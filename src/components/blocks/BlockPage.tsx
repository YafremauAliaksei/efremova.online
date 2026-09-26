import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { PageBlocks } from '@/components/blocks/PageBlocks';
import { SiteFooter } from '@/components/SiteFooter';
import { pagePath } from '@/lib/blocks/pages';
import { languageAlternates, type Locale } from '@/lib/i18n';
import { getPublicPage } from '@/lib/pages';

/**
 * Страница, собранная из блоков в базе: главная и все страницы, которые
 * владелец завёл в админке. Сколько их и что на них — решает база.
 */

export async function blockPageMetadata(slug: string, locale: Locale): Promise<Metadata> {
  const page = await getPublicPage(slug, locale);
  if (page === null) return {};
  return {
    // У главной заголовок — название сайта из макета, а не «Главная · …»
    ...(page.title !== null && pagePath(slug) !== '/' ? { title: page.title } : {}),
    ...(page.description !== null ? { description: page.description } : {}),
    alternates: languageAlternates(locale, pagePath(slug)),
  };
}

export async function BlockPage({ slug, locale }: { slug: string; locale: Locale }) {
  const page = await getPublicPage(slug, locale);
  if (page === null) notFound();

  // Страну сообщает Cloudflare. Никаких сторонних geo-IP сервисов:
  // иначе IP посетителя утекал бы третьей стороне (docs/03)
  const region = (await headers()).get('cf-ipcountry') ?? 'DEFAULT';

  return (
    <>
      <main id="main">
        <PageBlocks blocks={page.blocks} locale={locale} region={region} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
