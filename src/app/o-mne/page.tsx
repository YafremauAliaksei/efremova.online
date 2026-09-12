import type { Metadata } from 'next';
import Link from 'next/link';
import { getContentBlock } from '@/lib/content';
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
 * техническими средствами (docs/04, п.4).
 */

export const metadata: Metadata = {
  title: 'Обо мне',
  description: 'Образование, опыт и подход к работе.',
};

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const [about, approach] = await Promise.all([
    getContentBlock('about.main'),
    getContentBlock('approach.main'),
  ]);

  return (
    <>
      <main id="main" className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold">{about.title ?? 'Обо мне'}</h1>
        {about.body !== null && (
          <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{about.body}</p>
        )}

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">{approach.title ?? 'Подход к работе'}</h2>
          {approach.body !== null && (
            <p className="mt-4 leading-relaxed text-[var(--color-ink-soft)]">{approach.body}</p>
          )}
        </section>

        <Link
          href="/uslugi"
          className="mt-10 inline-block rounded-lg bg-[var(--color-accent)] px-8 py-4 font-medium text-white transition-colors hover:bg-[#3d594d]"
        >
          Услуги и цены
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
