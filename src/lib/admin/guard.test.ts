import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_LIMITS, WRITE_LIMITS } from './limits';

/**
 * Сторож действий админки: без сессии — отказ, сверх предела — авария
 * с отзывом всех сессий, переполненная база — отказ без аварии, но
 * удаление по GDPR проходит. База, сессия и журнал подменены в памяти.
 */

const ISSUED_AT = new Date('2026-10-25T12:00:00Z');

const state = {
  /** Когда выпущена сессия; null — сессии нет */
  issuedAt: ISSUED_AT as Date | null,
  count: 0,
  databaseBytes: 1000,
  revoked: 0,
  audits: [] as { action: string; metadata: unknown }[],
  events: [] as { severity: string; details: unknown }[],
  countedFrom: [] as Date[],
};

class Redirect extends Error {
  constructor(readonly url: string) {
    super(`redirect ${url}`);
  }
}

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-real-ip': '203.0.113.9' })),
}));
vi.mock('@/lib/auth/admin', () => ({
  adminSessionIssuedAt: () => Promise.resolve(state.issuedAt),
  revokeAdminSessions: () => {
    state.revoked += 1;
    return Promise.resolve();
  },
}));
vi.mock('@/lib/audit/log', () => ({
  auditCountSince: (from: Date) => {
    state.countedFrom.push(from);
    return Promise.resolve(state.count);
  },
  audit: (action: string, _id: unknown, metadata: unknown) => {
    state.audits.push({ action, metadata });
    return Promise.resolve();
  },
}));
vi.mock('@/lib/security/recorder', () => ({
  recordSecurityEvent: (event: { severity: string; details: unknown }) => {
    state.events.push(event);
    return Promise.resolve();
  },
}));
vi.mock('@/lib/db', () => ({
  db: { $queryRaw: () => Promise.resolve([{ bytes: BigInt(state.databaseBytes) }]) },
}));

const { requireAdminWrite } = await import('./guard');

async function outcome(options: Parameters<typeof requireAdminWrite>[0] = {}) {
  try {
    await requireAdminWrite(options);
    return 'ok';
  } catch (error) {
    if (error instanceof Redirect) return error.url;
    throw error;
  }
}

beforeEach(() => {
  Object.assign(state, {
    issuedAt: ISSUED_AT,
    count: 0,
    databaseBytes: 1000,
    revoked: 0,
    audits: [],
    events: [],
    countedFrom: [],
  });
});

describe('сторож записи', () => {
  it('без сессии — на страницу отказа, журнал даже не считается', async () => {
    state.issuedAt = null;
    expect(await outcome()).toBe('/admin/denied');
    expect(state.countedFrom).toHaveLength(0);
  });

  it('действия считаются с момента выпуска сессии', async () => {
    await outcome();
    expect(state.countedFrom).toEqual([ISSUED_AT]);
  });

  it('в пределах — пропускает молча', async () => {
    state.count = WRITE_LIMITS.perSession - 1;
    expect(await outcome()).toBe('ok');
    expect(state.revoked).toBe(0);
    expect(state.audits).toHaveLength(0);
  });

  it('предел — авария: сессии отозваны, запись в журнал и событие', async () => {
    state.count = WRITE_LIMITS.perSession;
    expect(await outcome()).toBe('/admin/denied?reason=limit');
    expect(state.revoked).toBe(1);
    expect(state.audits).toEqual([
      { action: 'session.lockdown', metadata: { sinceSession: WRITE_LIMITS.perSession } },
    ]);
    expect(state.events).toHaveLength(1);
    expect(state.events[0]?.severity).toBe('CRITICAL');
  });

  it('удаление не обходит предел действий: авария важнее', async () => {
    state.count = WRITE_LIMITS.perSession;
    expect(await outcome({ deletes: true })).toBe('/admin/denied?reason=limit');
    expect(state.revoked).toBe(1);
  });

  it('база полна — отказ без аварии: сессия цела', async () => {
    state.databaseBytes = STORAGE_LIMITS.databaseBytes;
    expect(await outcome()).toBe('/admin/denied?reason=full');
    expect(state.revoked).toBe(0);
    expect(state.events).toHaveLength(0);
  });

  it('база полна, но действие удаляет — проходит (отзыв согласия, GDPR)', async () => {
    state.databaseBytes = STORAGE_LIMITS.databaseBytes;
    expect(await outcome({ deletes: true })).toBe('ok');
  });
});
