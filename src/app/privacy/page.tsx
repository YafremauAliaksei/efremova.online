import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalDocument, LegalDocumentMissing } from '@/components/LegalDocument';
import { SiteFooter } from '@/components/SiteFooter';
import { getLegalDocument, LOCALE_TAGS, resolveLocale, SUPPORTED_LOCALES } from '@/lib/legal';

/**
 * Политика конфиденциальности.
 *
 * Текст живёт в базе (модель LegalDocument) на двух языках: польском —
 * как того требует место ведения деятельности — и русском.
 *
 * Прямые ссылки:
 *   /privacy?lang=pl        польская версия
 *   /privacy?lang=ru        русская версия
 *   /privacy?lang=pl#auth   сразу к разделу о передаче данных при входе
 *   /privacy?lang=pl#cookies раздел о файлах cookie
 */

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { lang } = await searchParams;
  const headerList = await headers();
  const locale = resolveLocale(lang, headerList.get('accept-language'));
  const document = await getLegalDocument('privacy', locale);

  // hreflang сообщает поисковику, что это одна страница на разных языках,
  // а не дубли. Без этого Google считает версии конкурирующими копиями.
  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    languages[LOCALE_TAGS[supported]] = `/privacy?lang=${supported}`;
  }

  return {
    title: document?.title ?? 'Polityka prywatności',
    description:
      'Jakie dane zbiera serwis, w jakim celu, jak długo je przechowuje i jakie prawa przysługują użytkownikowi.',
    alternates: {
      canonical: `/privacy?lang=${locale}`,
      languages: { ...languages, 'x-default': '/privacy?lang=pl' },
    },
  };
}

export default async function PrivacyPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const locale = resolveLocale(lang, headerList.get('accept-language'));
  const document = await getLegalDocument('privacy', locale);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        {document === null ? (
          <LegalDocumentMissing locale={locale} />
        ) : (
          <LegalDocument document={document} basePath="/privacy" />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
