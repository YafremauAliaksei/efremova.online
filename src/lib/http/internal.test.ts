import { describe, expect, it } from 'vitest';
import { createFailureReporter, internalUrl, secretsEqual } from './internal';

describe('адрес внутреннего вызова', () => {
  it('свой сервер по http, порт из PORT', () => {
    expect(internalUrl('/api/internal/security/event', '3000').href).toBe(
      'http://127.0.0.1:3000/api/internal/security/event'
    );
    expect(internalUrl('/api/internal/security/honeypot', '8080').href).toBe(
      'http://127.0.0.1:8080/api/internal/security/honeypot'
    );
  });

  it('PORT не задан или испорчен — порт по умолчанию', () => {
    expect(internalUrl('/api/internal/x', undefined).port).toBe('3000');
    expect(internalUrl('/api/internal/x', '3000@evil.example').host).toBe('127.0.0.1:3000');
  });

  it.each([
    ['/admin'],
    ['/api/health'],
    ['https://evil.example/api/internal/x'],
    ['/api/internal/../admin'],
  ])('%j — секрет не уходит за пределы /api/internal', (path) => {
    expect(() => internalUrl(path, '3000')).toThrow();
  });
});

describe('сравнение секретов', () => {
  it('совпадение и несовпадение', async () => {
    await expect(secretsEqual('token-a', 'token-a')).resolves.toBe(true);
    await expect(secretsEqual('token-a', 'token-b')).resolves.toBe(false);
    await expect(secretsEqual('token', 'token-longer')).resolves.toBe(false);
  });

  it('пустое значение не подходит никогда', async () => {
    await expect(secretsEqual('', '')).resolves.toBe(false);
    await expect(secretsEqual('x', '')).resolves.toBe(false);
  });
});

describe('сообщение о сбое внутреннего вызова', () => {
  it('не чаще раза в минуту и со счётчиком пропущенных', () => {
    const lines: string[] = [];
    let now = 0;
    const report = createFailureReporter(
      (line) => lines.push(line),
      () => now
    );

    report('/api/internal/security/event', new Error('fetch failed'));
    now = 10_000;
    report('/api/internal/security/event', new Error('fetch failed'));
    report('/api/internal/security/event', new Error('fetch failed'));
    now = 61_000;
    report('/api/internal/security/honeypot', 'boom');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('fetch failed');
    expect(lines[1]).toContain('ещё 2');
  });
});
