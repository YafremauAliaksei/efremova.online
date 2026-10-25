import { describe, expect, it } from 'vitest';
import { langSwitchHref, langSwitchTarget } from './lang-switch';

/**
 * Адрес смены языка — единственный публичный адрес, который ставит cookie
 * и перебрасывает по параметру из адреса. Главное, что держит тест: его
 * нельзя превратить в открытый переброс на чужой сайт.
 */

describe('куда перебросить', () => {
  it('страница своего сайта на языке', () => {
    expect(langSwitchTarget('/pl/about')).toEqual({ locale: 'pl', path: '/pl/about' });
    expect(langSwitchTarget('/en')).toEqual({ locale: 'en', path: '/en' });
    expect(langSwitchTarget('/ru/out/youtube/dQw4w9WgXcQ')).toMatchObject({ locale: 'ru' });
  });

  it.each([
    ['чужой домен без протокола', '//evil.example'],
    ['обратная косая черта', '/\\evil.example'],
    ['адрес с протоколом', 'https://evil.example'],
    ['javascript:', 'javascript:alert(1)'],
    ['незнакомый язык', '/de/about'],
    ['без языка', '/about'],
    ['подъём по папкам', '/pl/../admin'],
    ['параметры', '/pl/about?x=1'],
    ['якорь', '/pl/privacy#cookies'],
    ['перевод строки', '/pl/about\r\nSet-Cookie: x=1'],
    ['косая черта в конце', '/pl/about/'],
    ['пусто', ''],
  ])('отказ: %s', (_name, to) => {
    expect(langSwitchTarget(to)).toBeNull();
  });

  it('нет параметра и слишком длинный — отказ', () => {
    expect(langSwitchTarget(null)).toBeNull();
    expect(langSwitchTarget(`/pl/${'a'.repeat(300)}`)).toBeNull();
  });

  it('ссылка переключателя ведёт на служебный адрес с закодированным путём', () => {
    expect(langSwitchHref('/pl/about')).toBe('/api/lang?to=%2Fpl%2Fabout');
    expect(langSwitchTarget(new URLSearchParams('to=%2Fpl%2Fabout').get('to'))).toEqual({
      locale: 'pl',
      path: '/pl/about',
    });
  });
});
