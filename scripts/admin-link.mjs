#!/usr/bin/env node
/**
 * Выписывает одноразовую ссылку для входа в админку.
 *
 * ── КАК ЭТО РАБОТАЕТ И ПОЧЕМУ ТАК ─────────────────────────────────────────
 * Ссылку можно получить только здесь — в терминале того компьютера (или
 * сервера), где работает проект. Значит, чтобы войти в админку, нужен
 * доступ к серверу. Это и есть подтверждение личности: ни пароля, который
 * можно подобрать, ни письма, которое можно перехватить.
 *
 * Ссылка живёт 15 минут и срабатывает ровно один раз. В базе хранится
 * только её хеш — даже с дампом базы войти нельзя.
 *
 * Запуск:
 *   npm run admin:link                 для локальной разработки
 *   docker compose exec app node scripts/admin-link.mjs    на сервере
 */

import { createHash, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Начиная с Prisma 7 клиент не читает адрес базы из схемы: подключением
// занимается адаптер, а .env приходится загружать самим. Node умеет это
// встроенными средствами с версии 20.6, отдельная библиотека не нужна.
//
// Внутри контейнера файла .env нет — переменные приходят из окружения,
// поэтому его отсутствие не ошибка.
try {
  process.loadEnvFile('.env');
} catch {
  // .env отсутствует — значит, работаем в контейнере или в CI.
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const TTL_MINUTES = 15;

async function main() {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await db.adminLoginToken.create({ data: { tokenHash, issuedBy: 'cli', expiresAt } });
  const removed = await db.adminLoginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const url = `${baseUrl}/admin/enter?token=${token}`;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ССЫЛКА ДЛЯ ВХОДА В АДМИНКУ');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  ${url}\n`);
  console.log(`  Действует до: ${expiresAt.toLocaleTimeString()} (${String(TTL_MINUTES)} минут)`);
  console.log('  Срабатывает один раз.\n');
  console.log('  ⚠️ Не пересылайте её в мессенджерах и не сохраняйте:');
  console.log('     тот, у кого она окажется в ближайшие 15 минут, войдёт как вы.');
  console.log('     Нужна новая — просто выпишите ещё одну.\n');

  if (removed.count > 0) {
    console.log(`  (заодно удалено просроченных ссылок: ${String(removed.count)})\n`);
  }
}

main()
  .catch((error) => {
    console.error('\nНе удалось выписать ссылку.');
    console.error('Проверьте, что база запущена: npm run dev:db\n');
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
