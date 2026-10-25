import { CurrencySwitcher } from '@/components/CurrencySwitcher';
import type { PublicServices } from '@/lib/content';
import { localizedPath, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { formatPrice } from '@/lib/services/edit';

/**
 * Список услуг с ценой — один на главной и на странице услуг, чтобы
 * формат цены и длительности не расходился между ними. Над списком — выбор
 * валюты, под ним — ссылка на публичный архив цен.
 */
export function ServiceList({
  list,
  locale,
  path,
  headingLevel,
}: {
  list: PublicServices;
  locale: Locale;
  /** Адрес страницы со списком без языка — для ссылок выбора валюты */
  path: string;
  headingLevel: 'h2' | 'h3';
}) {
  const { services } = list;
  const t = messages(locale).services;
  const Heading = headingLevel;

  if (services.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
        {t.empty}
      </p>
    );
  }

  return (
    <div id="prices">
      <CurrencySwitcher
        path={localizedPath(locale, path)}
        currencies={list.currencies}
        current={list.currency}
        label={t.currencyNav}
      />
      <ul className="mt-8 space-y-4">
        {services.map((service) => (
          <li
            key={service.slug}
            className="rounded-lg border border-[var(--color-line)] bg-white p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Heading className="text-xl font-medium">{service.title}</Heading>
              <p className="text-lg font-semibold">
                {service.price === null
                  ? t.onRequest
                  : formatPrice(service.price.amountMinor, service.price.currency, locale)}
              </p>
            </div>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              {service.durationMinutes} {t.minutes}
            </p>
            {service.description !== '' && (
              <p className="mt-3 text-[var(--color-ink-soft)]">{service.description}</p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">
        <a
          href={localizedPath(locale, '/services/history')}
          className="underline underline-offset-4"
        >
          {t.archiveLink}
        </a>
      </p>
    </div>
  );
}
