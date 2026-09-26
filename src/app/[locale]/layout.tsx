import type { Metadata, Viewport } from 'next';
import '../globals.css';
import { DevelopmentNotice } from '@/components/DevelopmentNotice';
import { SiteHeader } from '@/components/SiteHeader';
import { DEFAULT_LOCALE, LOCALES, LOCALE_TAGS, OG_LOCALES, isLocale } from '@/lib/i18n';
import { messages } from '@/lib/messages';

/**
 * Корневой макет публичной части: /ru, /pl, /en.
 *
 * Корневых макетов два — этот и макет админки. Язык страницы берётся из
 * адреса, а атрибут lang стоит на <html>, поэтому у публичной части свой
 * <html> на каждый язык. Без правильного lang Accessibility не даст 100,
 * а скринридер прочитает польский текст с русским произношением.
 */

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Три языка собираются заранее. dynamicParams = false здесь НЕ ставится:
 * запрет унаследовал бы и [...rest], и Next.js отвечал бы на /pl/nie-ma
 * своей английской 404 ещё до страницы «не найдено» на языке адреса.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = messages(locale);

  return {
    metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
    title: { default: t.siteName, template: `%s · ${t.siteName}` },
    description: t.siteDescription,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    openGraph: { type: 'website', locale: OG_LOCALES[locale], siteName: t.siteName },
    twitter: { card: 'summary_large_image' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fbfaf8',
};

export default async function LocaleLayout({ children, params }: LayoutProps) {
  // Не notFound(): макет рисуется и вокруг самой страницы «не найдено».
  // Незнакомый язык сюда почти не попадает — middleware перебрасывает
  // /de/about на /ru/de/about, — а страницы проверяют язык сами (pageLocale)
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = messages(locale);

  return (
    <html lang={LOCALE_TAGS[locale]}>
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
        <SiteHeader locale={locale} />
        {children}
      </body>
    </html>
  );
}
