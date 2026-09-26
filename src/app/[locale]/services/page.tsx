import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getServices } from '@/lib/content';
import { languageAlternates, localizedPath } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';
import { ServiceList } from '@/components/ServiceList';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Страница услуг и цен.
 *
 * Цены приходят из базы и зависят от региона посетителя. Регион определяется
 * по заголовку Cloudflare — никаких сторонних geo-IP сервисов, чтобы IP
 * посетителя не уходил третьей стороне (docs/13, п.1.1).
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = messages(locale).services;
  return {
    title: t.title,
    description: t.description,
    alternates: languageAlternates(locale, '/services'),
  };
}

export default async function ServicesPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = messages(locale).services;
  const headerList = await headers();
  const region = headerList.get('cf-ipcountry') ?? 'DEFAULT';
  const services = await getServices(region, locale);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          {t.introBefore}
          <Link href={localizedPath(locale, '/terms')} className="underline underline-offset-4">
            {t.introLink}
          </Link>
          {t.introAfter}
        </p>

        <ServiceList services={services} locale={locale} headingLevel="h2" />

        {/* Здесь была кнопка «Выбрать время», которая вела в личный кабинет.
            Кабинет переехал на отдельный поддомен и пока не существует, а ссылка
            в никуда хуже её отсутствия. Кнопка вернётся в ветке contacts
            и поведёт на страницу контактов. */}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
