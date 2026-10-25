import { PageBlocks } from '@/components/blocks/PageBlocks';
import { SiteFooter } from '@/components/SiteFooter';
import { pagePath } from '@/lib/blocks/pages';
import type { Locale } from '@/lib/i18n';
import { getPublicPage } from '@/lib/pages';
import type { PublicView } from '@/lib/public/view';

/**
 * Страница, собранная из блоков в базе: главная и все страницы, которые
 * владелец завёл в админке. Сколько их и что на них — решает база.
 *
 * null — такой страницы нет или она скрыта: обработчик ответит 404.
 */
export async function blockPage(
  slug: string,
  locale: Locale,
  /** Валюта из адреса (?currency=EUR) для блока услуг; null — основная валюта сайта */
  currency: string | null
): Promise<PublicView | null> {
  const page = await getPublicPage(slug, locale);
  if (page === null) return null;
  const path = pagePath(slug);

  return {
    meta: {
      // У главной заголовок — название сайта, а не «Главная · …»
      title: path === '/' ? null : page.title,
      description: page.description,
      path,
    },
    body: (
      <>
        <main id="main">
          <PageBlocks blocks={page.blocks} locale={locale} path={path} currency={currency} />
        </main>
        <SiteFooter locale={locale} />
      </>
    ),
  };
}
