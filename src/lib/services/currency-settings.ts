import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import {
  DEFAULT_CURRENCY_KEY,
  FALLBACK_DEFAULT_CURRENCY,
  FALLBACK_REFERENCE_CURRENCY,
  REFERENCE_CURRENCY_KEY,
  orderRows,
  resolveCurrencySettings,
  type CurrencySettings,
} from '@/lib/services/currency-config';
import { RATE_SOURCES, type RateSourceDefinition } from '@/lib/services/rates';

/**
 * Настройки валют из базы (src/lib/services/currency-config.ts) — один
 * запрос на страницу: cache() не даёт спрашивать базу для каждого списка
 * услуг на странице заново.
 *
 * База недоступна — запасные значения: публичная страница с ценами в злотых
 * лучше, чем ошибка.
 */
export const getCurrencySettings = cache(async (): Promise<CurrencySettings> => {
  try {
    const [rows, settings] = await Promise.all([
      db.currency.findMany(),
      db.siteSetting.findMany({
        where: { key: { in: [DEFAULT_CURRENCY_KEY, REFERENCE_CURRENCY_KEY] } },
      }),
    ]);
    return resolveCurrencySettings(
      rows,
      Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
    );
  } catch {
    return {
      defaultCurrency: FALLBACK_DEFAULT_CURRENCY,
      referenceCurrency: FALLBACK_REFERENCE_CURRENCY,
      enabled: [FALLBACK_DEFAULT_CURRENCY, FALLBACK_REFERENCE_CURRENCY],
    };
  }
});

export interface ConfiguredSource extends RateSourceDefinition {
  isEnabled: boolean;
  sortOrder: number;
}

/**
 * Источники курсов в порядке админки. Источник из кода, которого ещё нет
 * в базе, — включён и в конце: новый источник после выкладки сразу виден.
 * Строка базы без источника в коде пропускается: ходить по ней некуда.
 */
export async function getRateSources(): Promise<ConfiguredSource[]> {
  const rows = await db.rateSource.findMany();
  const sources = RATE_SOURCES.map((source, index) => {
    const row = rows.find((candidate) => candidate.id === source.id);
    return {
      ...source,
      isEnabled: row?.isEnabled ?? true,
      sortOrder: row?.sortOrder ?? 1000 + index,
    };
  });
  return orderRows(sources, (source) => source.id);
}
