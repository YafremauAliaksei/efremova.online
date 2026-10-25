import { LegalDocument, LegalDocumentMissing } from '@/components/LegalDocument';
import { SiteFooter } from '@/components/SiteFooter';
import type { Locale } from '@/lib/i18n';
import { getLegalDocument, type LegalSlug } from '@/lib/legal';
import { messages, type Messages } from '@/lib/messages';
import type { PublicView } from '@/lib/public/view';

/**
 * Страница правового документа — одна на все документы.
 *
 * Текст живёт в базе (модель LegalDocument) на польском — языке места
 * ведения деятельности — и в переводах. Язык берётся из адреса (/pl/privacy);
 * документа на этом языке нет — показывается польская версия.
 */

export interface LegalPageOptions {
  slug: LegalSlug;
  /** Адрес без языка: /privacy */
  path: string;
  /** Подпись из меню — заголовок, пока документа нет в базе */
  navKey: keyof Messages['nav'];
  description: Record<Locale, string>;
}

export const LEGAL_PAGES: readonly LegalPageOptions[] = [
  {
    // Политика конфиденциальности (ст. 13 GDPR); /pl/privacy#cookies — сразу к cookie
    slug: 'privacy',
    path: '/privacy',
    navKey: 'privacy',
    description: {
      pl: 'Jakie dane przetwarza serwis, w jakim celu, jak długo je przechowuje i jakie prawa Ci przysługują.',
      ru: 'Какие данные обрабатывает сайт, зачем, как долго хранит и какие у вас права.',
      en: 'What data the site processes, why, for how long, and what your rights are.',
    },
  },
  {
    // Информация для потребителя перед удалённым договором (закон о правах потребителя, ст. 12)
    slug: 'terms',
    path: '/terms',
    navKey: 'terms',
    description: {
      pl: 'Jak umówić konsultację, ile kosztuje, jak ją odwołać i jak złożyć reklamację.',
      ru: 'Как записаться на консультацию, сколько она стоит, как её отменить и подать жалобу.',
      en: 'How to book a session, what it costs, how to cancel it and how to file a complaint.',
    },
  },
  {
    // Regulamin serwisu: обязателен для любого сайта, оказывающего услугу
    // по электронным каналам, даже информационного (закон об электронных услугах, ст. 8)
    slug: 'site-terms',
    path: '/site-terms',
    navKey: 'siteTerms',
    description: {
      pl: 'Zasady korzystania z serwisu informacyjnego.',
      ru: 'Правила пользования информационным сайтом.',
      en: 'Rules for using this informational website.',
    },
  },
  {
    // Данные владельца (закон об электронных услугах, ст. 5; директива 2000/31/ЕС, ст. 5)
    slug: 'provider',
    path: '/provider',
    navKey: 'provider',
    description: {
      pl: 'Dane usługodawcy, kontakt i informacje o wykonywanym zawodzie.',
      ru: 'Данные владельца сайта, контакты и сведения о профессии.',
      en: 'Service provider details, contact and professional information.',
    },
  },
];

export async function legalPage(options: LegalPageOptions, locale: Locale): Promise<PublicView> {
  const { slug, path, navKey, description } = options;
  const document = await getLegalDocument(slug, locale);

  return {
    meta: {
      title: document?.title ?? messages(locale).nav[navKey],
      description: description[locale],
      path,
      // Перевода нет и показан польский текст — каноническая страница польская
      canonicalLocale: document?.locale ?? locale,
    },
    body: (
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
    ),
  };
}
