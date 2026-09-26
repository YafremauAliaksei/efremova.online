import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { i18nTextSchema } from '@/lib/content-schema';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n';
import { HOME_SLUG, isPageSlug } from '@/lib/blocks/pages';
import { toRenderable, type RenderableBlock, type StoredBlock } from '@/lib/blocks/registry';

/**
 * Страницы и меню из базы для публичной части.
 *
 * Сайт обязан подниматься, даже если база пуста или недоступна: любой может
 * склонировать публичный репозиторий и запустить его, а сбой базы не должен
 * превращать главную в ошибку 500. Поэтому у главной есть заглушка, а меню
 * без базы просто короче.
 */

export interface PublicPage {
  slug: string;
  title: string | null;
  description: string | null;
  blocks: RenderableBlock[];
}

export interface NavItem {
  slug: string;
  title: string;
  inHeader: boolean;
  inFooter: boolean;
}

/** Нейтральная заглушка главной. Настоящие тексты живут только в базе на сервере. */
const FALLBACK_HOME: StoredBlock[] = [
  {
    id: 'fallback-hero',
    type: 'hero',
    content: {
      ru: {
        title: 'Психологические консультации онлайн',
        body: 'Страница ещё не заполнена в базе данных. Выполните «npm run db:seed» или добавьте блоки в админке.',
      },
      pl: {
        title: 'Konsultacje psychologiczne online',
        body: 'Strona nie została jeszcze uzupełniona w bazie danych.',
      },
      en: {
        title: 'Online psychological consultations',
        body: 'This page has not been filled in the database yet.',
      },
    },
    data: {},
    style: { align: 'center' },
  },
];

/** Перевод из JSON-поля: язык страницы, иначе русский, иначе ничего */
function localized(json: unknown, locale: Locale): string | null {
  const texts = i18nTextSchema.parse(json);
  return texts[locale] ?? texts[DEFAULT_LOCALE] ?? null;
}

function renderable(rows: StoredBlock[], locale: Locale): RenderableBlock[] {
  return rows
    .map((row) => toRenderable(row, locale))
    .filter((block): block is RenderableBlock => block !== null);
}

function fallback(slug: string, locale: Locale): PublicPage | null {
  if (slug !== HOME_SLUG) return null;
  return { slug, title: null, description: null, blocks: renderable(FALLBACK_HOME, locale) };
}

/**
 * Опубликованная страница с опубликованными блоками по порядку. null —
 * такой страницы нет: неизвестный адрес, снята с публикации или в архиве.
 * cache(): метаданные и сама страница спрашивают базу один раз.
 */
export const getPublicPage = cache(
  async (slug: string, locale: Locale): Promise<PublicPage | null> => {
    if (!isPageSlug(slug)) return null;
    try {
      const page = await db.page.findFirst({
        where: { slug, isPublished: true, archivedAt: null },
        include: {
          blocks: {
            where: { isPublished: true, archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      });
      if (page === null) return fallback(slug, locale);

      return {
        slug,
        title: localized(page.titleI18n, locale),
        description: localized(page.descriptionI18n, locale),
        blocks: renderable(page.blocks, locale),
      };
    } catch {
      // База недоступна — сбой виден в /api/health и в мониторинге
      return fallback(slug, locale);
    }
  }
);

/** Страницы из базы для шапки и подвала, по порядку, с названием на языке */
export const getNavigation = cache(async (locale: Locale): Promise<NavItem[]> => {
  try {
    const pages = await db.page.findMany({
      where: {
        isPublished: true,
        archivedAt: null,
        OR: [{ showInHeader: true }, { showInFooter: true }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { slug: true, titleI18n: true, showInHeader: true, showInFooter: true },
    });
    return pages.map((page) => ({
      slug: page.slug,
      title: localized(page.titleI18n, locale) ?? page.slug,
      inHeader: page.showInHeader,
      inFooter: page.showInFooter,
    }));
  } catch {
    return [];
  }
});

/** Адреса всех опубликованных страниц — для sitemap.xml */
export async function getPublishedSlugs(): Promise<string[]> {
  try {
    const pages = await db.page.findMany({
      where: { isPublished: true, archivedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true },
    });
    return pages.map((page) => page.slug);
  } catch {
    return [];
  }
}
