import type { Metadata } from 'next';
import { LegalDocument, LegalDocumentMissing } from '@/components/LegalDocument';
import { SiteFooter } from '@/components/SiteFooter';
import { getLegalDocument, type LegalSlug } from '@/lib/legal';
import { languageAlternates, localizedPath, type Locale } from '@/lib/i18n';
import { messages, type Messages } from '@/lib/messages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';

/**
 * Страница правового документа — одна на все документы.
 *
 * Текст живёт в базе (модель LegalDocument) на польском — языке места
 * ведения деятельности — и в переводах. Язык берётся из адреса (/pl/privacy);
 * документа на этом языке нет — показывается польская версия. Ссылки на
 * версии и hreflang одинаковы у всех документов, поэтому собраны здесь.
 */

interface LegalPageOptions {
  slug: LegalSlug;
  /** Адрес без языка: /privacy */
  path: string;
  /** Подпись из меню — заголовок, пока документа нет в базе */
  navKey: keyof Messages['nav'];
  description: Record<Locale, string>;
}

export function createLegalPage({ slug, path, navKey, description }: LegalPageOptions) {
  async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
    const locale = await pageLocale(params);
    const document = await getLegalDocument(slug, locale);
    const alternates = languageAlternates(locale, path);

    return {
      title: document?.title ?? messages(locale).nav[navKey],
      description: description[locale],
      alternates: {
        ...alternates,
        // Перевода нет и показан польский текст — каноническая страница
        // польская, иначе поисковик увидит один документ под двумя адресами
        canonical: localizedPath(document?.locale ?? locale, path),
      },
    };
  }

  async function Page({ params }: LocaleParams) {
    const locale = await pageLocale(params);
    const document = await getLegalDocument(slug, locale);

    return (
      <>
        <main id="main" className="mx-auto max-w-3xl px-6 py-16">
          {document === null ? (
            <LegalDocumentMissing locale={locale} />
          ) : (
            <LegalDocument document={document} path={path} />
          )}
        </main>
        <SiteFooter locale={locale} />
      </>
    );
  }

  return { generateMetadata, Page };
}
