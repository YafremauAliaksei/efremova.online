import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter } from '@/components/SiteFooter';
import { localizedPath } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { pageLocale } from '@/lib/page-locale';
import { isVideoId, youtubeWatchUrl } from '@/lib/video';

/**
 * Страница-предупреждение перед уходом на YouTube (docs/13, п.1.1).
 *
 * Карточка ролика ведёт сюда, а не на YouTube: до второго щелчка браузер
 * посетителя к Google не обращается. Здесь честно сказано, что произойдёт
 * дальше, и есть выбор — перейти или вернуться.
 *
 * id проверяется строго (11 знаков): адрес кнопки собирает код, поэтому
 * эту страницу нельзя превратить в «открытый переброс» на чужой сайт.
 */

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  return {
    title: messages(locale).video.leaveTitle,
    // Служебная страница: в поиске ей делать нечего
    robots: { index: false, follow: false },
  };
}

export default async function LeaveForYoutube({ params }: Props) {
  const locale = await pageLocale(params);
  const { id } = await params;
  if (!isVideoId(id)) notFound();
  const t = messages(locale).video;

  return (
    <>
      <main id="main" className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-3xl font-semibold">{t.leaveTitle}</h1>
        <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{t.leaveBody}</p>
        <p className="mt-3 text-sm">
          <Link
            href={`${localizedPath(locale, '/privacy')}#recipients`}
            className="underline underline-offset-4"
          >
            {t.leavePrivacy}
          </Link>
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          {/* Обычная ссылка, без скриптов: переход — только по щелчку человека.
              noreferrer — YouTube не узнает, с какой страницы пришёл посетитель */}
          <a
            href={youtubeWatchUrl(id)}
            rel="noreferrer noopener"
            className="inline-block rounded-lg bg-[var(--color-accent)] px-6 py-3 font-medium text-white"
          >
            {t.leaveGo}
          </a>
          <Link
            href={localizedPath(locale, '/')}
            className="inline-block rounded-lg border border-[var(--color-line)] px-6 py-3 font-medium"
          >
            {t.leaveBack}
          </Link>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
