import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalDocument, LegalDocumentMissing } from '@/components/LegalDocument';
import { SiteFooter } from '@/components/SiteFooter';
import {
  DEFAULT_LOCALE,
  getLegalDocument,
  LOCALE_TAGS,
  resolveLocale,
  SUPPORTED_LOCALES,
  type LegalSlug,
} from '@/lib/legal';

/**
 * Страница правового документа — одна на все документы.
 *
 * Текст живёт в базе (модель LegalDocument) на польском — языке места
 * ведения деятельности — и в переводах. Язык выбирается параметром ?lang,
 * затем по браузеру, затем польский. Прямые ссылки на версии и hreflang
 * одинаковы у всех документов, поэтому собраны здесь, а не повторены
 * в каждой странице.
 */

interface PageProps {
  searchParams: Promise<{ lang?: string }>;
}

interface LegalPageOptions {
  slug: LegalSlug;
  basePath: string;
  /** Заголовок, пока документа нет в базе */
  fallbackTitle: string;
  description: string;
}

async function currentLocale(searchParams: PageProps['searchParams']) {
  const { lang } = await searchParams;
  const headerList = await headers();
  return resolveLocale(lang, headerList.get('accept-language'));
}

export function createLegalPage({ slug, basePath, fallbackTitle, description }: LegalPageOptions) {
  async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
    const locale = await currentLocale(searchParams);
    const document = await getLegalDocument(slug, locale);

    // hreflang сообщает поисковику, что это одна страница на разных языках,
    // а не дубли. Без этого Google считает версии конкурирующими копиями.
    const languages: Record<string, string> = {};
    for (const supported of SUPPORTED_LOCALES) {
      languages[LOCALE_TAGS[supported]] = `${basePath}?lang=${supported}`;
    }

    return {
      title: document?.title ?? fallbackTitle,
      description,
      alternates: {
        canonical: `${basePath}?lang=${locale}`,
        languages: { ...languages, 'x-default': `${basePath}?lang=${DEFAULT_LOCALE}` },
      },
    };
  }

  async function Page({ searchParams }: PageProps) {
    const locale = await currentLocale(searchParams);
    const document = await getLegalDocument(slug, locale);

    return (
      <>
        <main id="main" className="mx-auto max-w-3xl px-6 py-16">
          {document === null ? (
            <LegalDocumentMissing locale={locale} />
          ) : (
            <LegalDocument document={document} basePath={basePath} />
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  return { generateMetadata, Page };
}
