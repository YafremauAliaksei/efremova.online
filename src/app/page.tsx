import Link from 'next/link';
import { headers } from 'next/headers';
import { formatPrice, getContentBlock, getServices } from '@/lib/content';

/**
 * Главная страница.
 *
 * Все тексты и цены приходят из базы (docs/06): в этом файле нет
 * ни одного личного слова владельца — только разметка.
 *
 * ⚠️ Пока страница читает регион из заголовка, она динамическая.
 * В Sprint 1 её переведут на статическую сборку с отдельным
 * клиентским переключателем валюты — это даст LCP около 30 мс (docs/04).
 */

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const headerList = await headers();
  // Страну сообщает Cloudflare. Никаких сторонних geo-IP сервисов:
  // иначе IP посетителя утекал бы третьей стороне (docs/08).
  const region = headerList.get('cf-ipcountry') ?? 'DEFAULT';

  const [hero, about, approach, cta, services] = await Promise.all([
    getContentBlock('hero.main'),
    getContentBlock('about.main'),
    getContentBlock('approach.main'),
    getContentBlock('cta.main'),
    getServices(region),
  ]);

  return (
    <main id="main">
      {/* ЭКРАН 1 — Первое впечатление */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{hero.title}</h1>
        {hero.body !== null && (
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-ink-soft)]">{hero.body}</p>
        )}
        <Link
          href="/login"
          className="mt-10 inline-block rounded-lg bg-[var(--color-accent)] px-8 py-4 font-medium text-white transition-colors hover:bg-[#3d594d]"
        >
          Записаться на консультацию
        </Link>
      </section>

      {/* ЭКРАН 2 — Обо мне */}
      <section className="bg-[var(--color-paper-alt)]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold">{about.title}</h2>
          {about.body !== null && (
            <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{about.body}</p>
          )}
        </div>
      </section>

      {/* ЭКРАН 3 — Подход */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-semibold">{approach.title}</h2>
        {approach.body !== null && (
          <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{approach.body}</p>
        )}
      </section>

      {/* ЭКРАН 4 — Услуги и цены */}
      <section className="bg-[var(--color-paper-alt)]">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-3xl font-semibold">Услуги</h2>

          {services.length === 0 ? (
            <p className="mt-6 text-[var(--color-ink-soft)]">
              Список услуг пока не заполнен. Выполните <code>npm run db:seed</code> для демо-данных.
            </p>
          ) : (
            <ul className="mt-8 space-y-4">
              {services.map((service) => (
                <li
                  key={service.slug}
                  className="rounded-lg border border-[var(--color-line)] bg-white p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-xl font-medium">{service.title}</h3>
                    <p className="text-lg font-semibold">
                      {service.price === null
                        ? 'по запросу'
                        : formatPrice(service.price.amountMinor, service.price.currency)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    {service.durationMinutes} минут
                  </p>
                  {service.description !== '' && (
                    <p className="mt-3 text-[var(--color-ink-soft)]">{service.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ЭКРАН 5 — Призыв к действию */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold">{cta.title}</h2>
        {cta.body !== null && <p className="mt-4 text-[var(--color-ink-soft)]">{cta.body}</p>}
        <Link
          href="/login"
          className="mt-8 inline-block rounded-lg bg-[var(--color-accent)] px-8 py-4 font-medium text-white transition-colors hover:bg-[#3d594d]"
        >
          Войти в личный кабинет
        </Link>
      </section>

      <footer className="border-t border-[var(--color-line)]">
        <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--color-ink-soft)]">
          <nav aria-label="Правовая информация">
            <ul className="flex flex-wrap gap-6">
              <li>
                <Link href="/privacy" className="underline underline-offset-4">
                  Политика конфиденциальности
                </Link>
              </li>
              <li>
                <Link href="/terms" className="underline underline-offset-4">
                  Публичная оферта
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </main>
  );
}
