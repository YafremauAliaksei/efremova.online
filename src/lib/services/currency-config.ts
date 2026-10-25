import { isCurrencyCode } from './edit';

/**
 * Настройки валют — из базы, а не из кода (PROJECT_LOG, задача 9b).
 *
 * Список валют (currencies), источники курсов (rate_sources) и две настройки
 * в site_settings правятся в админке: сменить основную валюту, добавить
 * валюту или переставить источники — без правки кода и выкладки.
 *
 * Что бы ни лежало в базе, отсюда выходит рабочая настройка: неизвестная
 * валюта пропускается, пустая настройка заменяется запасной. Сайт, впервые
 * запущенный на пустой базе, тоже получает осмысленные значения.
 *
 * Файл без 'server-only' и без базы: чистые функции, их проверяют тесты.
 */

/** Основная валюта: в ней цены по умолчанию у посетителя и в админке */
export const DEFAULT_CURRENCY_KEY = 'currency.default';
/** От цены в этой валюте считается подсказка курса в редакторе цен */
export const REFERENCE_CURRENCY_KEY = 'currency.reference';

/** Запасные значения — когда в базе ничего нет или там не валюта */
export const FALLBACK_DEFAULT_CURRENCY = 'PLN';
export const FALLBACK_REFERENCE_CURRENCY = 'EUR';

export interface OrderedRow {
  isEnabled: boolean;
  sortOrder: number;
}

export interface CurrencyRow extends OrderedRow {
  code: string;
}

export interface CurrencySettings {
  defaultCurrency: string;
  referenceCurrency: string;
  /** Включённые валюты в порядке админки; основная и опорная — всегда здесь */
  enabled: string[];
}

function byOrder<T extends OrderedRow>(key: (row: T) => string) {
  return (a: T, b: T) => a.sortOrder - b.sortOrder || key(a).localeCompare(key(b));
}

/** Строки базы и две настройки → рабочая настройка валют */
export function resolveCurrencySettings(
  rows: readonly CurrencyRow[],
  values: Readonly<Record<string, string | undefined>>
): CurrencySettings {
  const pick = (raw: string | undefined, fallback: string) =>
    raw !== undefined && isCurrencyCode(raw) ? raw : fallback;
  const defaultCurrency = pick(values[DEFAULT_CURRENCY_KEY], FALLBACK_DEFAULT_CURRENCY);
  const referenceCurrency = pick(values[REFERENCE_CURRENCY_KEY], FALLBACK_REFERENCE_CURRENCY);
  const enabled = rows
    .filter((row) => row.isEnabled && isCurrencyCode(row.code))
    .sort(byOrder((row) => row.code))
    .map((row) => row.code);
  return {
    defaultCurrency,
    referenceCurrency,
    enabled: [...new Set([defaultCurrency, ...enabled, referenceCurrency])],
  };
}

/** Строки по порядку админки: сначала включённые, затем остальные по алфавиту */
export function orderRows<T extends OrderedRow>(rows: readonly T[], key: (row: T) => string): T[] {
  const enabled = rows.filter((row) => row.isEnabled).sort(byOrder(key));
  const disabled = rows
    .filter((row) => !row.isEnabled)
    .sort((a, b) => key(a).localeCompare(key(b)));
  return [...enabled, ...disabled];
}

/**
 * Флажки из формы → что включить и в каком порядке. Включённые остаются на
 * своих местах, только что включённые встают в конец, выключенные выпадают.
 * Ключи из формы, которых нет в базе, не создают строк: список — из базы.
 */
export function applyChecked<T extends OrderedRow>(
  rows: readonly T[],
  key: (row: T) => string,
  checked: ReadonlySet<string>,
  forced: ReadonlySet<string> = new Set()
): { key: string; isEnabled: boolean; sortOrder: number }[] {
  const ordered = orderRows(rows, key);
  const kept = ordered.filter(
    (row) => row.isEnabled && (checked.has(key(row)) || forced.has(key(row)))
  );
  const added = ordered.filter(
    (row) => !row.isEnabled && (checked.has(key(row)) || forced.has(key(row)))
  );
  const position = new Map([...kept, ...added].map((row, index) => [key(row), index]));
  return ordered.map((row) => {
    const index = position.get(key(row));
    return {
      key: key(row),
      isEnabled: index !== undefined,
      sortOrder: index === undefined ? row.sortOrder : (index + 1) * 10,
    };
  });
}

/** Код валюты из формы: «eur » → EUR; не валюта с копейками — null */
export function parseCurrencyCode(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return isCurrencyCode(value) ? value : null;
}
