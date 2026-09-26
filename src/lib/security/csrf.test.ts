import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from './csrf';

const host = 'efremova.online';

describe('источник изменяющего запроса', () => {
  it('форма админки за nginx: Origin https, приложение видит свой Host', () => {
    expect(
      isSameOriginRequest({ origin: 'https://efremova.online', fetchSite: 'same-origin', host })
    ).toBe(true);
  });

  it('локальная разработка с портом', () => {
    expect(
      isSameOriginRequest({
        origin: 'http://localhost:3000',
        fetchSite: 'same-origin',
        host: 'localhost:3000',
      })
    ).toBe(true);
  });

  it('без Origin, но браузер подтверждает свой источник', () => {
    expect(isSameOriginRequest({ origin: null, fetchSite: 'same-origin', host })).toBe(true);
  });

  it.each([
    ['чужой сайт', 'https://evil.example', 'cross-site'],
    ['чужой сайт выдаёт себя за свой в Sec-Fetch-Site', 'https://evil.example', 'same-origin'],
    ['поддомен', 'https://cabinet.efremova.online', 'same-site'],
    ['домен-двойник', 'https://efremova.online.evil.example', 'same-origin'],
    ['Origin: null из песочницы', 'null', 'same-origin'],
    ['нет Sec-Fetch-Site', 'https://efremova.online', null],
  ])('%s — отказ', (_, origin, fetchSite) => {
    expect(isSameOriginRequest({ origin, fetchSite, host })).toBe(false);
  });

  it('нет Host — сравнивать не с чем, отказ', () => {
    expect(
      isSameOriginRequest({
        origin: 'https://efremova.online',
        fetchSite: 'same-origin',
        host: null,
      })
    ).toBe(false);
  });
});
