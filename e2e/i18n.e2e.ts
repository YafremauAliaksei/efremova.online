import { expect, test } from '@playwright/test';

/**
 * Языки сайта (docs/13, п.3): переброс адреса без языка, переключатель,
 * cookie только по щелчку, hreflang, 404 на языке адреса.
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

test('неизвестная страница — 404', async ({ request }) => {
  expect((await request.get('/pl/nie-ma-takiej-strony')).status()).toBe(404);
  expect((await request.get('/ru/a/b')).status()).toBe(404);
});
