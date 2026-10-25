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

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function AdminDeniedPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Нет доступа</h1>
      {/* Отказ после входа, а не на входе: подсказывать здесь нечего тому,
          кто подбирает ссылки, — сессия у него уже была */}
      {reason === 'limit' ? (
        <p className="mt-4 text-[var(--color-ink-soft)]">
          Слишком много изменений подряд — так работает скрипт, а не человек. Все сессии закрыты.
          Если это были не вы, cookie админки мог попасть в чужие руки: войдите заново и посмотрите
          «Журнал».
        </p>
      ) : reason === 'full' ? (
        <p className="mt-4 text-[var(--color-ink-soft)]">
          База сайта превысила свой предел, и админка больше ничего не сохраняет. Сайт работает.
          Проверьте «Журнал» и место на сервере.
        </p>
      ) : (
        <p className="mt-4 text-[var(--color-ink-soft)]">
          Ссылка не подошла. Выпишите новую командой в терминале:
        </p>
      )}
      {reason !== 'full' && (
        <p className="mt-4">
          <code className="rounded bg-[var(--color-paper-alt)] px-3 py-2">npm run admin:link</code>
        </p>
      )}
    </main>
  );
}
