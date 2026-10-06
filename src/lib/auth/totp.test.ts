import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateSecret,
  hotp,
  otpauthUrl,
  stepAt,
  totp,
  verifyTotp,
} from './totp';

/**
 * TOTP написан своими руками, поэтому проверяется эталоном: тестовые
 * векторы из приложения D к RFC 4226 и приложения B к RFC 6238.
 * Совпали — значит, коды совпадут и с приложением на телефоне.
 */

// Секрет из RFC: ASCII «12345678901234567890»
const RFC_SECRET = new TextEncoder().encode('12345678901234567890');

describe('RFC 4226: HOTP', () => {
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [9, '520489'],
  ])('счётчик %d → %s', (counter, code) => {
    expect(hotp(RFC_SECRET, counter)).toBe(code);
  });
});

describe('RFC 6238: TOTP (SHA-1, 8 цифр)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('время %d → %s', (seconds, code) => {
    expect(totp(RFC_SECRET, new Date(seconds * 1000), 8)).toBe(code);
  });
});

describe('base32', () => {
  it('RFC 4648: «foobar» → MZXW6YTBOI', () => {
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
    expect(new TextDecoder().decode(base32Decode('mzxw 6ytb oi') ?? new Uint8Array())).toBe(
      'foobar'
    );
  });

  it('чужой символ — null, а не мусорный секрет', () => {
    expect(base32Decode('MZXW1!')).toBeNull();
  });

  it('секрет: 160 бит, каждый раз новый', () => {
    const a = generateSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(a)).toHaveLength(20);
    expect(generateSecret()).not.toBe(a);
  });
});

describe('проверка кода', () => {
  const secret = base32Decode(generateSecret()) ?? new Uint8Array();
  const now = new Date('2026-10-06T12:00:10Z');
  const step = stepAt(now);
  const at = (offset: number) => new Date(now.getTime() + offset * 30_000);

  it('текущий код и соседние (часы расходятся на полминуты) — да, дальше — нет', () => {
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(step);
    expect(verifyTotp(secret, totp(secret, at(-1)), now)).toBe(step - 1);
    expect(verifyTotp(secret, totp(secret, at(1)), now)).toBe(step + 1);
    expect(verifyTotp(secret, totp(secret, at(-2)), now)).toBeNull();
    expect(verifyTotp(secret, totp(secret, at(2)), now)).toBeNull();
  });

  it('использованный код второй раз не принимается', () => {
    const code = totp(secret, now);
    const used = verifyTotp(secret, code, now);
    expect(used).toBe(step);
    expect(verifyTotp(secret, code, now, used)).toBeNull();
    // Код следующего шага после использованного — принимается
    expect(verifyTotp(secret, totp(secret, at(1)), at(1), used)).toBe(step + 1);
  });

  it.each(['', '12345', '1234567', 'abcdef', '12 34 5x'])('%j — не код', (code) => {
    expect(verifyTotp(secret, code, now)).toBeNull();
  });

  it('пробелы внутри кода допустимы: «123 456» из приложения', () => {
    const code = totp(secret, now);
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(step);
  });

  it('ссылка для приложения', () => {
    const url = otpauthUrl('MZXW6YTBOI', 'admin', 'efremova.online');
    expect(url).toMatch(/^otpauth:\/\/totp\/efremova\.online%3Aadmin\?/);
    expect(url).toContain('secret=MZXW6YTBOI');
    expect(url).toContain('period=30');
  });
});
