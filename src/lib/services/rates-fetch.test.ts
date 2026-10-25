import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Запрос курсов (задача 9b): адреса зашиты, переадресации запрещены, объём
 * ограничен, неудача не ломает редактор цен, свежий курс берётся из базы без
 * запроса. Сеть и база подменены: проверяется поведение, а не доступность
 * источников.
 */

interface Row {
  source: string;
  base: string;
  rates: unknown;
  rateDate: string;
  fetchedAt: Date;
}
const rows = new Map<string, Row>();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  db: {
    rateSnapshot: {
      findUnique: ({ where }: { where: { source: string } }) =>
        Promise.resolve(rows.get(where.source) ?? null),
      findMany: () =>
        Promise.resolve(
          [...rows.values()].sort((a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime())
        ),
      upsert: ({ create }: { create: Row }) => {
        rows.set(create.source, create);
        return Promise.resolve(create);
      },
    },
  },
}));

const { latestStoredRates, refreshRates, resetRatesFailures } = await import('./rates-fetch');

const NOW = new Date('2026-10-25T12:00:00Z');
const nbp = (code: string, mid: number) => [
  { table: 'A', effectiveDate: '2026-10-24', rates: [{ code, mid }] },
];

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

beforeEach(() => {
  rows.clear();
  resetRatesFailures();
});

describe('свежий курс', () => {
  it('ходит только на зашитые адреса, без переадресаций, и кладёт курс в базу', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const outcome = await refreshRates('nbp', NOW, (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(json(nbp('EUR', 4)));
    });
    expect(outcome.ok && outcome.table.rates.EUR).toBe(0.25);
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
      'https://api.nbp.pl/api/exchangerates/tables/B/?format=json',
    ]);
    for (const call of calls) expect(call.init.redirect).toBe('error');
    expect(rows.get('nbp')?.rateDate).toBe('2026-10-24');
  });

  it('курс моложе трёх часов — из базы, без запроса', async () => {
    await refreshRates('nbp', NOW, () => Promise.resolve(json(nbp('EUR', 4))));
    const network = vi.fn(() => Promise.resolve(json(nbp('EUR', 5))));
    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const outcome = await refreshRates('nbp', later, network);
    expect(network).not.toHaveBeenCalled();
    expect(outcome.ok && outcome.table.rates.EUR).toBe(0.25);
  });

  it('источник недоступен — ok: false, а не ошибка; минуту не долбим', async () => {
    const network = vi.fn(() => Promise.reject(new Error('сеть')));
    expect(await refreshRates('er-api', NOW, network)).toEqual({ ok: false, source: 'er-api' });
    expect(await refreshRates('er-api', NOW, network)).toEqual({ ok: false, source: 'er-api' });
    expect(network).toHaveBeenCalledTimes(1);
    const later = new Date(NOW.getTime() + 61 * 1000);
    await refreshRates('er-api', later, network);
    expect(network).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['ошибка сервера', () => new Response('', { status: 503 })],
    ['не JSON', () => new Response('<html>')],
    ['слишком большой ответ', () => new Response('x'.repeat(300 * 1024))],
  ])('%s — курса нет', async (_name, respond) => {
    const outcome = await refreshRates('floatrates', NOW, () => Promise.resolve(respond()));
    expect(outcome.ok).toBe(false);
    expect(rows.size).toBe(0);
  });

  it('неизвестный источник — без запроса', async () => {
    const network = vi.fn();
    expect((await refreshRates('https://evil.example', NOW, network)).ok).toBe(false);
    expect(network).not.toHaveBeenCalled();
  });
});

describe('прежний курс', () => {
  const seed: Row = {
    source: 'seed',
    base: 'EUR',
    rates: { EUR: 1, PLN: 4.25 },
    rateDate: '2026-01-01',
    fetchedAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('первый запуск — примерные курсы из миграции', async () => {
    rows.set('seed', seed);
    expect((await latestStoredRates(['nbp']))?.source).toBe('seed');
  });

  it('есть полученный курс — он, а не примерный; испорченная строка пропускается', async () => {
    rows.set('seed', seed);
    rows.set('nbp', { ...seed, source: 'nbp', fetchedAt: NOW });
    rows.set('er-api', { ...seed, source: 'er-api', rates: 'мусор', fetchedAt: new Date() });
    expect((await latestStoredRates(['nbp', 'er-api']))?.source).toBe('nbp');
  });

  it('пустая база — null', async () => {
    expect(await latestStoredRates(['nbp'])).toBeNull();
  });
});
