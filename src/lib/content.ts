import 'server-only';
import { db } from '@/lib/db';
import { contentBlockDataSchema, i18nTextSchema } from '@/lib/content-schema';
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from '@/lib/i18n';

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
  /**
   * Язык, на котором текст на самом деле написан. Если перевода нет,
   * показывается русский — и страница помечает его lang="ru", чтобы
   * скринридер не читал русский текст польским произношением.
   */
  locale: Locale;
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
    locale: DEFAULT_LOCALE,
  },
  'about.main': {
    key: 'about.main',
    title: 'Обо мне',
    body: 'Блок «Обо мне» пока не заполнен.',
    data: {},
    locale: DEFAULT_LOCALE,
  },
  'approach.main': {
    key: 'approach.main',
    title: 'Подход к работе',
    body: 'Блок «Подход» пока не заполнен.',
    data: {},
    locale: DEFAULT_LOCALE,
  },
  'cta.main': {
    key: 'cta.main',
    title: 'Записаться на консультацию',
    body: 'Напишите на e-mail, указанный внизу страницы.',
    data: {},
    locale: DEFAULT_LOCALE,
  },
};

function fallback(key: string): ContentBlockData {
  return FALLBACK[key] ?? { key, title: null, body: null, data: {}, locale: DEFAULT_LOCALE };
}

/**
 * Блок на нужном языке. Нет перевода или он снят с публикации — русский
 * вариант; нет и его — заглушка. Пустое место на странице хуже текста
 * на другом языке: посетитель хотя бы видит, что раздел существует.
 */
export async function getContentBlock(key: string, locale: Locale): Promise<ContentBlockData> {
  try {
    const rows = await db.contentBlock.findMany({
      where: { key, locale: { in: [locale, DEFAULT_LOCALE] }, isPublished: true },
    });
    const block =
      rows.find((row) => row.locale === locale) ??
      rows.find((row) => row.locale === DEFAULT_LOCALE);
    if (block === undefined) return fallback(key);

    return {
      key: block.key,
      title: block.title,
      body: block.body,
      data: contentBlockDataSchema.parse(block.data),
      locale: block.locale === locale ? locale : DEFAULT_LOCALE,
    };
  } catch {
    // База недоступна — отдаём заглушку, а не падаем.
    // Сам сбой будет виден в /api/health и в мониторинге.
    return fallback(key);
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
 * никуда не уходит (docs/13, п.1.1).
 */
export async function getServices(region: string, locale: Locale): Promise<PublicService[]> {
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
      // JSON из базы — не обещание типа: испорченная запись даёт пустой перевод, а не 500
      const titles = i18nTextSchema.parse(service.titleI18n);
      const descriptions = i18nTextSchema.parse(service.descriptionI18n);
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

export function formatPrice(amountMinor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
