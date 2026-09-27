import { defineConfig, devices } from '@playwright/test';

/**
 * Браузерные тесты: сайт и админка глазами человека, настоящими щелчками.
 *
 * Запуск: npm run test:e2e — нужна база с миграциями и сидом (npm run setup)
 * и собранный сайт (npm run build). Сервер тесты поднимают сами.
 *
 * Файлы — e2e/*.e2e.ts, а не *.test.ts: иначе их подхватил бы vitest.
 *
 * Один поток и ни одного повтора: тесты меняют одну и ту же базу, а повтор
 * упавшего теста прятал бы нестабильность вместо того, чтобы её показать.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  workers: 1,
  retries: 0,
  fullyParallel: false,
  forbidOnly: process.env.CI !== undefined,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['github']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    // Язык браузера — русский: без этого переброс с «/» зависел бы от машины
    locale: 'ru-RU',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    // В Docker-контейнере CI переменная HOSTNAME — имя контейнера, и сервер
    // Next.js слушал бы его адрес, а не localhost. Явно — все адреса,
    // как по умолчанию у самого Next.js
    env: { HOSTNAME: '0.0.0.0' },
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
