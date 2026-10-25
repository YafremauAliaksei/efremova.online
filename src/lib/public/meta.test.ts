import { describe, expect, it } from 'vitest';
import { headTags } from './meta';

/**
 * Теги <head> публичной страницы: раньше их собирал Next.js, теперь — свой
 * код, и поисковику они нужны те же: заголовок, canonical, hreflang.
 */

const APP = 'https://efremova.online';

describe('теги страницы', () => {
  it('заголовок страницы и название сайта', () => {
    const tags = headTags(
      { title: 'O mnie', description: 'Opis', path: '/about' },
      'pl',
      'Psycholog online',
      'Domyślny opis',
      APP
    );
    expect(tags.title).toBe('O mnie · Psycholog online');
    expect(tags.description).toBe('Opis');
    expect(tags.robots).toContain('index, follow');
  });

  it('у главной — только название сайта, описание по умолчанию', () => {
    const tags = headTags(
      { title: null, description: null, path: '/' },
      'ru',
      'Сайт',
      'Описание',
      APP
    );
    expect(tags.title).toBe('Сайт');
    expect(tags.description).toBe('Описание');
    expect(tags.canonical).toBe('https://efremova.online/ru');
  });

  it('canonical и hreflang — абсолютные адреса на все языки и x-default', () => {
    const tags = headTags({ title: 'T', description: null, path: '/about' }, 'pl', 'S', 'D', APP);
    expect(tags.canonical).toBe('https://efremova.online/pl/about');
    expect(tags.alternates).toEqual([
      { hrefLang: 'ru-RU', href: 'https://efremova.online/ru/about' },
      { hrefLang: 'pl-PL', href: 'https://efremova.online/pl/about' },
      { hrefLang: 'en', href: 'https://efremova.online/en/about' },
      { hrefLang: 'x-default', href: 'https://efremova.online/about' },
    ]);
  });

  it('документ без перевода: каноническая — польская версия', () => {
    const tags = headTags(
      { title: 'T', description: null, path: '/privacy', canonicalLocale: 'pl' },
      'en',
      'S',
      'D',
      APP
    );
    expect(tags.canonical).toBe('https://efremova.online/pl/privacy');
  });

  it('служебная страница не индексируется', () => {
    const tags = headTags(
      { title: 'T', description: null, path: '/', noindex: true },
      'ru',
      'S',
      'D',
      APP
    );
    expect(tags.robots).toBe('noindex, nofollow');
  });

  it('путь в APP_URL не попадает в адреса — только origin', () => {
    const tags = headTags(
      { title: 'T', description: null, path: '/about' },
      'ru',
      'S',
      'D',
      `${APP}/x/`
    );
    expect(tags.canonical).toBe('https://efremova.online/ru/about');
  });
});
