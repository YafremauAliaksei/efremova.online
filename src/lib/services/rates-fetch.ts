import 'server-only';
import { db } from '@/lib/db';
import { readLimited } from '@/lib/http/limited';
import { SEED_SOURCE, parseStoredTable, rateSource, type RateTable } from '@/lib/services/rates';

/**
 * Курсы для редактора цен (src/lib/services/rates.ts).
 *
 * Запрос уходит, только когда владелец открыл редактор цен: список услуг,
 * сайт и остальная админка курсов не спрашивают — пока цены не меняются,
 * ходить никуда незачем.
 *
 * Запрос делает СЕРВЕР, браузер админки к источнику не обращается —
 * правило 5 (ни одного чужого домена у браузера) не затронуто. Устроен как
 * запрос обложек YouTube (src/lib/media/thumbnail.ts):
 *   • адреса зашиты в коде, ничего из формы или базы в них не попадает (SSRF);
 *   • переадресации запрещены, время и объём ответа ограничены;
 *   • ответ проверяется схемой, а не читается «как получится».
 * Данных посетителей и владельца в запросе нет — только адрес сервера.
 *
 * Полученный курс ложится в rate_snapshots — по строке на источник, таблица
 * не растёт. Курс моложе трёх часов берётся оттуда без запроса: источники
 * обновляются раз в день, а частые открытия редактора (или чужой, кто
 * завладел сессией) не превращаются в поток запросов. Неудача помнится
 * минуту — кнопка «попробовать ещё раз» работает, а долбить источник нельзя.
 */

const TIMEOUT_MS = 5_000;
/** Таблица курсов — десятки килобайт; больше — не тот ответ */
const MAX_BYTES = 256 * 1024;
const FRESH_MS = 3 * 60 * 60 * 1000;
const RETRY_MS = 60 * 1000;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

export interface StoredRates {
  source: string;
  table: RateTable;
  fetchedAt: Date;
}

export type RatesOutcome = ({ ok: true } & StoredRates) | { ok: false; source: string };

const failedUntil = new Map<string, number>();

async function fetchJson(url: string, fetchImpl: Fetch): Promise<unknown> {
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

function stored(row: {
  source: string;
  base: string;
  rates: unknown;
  rateDate: string;
  fetchedAt: Date;
}): StoredRates | null {
  const table = parseStoredTable({ base: row.base, date: row.rateDate, rates: row.rates });
  return table === null ? null : { source: row.source, table, fetchedAt: row.fetchedAt };
}

/**
 * Свежий курс источника: из базы, если он моложе трёх часов, иначе запросом.
 * Никогда не бросает: недоступный источник — { ok: false }, и редактор
 * остаётся с прежним курсом.
 */
export async function refreshRates(
  sourceId: string,
  now = new Date(),
  fetchImpl: Fetch = fetch
): Promise<RatesOutcome> {
  const failed = { ok: false, source: sourceId } as const;
  const source = rateSource(sourceId);
  if (source === undefined) return failed;
  try {
    const row = await db.rateSnapshot.findUnique({ where: { source: sourceId } });
    const known = row === null ? null : stored(row);
    if (known !== null && now.getTime() - known.fetchedAt.getTime() < FRESH_MS) {
      return { ok: true, ...known };
    }
    if ((failedUntil.get(sourceId) ?? 0) > now.getTime()) return failed;

    const bodies = await Promise.all(source.urls.map((url) => fetchJson(url, fetchImpl)));
    const table = source.parse(bodies);
    if (table === null) {
      failedUntil.set(sourceId, now.getTime() + RETRY_MS);
      return failed;
    }
    const data = { base: table.base, rates: table.rates, rateDate: table.date, fetchedAt: now };
    await db.rateSnapshot.upsert({
      where: { source: sourceId },
      create: { source: sourceId, ...data },
      update: data,
    });
    return { ok: true, source: sourceId, table, fetchedAt: now };
  } catch {
    return failed;
  }
}

/**
 * Последний сохранённый курс — то, что редактор показывает сразу, пока
 * свежий ещё в пути. Из включённых источников — самый свежий; если ни один
 * ещё не отвечал — примерные курсы из миграции. null — база пуста.
 */
export async function latestStoredRates(sourceIds: readonly string[]): Promise<StoredRates | null> {
  try {
    const rows = await db.rateSnapshot.findMany({
      where: { source: { in: [...sourceIds, SEED_SOURCE] } },
      orderBy: { fetchedAt: 'desc' },
    });
    for (const row of rows) {
      const known = stored(row);
      if (known !== null) return known;
    }
    return null;
  } catch {
    return null;
  }
}

/** Для тестов: забыть неудачи */
export function resetRatesFailures(): void {
  failedUntil.clear();
}
