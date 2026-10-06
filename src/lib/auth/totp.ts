import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Одноразовые коды из приложения-аутентификатора (TOTP, RFC 6238).
 *
 * Второй фактор входа в админку (PROJECT_LOG, задача 13). Первый — ссылка
 * из терминала сервера: она доказывает доступ к серверу. Код доказывает
 * владение телефоном. Украденная ссылка (пересланная, оставшаяся в истории
 * браузера) без телефона не открывает админку.
 *
 * Своя реализация, а не библиотека: это сорок строк по стандарту, а каждая
 * зависимость — чужой код в самом чувствительном месте сайта. Проверяется
 * тестовыми векторами из приложения B к RFC 6238.
 *
 * Файл без 'server-only' и без базы: чистые функции, их проверяют тесты.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

/** Base32 (RFC 4648) — в нём приложения принимают секрет */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET.charAt((value << (5 - bits)) & 31);
  return out;
}

/** Обратно; пробелы и регистр не важны, чужой символ — null */
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.replace(/[\s=]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** Секрет: 20 случайных байт (160 бит, как советует RFC 4226) */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Код для шага времени (HOTP, RFC 4226) */
export function hotp(secret: Uint8Array, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', secret).update(message).digest();
  const offset = (hash[hash.length - 1] ?? 0) & 0xf;
  const binary = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function stepAt(time: Date): number {
  return Math.floor(time.getTime() / 1000 / STEP_SECONDS);
}

export function totp(secret: Uint8Array, time: Date, digits = DIGITS): string {
  return hotp(secret, stepAt(time), digits);
}

/**
 * Проверка кода: текущий шаг и по одному соседнему — часы телефона
 * и сервера могут расходиться на полминуты. Возвращает шаг, на котором
 * код совпал (чтобы не принять тот же код второй раз), или null.
 *
 * Шаг не позже `lastUsedStep` не принимается: использованный код
 * не открывает вторую сессию, даже пока он ещё «живой».
 */
export function verifyTotp(
  secret: Uint8Array,
  code: string,
  time: Date,
  lastUsedStep: number | null = null
): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const now = stepAt(time);
  let matched: number | null = null;
  for (const step of [now - 1, now, now + 1]) {
    const expected = Buffer.from(hotp(secret, step));
    // Сравнение в постоянном времени, и все три шага проверяются всегда
    if (timingSafeEqual(expected, Buffer.from(clean)) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (lastUsedStep !== null && matched <= lastUsedStep) return null;
  return matched;
}

/** Ссылка для приложения: её можно вставить или превратить в QR-код */
export function otpauthUrl(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
