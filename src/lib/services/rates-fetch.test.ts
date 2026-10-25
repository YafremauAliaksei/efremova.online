import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Запрос курсов к NBP (задача 9b): адреса зашиты, переадресации запрещены,
 * объём ограничен, неудача не ломает админку, курсы помнятся шесть часов.
 * Сеть подменена: проверяется поведение, а не доступность NBP.
 */

vi.mock('server-only', () => ({}));

const { getExchangeRates, resetExchangeRatesCache } = await import('./rates-fetch');

const table = (code: string, mid: number) => [
  { table: 'A', effectiveDate: '2026-10-23', rates: [{ code, mid }] },
];

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

beforeEach(() => {
  resetExchangeRatesCache();
});

describe('курсы NBP', () => {
  it('ходит только на зашитые адреса NBP, без переадресаций', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const rates = await getExchangeRates(0, (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(json(table('EUR', 4.25)));
    });
    expect(rates.get('EUR')?.plnPerUnit).toBe(4.25);
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
      'https://api.nbp.pl/api/exchangerates/tables/B/?format=json',
    ]);
    for (const call of calls) expect(call.init.redirect).toBe('error');
  });

  it('NBP недоступен — пустой словарь, а не ошибка', async () => {
    const rates = await getExchangeRates(0, () => Promise.reject(new Error('offline')));
    expect(rates.size).toBe(0);
  });

  it('ответ не 200, не JSON или слишком большой — отбрасывается', async () => {
    const answers = [
      new Response('Not Found', { status: 404 }),
      new Response('<html>не json</html>', { status: 200 }),
    ];
    const rates = await getExchangeRates(0, () => Promise.resolve(answers.shift() ?? json(null)));
    expect(rates.size).toBe(0);

    resetExchangeRatesCache();
    const huge = new Response('x', { headers: { 'content-length': String(10 * 1024 * 1024) } });
    expect((await getExchangeRates(0, () => Promise.resolve(huge.clone()))).size).toBe(0);
  });

  it('курсы помнятся шесть часов: второй раз к NBP не ходит', async () => {
    let calls = 0;
    const fetchImpl = () => {
      calls += 1;
      return Promise.resolve(json(table('EUR', 4.25)));
    };
    await getExchangeRates(0, fetchImpl);
    await getExchangeRates(5 * 60 * 60 * 1000, fetchImpl);
    expect(calls).toBe(2);
    await getExchangeRates(7 * 60 * 60 * 1000, fetchImpl);
    expect(calls).toBe(4);
  });

  it('неудача помнится десять минут: недоступный NBP не тормозит каждую страницу', async () => {
    let calls = 0;
    const failing = () => {
      calls += 1;
      return Promise.reject(new Error('offline'));
    };
    await getExchangeRates(0, failing);
    await getExchangeRates(5 * 60 * 1000, failing);
    expect(calls).toBe(2);
    await getExchangeRates(11 * 60 * 1000, failing);
    expect(calls).toBe(4);
  });
});
