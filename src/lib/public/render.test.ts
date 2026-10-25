import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RenderableBlock } from '@/lib/blocks/registry';

/**
 * Публичная страница — HTML без JavaScript из общего кэша Cloudflare (docs/14).
 * Тест держит обещания, на которых это стоит:
 *   • в HTML нет ни одного <script>;
 *   • текст из базы экранируется;
 *   • страница не зависит от посетителя — две отрисовки дают один HTML;
 *   • заголовки: CSP без скриптов, кэш публичный, 404 — на языке адреса.
 *
 * База подменена в памяти: проверяется отрисовка, а не Postgres.
 */

let databaseUp = true;
const pages = new Map<string, { title: string | null; blocks: RenderableBlock[] }>();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: () => ({ APP_URL: 'https://efremova.online' }) }));
vi.mock('@/lib/public/stylesheet', () => ({ stylesheetHref: () => '/site.css?v=test' }));
vi.mock('@/lib/site-profile', () => ({
  getSiteProfile: () => Promise.resolve({ values: {}, status: 'live' }),
}));
vi.mock('@/lib/pages', () => ({
  getNavigation: () =>
    Promise.resolve([{ slug: 'about', title: 'O mnie', inHeader: true, inFooter: false }]),
  getPublicPage: (slug: string) => {
    const page = pages.get(slug);
    return Promise.resolve(
      page === undefined
        ? null
        : { slug, title: page.title, description: null, blocks: page.blocks }
    );
  },
}));
vi.mock('@/lib/content', () => ({ getServices: () => Promise.resolve([]) }));
vi.mock('@/lib/testimonials/public', () => ({ getTestimonials: () => Promise.resolve([]) }));
vi.mock('@/lib/legal', () => ({ getLegalDocument: () => Promise.resolve(null) }));
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: () =>
      databaseUp ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('down')),
  },
}));

const { publicPageResponse } = await import('./render');

function textBlock(title: string, body: string): RenderableBlock {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'text',
    texts: { title, body },
    textLocale: 'pl',
    data: {},
    style: { width: 'wide', align: 'left', background: 'base' },
  };
}

async function page(locale: string, segments: string[]) {
  const response = await publicPageResponse(locale, segments);
  return { response, html: await response.text() };
}

beforeEach(() => {
  databaseUp = true;
  pages.clear();
  pages.set('home', { title: null, blocks: [textBlock('Witaj', 'Tekst')] });
  pages.set('about', { title: 'O mnie', blocks: [textBlock('O mnie', 'Opis')] });
});

describe('публичная страница', () => {
  it('HTML без единого скрипта, с языком и стилями', async () => {
    const { response, html } = await page('pl', ['about']);
    expect(response.status).toBe(200);
    expect(html).toMatch(/^<!DOCTYPE html><html lang="pl-PL">/);
    expect(html).not.toContain('<script');
    expect(html).toContain('<link rel="stylesheet" href="/site.css?v=test"/>');
    expect(html).toContain('<title>O mnie · Psycholog online</title>');
    expect(html).toContain('<link rel="canonical" href="https://efremova.online/pl/about"/>');
  });

  it('заголовки: CSP без скриптов и публичный кэш', async () => {
    const { response } = await page('pl', ['about']);
    expect(response.headers.get('content-security-policy')).toContain("script-src 'none'");
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(response.headers.get('cdn-cache-control')).toContain('max-age=3600');
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('текст из базы экранируется: <script> в блоке остаётся текстом', async () => {
    pages.set('about', {
      title: 'O mnie',
      blocks: [textBlock('<script>alert(1)</script>', '"><img src=x onerror=alert(1)>')],
    });
    const { html } = await page('pl', ['about']);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('две отрисовки — один и тот же HTML: в общем кэше нет ничего от посетителя', async () => {
    const first = await page('pl', ['about']);
    const second = await page('pl', ['about']);
    expect(second.html).toBe(first.html);
  });

  it('главная — по адресу языка, с названием сайта в заголовке', async () => {
    const { response, html } = await page('ru', []);
    expect(response.status).toBe(200);
    expect(html).toContain('<title>Психолог онлайн</title>');
  });

  it('переключатель языка — обычные ссылки на служебный адрес, nofollow', async () => {
    const { html } = await page('pl', ['about']);
    expect(html).toContain('href="/api/lang?to=%2Fru%2Fabout"');
    expect(html).toContain('rel="nofollow"');
  });
});

describe('база недоступна', () => {
  it('страница на заглушках отдаётся, но в кэш не кладётся', async () => {
    databaseUp = false;
    const { response, html } = await page('ru', []);
    expect(response.status).toBe(200);
    expect(html).not.toContain('<script');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('cdn-cache-control')).toBe('no-store');
  });
});

describe('«не найдено»', () => {
  it.each([
    ['нет страницы', ['nie-ma']],
    ['две части', ['a', 'b']],
    ['дубль главной', ['home']],
    ['неверный id ролика', ['out', 'youtube', 'x']],
  ])('%s — 404 на языке адреса, не в индекс', async (_name, segments) => {
    const { response, html } = await page('pl', segments);
    expect(response.status).toBe(404);
    expect(html).toContain('<html lang="pl-PL">');
    expect(html).toContain('noindex');
    expect(html).not.toContain('<script');
    expect(response.headers.get('cdn-cache-control')).toBe('public, max-age=300');
  });

  it('незнакомый язык — 404 по-русски', async () => {
    const { response, html } = await page('de', ['about']);
    expect(response.status).toBe(404);
    expect(html).toContain('<html lang="ru-RU">');
  });
});

describe('страницы со своим кодом', () => {
  it.each([['services'], ['testimonials'], ['privacy'], ['terms'], ['site-terms'], ['provider']])(
    '/pl/%s отдаётся без базы страниц',
    async (slug) => {
      const { response, html } = await page('pl', [slug]);
      expect(response.status).toBe(200);
      expect(html).toContain(`<link rel="canonical" href="https://efremova.online/pl/${slug}"/>`);
    }
  );

  it('предупреждение перед YouTube — не в индекс', async () => {
    const { response, html } = await page('ru', ['out', 'youtube', 'dQw4w9WgXcQ']);
    expect(response.status).toBe(200);
    expect(html).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(html).toContain('noindex');
  });
});
