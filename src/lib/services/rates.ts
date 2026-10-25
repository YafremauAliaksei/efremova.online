import { z } from 'zod';

/**
 * Курсы валют — подсказка владельцу в редакторе цен (PROJECT_LOG, задача 9b).
 *
 * Цену в каждой валюте владелец ставит сам, ровным числом: 200 zł, 45 €.
 * Курс нужен только чтобы прикинуть, какое ровное число поставить, — на сайт
 * он не попадает и ничего не пересчитывает сам.
 *
 * Источников несколько: один недоступен — владелец пробует следующий. Какие
 * включены и в каком порядке — в базе (rate_sources), а что такое источник —
 * адрес и разбор ответа — только здесь. Адрес из базы или из формы сделал бы
 * сервер прокси к чему угодно (SSRF), поэтому новый источник — это новая
 * запись в RATE_SOURCES и ревью, а не строка в админке.
 *
 * Ответы источников разные, курс внутри один: RateTable — сколько единиц
 * каждой валюты дают за одну единицу base. Так любую валюту можно перевести
 * в любую, какой бы ни была база у источника.
 *
 * Файл без 'server-only' и без сети: чистые функции, их проверяют тесты.
 * Запросы — в rates-fetch.ts.
 */

export interface RateTable {
  /** Валюта, к которой даны курсы */
  base: string;
  /** Дата курса по данным источника, YYYY-MM-DD */
  date: string;
  /** Код валюты → сколько её единиц за одну base; у самой base — 1 */
  rates: Record<string, number>;
}

export interface RateSourceDefinition {
  id: string;
  /** Как источник называется в админке */
  name: string;
  /** Адреса зашиты: в запросе нет ничего, что пришло из формы или из базы */
  urls: readonly string[];
  /** Разбор ответов по порядку urls; null — ответ не похож на курсы */
  parse: (bodies: readonly unknown[]) => RateTable | null;
  /** Подпись, которую источник требует показывать рядом с его курсами */
  attribution: { text: string; href: string } | null;
}

/** Строка в rate_snapshots с примерными курсами из миграции */
export const SEED_SOURCE = 'seed';

const code = z.string().regex(/^[A-Z]{3}$/);
/** Курс — положительное число в разумных пределах: 0 или 1e300 — не курс */
const rateValue = z.number().positive().min(1e-9).max(1e9);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Таблица с базой и хотя бы одной другой валютой — иначе подсказывать нечего */
function table(base: string, date: string, rates: Map<string, number>): RateTable | null {
  rates.set(base, 1);
  return rates.size > 1 ? { base, date, rates: Object.fromEntries(rates) } : null;
}

function dayOf(timestamp: number): string | null {
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
}

/**
 * Национальный банк Польши: официальный, без ключа. Таблица A — основные
 * валюты каждый рабочий день, B — остальные (в том числе BYN) раз в неделю.
 * Курс — злотых за единицу валюты, поэтому переворачивается.
 */
const nbpSchema = z
  .array(
    z.object({
      table: z.string().max(1),
      effectiveDate: isoDate,
      rates: z.array(z.object({ code, mid: rateValue })).max(300),
    })
  )
  .length(1);

export function parseNbp(bodies: readonly unknown[]): RateTable | null {
  const rates = new Map<string, number>();
  let date = '';
  for (const body of bodies) {
    const parsed = nbpSchema.safeParse(body);
    if (!parsed.success) continue;
    const [nbpTable] = parsed.data;
    if (nbpTable === undefined) continue;
    // Валюта есть в обеих таблицах — побеждает A: её курс свежее
    for (const rate of nbpTable.rates) {
      if (rates.has(rate.code) && nbpTable.table !== 'A') continue;
      rates.set(rate.code, 1 / rate.mid);
    }
    if (nbpTable.effectiveDate > date) date = nbpTable.effectiveDate;
  }
  return table('PLN', date, rates);
}

/** open.er-api.com: бесплатный, без ключа, обновляется раз в сутки, база — евро */
const erApiSchema = z.object({
  result: z.literal('success'),
  base_code: z.literal('EUR'),
  time_last_update_unix: z.number().int().positive(),
  rates: z.record(z.string(), z.unknown()),
});

export function parseErApi([body]: readonly unknown[]): RateTable | null {
  const parsed = erApiSchema.safeParse(body);
  if (!parsed.success) return null;
  const date = dayOf(parsed.data.time_last_update_unix * 1000);
  if (date === null) return null;
  const rates = new Map<string, number>();
  for (const [key, value] of Object.entries(parsed.data.rates).slice(0, 400)) {
    const rate = rateValue.safeParse(value);
    if (code.safeParse(key).success && rate.success) rates.set(key, rate.data);
  }
  return table('EUR', date, rates);
}

/** floatrates.com: ежедневная выгрузка к евро, без ключа */
const floatRateSchema = z.object({ code, rate: rateValue, date: z.string().max(64) });

export function parseFloatRates([body]: readonly unknown[]): RateTable | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const rates = new Map<string, number>();
  let date: string | null = null;
  for (const entry of Object.values(body).slice(0, 400)) {
    const parsed = floatRateSchema.safeParse(entry);
    if (!parsed.success) continue;
    rates.set(parsed.data.code, parsed.data.rate);
    date ??= dayOf(Date.parse(parsed.data.date));
  }
  return date === null ? null : table('EUR', date, rates);
}

export const RATE_SOURCES: readonly RateSourceDefinition[] = [
  {
    id: 'nbp',
    name: 'Национальный банк Польши (NBP)',
    urls: [
      'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
      'https://api.nbp.pl/api/exchangerates/tables/B/?format=json',
    ],
    parse: parseNbp,
    attribution: null,
  },
  {
    id: 'er-api',
    name: 'ExchangeRate-API',
    urls: ['https://open.er-api.com/v6/latest/EUR'],
    parse: parseErApi,
    // Условие бесплатного доступа — подпись со ссылкой рядом с курсами
    attribution: { text: 'Rates By Exchange Rate API', href: 'https://www.exchangerate-api.com' },
  },
  {
    id: 'floatrates',
    name: 'FloatRates',
    urls: ['https://www.floatrates.com/daily/eur.json'],
    parse: parseFloatRates,
    attribution: null,
  },
];

export function rateSource(id: string): RateSourceDefinition | undefined {
  return RATE_SOURCES.find((source) => source.id === id);
}

/** Сохранённая таблица из базы: JSON — не обещание формата, проверяется заново */
const storedSchema = z.object({
  base: code,
  date: isoDate,
  rates: z.record(code, rateValue),
});

export function parseStoredTable(value: unknown): RateTable | null {
  const parsed = storedSchema.safeParse(value);
  if (!parsed.success || parsed.data.rates[parsed.data.base] === undefined) return null;
  return parsed.data;
}

/**
 * Сумма из одной валюты в другую по таблице, в минорных единицах. null —
 * у источника нет курса одной из валют.
 */
export function convert(
  amountMinor: number,
  from: string,
  to: string,
  rates: RateTable
): number | null {
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  if (fromRate === undefined || toRate === undefined) return null;
  return Math.round((amountMinor * toRate) / fromRate);
}

/**
 * Ровное число рядом с пересчётом — то, что владелец и так бы поставил:
 * 58,81 € → 60 €, 253 → 250, 5873 ₽ → 5900 ₽, 12,40 → 12. Шаг растёт вместе
 * с суммой: две значащие цифры; от 20 до 99 — кратно пяти, меньше 20 — целое
 * (шаг 5 превратил бы 12 в 10 — это уже другая цена).
 */
export function roundNicely(amountMinor: number): number {
  const units = amountMinor / 100;
  if (units < 1) return amountMinor;
  const digits = Math.floor(Math.log10(units)) + 1;
  const step = units < 20 ? 1 : digits === 2 ? 5 : 10 ** (digits - 2);
  return Math.max(step, Math.round(units / step) * step) * 100;
}
