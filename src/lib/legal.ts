import 'server-only';
import { db } from '@/lib/db';
import type { LegalSection } from '../../prisma/legal-content';

/**
 * Чтение правовых документов из базы.
 *
 * ⚖️ ЯЗЫК — ЭТО ЮРИДИЧЕСКОЕ ТРЕБОВАНИЕ, А НЕ УДОБСТВО
 * Владелец ведёт деятельность в Польше. Документы для потребителя должны быть
 * доступны на польском языке, поэтому польский здесь — язык по умолчанию,
 * а не «один из». Русская версия дополнительная.
 *
 * Прямая ссылка на конкретную языковую версию: /privacy?lang=pl
 * Ссылка на конкретный раздел:                 /privacy?lang=pl#auth
 */

export const SUPPORTED_LOCALES = ['pl', 'ru', 'en'] as const;

/** Правовые документы сайта-визитки: у каждого своя страница (LegalPage) */
export const LEGAL_SLUGS = ['privacy', 'terms', 'provider', 'site-terms'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Польский — язык по умолчанию по месту ведения деятельности */
export const DEFAULT_LOCALE: Locale = 'pl';

export const LOCALE_NAMES: Record<Locale, string> = {
  pl: 'Polski',
  ru: 'Русский',
  en: 'English',
};

/** Языковой тег для атрибутов lang и hreflang */
export const LOCALE_TAGS: Record<Locale, string> = {
  pl: 'pl-PL',
  ru: 'ru-RU',
  en: 'en',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Определяет язык документа.
 *
 * Приоритет: явный параметр в ссылке → язык браузера → польский.
 * Явный параметр важнее всего: ссылку на конкретную версию должно быть
 * возможно отправить, и она обязана открыться именно в этом языке.
 */
export function resolveLocale(param: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(param)) return param;

  if (acceptLanguage !== null) {
    // Простой разбор без библиотеки: "ru-RU,ru;q=0.9,en;q=0.8" → ru
    const preferred = acceptLanguage
      .split(',')
      .map((part) => part.split(';')[0]?.trim().slice(0, 2).toLowerCase())
      .find((code) => isLocale(code));
    if (isLocale(preferred)) return preferred;
  }

  return DEFAULT_LOCALE;
}

export interface LegalDocumentView {
  slug: string;
  locale: Locale;
  version: string;
  title: string;
  sections: LegalSection[];
  isDraft: boolean;
  publishedAt: Date;
  /** Языки, на которых этот документ реально существует в базе */
  availableLocales: Locale[];
}

/**
 * Действующая редакция документа на нужном языке.
 *
 * Если на запрошенном языке документа нет — отдаём польскую версию:
 * лучше показать документ на официальном языке, чем не показать никакой.
 * Факт подмены виден по полю locale в ответе.
 */
export async function getLegalDocument(
  slug: LegalSlug,
  locale: Locale
): Promise<LegalDocumentView | null> {
  try {
    const all = await db.legalDocument.findMany({
      where: { slug, isCurrent: true },
      orderBy: { publishedAt: 'desc' },
    });

    if (all.length === 0) return null;

    const availableLocales = all
      .map((doc) => doc.locale)
      .filter(isLocale)
      .sort();

    const chosen =
      all.find((doc) => doc.locale === locale) ??
      all.find((doc) => doc.locale === DEFAULT_LOCALE) ??
      all[0];

    if (chosen === undefined) return null;

    return {
      slug: chosen.slug,
      locale: isLocale(chosen.locale) ? chosen.locale : DEFAULT_LOCALE,
      version: chosen.version,
      title: chosen.title,
      sections: (chosen.sections ?? []) as unknown as LegalSection[],
      isDraft: chosen.isDraft,
      publishedAt: chosen.publishedAt,
      availableLocales: [...new Set(availableLocales)],
    };
  } catch {
    // База недоступна — страница не должна падать целиком
    return null;
  }
}
