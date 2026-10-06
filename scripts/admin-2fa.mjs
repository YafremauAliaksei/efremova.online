#!/usr/bin/env node
/**
 * Выпускает секрет второго фактора для входа в админку.
 *
 * ── ЧТО ДЕЛАЕТ ────────────────────────────────────────────────────────────
 * Печатает новый секрет и ссылку otpauth:// — их понимает любое приложение-
 * аутентификатор (Google Authenticator, Aegis, 2FAS, 1Password, Bitwarden).
 * Секрет никуда не записывается: его кладут в .env вручную как
 * ADMIN_TOTP_SECRET и перезапускают сайт. Так выпуск нового секрета
 * не ломает текущий вход, пока владелец сам его не заменил.
 *
 * Для проверки печатается текущий код: он должен совпасть с кодом
 * в приложении. Не совпал — часы телефона или компьютера сбиты.
 *
 * Запуск — где угодно, сеть и база не нужны:
 *   npm run admin:2fa
 *
 * Реализация TOTP — та же, что в src/lib/auth/totp.ts (RFC 6238); здесь
 * она повторена, потому что скрипт запускается без сборки TypeScript.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { URLSearchParams } from 'node:url';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(bytes) {
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

function currentCode(secretBytes) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const hash = createHmac('sha1', secretBytes).update(message).digest();
  const offset = hash[hash.length - 1] & 0xf;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

const bytes = randomBytes(20);
const secret = base32(bytes);
const issuer = 'efremova.online';
const params = new URLSearchParams({
  secret,
  issuer,
  algorithm: 'SHA1',
  digits: '6',
  period: '30',
});
const url = `otpauth://totp/${encodeURIComponent(`${issuer}:admin`)}?${params.toString()}`;
const grouped = secret.match(/.{1,4}/g).join(' ');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  ВТОРОЙ ФАКТОР ВХОДА В АДМИНКУ');
console.log('═══════════════════════════════════════════════════════════\n');
console.log('  1. В приложении-аутентификаторе: «добавить» → «ввести ключ вручную»');
console.log(`     Аккаунт: ${issuer}`);
console.log(`     Ключ:    ${grouped}`);
console.log('     Тип: по времени (TOTP), 6 цифр, 30 секунд\n');
console.log('     Или ссылка (некоторые приложения принимают её целиком):');
console.log(`     ${url}\n`);
console.log(`  2. Проверка: сейчас приложение должно показать ${currentCode(bytes)}`);
console.log('     (код меняется каждые 30 секунд)\n');
console.log('  3. В файл .env на сервере — строку:');
console.log(`     ADMIN_TOTP_SECRET=${secret}`);
console.log('     и перезапустить сайт. Со следующего входа ссылка спросит код.\n');
console.log('  ⚠️ Ключ — как пароль: не пересылайте его и не храните рядом с телефоном.');
console.log('     Телефон потерян — выпустите новый ключ и замените строку в .env.\n');
