#!/usr/bin/env node
/**
 * Запуск Next.js с ограничением памяти.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ
 *
 * На машине разработчика 6 ГБ оперативной памяти, и одновременно работают
 * Docker Desktop (своя виртуальная машина), браузер и редактор. По умолчанию
 * Node.js считает, что памяти много, разгоняет кучу — и процесс падает
 * с «Fatal process out of memory» прямо посреди сборки.
 *
 * Явный лимит решает проблему: сборщик мусора начинает работать чаще,
 * сборка идёт немного медленнее, но не падает.
 *
 * Почему не просто «NODE_OPTIONS=... next dev»: такая запись работает
 * в Linux и macOS, но не в стандартной командной строке Windows.
 * Этот скрипт делает то же самое одинаково на всех системах и не требует
 * дополнительной зависимости (cross-env) — а каждая лишняя зависимость
 * в проекте с медицинскими данными это ещё и вопрос доверия к её автору.
 *
 * Использование: node scripts/run-next.mjs dev|build|start
 */

import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const command = process.argv[2] ?? 'dev';
const extraArgs = process.argv.slice(3);

/** Лимит кучи в мегабайтах. Меняется переменной NEXT_MEMORY_LIMIT_MB. */
const memoryLimitMb = process.env.NEXT_MEMORY_LIMIT_MB ?? '2048';

const nodeOptions = [process.env.NODE_OPTIONS ?? '', `--max-old-space-size=${memoryLimitMb}`]
  .join(' ')
  .trim();

console.log(`[run-next] ${command}, лимит памяти Node.js: ${memoryLimitMb} МБ`);

/**
 * ⚠️ ПОЧЕМУ `start` ЗАПУСКАЕТСЯ НЕ ЧЕРЕЗ `next start`
 *
 * В next.config.mjs включён `output: 'standalone'` — сборка кладёт в
 * .next/standalone самодостаточный сервер, и именно он уезжает в Docker-образ.
 * `next start` при таком режиме сам печатает предупреждение «does not work with
 * output: standalone» и поднимает ДРУГОЙ сервер: страницы он отдаёт, а
 * служебные маршруты метаданных (иконка сайта, манифест) теряет — они отвечают
 * 404, и <link rel="icon"> в разметку не попадает.
 *
 * Последствие было не теоретическим. Lighthouse и ZAP в CI проверяли сайт
 * через `npm start`, то есть проверяли сервер, которого нет ни в продакшене,
 * ни в образе. Lighthouse честно ловил ошибку 404 на /favicon.ico и валил
 * Best Practices до 0.96 — а добавление иконки этого не чинило, потому что
 * тот сервер её всё равно не отдавал.
 *
 * Это та же ошибка, что с порогом Hadolint: проверяем не то, что везём.
 * Правило проекта — локальный прогон, CI и продакшен обязаны работать
 * с одним и тем же артефактом.
 *
 * Подробнее о цикле проверок: docs/10-how-we-work.md.
 */
const standaloneServer = '.next/standalone/server.js';
const useStandalone = command === 'start' && existsSync(standaloneServer);

if (useStandalone) {
  // Сборка кладёт в .next/standalone только код сервера: статика и public
  // остаются снаружи, потому что в образе их копирует Dockerfile отдельными
  // слоями. Для локального запуска доносим их сами.
  for (const [from, to] of [
    ['.next/static', '.next/standalone/.next/static'],
    ['public', '.next/standalone/public'],
  ]) {
    if (existsSync(from)) cpSync(from, to, { recursive: true, force: true });
  }
  console.log('[run-next] запускаю standalone-сервер — тот же, что в Docker-образе');
} else if (command === 'start') {
  console.warn('[run-next] .next/standalone не найден: сначала `npm run build`');
}

// Запускаем сам файл Next.js через node, без shell.
// Так безопаснее (аргументы не склеиваются в строку командной оболочки)
// и одинаково работает на Windows, Linux и macOS.
const nextBin = require.resolve('next/dist/bin/next');

const child = spawn(
  process.execPath,
  useStandalone ? [standaloneServer] : [nextBin, command, ...extraArgs],
  {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  }
);

// Пробрасываем сигнал остановки дочернему процессу.
// Без этого Ctrl+C убивает только обёртку, а сам сервер остаётся висеть
// и держать порт 3000 — при следующем запуске будет EADDRINUSE.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal !== null) {
    console.error(`[run-next] процесс остановлен сигналом ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
