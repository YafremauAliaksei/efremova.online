import { LOCALES, LOCALE_TAGS, localizedPath, type Locale } from '@/lib/i18n';

/**
 * Что публичная страница сообщает о себе в <head> (docs/14).
 *
 * Раньше это собирал Next.js из generateMetadata. Публичная страница теперь —
 * HTML, который отрисовывает свой обработчик, поэтому теги собираются здесь.
 * Набор тот же: заголовок, описание, canonical, hreflang, Open Graph.
 *
 * Файл без 'server-only': чистые функции, их проверяют тесты.
 */

export interface PageMeta {
  /** Заголовок страницы; null — только название сайта (главная) */
  title: string | null;
  description: string | null;
  /** Адрес страницы без языка: '/', '/about' */
  path: string;
  /**
   * Язык канонической версии, если показан не язык адреса: перевода
   * документа нет — каноническая страница польская, иначе поисковик
   * увидит один текст под двумя адресами
   */
  canonicalLocale?: Locale;
  /** Служебная страница: в поиске ей делать нечего */
  noindex?: boolean;
}

export interface HeadTags {
  title: string;
  description: string;
  robots: string;
  canonical: string;
  /** hreflang → абсолютный адрес; x-default — адрес без языка */
  alternates: { hrefLang: string; href: string }[];
}

export function headTags(
  meta: PageMeta,
  locale: Locale,
  siteName: string,
  siteDescription: string,
  appUrl: string
): HeadTags {
  const origin = new URL(appUrl).origin;
  const absolute = (path: string) => `${origin}${path}`;
  return {
    title: meta.title === null ? siteName : `${meta.title} · ${siteName}`,
    description: meta.description ?? siteDescription,
    robots: meta.noindex === true ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    canonical: absolute(localizedPath(meta.canonicalLocale ?? locale, meta.path)),
    alternates: [
      ...LOCALES.map((other) => ({
        hrefLang: LOCALE_TAGS[other],
        href: absolute(localizedPath(other, meta.path)),
      })),
      { hrefLang: 'x-default', href: absolute(meta.path) },
    ],
  };
}
