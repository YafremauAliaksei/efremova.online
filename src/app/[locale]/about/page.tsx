import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentBlock } from '@/lib/content';
import { languageAlternates, langIfDifferent, localizedPath } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { pageLocale, type LocaleParams } from '@/lib/page-locale';
import { SiteFooter } from '@/components/SiteFooter';

/**
 * Страница «Обо мне».
 *
 * Текст берётся из базы (блоки about.main и approach.main) — в коде его нет
 * и быть не должно: репозиторий публичный (docs/06).
 *
 * ⚠️ Для SEO это самая важная страница сайта. Тема психологического здоровья
 * относится к категории YMYL, и Google оценивает такие сайты по критериям
 * E-E-A-T: реальное имя, образование, номер диплома, членство в ассоциациях.
 * Без этого в поиске по медицинским запросам не подняться никакими
 * техническими средствами.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = messages(locale).about;
  return {
    title: t.title,
    description: t.description,
    alternates: languageAlternates(locale, '/about'),
  };
}

export default async function AboutPage({ params }: LocaleParams) {
  const locale = await pageLocale(params);
  const t = messages(locale).about;
  const [about, approach] = await Promise.all([
    getContentBlock('about.main', locale),
    getContentBlock('approach.main', locale),
  ]);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <div lang={langIfDifferent(about.locale, locale)}>
          <h1 className="text-3xl font-semibold">{about.title ?? t.title}</h1>
          {about.body !== null && (
            <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{about.body}</p>
          )}
        </div>

        <section lang={langIfDifferent(approach.locale, locale)} className="mt-12">
          <h2 className="text-2xl font-semibold">{approach.title ?? t.approach}</h2>
          {approach.body !== null && (
            <p className="mt-4 leading-relaxed text-[var(--color-ink-soft)]">{approach.body}</p>
          )}
        </section>

        <Link
          href={localizedPath(locale, '/services')}
          className="mt-10 inline-block rounded-lg bg-[var(--color-accent)] px-8 py-4 font-medium text-white transition-colors hover:bg-[#3d594d]"
        >
          {t.toServices}
        </Link>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
