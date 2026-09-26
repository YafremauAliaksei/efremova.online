import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlockPage, blockPageMetadata } from '@/components/blocks/BlockPage';
import { HOME_SLUG, isFreePageSlug } from '@/lib/blocks/pages';
import { isLocale, type Locale } from '@/lib/i18n';

/**
 * Страницы из базы: /ru/about, /pl/nowa-strona — всё, что владелец завёл
 * в админке. Адреса со своим кодом (услуги, правовые документы) Next.js
 * отдаёт своим страницам раньше, чем дойдёт сюда.
 *
 * Адрес из двух и более частей (/pl/a/b) и /ru/home (дубль главной) —
 * 404 на языке адреса.
 */

export const dynamic = 'force-dynamic';

interface PathParams {
  params: Promise<{ locale: string; path: string[] }>;
}

async function resolve(params: PathParams['params']): Promise<{ slug: string; locale: Locale }> {
  const { locale, path } = await params;
  const [slug] = path;
  if (!isLocale(locale) || path.length !== 1 || !isFreePageSlug(slug) || slug === HOME_SLUG) {
    notFound();
  }
  return { slug, locale };
}

export async function generateMetadata({ params }: PathParams): Promise<Metadata> {
  const { slug, locale } = await resolve(params);
  return blockPageMetadata(slug, locale);
}

export default async function DatabasePage({ params }: PathParams) {
  const { slug, locale } = await resolve(params);
  return <BlockPage slug={slug} locale={locale} />;
}
