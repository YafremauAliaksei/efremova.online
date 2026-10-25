import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { closePrice, setPrices } from '@/app/admin/services/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/auth/admin';
import { i18nTextSchema } from '@/lib/content-schema';
import { db } from '@/lib/db';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import {
  getCurrencySettings,
  getRateSources,
  type ConfiguredSource,
} from '@/lib/services/currency-settings';
import { currentPrices, formatPrice } from '@/lib/services/edit';
import {
  SEED_SOURCE,
  convert,
  rateSource,
  roundNicely,
  type RateTable,
} from '@/lib/services/rates';
import {
  latestStoredRates,
  refreshRates,
  type RatesOutcome,
  type StoredRates,
} from '@/lib/services/rates-fetch';

/**
 * Редактор цен услуги (PROJECT_LOG, задача 9b).
 *
 * Только здесь сервер спрашивает курс: пока владелец не меняет цены, ходить
 * никуда незачем. Страница приходит сразу — с курсом, сохранённым в прошлый
 * раз (или примерным из миграции на новом сайте), а свежий курс подменяет
 * его, как только источник ответит (Suspense). Источник не ответил —
 * остаётся прежний курс и предложение попробовать другой источник.
 *
 * В каждой валюте — действующая цена, подсказка «по курсу от цены в опорной
 * валюте ≈ 58,81 € → ровно 60 €» и поле новой цены. Курс — только подсказка:
 * на сайт попадает то, что владелец впишет сам.
 */

export const metadata: Metadata = {
  title: 'Цены услуги',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Итог действия — только известным кодом из адреса, текст — отсюда */
const SAVED = {
  price: 'Цены сохранены. Прежние цены этих валют закрыты сегодняшним числом и остались в истории.',
  priceSame: 'Новых цен нет — ничего не изменилось.',
  priceClosed: 'Цена убрана с сайта и осталась в истории.',
} as const;

const ERRORS = {
  missing: 'Цена не найдена — обновите страницу.',
  serviceId: 'Услуга не найдена — обновите страницу.',
  currency: 'Валюта не принята: только коды ISO 4217 с копейками из списка валют.',
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

function errorMessage(code: string | undefined): string | null {
  const general = known(ERRORS, code);
  if (general !== null) return general;
  const amount = /^amount_([A-Z]{3})$/.exec(code ?? '');
  if (amount === null) return null;
  return `${amount[1] ?? ''}: сумма — число больше нуля, не больше двух знаков после запятой, например 250 или 250,50. Ничего не сохранено.`;
}

const INPUT = 'w-32 rounded border border-[var(--color-line)] px-2 py-1 font-normal';
const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)]';
const BUTTON =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const NOTE = 'mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm';

/** Дата для владельца: день в UTC — время в базе хранится в UTC */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const currencyNames = new Intl.DisplayNames('ru', { type: 'currency' });

function sourceName(id: string): string {
  if (id === SEED_SOURCE) return 'примерные курсы, заданные при установке';
  return rateSource(id)?.name ?? id;
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string; saved?: string; error?: string }>;
}

export default async function ServicePricesPage({ params, searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');
  const { id } = await params;
  const query = await searchParams;
  if (!UUID.test(id)) notFound();

  const service = await db.service.findUnique({
    where: { id },
    include: { prices: { orderBy: [{ validFrom: 'desc' }] } },
  });
  if (service === null) notFound();

  const [settings, sources] = await Promise.all([getCurrencySettings(), getRateSources()]);
  const enabledSources = sources.filter((source) => source.isEnabled);
  const chosen = enabledSources.find((source) => source.id === query.source) ?? enabledSources[0];
  const previous = await latestStoredRates(enabledSources.map((source) => source.id));
  // Не ждём: страница уходит с прежним курсом, свежий догоняет её потоком
  const fresh: Promise<RatesOutcome | null> =
    chosen === undefined ? Promise.resolve(null) : refreshRates(chosen.id);

  const now = new Date();
  const current = currentPrices(service.prices, now);
  const history = service.prices.filter((price) => price.validTo !== null && price.validTo <= now);
  const codes = [...new Set([...settings.enabled, ...current.keys()])];
  // Подсказка — от цены в опорной валюте, нет её — от цены в основной
  const basis = current.get(settings.referenceCurrency) ?? current.get(settings.defaultCurrency);
  const name = i18nTextSchema.parse(service.titleI18n)[DEFAULT_LOCALE] ?? service.slug;

  const savedText = known(SAVED, query.saved);
  const errorText = query.error === undefined ? null : errorMessage(query.error);

  return (
    <main id="main" className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm">
        <Link href={`/admin/services?open=${service.id}`} className="underline underline-offset-4">
          ← Услуги и цены
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Цены: {name}</h1>
      <AdminNav current="/admin/services" />

      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        Цена в каждой валюте — своя и ровная. Впишите новую цену только там, где она меняется:
        пустое поле — цена прежняя. Новая цена не затирает прежнюю: та закрывается сегодняшним
        числом и остаётся в публичном архиве цен. Какие валюты здесь и в каком порядке, основная
        валюта и источники курсов — в разделе{' '}
        <Link href="/admin/currencies" className="underline underline-offset-4">
          «Валюты и курсы»
        </Link>
        .
      </p>

      {savedText !== null && (
        <p role="status" className={NOTE}>
          {savedText}
        </p>
      )}
      {query.error !== undefined && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {errorText ?? 'Не сохранено — проверьте поля и попробуйте ещё раз.'}
        </p>
      )}

      <Suspense
        fallback={
          <p className={NOTE}>
            {previous === null
              ? 'Сохранённых курсов нет. '
              : `Пока показаны прежние курсы: ${sourceName(previous.source)}, на ${previous.table.date}. `}
            {chosen !== undefined && `Запрашиваю свежие: ${chosen.name}…`}
          </p>
        }
      >
        <RatesStatus
          fresh={fresh}
          previous={previous}
          chosen={chosen}
          others={enabledSources.filter((source) => source.id !== chosen?.id)}
          serviceId={service.id}
        />
      </Suspense>

      <form action={setPrices} className="mt-6">
        <input type="hidden" name="serviceId" value={service.id} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--color-ink-soft)]">
              <tr>
                <th className="py-1 pr-3 font-normal">Валюта</th>
                <th className="py-1 pr-3 font-normal">Сейчас</th>
                <th className="py-1 pr-3 font-normal">
                  По курсу
                  {basis !== undefined &&
                    ` от ${formatPrice(basis.amountMinor, basis.currency, 'ru')}`}
                </th>
                <th className="py-1 pr-3 font-normal">Новая цена</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => {
                const price = current.get(code);
                return (
                  <tr key={code} className="border-t border-[var(--color-line)]">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{code}</span>{' '}
                      <span className="text-xs text-[var(--color-ink-soft)]">
                        {currencyNames.of(code)}
                        {code === settings.defaultCurrency && ' · основная'}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {price === undefined ? (
                        <span className="text-[var(--color-ink-soft)]">нет</span>
                      ) : (
                        <>
                          {formatPrice(price.amountMinor, code, 'ru')}{' '}
                          <span className="text-xs text-[var(--color-ink-soft)]">
                            с {day(price.validFrom)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      <Suspense
                        fallback={<Hint basis={basis} code={code} rates={previous?.table} />}
                      >
                        <FreshHint fresh={fresh} previous={previous} basis={basis} code={code} />
                      </Suspense>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        name={`amount_${code}`}
                        inputMode="decimal"
                        placeholder="не менять"
                        aria-label={`Новая цена, ${code}`}
                        className={INPUT}
                      />
                    </td>
                    <td className="py-2 text-right">
                      {price !== undefined && (
                        // Кнопка своей формы (ниже, вне этой): Enter в поле цены
                        // нажимает «Сохранить цены», а не «Убрать»
                        <button type="submit" form={`close-${price.id}`} className={SMALL_BUTTON}>
                          Убрать
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="submit" className={`${BUTTON} mt-4`}>
          Сохранить цены
        </button>
      </form>
      {[...current.values()].map((price) => (
        <form key={price.id} id={`close-${price.id}`} action={closePrice}>
          <input type="hidden" name="serviceId" value={service.id} />
          <input type="hidden" name="priceId" value={price.id} />
        </form>
      ))}

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="font-medium">История цен</h2>
          <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-soft)]">
            {history.map((price) => (
              <li key={price.id}>
                {formatPrice(price.amountMinor, price.currency, 'ru')} · {day(price.validFrom)} —{' '}
                {price.validTo === null ? '' : day(price.validTo)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

interface Basis {
  currency: string;
  amountMinor: number;
}

/** «≈ 58,81 € → ровно 60 €» — пересчёт цены-основы в валюту строки */
function Hint({
  basis,
  code,
  rates,
}: {
  basis: Basis | undefined;
  code: string;
  rates: RateTable | undefined;
}) {
  if (basis === undefined) return <span className="text-[var(--color-ink-soft)]">нет основы</span>;
  if (basis.currency === code) return <span className="text-[var(--color-ink-soft)]">основа</span>;
  const exact =
    rates === undefined ? null : convert(basis.amountMinor, basis.currency, code, rates);
  if (exact === null) return <span className="text-[var(--color-ink-soft)]">нет курса</span>;
  return (
    <span>
      ≈ {formatPrice(exact, code, 'ru')} → ровно{' '}
      <strong>{formatPrice(roundNicely(exact), code, 'ru')}</strong>
    </span>
  );
}

async function FreshHint({
  fresh,
  previous,
  ...props
}: {
  fresh: Promise<RatesOutcome | null>;
  previous: StoredRates | null;
  basis: Basis | undefined;
  code: string;
}) {
  const outcome = await fresh;
  return <Hint {...props} rates={outcome?.ok === true ? outcome.table : previous?.table} />;
}

/**
 * Чей курс на экране. Источник не ответил — прежний курс остаётся,
 * а владельцу предлагаются остальные включённые источники.
 */
async function RatesStatus({
  fresh,
  previous,
  chosen,
  others,
  serviceId,
}: {
  fresh: Promise<RatesOutcome | null>;
  previous: StoredRates | null;
  chosen: ConfiguredSource | undefined;
  others: ConfiguredSource[];
  serviceId: string;
}) {
  const outcome = await fresh;
  const here = `/admin/services/${serviceId}/prices`;

  if (outcome?.ok === true) {
    const attribution = rateSource(outcome.source)?.attribution ?? null;
    return (
      <p className={NOTE}>
        Курсы: {sourceName(outcome.source)}, на {outcome.table.date}.
        {attribution !== null && (
          <>
            {' '}
            <a
              href={attribution.href}
              rel="noreferrer noopener"
              className="underline underline-offset-4"
            >
              {attribution.text}
            </a>
          </>
        )}
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p>
        {chosen === undefined
          ? 'Все источники курсов выключены.'
          : `${chosen.name} сейчас недоступен.`}{' '}
        {previous === null
          ? 'Сохранённых курсов нет — подсказки нет, цены ставятся как обычно.'
          : `Показаны прежние курсы: ${sourceName(previous.source)}, на ${previous.table.date}.`}
      </p>
      {others.length > 0 && (
        <p className="mt-2">
          Попробовать получить курсы из{' '}
          {others.map((source, index) => (
            <span key={source.id}>
              {index > 0 && ' или '}
              <Link
                href={`${here}?source=${source.id}`}
                className="font-medium underline underline-offset-4"
              >
                {source.name}
              </Link>
            </span>
          ))}
          ?
        </p>
      )}
      {chosen !== undefined && (
        <p className="mt-2">
          <Link href={`${here}?source=${chosen.id}`} className="underline underline-offset-4">
            Повторить запрос: {chosen.name}
          </Link>
        </p>
      )}
    </div>
  );
}
