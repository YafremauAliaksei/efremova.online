import 'server-only';
import { blockPage } from '@/components/blocks/BlockPage';
import { Filled } from '@/components/Filled';
import { LEGAL_PAGES, legalPage } from '@/components/LegalPage';
import { ServiceList } from '@/components/ServiceList';
import { SiteFooter } from '@/components/SiteFooter';
import { TestimonialList } from '@/components/TestimonialList';
import { HOME_SLUG, isFreePageSlug } from '@/lib/blocks/pages';
import { getPriceArchive, getServices } from '@/lib/content';
import { LOCALE_TAGS, localizedPath, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import type { PublicView } from '@/lib/public/view';
import { formatPrice } from '@/lib/services/edit';
import { getSiteProfile } from '@/lib/site-profile';
import { getTestimonials } from '@/lib/testimonials/public';
import { isVideoId, youtubeWatchUrl } from '@/lib/video';

/**
 * Какая страница по какому адресу (docs/14).
 *
 * Все публичные адреса — /ru, /pl/about, /en/services… — приходят сюда из
 * двух обработчиков маршрута (src/app/[locale]). null — такой страницы нет:
 * обработчик отвечает 404 на языке адреса.
 *
 * Адрес из двух и более частей (/pl/a/b) и /ru/home (дубль главной) — 404.
 *
 * currency — валюта цен из адреса (?currency=EUR, задача 9a). Кроме языка,
 * пути и этой валюты отрисовка не знает о запросе ничего: страница лежит
 * в общем кэше, и Cloudflare кэширует адрес вместе с параметром.
 */
export async function resolvePublicPage(
  locale: Locale,
  segments: readonly string[],
  currency: string | null = null
): Promise<PublicView | null> {
  const [first, ...rest] = segments;
  if (first === undefined) return blockPage(HOME_SLUG, locale, currency);

  if (first === 'out' && rest[0] === 'youtube' && rest.length === 2) {
    return leaveForYoutube(locale, rest[1] ?? '');
  }
  if (first === 'services' && rest[0] === 'history' && rest.length === 1) {
    return priceArchivePage(locale);
  }
  if (rest.length > 0) return null;

  if (first === 'services') return servicesPage(locale, currency);
  if (first === 'testimonials') return testimonialsPage(locale);
  const legal = LEGAL_PAGES.find((page) => page.path === `/${first}`);
  if (legal !== undefined) return legalPage(legal, locale);

  if (!isFreePageSlug(first) || first === HOME_SLUG) return null;
  return blockPage(first, locale, currency);
}

/** «Страница не найдена» на языке адреса */
export function notFoundPage(locale: Locale): PublicView {
  const t = messages(locale).notFound;
  return {
    meta: { title: t.title, description: null, path: '/', noindex: true },
    body: (
      <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-4 text-[var(--color-ink-soft)]">{t.body}</p>
        <a href={localizedPath(locale)} className="mt-8 inline-block underline underline-offset-4">
          {t.home}
        </a>
      </main>
    ),
  };
}

/**
 * Услуги и цены. Цена — в валюте из адреса, по умолчанию основная валюта сайта; страна
 * посетителя не читается: страница одна на всех и лежит в общем кэше.
 */
async function servicesPage(locale: Locale, currency: string | null): Promise<PublicView> {
  const t = messages(locale).services;
  const services = await getServices(locale, currency);
  return {
    meta: { title: t.title, description: t.description, path: '/services' },
    body: (
      <>
        <main id="main" className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-4 text-[var(--color-ink-soft)]">
            {t.introBefore}
            <a href={localizedPath(locale, '/terms')} className="underline underline-offset-4">
              {t.introLink}
            </a>
            {t.introAfter}
          </p>
          <ServiceList list={services} locale={locale} path="/services" headingLevel="h2" />
        </main>
        <SiteFooter locale={locale} />
      </>
    ),
  };
}

/** Дата в архиве цен: «1 czerwca 2026» — по-человечески, на языке страницы */
function archiveDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Публичный архив цен (задача 9a): все цены всех услуг с датами — «с 1 июня
 * 2026 по 14 сентября 2027 — 200 zł». Историю нельзя переписать: правку
 * и удаление цен запрещает база, новая цена закрывает прежнюю датой.
 */
async function priceArchivePage(locale: Locale): Promise<PublicView> {
  const t = messages(locale).priceArchive;
  const archive = await getPriceArchive(locale);
  return {
    meta: { title: t.title, description: t.description, path: '/services/history' },
    body: (
      <>
        <main id="main" className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="text-3xl font-semibold">{t.title}</h1>
          <p className="mt-4 text-[var(--color-ink-soft)]">{t.intro}</p>
          {archive.length === 0 ? (
            <p className="mt-8 text-[var(--color-ink-soft)]">{t.empty}</p>
          ) : (
            <ul className="mt-8 space-y-6">
              {archive.map((service) => (
                <li
                  key={service.slug}
                  className="rounded-lg border border-[var(--color-line)] bg-white p-6"
                >
                  <h2 className="text-xl font-medium">{service.title}</h2>
                  {service.currencies.map(({ currency, periods }) => (
                    <section key={currency} className="mt-4">
                      <h3 className="text-sm font-medium">{currency}</h3>
                      <ul className="mt-2 space-y-1 text-sm">
                        {periods.map((period) => (
                          <li
                            key={period.validFrom.toISOString()}
                            className="flex flex-wrap gap-x-3"
                          >
                            <span className="font-medium">
                              {formatPrice(period.amountMinor, period.currency, locale)}
                            </span>
                            <span className="text-[var(--color-ink-soft)]">
                              {t.since}{' '}
                              <time dateTime={period.validFrom.toISOString()}>
                                {archiveDate(period.validFrom, locale)}
                              </time>{' '}
                              {period.validTo === null ? (
                                <>— {t.now}</>
                              ) : (
                                <>
                                  {t.until}{' '}
                                  <time dateTime={period.validTo.toISOString()}>
                                    {archiveDate(period.validTo, locale)}
                                  </time>
                                </>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </main>
        <SiteFooter locale={locale} />
      </>
    ),
  };
}

/**
 * Все отзывы (задача 8). Над списком — как отзывы проверяются: директива
 * Omnibus требует сообщать, проверяет ли продавец, что отзыв оставил
 * реальный клиент, и как (docs/03 п.11.1, правило 7).
 */
async function testimonialsPage(locale: Locale): Promise<PublicView> {
  const t = messages(locale).testimonials;
  const [testimonials, { values }] = await Promise.all([getTestimonials(), getSiteProfile()]);
  return {
    meta: { title: t.title, description: t.description, path: '/testimonials' },
    body: (
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
    ),
  };
}

/**
 * Страница-предупреждение перед уходом на YouTube (docs/13, п.1.1).
 *
 * Карточка ролика ведёт сюда, а не на YouTube: до второго щелчка браузер
 * посетителя к Google не обращается. id проверяется строго (11 знаков):
 * адрес кнопки собирает код, поэтому эту страницу нельзя превратить
 * в «открытый переброс» на чужой сайт.
 */
function leaveForYoutube(locale: Locale, id: string): PublicView | null {
  if (!isVideoId(id)) return null;
  const t = messages(locale).video;
  return {
    meta: { title: t.leaveTitle, description: null, path: `/out/youtube/${id}`, noindex: true },
    body: (
      <>
        <main id="main" className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="text-3xl font-semibold">{t.leaveTitle}</h1>
          <p className="mt-6 leading-relaxed text-[var(--color-ink-soft)]">{t.leaveBody}</p>
          <p className="mt-3 text-sm">
            <a
              href={`${localizedPath(locale, '/privacy')}#recipients`}
              className="underline underline-offset-4"
            >
              {t.leavePrivacy}
            </a>
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            {/* Переход — только по щелчку человека. noreferrer — YouTube
                не узнает, с какой страницы пришёл посетитель */}
            <a
              href={youtubeWatchUrl(id)}
              rel="noreferrer noopener"
              className="inline-block rounded-lg bg-[var(--color-accent)] px-6 py-3 font-medium text-white"
            >
              {t.leaveGo}
            </a>
            <a
              href={localizedPath(locale, '/')}
              className="inline-block rounded-lg border border-[var(--color-line)] px-6 py-3 font-medium"
            >
              {t.leaveBack}
            </a>
          </div>
        </main>
        <SiteFooter locale={locale} />
      </>
    ),
  };
}
