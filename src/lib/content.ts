import 'server-only';
import { db } from '@/lib/db';
import { i18nTextSchema } from '@/lib/content-schema';
import type { Locale } from '@/lib/i18n';
import { DEFAULT_REGION, normalizeRegion, pickPrice } from '@/lib/services/edit';

/**
 * Услуги и цены из базы для публичных страниц.
 *
 * Тексты страниц читает src/lib/pages.ts; здесь — только услуги. База
 * недоступна — пустой список, а не ошибка 500: посетитель хотя бы увидит
 * остальную страницу и контакты.
 */

export interface PublicService {
  slug: string;
  title: string;
  description: string;
  durationMinutes: number;
  price: { amountMinor: number; currency: string } | null;
}

/**
 * Услуги с ценой под регион посетителя.
 *
 * Регион определяется по заголовку CF-IPCountry от Cloudflare — то есть
 * никакие сторонние сервисы геолокации не вызываются и IP посетителя
 * никуда не уходит (docs/13, п.1.1).
 */
export async function getServices(region: string, locale: Locale): Promise<PublicService[]> {
  // Заголовок приходит снаружи: «pl», мусор или его отсутствие — общая цена
  const visitorRegion = normalizeRegion(region) ?? DEFAULT_REGION;
  const now = new Date();
  try {
    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        prices: {
          where: {
            region: { in: [visitorRegion, DEFAULT_REGION] },
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
          },
        },
      },
    });

    return services.map((service) => {
      // JSON из базы — не обещание типа: испорченная запись даёт пустой перевод, а не 500
      const titles = i18nTextSchema.parse(service.titleI18n);
      const descriptions = i18nTextSchema.parse(service.descriptionI18n);
      const price = pickPrice(service.prices, visitorRegion, now);

      return {
        slug: service.slug,
        title: titles[locale] ?? titles.ru ?? service.slug,
        description: descriptions[locale] ?? descriptions.ru ?? '',
        durationMinutes: service.durationMinutes,
        price: price === null ? null : { amountMinor: price.amountMinor, currency: price.currency },
      };
    });
  } catch {
    return [];
  }
}
