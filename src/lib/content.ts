import 'server-only';
import { db } from '@/lib/db';

/**
 * Чтение текстов сайта из базы.
 *
 * Ключевое требование: сайт должен подниматься и выглядеть осмысленно
 * ДАЖЕ если база пуста или недоступна. Это нужно по трём причинам:
 *   1. Любой человек может склонировать публичный репозиторий и запустить —
 *      он увидит работающий сайт с заглушками, а не стену ошибок.
 *   2. Сбой базы не должен превращать главную страницу в 500 —
 *      посетитель хотя бы увидит контакты.
 *   3. В репозитории нет ни одного настоящего текста владельца,
 *      значит и утечь из репозитория нечему.
 */

export interface ContentBlockData {
  key: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
}

/** Нейтральные заглушки. Настоящие тексты живут только в базе на сервере. */
const FALLBACK: Record<string, ContentBlockData> = {
  'hero.main': {
    key: 'hero.main',
    title: 'Психологические консультации онлайн',
    body: 'Содержимое этого блока ещё не заполнено в базе данных. Выполните «npm run db:seed» или отредактируйте текст в админке.',
    data: {},
  },
  'about.main': {
    key: 'about.main',
    title: 'Обо мне',
    body: 'Блок «Обо мне» пока не заполнен.',
    data: {},
  },
  'approach.main': {
    key: 'approach.main',
    title: 'Подход к работе',
    body: 'Блок «Подход» пока не заполнен.',
    data: {},
  },
  'cta.main': {
    key: 'cta.main',
    title: 'Записаться на консультацию',
    body: 'Выберите удобное время в личном кабинете.',
    data: {},
  },
};

export async function getContentBlock(key: string, locale = 'ru'): Promise<ContentBlockData> {
  try {
    const block = await db.contentBlock.findUnique({
      where: { key_locale: { key, locale } },
    });

    if (block?.isPublished !== true) {
      return FALLBACK[key] ?? { key, title: null, body: null, data: {} };
    }

    return {
      key: block.key,
      title: block.title,
      body: block.body,
      data: (block.data ?? {}) as Record<string, unknown>,
    };
  } catch {
    // База недоступна — отдаём заглушку, а не падаем.
    // Сам сбой будет виден в /api/health и в мониторинге.
    return FALLBACK[key] ?? { key, title: null, body: null, data: {} };
  }
}

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
 * никуда не уходит (docs/08, п.3).
 */
export async function getServices(region: string, locale = 'ru'): Promise<PublicService[]> {
  try {
    const services = await db.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        prices: {
          where: { OR: [{ region }, { region: 'DEFAULT' }] },
          orderBy: { validFrom: 'desc' },
        },
      },
    });

    return services.map((service) => {
      const titles = service.titleI18n as Record<string, string>;
      const descriptions = service.descriptionI18n as Record<string, string>;
      // Цена для конкретного региона приоритетнее общей
      const price = service.prices.find((p) => p.region === region) ?? service.prices[0] ?? null;

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

export function formatPrice(amountMinor: number, currency: string, locale = 'ru'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
