#!/usr/bin/env node
/**
 * Проверка заголовков безопасности на локально поднятом контейнере.
 *
 * ── Зачем этот файл ───────────────────────────────────────────────────────
 *
 * scripts/check-security-headers.mjs умеет проверять работающий сайт, но сам
 * сайт не поднимает. В конвейере его запускает задача DAST, которая перед этим
 * собирает приложение и стартует сервер. Локально такого шага не было вовсе:
 * из десяти проверок npm run ci ни одна не трогала заголовки.
 *
 * Получалось, что БЛОКИРУЮЩАЯ проверка требования №5 из CLAUDE.md (no-store
 * и noindex для кабинета) выполнялась только на GitHub — то есть узнать её
 * вердикт можно было исключительно после отправки кода. Ровно та болезнь,
 * ради лечения которой написан scripts/ci-local.mjs.
 *
 * ── Почему через контейнер, а не npm start ────────────────────────────────
 *
 * Проверять надо то, что поедет на сервер. Контейнер поднимается из того же
 * образа, с тем же пользователем, той же файловой системой только для чтения
 * и той же обвязкой переменных, что и в docker-compose.yml. Запуск через
 * npm start проверял бы похожее, но другое — а мы сегодня уже обожглись на
 * разнице между `next start` и standalone-сервером (см. scripts/run-next.mjs).
 *
 * ── Что остаётся после прогона ────────────────────────────────────────────
 *
 * Останавливается только сервис app. Postgres и Redis продолжают работать:
 * они нужны для повседневной разработки, и гасить их ради одной проверки —
 * значит заставлять ждать их повторного старта.
 *
 * Запуск:  node scripts/check-headers-local.mjs
 */

import { spawnSync } from 'node:child_process';

const URL_TO_CHECK = 'http://localhost:3000';
const READY_TIMEOUT_MS = 180_000;
const COMPOSE = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml'];

/** Запуск без командной оболочки: аргументы не склеиваются в исполняемую строку. */
function docker(args, { quiet = true } = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    maxBuffer: 20 * 1024 * 1024,
  });
}

/** Ждём, пока сайт начнёт отвечать. Контейнер стартует не мгновенно. */
async function waitUntilReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(URL_TO_CHECK, { redirect: 'manual' });
      // Любой ответ означает, что сервер слушает порт. Код здесь неважен:
      // заголовки проверяет следующий шаг, он же и решает, что с ними не так.
      if (response.status > 0) return true;
    } catch {
      // Соединение ещё не принимается — это ожидаемо, пробуем снова.
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

console.log('Поднимаю приложение в контейнере (тот же образ, что поедет на сервер)...');

const up = docker([...COMPOSE, 'up', '-d', '--build', 'app']);

if (up.status !== 0) {
  console.error('Не удалось поднять контейнер. Запущен ли Docker Desktop?\n');
  console.error(up.stderr ?? up.stdout ?? '');
  process.exit(1);
}

const ready = await waitUntilReady();

if (!ready) {
  console.error(`Сайт не ответил за ${String(READY_TIMEOUT_MS / 1000)} с. Логи контейнера:\n`);
  const logs = docker([...COMPOSE, 'logs', '--tail', '40', 'app']);
  console.error(logs.stdout ?? logs.stderr ?? '');
  docker([...COMPOSE, 'stop', 'app']);
  process.exit(1);
}

console.log('Сайт отвечает, проверяю заголовки.\n');

const check = spawnSync(process.execPath, ['scripts/check-security-headers.mjs', URL_TO_CHECK], {
  stdio: 'inherit',
});

// Гасим только app: база и Redis нужны для повседневной работы.
docker([...COMPOSE, 'stop', 'app']);

process.exit(check.status ?? 1);
