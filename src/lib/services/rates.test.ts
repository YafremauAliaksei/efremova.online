import { describe, expect, it } from 'vitest';
import {
  RATE_SOURCES,
  convert,
  parseErApi,
  parseFloatRates,
  parseNbp,
  parseStoredTable,
  roundNicely,
} from './rates';

/**
 * Курс — только подсказка владельцу (задача 9b), но ответ чужого сервера
 * читается строго: всё, что не похоже на курсы, отбрасывается. Ответы
 * разных источников сводятся к одной таблице — «единиц за одну базу».
 */

const tableA = [
  {
    table: 'A',
    no: '206/A/NBP/2026',
    effectiveDate: '2026-10-23',
    rates: [
      { currency: 'euro', code: 'EUR', mid: 4.25 },
      { currency: 'rubel rosyjski', code: 'RUB', mid: 0.05 },
    ],
  },
];
const tableB = [
  {
    table: 'B',
    no: '043/B/NBP/2026',
    effectiveDate: '2026-10-21',
    rates: [
      { currency: 'rubel białoruski', code: 'BYN', mid: 1.25 },
      { currency: 'euro (stary kurs)', code: 'EUR', mid: 9.99 },
    ],
  },
];

describe('NBP', () => {
  it('две таблицы — одна таблица к злотому, дата — самая свежая', () => {
    const table = parseNbp([tableA, tableB]);
    expect(table?.base).toBe('PLN');
    expect(table?.date).toBe('2026-10-23');
    expect(table?.rates.PLN).toBe(1);
    expect(table?.rates.BYN).toBe(0.8);
  });

  it('валюта в обеих таблицах — побеждает таблица A, в каком бы порядке ни пришли', () => {
    expect(parseNbp([tableA, tableB])?.rates.EUR).toBeCloseTo(1 / 4.25);
    expect(parseNbp([tableB, tableA])?.rates.EUR).toBeCloseTo(1 / 4.25);
  });

  it.each([
    ['не массив', { rates: [] }],
    ['пустой ответ', null],
    ['две таблицы в одном ответе', [...tableA, ...tableA]],
    ['отрицательный курс', [{ ...tableA[0], rates: [{ code: 'EUR', mid: -1 }] }]],
    ['код не валюты', [{ ...tableA[0], rates: [{ code: '<b>', mid: 1 }] }]],
    ['дата не дата', [{ ...tableA[0], effectiveDate: 'вчера' }]],
  ])('%s — курса нет', (_name, body) => {
    expect(parseNbp([body])).toBeNull();
  });

  it('испорченная таблица не портит исправную', () => {
    expect(parseNbp(['мусор', tableB])?.rates.BYN).toBe(0.8);
  });
});

describe('ExchangeRate-API', () => {
  const body = {
    result: 'success',
    base_code: 'EUR',
    time_last_update_unix: Date.UTC(2026, 9, 24) / 1000,
    rates: { EUR: 1, PLN: 4.25, KZT: 560, '<b>': 1, BAD: -3, NAN: 'x' },
  };

  it('курсы к евро, мусорные строки пропускаются', () => {
    expect(parseErApi([body])).toEqual({
      base: 'EUR',
      date: '2026-10-24',
      rates: { EUR: 1, PLN: 4.25, KZT: 560 },
    });
  });

  it.each([
    ['ошибка источника', { ...body, result: 'error' }],
    ['другая база', { ...body, base_code: 'USD' }],
    ['без курсов', { ...body, rates: {} }],
    ['не объект', 'мусор'],
  ])('%s — курса нет', (_name, broken) => {
    expect(parseErApi([broken])).toBeNull();
  });
});

describe('FloatRates', () => {
  it('курсы к евро из записей по валютам', () => {
    const body = {
      pln: { code: 'PLN', rate: 4.25, date: 'Fri, 24 Oct 2026 23:55:01 GMT', inverseRate: 0.23 },
      byn: { code: 'BYN', rate: 3.6, date: 'Fri, 24 Oct 2026 23:55:01 GMT' },
      bad: { code: 'xx', rate: 1, date: '' },
    };
    expect(parseFloatRates([body])).toEqual({
      base: 'EUR',
      date: '2026-10-24',
      rates: { PLN: 4.25, BYN: 3.6, EUR: 1 },
    });
  });

  it.each([
    ['массив', []],
    ['пусто', {}],
    ['null', null],
  ])('%s — курса нет', (_name, body) => {
    expect(parseFloatRates([body])).toBeNull();
  });
});

describe('источники', () => {
  it('у каждого — свой id и адреса только https, без параметров из вне', () => {
    expect(new Set(RATE_SOURCES.map((source) => source.id)).size).toBe(RATE_SOURCES.length);
    for (const source of RATE_SOURCES) {
      expect(source.urls.length).toBeGreaterThan(0);
      for (const url of source.urls) expect(new URL(url).protocol).toBe('https:');
    }
  });

  it('хосты — ровно те, что записаны в docs/03 (SSRF)', () => {
    const hosts = new Set(
      RATE_SOURCES.flatMap((source) => source.urls.map((url) => new URL(url).host))
    );
    expect([...hosts].sort()).toEqual(['api.nbp.pl', 'open.er-api.com', 'www.floatrates.com']);
  });
});

describe('пересчёт', () => {
  const rates = { base: 'EUR', date: '2026-10-24', rates: { EUR: 1, PLN: 4.25, BYN: 3.6 } };

  it('из любой валюты в любую через базу, в минорных единицах', () => {
    expect(convert(6000, 'EUR', 'PLN', rates)).toBe(25500);
    expect(convert(25500, 'PLN', 'EUR', rates)).toBe(6000);
    expect(convert(25500, 'PLN', 'BYN', rates)).toBe(21600);
  });

  it('нет курса одной из валют — null, а не выдуманное число', () => {
    expect(convert(100, 'EUR', 'KZT', rates)).toBeNull();
  });

  it('таблица из базы проверяется заново', () => {
    expect(parseStoredTable(rates)).toEqual(rates);
    expect(parseStoredTable({ ...rates, rates: { PLN: 4 } })).toBeNull();
    expect(parseStoredTable({ ...rates, rates: { EUR: 1, PLN: 0 } })).toBeNull();
    expect(parseStoredTable('мусор')).toBeNull();
  });

  it.each([
    [5881, 6000], // 58,81 € → 60 €
    [25300, 25000], // 253 → 250
    [587300, 590000], // 5873 ₽ → 5900 ₽
    [1240, 1200], // 12,40 → 12
    [20487, 20000], // 204,87 BYN → 200 BYN
    [50, 50], // меньше единицы — как есть
  ])('ровное число: %i → %i', (exact, nice) => {
    expect(roundNicely(exact)).toBe(nice);
  });
});
