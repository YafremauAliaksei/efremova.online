#!/usr/bin/env node
/**
 * Запуск ESLint с ограничением памяти.
 *
 * ── Зачем этот файл существует ────────────────────────────────────────────
 *
 * На машине разработчика 6 ГБ оперативной памяти, и часть её занимает Docker
 * (postgres, redis, сборка образа). ESLint в этом проекте проверяет типы — то
 * есть держит в памяти всё дерево типов приложения, включая сгенерированный
 * клиент Prisma на три десятка моделей. В какой-то момент этого стало больше,
 * чем система готова отдать одному процессу, и линтер начал падать:
 *
 *     FATAL ERROR: Zone Allocation failed - process out of memory
 *
 * Это падение не про код: `tsc`, тесты и Prettier на том же проекте проходят.
 * Ломается именно линтер, и ломается он у ВСЕХ проверок сразу — `npm run verify`
 * перед коммитом и `npm run ci` перед push. То есть без этого файла по правилам
 * проекта нельзя сделать ни одного коммита.
 *
 * Явный лимит кучи решает проблему: V8 перестаёт разгоняться в расчёте на
 * несуществующую память и чаще собирает мусор. Линтер работает немного дольше,
 * но доходит до конца. Тот же приём и по той же причине применён к сборке
 * Next.js — см. scripts/run-next.mjs и PROJECT_LOG → «Особенность этой машины».
 *
 * ── Почему не просто NODE_OPTIONS=... npx eslint ───────────────────────────
 *
 * Такая запись работает в Linux и macOS, но не в стандартной командной строке
 * Windows. Отдельная зависимость (cross-env) ради одной переменной — лишняя
 * дверь в проекте с медицинскими данными (CLAUDE.md, правило 8).
 *
 * ── Почему путь к ESLint не прибит гвоздями ────────────────────────────────
 *
 * Путь берётся из поля `bin` в package.json самого ESLint. Прямая ссылка вида
 * node_modules/eslint/bin/eslint.js работала бы сегодня и сломалась бы на
 * следующей мажорной версии — а переход на ESLint 10 у нас в планах.
 *
 * Использование:  node scripts/run-eslint.mjs [аргументы ESLint]
 * Лимит меняется переменной LINT_MEMORY_LIMIT_MB.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

/** Лимит кучи в мегабайтах. 1536 подобрано опытом: 2048 на этой машине падало. */
const memoryLimitMb = process.env.LINT_MEMORY_LIMIT_MB ?? '1536';

// Спрашиваем у самого ESLint, где лежит его исполняемый файл.
const eslintPackageJson = require.resolve('eslint/package.json');
const eslintPackage = require('eslint/package.json');
const binField = eslintPackage.bin;
const binRelative = typeof binField === 'string' ? binField : binField.eslint;
const eslintBin = resolve(dirname(eslintPackageJson), binRelative);

// Запускаем через node напрямую, без командной оболочки: аргументы не склеиваются
// в строку, которую кто-то станет разбирать. Та же причина, что в ci-local.mjs.
const child = spawn(
  process.execPath,
  [`--max-old-space-size=${memoryLimitMb}`, eslintBin, ...process.argv.slice(2)],
  { stdio: 'inherit' }
);

// Пробрасываем сигнал остановки дочернему процессу: иначе Ctrl+C убьёт обёртку,
// а линтер продолжит жить и держать память.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('exit', (code, signal) => {
  if (signal !== null) {
    console.error(`[run-eslint] процесс остановлен сигналом ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
