import { z } from 'zod';

/**
 * Курсы валют — подсказка владельцу в админке (PROJECT_LOG, задача 9b).
 *
 * Цену в каждой валюте владелец ставит сам, ровным числом: 200 zł, 45 €.
 * Курс нужен только чтобы прикинуть, какое ровное число поставить, — на сайт
 * он не попадает и ничего не пересчитывает сам.
 *
 * Источник — Национальный банк Польши (api.nbp.pl): официальный, бесплатный,
 * без ключа, курсы к злотому. Таблица A — основные валюты, каждый рабочий
 * день; таблица B — остальные (в том числе белорусский рубль), раз в неделю.
 * Два запроса — и известны почти все валюты мира.
 *
 * Файл без 'server-only' и без сети: чистые функции, их проверяют тесты.
 * Запросы — в rates-fetch.ts.
 */

/** Адреса зашиты: в запросе нет ничего, что пришло из формы или от посетителя */
export const NBP_TABLE_URLS = [
  'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
  'https://api.nbp.pl/api/exchangerates/tables/B/?format=json',
] as const;

/**
 * Ответ NBP: массив из одной таблицы. Чужой ответ — не обещание формата:
 * всё, что не сошлось со схемой, отбрасывается, а не «примерно читается».
 */
const tableSchema = z
  .array(
    z.object({
      table: z.string().max(1),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rates: z
        .array(
          z.object({
            code: z.string().regex(/^[A-Z]{3}$/),
            mid: z.number().positive().max(1_000_000),
          })
        )
        .max(300),
    })
  )
  .length(1);

export interface ExchangeRate {
  /** Сколько злотых стоит одна единица валюты */
  plnPerUnit: number;
  /** Дата курса по таблице NBP */
  date: string;
}

/**
 * Курсы из ответов NBP: код валюты → курс. Испорченный ответ пропускается,
 * остальные читаются. Валюта есть в обеих таблицах — побеждает таблица A:
 * её курс свежее.
 */
export function parseNbpTables(bodies: readonly unknown[]): Map<string, ExchangeRate> {
  const rates = new Map<string, ExchangeRate>();
  for (const body of bodies) {
    const parsed = tableSchema.safeParse(body);
    if (!parsed.success) continue;
    const [table] = parsed.data;
    if (table === undefined) continue;
    for (const rate of table.rates) {
      if (rates.has(rate.code) && table.table !== 'A') continue;
      rates.set(rate.code, { plnPerUnit: rate.mid, date: table.effectiveDate });
    }
  }
  return rates;
}

/** Цена в злотых → та же цена в другой валюте по курсу, в минорных единицах */
export function convertFromPln(amountMinorPln: number, rate: ExchangeRate): number {
  return Math.round(amountMinorPln / rate.plnPerUnit);
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
