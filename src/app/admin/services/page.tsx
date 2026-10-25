import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createService, moveService, saveService } from '@/app/admin/services/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/auth/admin';
import { i18nTextSchema } from '@/lib/content-schema';
import { db } from '@/lib/db';
import { getCurrencySettings } from '@/lib/services/currency-settings';
import { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, LOCALE_TAGS, type Locale } from '@/lib/i18n';
import {
  DURATION_MAX,
  DURATION_MIN,
  SERVICE_DESCRIPTION_MAX,
  SERVICE_TITLE_MAX,
  formatPrice,
  isPriceCurrent,
} from '@/lib/services/edit';

/**
 * Услуги и цены (задача 6, бывш. A.4).
 *
 * Услуга — название и описание на трёх языках, длительность, показ на сайте
 * и место в списке. Цены — отдельно, в редакторе цен услуги
 * (services/[id]/prices): только там сервер спрашивает курс валют.
 */

export const metadata: Metadata = {
  title: 'Услуги и цены',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Итог действия — только известным кодом из адреса, текст — отсюда */
const SAVED = {
  created:
    'Услуга создана скрытой. Назначьте цену и переводы, затем включите «показывать на сайте».',
  settings: 'Услуга сохранена.',
  moved: 'Порядок изменён.',
} as const;

const ERRORS = {
  missing: 'Услуга или цена не найдены — обновите страницу.',
  serviceId: 'Услуга не найдена — обновите страницу.',
  slug: 'Служебное имя: латиница, цифры и дефис, до 48 знаков, например individual-50.',
  slugTaken: 'Услуга с таким служебным именем уже есть.',
  title: `Нужно название по-русски: одна строка до ${String(SERVICE_TITLE_MAX)} знаков.`,
  durationMinutes: `Длительность — целое число минут от ${String(DURATION_MIN)} до ${String(DURATION_MAX)}.`,
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

function errorMessage(code: string | undefined): string | null {
  const general = known(ERRORS, code);
  if (general !== null) return general;
  const field = /^(title|description)_(ru|pl|en)$/.exec(code ?? '');
  if (field === null) return null;
  const what = field[1] === 'title' ? 'Название' : 'Описание';
  const shape = field[1] === 'title' ? 'одна строка' : 'текст';
  return `${what} (${LOCALE_NAMES[field[2] as Locale]}) не сохранено: ${shape} без служебных символов.`;
}

const INPUT = 'mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal';
const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)] disabled:opacity-40';
const BUTTON =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50';

interface PageProps {
  searchParams: Promise<{ open?: string; saved?: string; error?: string; newservice?: string }>;
}

export default async function ServicesAdminPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');

  const params = await searchParams;
  const now = new Date();
  const { defaultCurrency } = await getCurrencySettings();
  const services = await db.service.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { prices: { orderBy: [{ currency: 'asc' }, { validFrom: 'desc' }] } },
  });

  const savedText = known(SAVED, params.saved);
  const errorText = params.error === undefined ? null : errorMessage(params.error);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Страницы и тексты
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Услуги и цены</h1>
      <AdminNav current="/admin/services" />
      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        Список виден на странице «Услуги» и в блоке «Список услуг». Цена — итоговая, в каждой валюте
        своя и ровная: посетитель видит цены в основной валюте ({defaultCurrency}) и может выбрать
        другую. Цены меняются кнопкой «Изменить цены» в карточке услуги.
      </p>

      {savedText !== null && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm"
        >
          {savedText}
        </p>
      )}
      {params.error !== undefined && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {errorText ?? 'Не сохранено — проверьте поля и попробуйте ещё раз.'}
        </p>
      )}

      <ol className="mt-8 space-y-4">
        {services.map((service, index) => {
          const titles = i18nTextSchema.parse(service.titleI18n);
          const descriptions = i18nTextSchema.parse(service.descriptionI18n);
          const current = service.prices.filter((price) => isPriceCurrent(price, now));
          const hasDefault = current.some((price) => price.currency === defaultCurrency);
          const name = titles[DEFAULT_LOCALE] ?? service.slug;

          return (
            <li key={service.id}>
              <details
                open={params.open === service.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm"
              >
                <summary className="cursor-pointer">
                  <span className="font-medium">{name}</span>{' '}
                  <span className="text-[var(--color-ink-soft)]">
                    · {service.durationMinutes} мин ·{' '}
                    {current.length === 0
                      ? 'без цены'
                      : current
                          .map((price) => formatPrice(price.amountMinor, price.currency, 'ru'))
                          .join(', ')}
                  </span>
                  {!service.isActive && (
                    <span className="ml-2 rounded-full bg-[var(--color-paper-alt)] px-2 text-xs">
                      скрыта
                    </span>
                  )}
                  {service.isActive && !hasDefault && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">
                      нет цены в {defaultCurrency} — посетителям по умолчанию «по запросу»
                    </span>
                  )}
                </summary>

                <div className="mt-4 flex gap-1">
                  {(['up', 'down'] as const).map((direction) => (
                    <form key={direction} action={moveService}>
                      <input type="hidden" name="serviceId" value={service.id} />
                      <input type="hidden" name="direction" value={direction} />
                      <button
                        type="submit"
                        className={SMALL_BUTTON}
                        disabled={direction === 'up' ? index === 0 : index === services.length - 1}
                        aria-label={direction === 'up' ? 'Выше в списке' : 'Ниже в списке'}
                      >
                        {direction === 'up' ? '↑' : '↓'}
                      </button>
                    </form>
                  ))}
                </div>

                {/* ── название, описание, длительность ── */}
                <form action={saveService} className="mt-4 space-y-4">
                  <input type="hidden" name="serviceId" value={service.id} />
                  {LOCALES.map((lang) => (
                    <fieldset key={lang} className="rounded border border-[var(--color-line)] p-3">
                      <legend className="px-1 text-xs text-[var(--color-ink-soft)]">
                        {LOCALE_NAMES[lang]}
                      </legend>
                      <label className="block">
                        Название{lang === DEFAULT_LOCALE ? ' (обязательно)' : ''}
                        <input
                          name={`title_${lang}`}
                          lang={LOCALE_TAGS[lang]}
                          defaultValue={titles[lang] ?? ''}
                          maxLength={SERVICE_TITLE_MAX}
                          required={lang === DEFAULT_LOCALE}
                          className={INPUT}
                        />
                      </label>
                      <label className="mt-3 block">
                        Описание
                        <textarea
                          name={`description_${lang}`}
                          lang={LOCALE_TAGS[lang]}
                          defaultValue={descriptions[lang] ?? ''}
                          maxLength={SERVICE_DESCRIPTION_MAX}
                          rows={3}
                          className={INPUT}
                        />
                      </label>
                    </fieldset>
                  ))}
                  <label className="block">
                    Длительность, минут
                    <input
                      name="durationMinutes"
                      type="number"
                      min={DURATION_MIN}
                      max={DURATION_MAX}
                      step={1}
                      defaultValue={service.durationMinutes}
                      className={`${INPUT} max-w-32`}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="isActive" type="checkbox" defaultChecked={service.isActive} />
                    Показывать на сайте
                  </label>
                  <button type="submit" className={BUTTON}>
                    Сохранить услугу
                  </button>
                </form>

                {/* ── цены: отдельный редактор, только там запрашивается курс ── */}
                <section className="mt-6 border-t border-[var(--color-line)] pt-4">
                  <h2 className="font-medium">Цены</h2>
                  <p className="mt-2 text-[var(--color-ink-soft)]">
                    {current.length === 0
                      ? 'Цены нет — на сайте «по запросу».'
                      : current
                          .map((price) => formatPrice(price.amountMinor, price.currency, 'ru'))
                          .join(' · ')}
                  </p>
                  <Link
                    href={`/admin/services/${service.id}/prices`}
                    className={`${BUTTON} mt-3 inline-block`}
                  >
                    Изменить цены
                  </Link>
                </section>
              </details>
            </li>
          );
        })}
      </ol>

      {/* ── новая услуга ── */}
      <details
        open={params.newservice !== undefined}
        className="mt-8 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm"
      >
        <summary className="cursor-pointer font-medium">+ Новая услуга</summary>
        <form action={createService} className="mt-4 space-y-4">
          <label className="block">
            Служебное имя (латиницей, не меняется)
            <input
              name="slug"
              placeholder="family-60"
              pattern="[a-z0-9-]{1,48}"
              required
              className={INPUT}
            />
          </label>
          <label className="block">
            Название по-русски
            <input name="title" maxLength={SERVICE_TITLE_MAX} required className={INPUT} />
          </label>
          <button type="submit" className={BUTTON}>
            Создать скрытой
          </button>
        </form>
      </details>
    </main>
  );
}
