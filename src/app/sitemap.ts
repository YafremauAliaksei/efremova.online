import type { MetadataRoute } from 'next';
import { LOCALES, LOCALE_TAGS, localizedPath } from '@/lib/i18n';

/**
 * sitemap.xml — карта сайта для поисковых систем.
 *
 * ⚠️ Пока это список, набранный руками, — то есть ровно та ошибка, от которой
 * карта сайта должна защищать: страницу забыли дописать, и она не попала
 * в индекс. Список станет настоящей выборкой из базы вместе с управляемой
 * структурой страниц (docs/13-site-architecture.md).
 *
 * В карту попадают ТОЛЬКО публичные страницы. Кабинет и служебные адреса
 * не индексируются, и их здесь быть не должно.
 */
/** Страницы и подсказки для поисковика: адрес без языка, частота, вес */
const PAGES = [
  ['/', 'monthly', 1],
  ['/about', 'monthly', 0.8],
  ['/services', 'weekly', 0.9],
  ['/privacy', 'yearly', 0.3],
  ['/terms', 'yearly', 0.3],
  ['/site-terms', 'yearly', 0.2],
  ['/provider', 'yearly', 0.2],
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const now = new Date();

  // changeFrequency и priority — это подсказки, а не команды: Google давно
  // ориентируется в основном на реальную частоту изменений. Оставляем честные
  // значения, чтобы не вводить в заблуждение и себя.
  //
  // Каждая языковая версия — отдельная запись со ссылками на остальные:
  // так поисковик понимает, что это переводы, а не дубли (hreflang в карте).
  return PAGES.flatMap(([path, changeFrequency, priority]) => {
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
