import { describe, expect, it } from 'vitest';
import { convertFromPln, parseNbpTables, roundNicely } from './rates';

/**
 * Курс — только подсказка владельцу (задача 9b), но ответ чужого сервера
 * читается строго: всё, что не похоже на таблицу NBP, отбрасывается.
 */

const tableA = [
  {
    table: 'A',
    no: '206/A/NBP/2026',
    effectiveDate: '2026-10-23',
    rates: [
      { currency: 'euro', code: 'EUR', mid: 4.2512 },
      { currency: 'rubel rosyjski', code: 'RUB', mid: 0.0451 },
    ],
  },
];
const tableB = [
  {
    table: 'B',
    no: '043/B/NBP/2026',
    effectiveDate: '2026-10-21',
    rates: [
      { currency: 'rubel białoruski', code: 'BYN', mid: 1.2203 },
      { currency: 'euro (stary kurs)', code: 'EUR', mid: 9.99 },
    ],
  },
];

describe('таблицы NBP', () => {
  it('две таблицы — один словарь курсов к злотому', () => {
    const rates = parseNbpTables([tableA, tableB]);
    expect(rates.get('EUR')).toEqual({ plnPerUnit: 4.2512, date: '2026-10-23' });
    expect(rates.get('BYN')).toEqual({ plnPerUnit: 1.2203, date: '2026-10-21' });
    expect(rates.get('RUB')?.plnPerUnit).toBe(0.0451);
  });

  it('валюта в обеих таблицах — побеждает таблица A, в каком бы порядке ни пришли', () => {
    expect(parseNbpTables([tableA, tableB]).get('EUR')?.plnPerUnit).toBe(4.2512);
    expect(parseNbpTables([tableB, tableA]).get('EUR')?.plnPerUnit).toBe(4.2512);
  });

  it.each([
    ['не массив', { rates: [] }],
    ['пустой ответ', null],
    ['две таблицы в одном ответе', [...tableA, ...tableA]],
    ['отрицательный курс', [{ ...tableA[0], rates: [{ code: 'EUR', mid: -1 }] }]],
    ['код не валюты', [{ ...tableA[0], rates: [{ code: '<b>', mid: 1 }] }]],
    ['дата не дата', [{ ...tableA[0], effectiveDate: 'вчера' }]],
  ])('%s — ответ отбрасывается', (_name, body) => {
    expect(parseNbpTables([body]).size).toBe(0);
  });

  it('испорченная таблица не портит исправную', () => {
    expect(parseNbpTables(['мусор', tableB]).has('BYN')).toBe(true);
  });
});

describe('пересчёт и ровное число', () => {
  it('из злотых по курсу, в минорных единицах', () => {
    // 250 zł / 4.2512 = 58,81 €
    expect(convertFromPln(25000, { plnPerUnit: 4.2512, date: '2026-10-23' })).toBe(5881);
  });

  it.each([
    [5881, 6000], // 58,81 € → 60 €
    [25300, 25000], // 253 → 250
    [587300, 590000], // 5873 ₽ → 5900 ₽
    [1240, 1200], // 12,40 → 12
    [20487, 20000], // 204,87 BYN → 200 BYN
    [50, 50], // меньше единицы — как есть
  ])('%i → %i', (exact, nice) => {
    expect(roundNicely(exact)).toBe(nice);
  });
});
