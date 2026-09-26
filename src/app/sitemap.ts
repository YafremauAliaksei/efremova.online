import type { MetadataRoute } from 'next';
import { HOME_SLUG, pagePath } from '@/lib/blocks/pages';
import { LOCALES, LOCALE_TAGS, localizedPath } from '@/lib/i18n';
import { getPublishedSlugs } from '@/lib/pages';

/**
 * sitemap.xml — карта сайта для поисковых систем.
 *
 * Страницы из базы берутся выборкой, а не списком, набранным руками:
 * страницу, заведённую в админке, забыть дописать невозможно. Руками —
 * только страницы, у которых есть свой код.
 *
 * В карту попадают ТОЛЬКО публичные страницы. Кабинет и служебные адреса
 * не индексируются, и их здесь быть не должно.
 */
/** Страницы со своим кодом: адрес без языка, частота, вес */
const CODE_PAGES = [
  ['/services', 'weekly', 0.9],
  ['/privacy', 'yearly', 0.3],
  ['/terms', 'yearly', 0.3],
  ['/site-terms', 'yearly', 0.2],
  ['/provider', 'yearly', 0.2],
] as const;

/** Карта строится из базы на каждый запрос: новая страница попадает в неё сама */
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const now = new Date();

  // Страницы из базы: главная важнее остальных
  const fromDatabase = (await getPublishedSlugs()).map(
    (slug) => [pagePath(slug), 'monthly', slug === HOME_SLUG ? 1 : 0.8] as const
  );

  // changeFrequency и priority — это подсказки, а не команды: Google давно
  // ориентируется в основном на реальную частоту изменений. Оставляем честные
  // значения, чтобы не вводить в заблуждение и себя.
  //
  // Каждая языковая версия — отдельная запись со ссылками на остальные:
  // так поисковик понимает, что это переводы, а не дубли (hreflang в карте).
  return [...fromDatabase, ...CODE_PAGES].flatMap(([path, changeFrequency, priority]) => {
    const languages = Object.fromEntries(
      LOCALES.map((locale) => [LOCALE_TAGS[locale], `${baseUrl}${localizedPath(locale, path)}`])
    );
    return LOCALES.map((locale) => ({
      url: `${baseUrl}${localizedPath(locale, path)}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  });
}
