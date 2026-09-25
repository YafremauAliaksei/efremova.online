import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { formatPrice, getServices } from '@/lib/content';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Страница услуг и цен.
 *
 * Цены приходят из базы и зависят от региона посетителя. Регион определяется
 * по заголовку Cloudflare — никаких сторонних geo-IP сервисов, чтобы IP
 * посетителя не уходил третьей стороне (docs/13, п.1.1).
 */

export const metadata: Metadata = {
  title: 'Услуги и цены',
  description:
    'Форматы консультаций, длительность и стоимость. Цена показывается в валюте вашего региона.',
};

export const dynamic = 'force-dynamic';

export default async function ServicesPage() {
  const headerList = await headers();
  const region = headerList.get('cf-ipcountry') ?? 'DEFAULT';
  const services = await getServices(region);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">Услуги и цены</h1>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          Указана итоговая цена в валюте вашего региона. Порядок оплаты, переноса и отмены — в{' '}
          <Link href="/terms" className="underline underline-offset-4">
            условиях консультаций
          </Link>
          .
        </p>

        {services.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
            Список услуг пока не заполнен. Для локальной разработки выполните{' '}
            <code>npm run db:seed</code>.
          </p>
        ) : (
          <ul className="mt-10 space-y-4">
            {services.map((service) => (
              <li
                key={service.slug}
                className="rounded-lg border border-[var(--color-line)] bg-white p-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-xl font-medium">{service.title}</h2>
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

        {/* Здесь была кнопка «Выбрать время», которая вела в личный кабинет.
            Кабинет переехал на отдельный поддомен и пока не существует, а ссылка
            в никуда хуже её отсутствия. Кнопка вернётся в ветке feat/contacts
            и поведёт на страницу контактов. */}
      </main>
      <SiteFooter />
    </>
  );
}
