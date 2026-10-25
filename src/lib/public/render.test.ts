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
let profile: Record<string, string> = {};
const pages = new Map<string, { title: string | null; blocks: RenderableBlock[] }>();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env', () => ({ env: () => ({ APP_URL: 'https://efremova.online' }) }));
vi.mock('@/lib/public/stylesheet', () => ({ stylesheetHref: () => '/site.css?v=test' }));
vi.mock('@/lib/site-profile', () => ({
  getSiteProfile: () => Promise.resolve({ values: profile, status: 'live' }),
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
vi.mock('@/lib/content', () => ({
  // Как настоящая: цена в запрошенной валюте, незнакомая валюта — злотые
  getServices: (_locale: string, currency: string | null) => {
    const prices: Record<string, number> = { PLN: 20000, EUR: 4500 };
    const chosen = currency !== null && currency in prices ? currency : 'PLN';
    return Promise.resolve({
      currency: chosen,
      currencies: ['PLN', 'EUR'],
      defaultCurrency: 'PLN',
      services: [
        {
          slug: 'individual-50',
          title: 'Konsultacja',
          description: '',
          durationMinutes: 50,
          price: { amountMinor: prices[chosen], currency: chosen },
        },
      ],
    });
  },
  getPriceArchive: () =>
    Promise.resolve([
      {
        slug: 'individual-50',
        title: 'Konsultacja',
        currencies: [
          {
            currency: 'PLN',
            periods: [
              {
                currency: 'PLN',
                amountMinor: 20000,
                validFrom: new Date('2027-09-01T00:00:00Z'),
                validTo: null,
              },
              {
                currency: 'PLN',
                amountMinor: 18000,
                validFrom: new Date('2026-06-01T00:00:00Z'),
                validTo: new Date('2027-09-01T00:00:00Z'),
              },
            ],
          },
        ],
      },
    ]),
}));
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

async function page(locale: string, segments: string[], currency: string | null = null) {
  const response = await publicPageResponse(locale, segments, currency);
  return { response, html: await response.text() };
}

beforeEach(() => {
  databaseUp = true;
  profile = {};
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

describe('цены и валюты (задача 9a)', () => {
  it('микроразметка Schema.org: услуга с ценой — без единого <script>', async () => {
    const { html } = await page('pl', ['services'], 'EUR');
    expect(html).toContain('itemType="https://schema.org/Service"');
    expect(html).toContain('<meta itemProp="price" content="45.00"/>');
    expect(html).toContain('<meta itemProp="priceCurrency" content="EUR"/>');
    expect(html).not.toContain('<script');
  });

  it('по умолчанию — злотые, рядом выбор валюты ссылками без скриптов', async () => {
    const { html } = await page('pl', ['services']);
    expect(html).toMatch(/200\s*zł/);
    expect(html).toContain('href="/pl/services?currency=EUR#prices"');
    expect(html).toContain('href="/pl/services#prices"');
    expect(html).not.toContain('<script');
  });

  it('валюта из адреса: та же страница в евро, canonical — без валюты', async () => {
    const { response, html } = await page('pl', ['services'], 'EUR');
    expect(response.status).toBe(200);
    expect(html).toMatch(/45\s*€/);
    expect(html).toContain('<link rel="canonical" href="https://efremova.online/pl/services"/>');
  });

  it('чужая валюта в адресе не попадает в страницу — злотые', async () => {
    const { html } = await page('pl', ['services'], '<script>alert(1)</script>');
    expect(html).toMatch(/200\s*zł/);
    expect(html).not.toContain('alert(1)');
  });

  it('архив цен: все периоды с датами, текущая цена отмечена', async () => {
    const { response, html } = await page('pl', ['services', 'history']);
    expect(response.status).toBe(200);
    expect(html).toContain('Archiwum cen');
    expect(html).toMatch(/180\s*zł/);
    expect(html).toContain('1 czerwca 2026');
    expect(html).toContain('obowiązuje obecnie');
    expect(html).toContain('<time dateTime="2026-06-01T00:00:00.000Z">');
  });

  it('у списка услуг — ссылка на архив цен', async () => {
    const { html } = await page('ru', ['services']);
    expect(html).toContain('href="/ru/services/history"');
  });
});

describe('Schema.org: владелец сайта', () => {
  it('Person — только из заполненных полей профиля, значения экранируются', async () => {
    profile = { 'owner.fullName': 'Anna "Test" <b>', 'owner.professionalTitle': 'psycholog' };
    const { html } = await page('pl', ['about']);
    expect(html).toContain('itemType="https://schema.org/Person"');
    expect(html).toContain('<meta itemProp="name" content="Anna &quot;Test&quot; &lt;b&gt;"/>');
    expect(html).toContain('<meta itemProp="jobTitle" content="psycholog"/>');
    expect(html).toContain('<link itemProp="url" href="https://efremova.online/"/>');
    expect(html).not.toContain('itemProp="email"');
  });

  it('профиль пуст — ни одного выдуманного свойства', async () => {
    const { html } = await page('pl', ['about']);
    expect(html).not.toMatch(/itemProp="(name|url|email)"/);
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
