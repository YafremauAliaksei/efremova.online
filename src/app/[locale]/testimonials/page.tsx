import type { Metadata } from 'next';
import { Filled } from '@/components/Filled';
import { SiteFooter } from '@/components/SiteFooter';
import { TestimonialList } from '@/components/TestimonialList';
import { languageAlternates } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';
import { getSiteProfile } from '@/lib/site-profile';
import { getTestimonials } from '@/lib/testimonials/public';

/**
 * Все отзывы (задача 8).
 *
 * Над списком — как отзывы проверяются: закон о защите потребителей
 * (директива Omnibus) требует сообщать, проверяет ли продавец, что отзыв
 * оставил реальный клиент, и как (docs/03 п.11.1, правило 7).
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = messages(locale).testimonials;
  return {
    title: t.title,
    description: t.description,
    alternates: languageAlternates(locale, '/testimonials'),
  };
}

export default async function TestimonialsPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = messages(locale).testimonials;
  const [testimonials, { values }] = await Promise.all([getTestimonials(), getSiteProfile()]);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
          <Filled text={t.verification} values={values} />
        </p>
        <TestimonialList testimonials={testimonials} locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
