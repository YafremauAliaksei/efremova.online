import { describe, expect, it } from 'vitest';
import {
  isLocale,
  isLocaleNeutral,
  languageAlternates,
  localeFromAcceptLanguage,
  localeRedirectTarget,
  localizedPath,
  negotiateLocale,
  splitLocale,
} from './i18n';

/**
 * Язык приходит снаружи — из адреса, cookie и заголовка. Тесты держат
 * главное обещание docs/13 п.3.5: всё, что не из списка, становится
 * языком по умолчанию и никуда не попадает как есть.
 */

describe('проверка языка', () => {
  it.each(['ru', 'pl', 'en'])('%s — язык сайта', (value) => {
    expect(isLocale(value)).toBe(true);
  });

  it.each(['de', 'RU', 'pl-PL', '', '<script>', '../ru', null, 42, undefined])(
    '%j — не язык сайта',
    (value) => {
      expect(isLocale(value)).toBe(false);
    }
  );
});

describe('язык браузера', () => {
  it.each([
    ['pl-PL,pl;q=0.9,en;q=0.8', 'pl'],
    ['de-DE,de;q=0.9,en;q=0.5,ru;q=0.7', 'ru'],
    ['en-GB', 'en'],
    ['ru;q=0.1, pl;q=0.2', 'pl'],
    ['RU-ru', 'ru'],
  ])('%s → %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  it.each([[null], [''], ['de-DE,fr;q=0.9'], ['pl;q=0'], ['*']])('%j → нет выбора', (header) => {
    expect(localeFromAcceptLanguage(header)).toBeNull();
  });

  it('длинный заголовок разбирается не дальше предела', () => {
    const header = `${'de,'.repeat(5000)}pl`;
    expect(localeFromAcceptLanguage(header)).toBeNull();
  });
});

describe('выбор языка', () => {
  it('выбор человека в cookie важнее браузера', () => {
    expect(negotiateLocale('en', 'pl-PL')).toBe('en');
  });

  it('подделанная cookie не проходит — решает браузер', () => {
    expect(negotiateLocale('<script>', 'pl-PL')).toBe('pl');
  });

  it('ни cookie, ни языка браузера — русский', () => {
    expect(negotiateLocale(undefined, null)).toBe('ru');
  });
});

describe('язык в адресе', () => {
  it.each([
    ['/pl', 'pl', '/'],
    ['/pl/about', 'pl', '/about'],
    ['/en/privacy/x', 'en', '/privacy/x'],
    ['/about', null, '/about'],
    ['/plx/about', null, '/plx/about'],
    ['/', null, '/'],
  ])('%s', (path, locale, rest) => {
    expect(splitLocale(path)).toEqual({ locale, rest });
  });

  it('адрес на языке', () => {
    expect(localizedPath('pl')).toBe('/pl');
    expect(localizedPath('pl', '/')).toBe('/pl');
    expect(localizedPath('en', '/services')).toBe('/en/services');
  });

  it('hreflang: все три языка и x-default без языка', () => {
    expect(languageAlternates('pl', '/about')).toEqual({
      canonical: '/pl/about',
      languages: {
        'ru-RU': '/ru/about',
        'pl-PL': '/pl/about',
        en: '/en/about',
        'x-default': '/about',
      },
    });
  });
});

describe('переброс на язык', () => {
  const none = new URLSearchParams();

  it.each([
    ['/admin'],
    ['/admin/profile'],
    ['/api/health'],
    ['/_next/static/x.js'],
    ['/.well-known/security.txt'],
    ['/robots.txt'],
    ['/icon.svg'],
    ['/ru'],
    ['/pl/about'],
  ])('%s — без переброса', (path) => {
    expect(isLocaleNeutral(path) || splitLocale(path).locale !== null).toBe(true);
    expect(localeRedirectTarget(path, none, undefined, 'pl')).toBeNull();
  });

  it('адрес без языка → язык браузера', () => {
    expect(localeRedirectTarget('/about', none, undefined, 'pl-PL')).toBe('/pl/about');
    expect(localeRedirectTarget('/', none, undefined, null)).toBe('/ru');
  });

  it('старая ссылка /privacy?lang=pl открывается на польском, параметр убирается', () => {
    const search = new URLSearchParams('lang=pl&x=1');
    expect(localeRedirectTarget('/privacy', search, 'en', 'ru')).toBe('/pl/privacy?x=1');
  });

  it('подделанный ?lang не проходит', () => {
    const search = new URLSearchParams('lang=../../etc');
    expect(localeRedirectTarget('/privacy', search, undefined, null)).toBe('/ru/privacy');
  });

  it.each([['//evil.example'], ['//evil/path'], ['/\\evil']])(
    '%s не уводит на чужой домен',
    (path) => {
      const target = localeRedirectTarget(path, none, undefined, null);
      if (target === null) return; // без переброса — тем более не уводит
      expect(target.startsWith('/ru/')).toBe(true);
      expect(new URL(target, 'https://efremova.online').host).toBe('efremova.online');
    }
  );
});
