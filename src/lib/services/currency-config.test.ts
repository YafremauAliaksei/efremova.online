import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CURRENCY_KEY,
  REFERENCE_CURRENCY_KEY,
  applyChecked,
  orderRows,
  parseCurrencyCode,
  resolveCurrencySettings,
} from './currency-config';

/**
 * Настройки валют живут в базе и правятся в админке (задача 9b). Что бы там
 * ни лежало — сайт получает рабочую настройку, а не ошибку.
 */

const row = (code: string, isEnabled: boolean, sortOrder: number) => ({
  code,
  isEnabled,
  sortOrder,
});

describe('настройка из базы', () => {
  it('основная, опорная и включённые по порядку админки', () => {
    const settings = resolveCurrencySettings(
      [row('RUB', true, 30), row('PLN', true, 10), row('USD', false, 5), row('EUR', true, 20)],
      { [DEFAULT_CURRENCY_KEY]: 'EUR', [REFERENCE_CURRENCY_KEY]: 'PLN' }
    );
    expect(settings).toEqual({
      defaultCurrency: 'EUR',
      referenceCurrency: 'PLN',
      enabled: ['EUR', 'PLN', 'RUB'],
    });
  });

  it('пустая база — злотые и евро, сайт работает', () => {
    expect(resolveCurrencySettings([], {})).toEqual({
      defaultCurrency: 'PLN',
      referenceCurrency: 'EUR',
      enabled: ['PLN', 'EUR'],
    });
  });

  it('в базе не валюта — запасное значение; валюта без копеек пропускается', () => {
    const settings = resolveCurrencySettings([row('JPY', true, 1), row('BYN', true, 2)], {
      [DEFAULT_CURRENCY_KEY]: '<script>',
      [REFERENCE_CURRENCY_KEY]: 'BTC',
    });
    expect(settings.defaultCurrency).toBe('PLN');
    expect(settings.referenceCurrency).toBe('EUR');
    expect(settings.enabled).toEqual(['PLN', 'BYN', 'EUR']);
  });
});

describe('флажки и порядок', () => {
  const rows = [
    row('PLN', true, 10),
    row('EUR', true, 20),
    row('RUB', true, 30),
    row('KZT', false, 0),
    row('BYN', false, 0),
  ];
  const code = (r: { code: string }) => r.code;

  it('сначала включённые по порядку, затем остальные по алфавиту', () => {
    expect(orderRows(rows, code).map(code)).toEqual(['PLN', 'EUR', 'RUB', 'BYN', 'KZT']);
  });

  it('снятая выпадает, отмеченная встаёт в конец, порядок остальных сохраняется', () => {
    const next = applyChecked(rows, code, new Set(['PLN', 'RUB', 'KZT']));
    expect(next.filter((r) => r.isEnabled).map((r) => [r.key, r.sortOrder])).toEqual([
      ['PLN', 10],
      ['RUB', 20],
      ['KZT', 30],
    ]);
    expect(next.find((r) => r.key === 'EUR')?.isEnabled).toBe(false);
  });

  it('обязательная валюта не снимается; код не из базы строки не создаёт', () => {
    const next = applyChecked(rows, code, new Set(['XYZ']), new Set(['PLN']));
    expect(next.filter((r) => r.isEnabled).map((r) => r.key)).toEqual(['PLN']);
    expect(next.some((r) => r.key === 'XYZ')).toBe(false);
  });

  it('код валюты из формы', () => {
    expect(parseCurrencyCode(' kzt ')).toBe('KZT');
    expect(parseCurrencyCode('JPY')).toBeNull();
    expect(parseCurrencyCode('PLN; DROP')).toBeNull();
    expect(parseCurrencyCode(null)).toBeNull();
  });
});
