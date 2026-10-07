import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/AdminNav';
import { auditLabel } from '@/lib/audit/actions';
import { checkAuditChain, recentAudit } from '@/lib/audit/log';
import { isAdmin } from '@/lib/auth/admin';

/**
 * Журнал действий (задача 13): что и когда менялось в админке.
 *
 * Только чтение: записи не правятся и не удаляются ни отсюда, ни из базы
 * (триггер в миграции audit_log_append_only). Сверху — проверка цепочки
 * хешей: если кто-то правил журнал в обход приложения, здесь это видно.
 */

export const metadata: Metadata = {
  title: 'Журнал действий',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SHOWN = 200;

function details(metadata: unknown): string {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  return Object.entries(metadata as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
    .join(' · ');
}

export default async function JournalPage() {
  if (!(await isAdmin())) redirect('/admin/denied');

  const [chain, rows] = await Promise.all([checkAuditChain(), recentAudit(SHOWN)]);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Страницы и тексты
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Журнал действий</h1>
      <AdminNav current="/admin/journal" />

      {chain.ok ? (
        <p className="mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm">
          Цепочка цела: {chain.count} записей.
          {chain.lastHash !== null && (
            <>
              {' '}
              Последний отпечаток:{' '}
              <code data-testid="journal-hash">{chain.lastHash.slice(0, 16)}</code> — если записать
              его где-то вне сервера, подмену всего журнала тоже будет видно.
            </>
          )}
        </p>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          Цепочка журнала нарушена на записи <code>{chain.brokenAt}</code>: журнал правили в обход
          админки. Это признак взлома базы — смените секреты в <code>.env</code> и проверьте сервер.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--color-ink-soft)]">Записей пока нет.</p>
      ) : (
        <table className="mt-6 w-full text-left text-sm">
          <caption className="sr-only">Последние {SHOWN} действий, новые сверху</caption>
          <thead className="text-[var(--color-ink-soft)]">
            <tr>
              <th scope="col" className="py-2 pr-4 font-normal">
                Когда (UTC)
              </th>
              <th scope="col" className="py-2 pr-4 font-normal">
                Действие
              </th>
              <th scope="col" className="py-2 font-normal">
                Подробности
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--color-line)] align-top">
                <td className="py-2 pr-4 whitespace-nowrap">
                  <time dateTime={row.createdAt.toISOString()}>
                    {row.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                  </time>
                </td>
                <td className="py-2 pr-4">{auditLabel(row.action)}</td>
                <td className="py-2 break-all text-[var(--color-ink-soft)]">
                  {details(row.metadata)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
