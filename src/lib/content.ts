import 'server-only';
import { db } from '@/lib/db';
import { i18nTextSchema } from '@/lib/content-schema';
import type { Locale } from '@/lib/i18n';
import { getCurrencySettings } from '@/lib/services/currency-settings';
import {
  currentPrices,
  orderCurrencies,
  priceHistory,
  visitorCurrency,
  type PricePeriod,
} from '@/lib/services/edit';

/**
 * Услуги и цены из базы для публичных страниц.
 *
 * Тексты страниц читает src/lib/pages.ts; здесь — только услуги. База
 * недоступна — пустой список, а не ошибка 500: посетитель хотя бы увидит
 * остальную страницу и контакты.
 *
 * Страна посетителя не читается: страница одна на всех и лежит в общем
 * кэше Cloudflare (docs/14). Валюту посетитель выбирает сам — адресом
 * ?currency=EUR, по умолчанию основная валюта из админки (PROJECT_LOG, задача 9a).
 */

export interface PublicService {
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  price: { amountMinor: number; currency: string } | null;
}

export interface PublicServices {
  services: PublicService[];
  /** Валюта, в которой показаны цены */
  currency: string;
  /** Валюты, в которых у видимых услуг есть цена — для переключателя */
  currencies: string[];
  /** Основная валюта сайта: её адрес — без ?currency */
  defaultCurrency: string;
}

/** Активные услуги с ценой в выбранной валюте; валюты нет — основная */
export async function getServices(
  locale: Locale,
  requestedCurrency: string | null
): Promise<PublicServices> {
  const now = new Date();
  const { defaultCurrency, enabled } = await getCurrencySettings();
  try {
    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        prices: {
          where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
        },
      },
    });

    const current = services.map((service) => currentPrices(service.prices, now));
    const currencies = orderCurrencies(
      current.flatMap((prices) => [...prices.keys()]),
      enabled
    );
    const currency = visitorCurrency(requestedCurrency, currencies, defaultCurrency);

    return {
      currency,
      currencies,
      defaultCurrency,
      services: services.map((service, index) => {
        // JSON из базы — не обещание типа: испорченная запись даёт пустой перевод, а не 500
        const titles = i18nTextSchema.parse(service.titleI18n);
        const descriptions = i18nTextSchema.parse(service.descriptionI18n);
        const price = current[index]?.get(currency);
        return {
          slug: service.slug,
          title: titles[locale] ?? titles.ru ?? service.slug,
          description: descriptions[locale] ?? descriptions.ru ?? '',
          durationMinutes: service.durationMinutes,
          price:
            price === undefined
              ? null
              : { amountMinor: price.amountMinor, currency: price.currency },
        };
      }),
    };
  } catch {
    return { services: [], currency: defaultCurrency, currencies: [], defaultCurrency };
  }
}

export interface ArchivedService {
  slug: string;
  title: string;
  currencies: { currency: string; periods: PricePeriod[] }[];
}

/**
 * Публичный архив цен: услуги, показанные на сайте, со всеми ценами по
 * датам — «в июне 2026 цена была такой-то». История неизменна: правку и
 * удаление запрещает база (миграция prices_by_currency).
 *
 * Скрытая услуга в архив не попадает: черновик, который посетитель ни разу
 * не видел, архивом не становится. История её цен остаётся в базе и
 * вернётся в архив вместе с услугой.
 */
export async function getPriceArchive(locale: Locale): Promise<ArchivedService[]> {
  const now = new Date();
  const { enabled } = await getCurrencySettings();
  try {
    const services = await db.service.findMany({
      where: { isActive: true, prices: { some: { validFrom: { lte: now } } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { prices: true },
    });
    return services.map((service) => {
      const titles = i18nTextSchema.parse(service.titleI18n);
      return {
        slug: service.slug,
        title: titles[locale] ?? titles.ru ?? service.slug,
        currencies: priceHistory(service.prices, now, enabled),
      };
    });
  } catch {
    return [];
  }
}
