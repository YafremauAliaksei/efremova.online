import 'server-only';
import { db } from '@/lib/db';
import { isLocale, type Locale } from '@/lib/i18n';
import type { LegalSection } from '../../prisma/legal-content';

/**
 * Чтение правовых документов из базы.
 *
 * ⚖️ ЯЗЫК — ЭТО ЮРИДИЧЕСКОЕ ТРЕБОВАНИЕ, А НЕ УДОБСТВО
 * Владелец ведёт деятельность в Польше. Документы для потребителя должны быть
 * доступны на польском языке, поэтому польский здесь — запасной язык,
 * а не «один из». Русская версия дополнительная.
 *
 * Прямая ссылка на конкретную языковую версию: /pl/privacy
 * Ссылка на конкретный раздел:                 /pl/privacy#cookies
 */

/** Правовые документы сайта-визитки: у каждого своя страница (LegalPage) */
export const LEGAL_SLUGS = ['privacy', 'terms', 'provider', 'site-terms'] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/**
 * Запасной язык документа — польский, по месту ведения деятельности. Сайт
 * по умолчанию русский, но документ, которого нет на русском, показывается
 * на официальном языке, а не пропадает.
 */
export const LEGAL_FALLBACK_LOCALE: Locale = 'pl';

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
      all.find((doc) => doc.locale === LEGAL_FALLBACK_LOCALE) ??
      all[0];

    if (chosen === undefined) return null;

    return {
      slug: chosen.slug,
      locale: isLocale(chosen.locale) ? chosen.locale : LEGAL_FALLBACK_LOCALE,
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
