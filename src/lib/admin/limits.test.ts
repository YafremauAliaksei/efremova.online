import { describe, expect, it } from 'vitest';
import {
  STORAGE_LIMITS,
  WRITE_LIMITS,
  countSince,
  dayAgo,
  issuedAfterRevocation,
  judgeMedia,
  judgeWrite,
  parseRevocationMark,
  revocationMark,
} from './limits';

/**
 * Потолки записи держат обещание docs/03 п.3.1: унесённый cookie сессии
 * не превращается в способ забить диск. Здесь — только арифметика;
 * как её применяют действия админки, проверяет guard.test.ts.
 */

const NOW = new Date('2026-10-25T12:00:00.500Z');
const usage = { sinceSession: 0, databaseBytes: 0 };

describe('предел действий', () => {
  it('ниже предела — можно', () => {
    expect(judgeWrite({ ...usage, sinceSession: WRITE_LIMITS.perSession - 1 })).toEqual({
      ok: true,
    });
  });

  it('ровно предел — уже отказ: проверка идёт до действия', () => {
    expect(judgeWrite({ ...usage, sinceSession: WRITE_LIMITS.perSession })).toEqual({
      ok: false,
      reason: 'session',
    });
  });

  it('предел сессии важнее переполнения: авария, а не тихий отказ', () => {
    expect(
      judgeWrite({
        sinceSession: WRITE_LIMITS.perSession,
        databaseBytes: STORAGE_LIMITS.databaseBytes,
      })
    ).toMatchObject({ reason: 'session' });
  });

  it('база дошла до предела — отказ без аварии', () => {
    expect(judgeWrite({ ...usage, databaseBytes: STORAGE_LIMITS.databaseBytes })).toEqual({
      ok: false,
      reason: 'full',
    });
    expect(judgeWrite({ ...usage, databaseBytes: STORAGE_LIMITS.databaseBytes - 1 })).toEqual({
      ok: true,
    });
  });

  it('свой предел — для проверки самой функции', () => {
    expect(judgeWrite({ ...usage, sinceSession: 2 }, { perSession: 2 })).toMatchObject({
      ok: false,
    });
  });
});

describe('сутки', () => {
  it('countSince считает границу включительно', () => {
    const from = dayAgo(NOW);
    expect(NOW.getTime() - from.getTime()).toBe(24 * 60 * 60 * 1000);
    const dates = [new Date(from.getTime() - 1), from, NOW];
    expect(countSince(dates, from)).toBe(2);
    expect(countSince([], from)).toBe(0);
  });
});

describe('картинки', () => {
  const empty = { storedBytes: 0, incomingBytes: 1000, lastDay: 0 };

  it('в пределах — можно', () => {
    expect(judgeMedia(empty)).toEqual({ ok: true });
  });

  it('новая картинка, которая не помещается целиком, — отказ', () => {
    expect(
      judgeMedia({ ...empty, storedBytes: STORAGE_LIMITS.mediaBytes - 999, incomingBytes: 1000 })
    ).toEqual({ ok: false, reason: 'quota' });
  });

  it('ровно до предела — помещается', () => {
    expect(
      judgeMedia({ ...empty, storedBytes: STORAGE_LIMITS.mediaBytes - 1000, incomingBytes: 1000 })
    ).toEqual({ ok: true });
  });

  it('за сутки — не больше mediaPerDay новых', () => {
    expect(judgeMedia({ ...empty, lastDay: STORAGE_LIMITS.mediaPerDay })).toEqual({
      ok: false,
      reason: 'quota',
    });
  });
});

describe('отзыв сессий', () => {
  it('отметка — следующая целая секунда', () => {
    expect(revocationMark(NOW).toISOString()).toBe('2026-10-25T12:00:01.000Z');
  });

  it('и на ровной секунде — тоже следующая', () => {
    expect(revocationMark(new Date('2026-10-25T12:00:00.000Z')).toISOString()).toBe(
      '2026-10-25T12:00:01.000Z'
    );
  });

  it('сессия, выпущенная в ту же секунду до отзыва, не переживает его', () => {
    const mark = revocationMark(NOW);
    const iat = Math.floor(NOW.getTime() / 1000);
    expect(issuedAfterRevocation(iat, mark)).toBe(false);
  });

  it('сессия, выпущенная после отметки, действует', () => {
    const mark = revocationMark(NOW);
    expect(issuedAfterRevocation(mark.getTime() / 1000, mark)).toBe(true);
    expect(issuedAfterRevocation(mark.getTime() / 1000 + 60, mark)).toBe(true);
  });

  it('без отзыва действует любая подписанная сессия', () => {
    expect(issuedAfterRevocation(0, null)).toBe(true);
  });

  it('отметка из базы читается числом миллисекунд', () => {
    expect(parseRevocationMark('1761393601000', NOW)).toEqual(new Date(1761393601000));
    expect(parseRevocationMark(undefined, NOW)).toBeNull();
  });

  it('испорченная отметка — как отзыв сейчас, а не как «отзыва не было»', () => {
    for (const raw of ['', 'abc', '-5', '0', '1e400', '12.5']) {
      expect(parseRevocationMark(raw, NOW)).toEqual(revocationMark(NOW));
    }
  });
});
