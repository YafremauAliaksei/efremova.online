import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LegalDocument, LegalDocumentMissing } from '@/components/LegalDocument';
import { SiteFooter } from '@/components/SiteFooter';
import { getLegalDocument, LOCALE_TAGS, resolveLocale, SUPPORTED_LOCALES } from '@/lib/legal';

/**
 * Условия оказания услуг (regulamin / публичная оферта).
 *
 * Прямые ссылки: /terms?lang=pl и /terms?lang=ru
 */

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { lang } = await searchParams;
  const headerList = await headers();
  const locale = resolveLocale(lang, headerList.get('accept-language'));
  const document = await getLegalDocument('terms', locale);

  const languages: Record<string, string> = {};
  for (const supported of SUPPORTED_LOCALES) {
    languages[LOCALE_TAGS[supported]] = `/terms?lang=${supported}`;
  }

  return {
    title: document?.title ?? 'Regulamin',
    description:
      'Warunki świadczenia usług: format konsultacji, płatność, zmiana terminu i odwołanie.',
    alternates: {
      canonical: `/terms?lang=${locale}`,
      languages: { ...languages, 'x-default': '/terms?lang=pl' },
    },
  };
}

export default async function TermsPage({ searchParams }: PageProps) {
  const { lang } = await searchParams;
  const headerList = await headers();
  const locale = resolveLocale(lang, headerList.get('accept-language'));
  const document = await getLegalDocument('terms', locale);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        {document === null ? (
          <LegalDocumentMissing locale={locale} />
        ) : (
          <LegalDocument document={document} basePath="/terms" />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
