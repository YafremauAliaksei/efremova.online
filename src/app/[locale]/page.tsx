import type { Metadata } from 'next';
import { BlockPage, blockPageMetadata } from '@/components/blocks/BlockPage';
import { HOME_SLUG } from '@/lib/blocks/pages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';

/**
 * Главная — страница из блоков со slug «home» (docs/13, п.4).
 *
 * ⚠️ ЧЕСТНО О КЭШИРОВАНИИ: страница собирается заново на каждого посетителя
 * (force-dynamic) — ради валюты по стране и nonce в CSP. Переход на заранее
 * собранные страницы — задача static-pages (docs/13, п.6.1).
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  return blockPageMetadata(HOME_SLUG, await pageLocale(params));
}

export default async function HomePage({ params }: LocaleParams) {
  return <BlockPage slug={HOME_SLUG} locale={await pageLocale(params)} />;
}
