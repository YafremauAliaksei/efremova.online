import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { audit, auditCountSince } from '@/lib/audit/log';
import { adminSessionIssuedAt, revokeAdminSessions } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { judgeWrite } from '@/lib/admin/limits';
import { recordSecurityEvent } from '@/lib/security/recorder';

/**
 * Дверь для каждого действия админки, которое что-то записывает.
 *
 * Сначала сессия, потом предел записей (src/lib/admin/limits.ts). Страницы
 * админки только читают и проверяют одну сессию — им предел не нужен.
 */
export async function requireAdminWrite(
  options: {
    /**
     * Действие, которое удаляет, а не создаёт. Переполнение его не держит:
     * отзыв согласия на отзыв (GDPR) исполняется всегда
     */
    deletes?: boolean;
  } = {}
): Promise<void> {
  const issuedAt = await adminSessionIssuedAt();
  if (issuedAt === null) redirect('/admin/denied');

  const [sinceSession, databaseBytes] = await Promise.all([
    auditCountSince(issuedAt),
    databaseSize(),
  ]);
  const verdict = judgeWrite({ sinceSession, databaseBytes });
  if (verdict.ok) return;

  // База разрослась — это не обязательно взлом: сайт продолжает работать,
  // админка перестаёт создавать новое, пока владелец не разберётся
  if (verdict.reason === 'full') {
    if (options.deletes === true) return;
    redirect('/admin/denied?reason=full');
  }

  await lockdown(sinceSession);
  redirect('/admin/denied?reason=limit');
}

/**
 * Авария: столько действий за сессию владелец не делает. Отзыв всех сессий,
 * запись в журнал и событие безопасности — одно на аварию, а не на каждый
 * следующий запрос: следующие запросы уже без сессии и сюда не доходят.
 */
async function lockdown(sinceSession: number): Promise<void> {
  await revokeAdminSessions();
  await audit('session.lockdown', null, { sinceSession });
  const headerList = await headers();
  await recordSecurityEvent({
    kind: 'ANOMALY',
    severity: 'CRITICAL',
    ip: headerList.get('cf-connecting-ip') ?? headerList.get('x-real-ip') ?? null,
    country: null,
    path: '/admin',
    details: { event: 'ADMIN_WRITE_LIMIT', sinceSession },
    count: 1,
  });
}

/** Размер базы в байтах: считает Postgres по файлам, а не перебором строк */
async function databaseSize(): Promise<number> {
  const rows = await db.$queryRaw<{ bytes: bigint }[]>`
    SELECT pg_database_size(current_database()) AS bytes`;
  return Number(rows[0]?.bytes ?? 0);
}
