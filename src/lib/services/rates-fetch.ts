import 'server-only';
import { readLimited } from '@/lib/http/limited';
import { NBP_TABLE_URLS, parseNbpTables, type ExchangeRate } from '@/lib/services/rates';

/**
 * Курсы NBP для подсказки в админке (src/lib/services/rates.ts).
 *
 * Запрос делает СЕРВЕР, браузер админки к NBP не обращается — правило 5
 * (ни одного чужого домена у браузера) не затронуто. Устроен как запрос
 * обложек YouTube (src/lib/media/thumbnail.ts), чтобы им нельзя было
 * воспользоваться:
 *   • адреса зашиты, ничего из формы в них не попадает (SSRF);
 *   • переадресации запрещены, время и объём ответа ограничены;
 *   • ответ проверяется схемой, а не читается «как получится».
 *
 * Данных посетителей и владельца в запросе нет — только адрес сервера.
 * Курсы держатся в памяти шесть часов: NBP обновляет таблицу A раз в день,
 * и ходить к нему на каждое открытие админки незачем. Неудача помнится
 * десять минут — недоступный NBP не тормозит каждую страницу админки.
 */

const TIMEOUT_MS = 5_000;
/** Таблица NBP — десятки килобайт; больше — не тот ответ */
const MAX_BYTES = 256 * 1024;
const FRESH_MS = 6 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

let cached: { rates: Map<string, ExchangeRate>; until: number } | null = null;

async function fetchTable(url: string, fetchImpl: Fetch): Promise<unknown> {
  try {
    const response = await fetchImpl(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const bytes = await readLimited(response, MAX_BYTES);
    return bytes === null ? null : (JSON.parse(new TextDecoder().decode(bytes)) as unknown);
  } catch {
    // Сеть, таймаут, переадресация, не JSON — курса просто нет
    return null;
  }
}

/** Курсы к злотому; пусто — NBP недоступен, админка работает без подсказки */
export async function getExchangeRates(
  now = Date.now(),
  fetchImpl: Fetch = fetch
): Promise<Map<string, ExchangeRate>> {
  if (cached !== null && cached.until > now) return cached.rates;
  const bodies = await Promise.all(NBP_TABLE_URLS.map((url) => fetchTable(url, fetchImpl)));
  const rates = parseNbpTables(bodies);
  cached = { rates, until: now + (rates.size > 0 ? FRESH_MS : RETRY_MS) };
  return rates;
}

/** Для тестов: забыть запомненные курсы */
export function resetExchangeRatesCache(): void {
  cached = null;
}
