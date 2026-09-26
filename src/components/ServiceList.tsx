import { formatPrice, type PublicService } from '@/lib/content';
import type { Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';

/**
 * Список услуг с ценой — один на главной и на странице услуг, чтобы
 * формат цены и длительности не расходился между ними.
 */
export function ServiceList({
  services,
  locale,
  headingLevel,
}: {
  services: PublicService[];
  locale: Locale;
  headingLevel: 'h2' | 'h3';
}) {
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
  );
}
