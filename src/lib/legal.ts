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

/** Редакция в списке под документом: ссылка ?ver= на неё */
export interface LegalRevisionLink {
  ver: string;
  publishedAt: Date;
  isDraft: boolean;
  isCurrent: boolean;
}

export interface LegalDocumentView {
  slug: string;
  locale: Locale;
  version: string;
  /** Ключ редакции в адресе: ?ver=2026-06-11 */
  ver: string;
  title: string;
  sections: LegalSection[];
  isDraft: boolean;
  publishedAt: Date;
  /** Показана действующая редакция или одна из прежних */
  isCurrent: boolean;
  /** Действующая редакция — для плашки «эта устарела» */
  current: LegalRevisionLink;
  /** Все редакции на этом языке, новые первыми */
  revisions: LegalRevisionLink[];
  /** Языки, на которых этот документ реально существует в базе */
  availableLocales: Locale[];
}

export type LegalLookup =
  | { kind: 'found'; document: LegalDocumentView }
  /** Адрес без ?ver= — переброс на действующую редакцию */
  | { kind: 'redirect'; ver: string }
  /** Такой редакции нет — 404 со ссылкой на действующую */
  | { kind: 'unknownVersion'; current: LegalRevisionLink }
  /** Документа нет или база недоступна */
  | { kind: 'missing' };

/**
 * Вид ключа редакции в адресе: дата и, если редакций за день несколько,
 * номер; у редакций из сида — «-draft» (prisma/legal/*.ts). Двумя простыми
 * проверками, а не одним выражением с необязательной группой
 */
function isVerKey(ver: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ver.slice(0, 10))) return false;
  const suffix = ver.slice(10);
  return suffix === '' || /^-[a-z0-9]{1,12}$/.test(suffix);
}
/** Сколько прежних редакций показывать списком — их рост ограничен (п.3.1) */
const REVISIONS_SHOWN = 200;

/**
 * «privacy-2026-06-11-2» → «2026-06-11-2»: имя редакции (nextVersion в
 * src/lib/legal-text.ts) — документ и дата публикации UTC
 */
export function versionKey(slug: string, version: string): string {
  return version.startsWith(`${slug}-`) ? version.slice(slug.length + 1) : version;
}

/**
 * Редакция документа на нужном языке.
 *
 * Адрес документа всегда указывает редакцию (?ver=…): ссылка, которую
 * человек сохранил или отправил, через год открывает тот же текст, а не
 * сегодняшний — с плашкой «устарела» и ссылкой на действующую. Адрес без
 * ?ver= перебрасывает на действующую.
 *
 * Если на запрошенном языке документа нет — отдаём польскую версию:
 * лучше показать документ на официальном языке, чем не показать никакой.
 * Факт подмены виден по полю locale в ответе; ?ver= — редакции этого языка.
 */
export async function getLegalDocument(
  slug: LegalSlug,
  locale: Locale,
  ver: string | null
): Promise<LegalLookup> {
  try {
    const all = await db.legalDocument.findMany({
      where: { slug, isCurrent: true },
      select: { locale: true },
    });
    const locales = [...new Set(all.map((doc) => doc.locale).filter(isLocale))].sort();
    const chosen = locales.includes(locale)
      ? locale
      : locales.includes(LEGAL_FALLBACK_LOCALE)
        ? LEGAL_FALLBACK_LOCALE
        : locales[0];
    if (chosen === undefined) return { kind: 'missing' };

    const rows = await db.legalDocument.findMany({
      where: { slug, locale: chosen },
      select: { version: true, publishedAt: true, isDraft: true, isCurrent: true },
      orderBy: { publishedAt: 'desc' },
      take: REVISIONS_SHOWN,
    });
    const revisions = rows.map((row) => ({
      ver: versionKey(slug, row.version),
      publishedAt: row.publishedAt,
      isDraft: row.isDraft,
      isCurrent: row.isCurrent,
    }));
    const current = revisions.find((revision) => revision.isCurrent);
    if (current === undefined) return { kind: 'missing' };

    if (ver === null) return { kind: 'redirect', ver: current.ver };
    const target = isVerKey(ver) ? revisions.find((revision) => revision.ver === ver) : undefined;
    if (target === undefined) return { kind: 'unknownVersion', current };

    const doc = await db.legalDocument.findFirst({
      where: { slug, locale: chosen, version: `${slug}-${target.ver}` },
    });
    if (doc === null) return { kind: 'unknownVersion', current };

    return {
      kind: 'found',
      document: {
        slug: doc.slug,
        locale: chosen,
        version: doc.version,
        ver: target.ver,
        title: doc.title,
        sections: (doc.sections ?? []) as unknown as LegalSection[],
        isDraft: doc.isDraft,
        publishedAt: doc.publishedAt,
        isCurrent: doc.isCurrent,
        current,
        revisions,
        availableLocales: locales,
      },
    };
  } catch {
    // База недоступна — страница не должна падать целиком
    return { kind: 'missing' };
  }
}
