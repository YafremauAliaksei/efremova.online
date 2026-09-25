import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * /.well-known/security.txt (RFC 9116): куда сообщать об уязвимостях.
 *
 * Поле Expires обязательно, и просроченный файл сканеры считают
 * недействительным. Тест падает за 30 дней до срока — продление не
 * забудется, а красный CI скажет, что именно поправить.
 */

const text = readFileSync(join(process.cwd(), 'public/.well-known/security.txt'), 'utf8');
const fields = new Map(
  text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as const;
    })
);

describe('security.txt', () => {
  it('есть обязательные поля Contact и Expires', () => {
    expect(fields.get('Contact')).toMatch(/^https:\/\//);
    expect(fields.get('Expires')).toBeDefined();
  });

  it('срок действия — не ближе 30 дней и не дальше года (RFC 9116 советует до года)', () => {
    const expires = Date.parse(fields.get('Expires') ?? '');
    const day = 24 * 60 * 60 * 1000;
    expect(expires - Date.now()).toBeGreaterThan(30 * day);
    expect(expires - Date.now()).toBeLessThan(366 * day);
  });

  it('Canonical указывает на сам файл на основном домене', () => {
    expect(fields.get('Canonical')).toBe('https://efremova.online/.well-known/security.txt');
  });
});
