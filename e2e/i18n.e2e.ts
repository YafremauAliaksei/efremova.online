import { expect, test } from '@playwright/test';

/**
 * Языки сайта (docs/13, п.3): переброс адреса без языка, переключатель,
 * cookie только по щелчку, hreflang, 404 на языке адреса. И то, на чём
 * стоит кэш Cloudflare (docs/14): HTML без скриптов, общий кэш, ни одной cookie.
 */

test('адрес без языка: 307 на язык браузера, без кэша', async ({ request }) => {
  const ru = await request.get('/about', { maxRedirects: 0 });
  expect(ru.status()).toBe(307);
  expect(ru.headers().location).toMatch(/\/ru\/about$/);
  expect(ru.headers()['cache-control']).toContain('no-store');
  // У переброса те же заголовки безопасности, что у страницы
  expect(ru.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

  const pl = await request.get('/', {
    maxRedirects: 0,
    headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' },
  });
  expect(pl.headers().location).toMatch(/\/pl$/);
});

test('старая ссылка ?lang=pl открывается по-польски', async ({ request }) => {
  const response = await request.get('/privacy?lang=pl', { maxRedirects: 0 });
  expect(response.headers().location).toMatch(/\/pl\/privacy$/);
});

test('страница на языке: lang, hreflang, canonical', async ({ page }) => {
  await page.goto('/pl/about');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl-PL');
  await expect(page.locator('link[rel=alternate][hreflang="ru-RU"]')).toHaveAttribute(
    'href',
    /\/ru\/about$/
  );
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/pl\/about$/);
});

test('переключатель: та же страница на другом языке, выбор запоминается', async ({
  page,
  context,
}) => {
  await page.goto('/ru/about');
  // Просто открытая страница cookie не ставит
  expect((await context.cookies()).find((c) => c.name === 'lang')).toBeUndefined();

  await page.getByRole('link', { name: 'Polski' }).click();
  await expect(page).toHaveURL(/\/pl\/about$/);
  expect((await context.cookies()).find((c) => c.name === 'lang')?.value).toBe('pl');

  // Выбор человека важнее языка браузера (браузер в тестах — русский)
  await page.goto('/');
  await expect(page).toHaveURL(/\/pl$/);
});

test('неизвестная страница — 404 на языке адреса, без JavaScript', async ({ page, request }) => {
  expect((await request.get('/ru/a/b')).status()).toBe(404);
  const response = await page.goto('/pl/nie-ma-takiej-strony');
  expect(response?.status()).toBe(404);
  // Раньше «не найдено» рисовалось только скриптом (T.8); теперь — сервером
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl-PL');
  await expect(page.locator('main h1')).not.toBeEmpty();
});

test('публичная страница: HTML без скриптов, общий кэш, CSP без скриптов', async ({ request }) => {
  const response = await request.get('/pl/about');
  const html = await response.text();
  expect(html).not.toContain('<script');
  expect(response.headers()['cache-control']).toContain('public');
  expect(response.headers()['cdn-cache-control']).toContain('max-age=');
  expect(response.headers()['content-security-policy']).toContain("script-src 'none'");
  // Ни одной cookie в ответе, который ляжет в общий кэш
  expect(response.headers()['set-cookie']).toBeUndefined();

  // Стили — одним файлом со своего домена, кэш навсегда
  const css = /href="(\/site\.css\?v=[0-9a-f]+)"/.exec(html)?.[1];
  expect(css).toBeDefined();
  const sheet = await request.get(css ?? '');
  expect(sheet.status()).toBe(200);
  expect(sheet.headers()['cache-control']).toContain('immutable');
});

test('смена языка не перебрасывает на чужой сайт', async ({ request }) => {
  for (const to of ['//evil.example', 'https://evil.example', '/\\evil.example', '/de/x']) {
    const response = await request.get(`/api/lang?to=${encodeURIComponent(to)}`, {
      maxRedirects: 0,
    });
    expect(response.status()).toBe(400);
    expect(response.headers()['set-cookie']).toBeUndefined();
  }
});
