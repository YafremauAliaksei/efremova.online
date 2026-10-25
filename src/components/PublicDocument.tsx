import { DevelopmentNotice } from '@/components/DevelopmentNotice';
import { SiteHeader } from '@/components/SiteHeader';
import { env } from '@/lib/env';
import { LOCALE_TAGS, OG_LOCALES, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { headTags, type PageMeta } from '@/lib/public/meta';
import { stylesheetHref } from '@/lib/public/stylesheet';

/**
 * Вся публичная страница: <html> с языком адреса, <head> и общая рамка —
 * ссылка «к содержимому», плашка «в разработке», шапка (docs/14).
 *
 * Ни одного <script>: страница отрисовывается сервером один раз и дальше
 * живёт в кэше Cloudflare. Атрибут lang стоит на <html>: без него
 * Accessibility не даст 100, а скринридер прочтёт польский текст с русским
 * произношением.
 */
export function PublicDocument({
  locale,
  meta,
  children,
}: {
  locale: Locale;
  meta: PageMeta;
  children: React.ReactNode;
}) {
  const t = messages(locale);
  const head = headTags(meta, locale, t.siteName, t.siteDescription, env().APP_URL);

  return (
    <html lang={LOCALE_TAGS[locale]}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#fbfaf8" />
        <title>{head.title}</title>
        <meta name="description" content={head.description} />
        <meta name="robots" content={head.robots} />
        <link rel="canonical" href={head.canonical} />
        {head.alternates.map((alternate) => (
          <link
            key={alternate.hrefLang}
            rel="alternate"
            hrefLang={alternate.hrefLang}
            href={alternate.href}
          />
        ))}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={OG_LOCALES[locale]} />
        <meta property="og:site_name" content={t.siteName} />
        <meta property="og:title" content={head.title} />
        <meta property="og:description" content={head.description} />
        <meta property="og:url" content={head.canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href={stylesheetHref()} />
      </head>
      <body className="min-h-screen">
        {/* Ссылка для тех, кто ходит по сайту с клавиатуры: позволяет
            перепрыгнуть меню и сразу попасть в содержимое */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2"
        >
          {t.skipLink}
        </a>
        <DevelopmentNotice />
        <SiteHeader locale={locale} path={meta.path} />
        {children}
      </body>
    </html>
  );
}
