import type { Metadata } from 'next';

/**
 * Отказ во входе в админку.
 *
 * ⚠️ Страница намеренно НИЧЕГО не объясняет: «ссылка просрочена»,
 * «уже использована» и «не существует» выглядят одинаково. Иначе тот,
 * кто подбирает ссылки, получил бы подсказку, какая из них была настоящей.
 * Владелец и так знает, что делать: выписать новую.
 */

export const metadata: Metadata = {
  title: 'Нет доступа',
  robots: { index: false, follow: false },
};

export default function AdminDeniedPage() {
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Нет доступа</h1>
      <p className="mt-4 text-[var(--color-ink-soft)]">
        Ссылка не подошла. Выпишите новую командой в терминале:
      </p>
      <p className="mt-4">
        <code className="rounded bg-[var(--color-paper-alt)] px-3 py-2">npm run admin:link</code>
      </p>
    </main>
  );
}
