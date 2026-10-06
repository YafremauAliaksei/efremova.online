import { createHash } from 'node:crypto';
import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Вход в админку — единственная дверь к текстам, ценам и правовым
 * документам. Тесты держат то, что обещано в src/lib/auth/admin.ts:
 * токен в базе только хешем, ссылка срабатывает один раз и 15 минут,
 * сессия подписана, живёт 30 минут и не подделывается.
 *
 * База, cookie и окружение подменены в памяти: проверяется логика,
 * а не Postgres.
 */

const SECRET = 'test_only_secret_value_for_vitest_32ch';

interface TokenRow {
  id: string;
  tokenHash: string;
  issuedBy: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedIp: string | null;
}

const rows: TokenRow[] = [];
const jar = new Map<string, { value: string; options: Record<string, unknown> }>();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: () => ({ AUTH_SECRET: SECRET }) }));
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { value: jar.get(name)?.value } : undefined),
      set: (name: string, value: string, options: Record<string, unknown>) =>
        jar.set(name, { value, options }),
      delete: (name: string) => jar.delete(name),
    }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    adminLoginToken: {
      create: ({ data }: { data: Omit<TokenRow, 'id' | 'usedAt' | 'usedIp'> }) => {
        rows.push({ id: String(rows.length + 1), usedAt: null, usedIp: null, ...data });
        return Promise.resolve();
      },
      deleteMany: () => Promise.resolve({ count: 0 }),
      findUnique: ({ where }: { where: { tokenHash: string } }) =>
        Promise.resolve(rows.find((row) => row.tokenHash === where.tokenHash) ?? null),
      // Как в Postgres: условие usedAt: null проверяется в момент записи
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string; usedAt: null };
        data: { usedAt: Date; usedIp: string | null };
      }) => {
        const row = rows.find(
          (candidate) => candidate.id === where.id && candidate.usedAt === null
        );
        if (row === undefined) return Promise.resolve({ count: 0 });
        Object.assign(row, data);
        return Promise.resolve({ count: 1 });
      },
    },
  },
}));

const admin = await import('./admin');

beforeEach(() => {
  rows.length = 0;
  jar.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('одноразовая ссылка', () => {
  it('в базе только хеш токена, сам токен — нигде', async () => {
    const { token } = await admin.issueLoginToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('срабатывает один раз и запоминает адрес входа', async () => {
    const { token } = await admin.issueLoginToken();
    expect(await admin.consumeLoginToken(token, '203.0.113.7')).toEqual({ ok: true });
    expect(rows[0]?.usedIp).toBe('203.0.113.7');
    expect(await admin.consumeLoginToken(token, '203.0.113.7')).toEqual({
      ok: false,
      reason: 'Ссылка уже была использована',
    });
  });

  it('две одновременные попытки — входит только одна', async () => {
    const { token } = await admin.issueLoginToken();
    const results = await Promise.all([
      admin.consumeLoginToken(token, null),
      admin.consumeLoginToken(token, null),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it('через 15 минут не действует', async () => {
    const { token } = await admin.issueLoginToken();
    vi.useFakeTimers({ now: Date.now() + 16 * 60_000 });
    expect(await admin.consumeLoginToken(token, null)).toEqual({
      ok: false,
      reason: 'Срок действия ссылки истёк',
    });
  });

  it('чужой или подобранный токен — отказ', async () => {
    await admin.issueLoginToken();
    expect(await admin.consumeLoginToken('A'.repeat(43), null)).toMatchObject({ ok: false });
  });
});

describe('сессия', () => {
  it('после входа — админ; cookie httpOnly, SameSite=Lax, 30 минут', async () => {
    await admin.createAdminSession();
    expect(await admin.isAdmin()).toBe(true);
    const cookie = jar.get(admin.adminCookieName());
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', maxAge: 30 * 60 });
  });

  it('без cookie — не админ', async () => {
    expect(await admin.isAdmin()).toBe(false);
  });

  it('через 30 минут сессия не действует', async () => {
    await admin.createAdminSession();
    vi.useFakeTimers({ now: Date.now() + 31 * 60_000 });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('подпись чужим ключом не проходит', async () => {
    const forged = await new SignJWT({ role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode('another_secret_value_of_32_chars!!'));
    jar.set(admin.adminCookieName(), { value: forged, options: {} });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('неподписанный токен (alg: none) не проходит', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ role: 'ADMIN', exp: 9_999_999_999 })).toString(
      'base64url'
    );
    jar.set(admin.adminCookieName(), { value: `${header}.${payload}.`, options: {} });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('верная подпись, но не та роль — не админ', async () => {
    const token = await new SignJWT({ role: 'CLIENT' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30m')
      .sign(new TextEncoder().encode(SECRET));
    jar.set(admin.adminCookieName(), { value: token, options: {} });
    expect(await admin.isAdmin()).toBe(false);
  });

  it('выход удаляет cookie', async () => {
    await admin.createAdminSession();
    await admin.destroyAdminSession();
    expect(await admin.isAdmin()).toBe(false);
  });
});
