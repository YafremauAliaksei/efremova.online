import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  addCurrency,
  moveCurrency,
  moveSource,
  saveCurrencies,
  saveMainCurrencies,
  saveSources,
} from '@/app/admin/currencies/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { orderRows } from '@/lib/services/currency-config';
import { getCurrencySettings, getRateSources } from '@/lib/services/currency-settings';

/**
 * Валюты и курсы (PROJECT_LOG, задача 9b) — всё, что раньше было бы
 * константой в коде:
 *   • основная валюта сайта и опорная валюта подсказки курса;
 *   • какие валюты в редакторе цен и в каком порядке, новая валюта;
 *   • какие источники курсов пробовать и в каком порядке.
 * Сами источники (адрес, разбор ответа) — в коде: src/lib/services/rates.ts.
 */

export const metadata: Metadata = {
  title: 'Валюты и курсы',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SAVED = {
  main: 'Основная и опорная валюта сохранены.',
  list: 'Список валют сохранён.',
  added: 'Валюта добавлена в конец списка.',
  moved: 'Порядок изменён.',
  sources: 'Источники курсов сохранены.',
} as const;

const ERRORS = {
  code: 'Валюта не принята: нужен код ISO 4217 с копейками — PLN, EUR, KZT… Иена, динар и другие валюты без копеек не поддерживаются.',
  missing: 'Не найдено — обновите страницу.',
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

const INPUT = 'mt-1 rounded border border-[var(--color-line)] px-3 py-2 font-normal';
const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-0.5 text-xs hover:bg-[var(--color-paper-alt)] disabled:opacity-40';
const BUTTON =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
const CARD = 'mt-8 rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm';

const currencyNames = new Intl.DisplayNames('ru', { type: 'currency' });

interface PageProps {
  searchParams: Promise<{ saved?: string; error?: string }>;
}

export default async function CurrenciesAdminPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');
  const params = await searchParams;

  const [rows, settings, sources, snapshots] = await Promise.all([
    db.currency.findMany(),
    getCurrencySettings(),
    getRateSources(),
    db.rateSnapshot.findMany({ select: { source: true, rateDate: true, fetchedAt: true } }),
  ]);
  const ordered = orderRows(rows, (row) => row.code);
  const enabled = ordered.filter((row) => row.isEnabled);
  const disabled = ordered.filter((row) => !row.isEnabled);
  const enabledSources = sources.filter((source) => source.isEnabled);
  const forced = new Set([settings.defaultCurrency, settings.referenceCurrency]);

  const savedText = known(SAVED, params.saved);
  const errorText = known(ERRORS, params.error);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Валюты и курсы</h1>
      <AdminNav current="/admin/currencies" />

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
          {errorText ?? 'Не сохранено — попробуйте ещё раз.'}
        </p>
      )}

      {/* ── основная и опорная ── */}
      <form action={saveMainCurrencies} className={CARD}>
        <h2 className="font-medium">Основная валюта</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          Основная — в ней посетитель видит цены по умолчанию, она первая в переключателе валют.
          Опорная — от цены в ней редактор цен считает подсказку «по курсу ≈ … → ровно …».
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block">
            Основная
            <select
              name="defaultCurrency"
              defaultValue={settings.defaultCurrency}
              className={`${INPUT} block`}
            >
              {enabled.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.code} — {currencyNames.of(row.code)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Опорная для курса
            <select
              name="referenceCurrency"
              defaultValue={settings.referenceCurrency}
              className={`${INPUT} block`}
            >
              {enabled.map((row) => (
                <option key={row.code} value={row.code}>
                  {row.code} — {currencyNames.of(row.code)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={BUTTON}>
            Сохранить
          </button>
        </div>
      </form>

      {/* ── список валют ── */}
      <form action={saveCurrencies} className={CARD}>
        <h2 className="font-medium">Валюты в редакторе цен</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          Отмеченные валюты — строки в редакторе цен, в этом порядке; в нём же валюты стоят в
          переключателе у посетителя. Цена в снятой валюте остаётся на сайте, пока её не убрать в
          редакторе цен. Основную и опорную снять нельзя.
        </p>
        <ol className="mt-4 space-y-1">
          {enabled.map((row, index) => (
            <li key={row.code} className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-2">
                <input
                  type="checkbox"
                  name="enabled"
                  value={row.code}
                  defaultChecked
                  disabled={forced.has(row.code)}
                />
                <span className="font-medium">{row.code}</span>
                <span className="text-[var(--color-ink-soft)]">{currencyNames.of(row.code)}</span>
              </label>
              {(['up', 'down'] as const).map((direction) => (
                <button
                  key={direction}
                  type="submit"
                  formAction={moveCurrency.bind(null, `${row.code}:${direction}`)}
                  disabled={direction === 'up' ? index === 0 : index === enabled.length - 1}
                  aria-label={`${row.code} ${direction === 'up' ? 'выше' : 'ниже'}`}
                  className={SMALL_BUTTON}
                >
                  {direction === 'up' ? '↑' : '↓'}
                </button>
              ))}
            </li>
          ))}
        </ol>
        {disabled.length > 0 && (
          <fieldset className="mt-4 border-t border-[var(--color-line)] pt-3">
            <legend className="sr-only">Остальные валюты</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {disabled.map((row) => (
                <label key={row.code} className="flex items-center gap-2">
                  <input type="checkbox" name="enabled" value={row.code} />
                  <span className="font-medium">{row.code}</span>
                  <span className="truncate text-xs text-[var(--color-ink-soft)]">
                    {currencyNames.of(row.code)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <button type="submit" className={`${BUTTON} mt-4`}>
          Сохранить список
        </button>
      </form>

      <form action={addCurrency} className={`${CARD} flex flex-wrap items-end gap-3`}>
        <label className="block">
          Добавить валюту (код ISO 4217)
          <input
            name="code"
            placeholder="PEN"
            maxLength={3}
            required
            className={`${INPUT} block w-28 uppercase`}
          />
        </label>
        <button type="submit" className={BUTTON}>
          Добавить
        </button>
      </form>

      {/* ── источники курсов ── */}
      <form action={saveSources} className={CARD}>
        <h2 className="font-medium">Источники курсов</h2>
        <p className="mt-2 text-[var(--color-ink-soft)]">
          Курс спрашивается только при открытии редактора цен — у первого отмеченного источника. Не
          ответил — редактор показывает прежний курс и предлагает следующие. Запрос делает сервер,
          адреса источников зашиты в коде.
        </p>
        <ol className="mt-4 space-y-2">
          {sources.map((source) => {
            const index = enabledSources.indexOf(source);
            const snapshot = snapshots.find((row) => row.source === source.id);
            return (
              <li key={source.id} className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    name="source"
                    value={source.id}
                    defaultChecked={source.isEnabled}
                  />
                  <span>
                    <span className="font-medium">{source.name}</span>{' '}
                    <span className="text-xs text-[var(--color-ink-soft)]">
                      {new URL(source.urls[0] ?? 'https://invalid').host}
                      {snapshot !== undefined && ` · курс на ${snapshot.rateDate}`}
                    </span>
                  </span>
                </label>
                {source.isEnabled &&
                  (['up', 'down'] as const).map((direction) => (
                    <button
                      key={direction}
                      type="submit"
                      formAction={moveSource.bind(null, `${source.id}:${direction}`)}
                      disabled={
                        direction === 'up' ? index === 0 : index === enabledSources.length - 1
                      }
                      aria-label={`${source.name} ${direction === 'up' ? 'выше' : 'ниже'}`}
                      className={SMALL_BUTTON}
                    >
                      {direction === 'up' ? '↑' : '↓'}
                    </button>
                  ))}
              </li>
            );
          })}
        </ol>
        <button type="submit" className={`${BUTTON} mt-4`}>
          Сохранить источники
        </button>
      </form>
    </main>
  );
}
