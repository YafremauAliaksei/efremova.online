import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';

/**
 * Админка глазами владельца: вход по одноразовой ссылке, конструктор блоков,
 * перевод, страницы. После каждого действия смотрим сам сайт — админка может
 * рапортовать «сохранено», а сайт при этом ничего не показать.
 *
 * Тесты идут по порядку и меняют базу: сид создаёт главную и «Обо мне»,
 * дальше каждый шаг опирается на предыдущий.
 */
test.describe.configure({ mode: 'serial' });

/** Одноразовая ссылка входа — тем же способом, что у владельца на сервере */
function loginLink(): string {
  const output = execFileSync('node', ['scripts/admin-link.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, APP_URL: 'http://localhost:3000' },
  });
  const link = /http:\/\/localhost:3000\/admin\/enter\?token=\S+/.exec(output)?.[0];
  if (link === undefined) throw new Error('admin:link не выдал ссылку');
  return link;
}

/** Итог действия в админке: сообщение со статусом, а не ошибка */
async function saved(page: Page, text: string) {
  await expect(page.locator('main [role=status]')).toContainText(text);
}

/** Заголовки блоков на странице сайта */
async function siteHeadings(page: Page, path: string): Promise<string[]> {
  const site = await page.context().newPage();
  await site.goto(path);
  const headings = await site.locator('main h1, main h2').allTextContents();
  await site.close();
  return headings;
}

// Уникальные имена: локально тесты можно гонять много раз на одной базе
const RUN = String(Date.now()).slice(-6);

let admin: Page;

test.beforeAll(async ({ browser }) => {
  // Свой контекст: из него же открываются вкладки сайта для проверки
  admin = await (await browser.newContext({ locale: 'ru-RU' })).newPage();
  await admin.goto(loginLink());
  await expect(admin).toHaveURL(/\/admin$/);
});

test.afterAll(async () => {
  // Если браузер не поднялся, beforeAll упал раньше присваивания — без этой
  // проверки к настоящей ошибке в отчёте добавляется вторая, ложная
  if (typeof admin !== 'undefined') await admin.context().close();
});

test('без входа админки не видно', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/denied$/);

  // Использованная ссылка второй раз не пускает
  const link = loginLink();
  await page.goto(link);
  await expect(page).toHaveURL(/\/admin$/);
  const again = await request.get(link, { maxRedirects: 0 });
  expect(again.headers().location).toMatch(/\/admin\/denied$/);
});

test('запрос с чужого сайта — 403', async ({ request }) => {
  const response = await request.post('/admin', {
    headers: { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
    form: { any: 'x' },
  });
  expect(response.status()).toBe(403);
});

test('блок: добавить, написать, поднять, скрыть, в архив и обратно', async () => {
  const title = `Раздел ${RUN}`;
  await admin.goto('/admin?page=about&lang=ru');

  await admin.getByRole('button', { name: '+ Текст' }).last().click();
  await saved(admin, 'Блок добавлен');

  const card = admin.locator('article[id^="block-"]').last();
  await card.locator('input[name=title]').fill(title);
  await card.locator('textarea[name=body]').fill('Первый абзац.\n\nВторой абзац.');
  await card.getByRole('button', { name: 'Сохранить текст' }).click();
  await saved(admin, 'Текст сохранён');
  expect((await siteHeadings(admin, '/ru/about')).at(-1)).toBe(title);

  // Наверх: по шагу стрелкой, после каждого — ждём, что блок встал выше
  const cards = admin.locator('article[id^="block-"]');
  const ours = cards.filter({ has: admin.locator(`input[value="${title}"]`) });
  for (let position = (await cards.count()) - 2; position >= 0; position -= 1) {
    await ours.getByRole('button', { name: 'Выше' }).click();
    await expect(cards.nth(position).locator('input[name=title]')).toHaveValue(title);
  }
  expect((await siteHeadings(admin, '/ru/about'))[0]).toBe(title);

  await ours.getByRole('button', { name: 'Скрыть' }).click();
  await saved(admin, 'скрыт');
  expect(await siteHeadings(admin, '/ru/about')).not.toContain(title);

  await ours.getByRole('button', { name: 'Показать' }).click();
  await saved(admin, 'снова на сайте');

  await ours.getByRole('button', { name: 'В архив' }).click();
  await saved(admin, 'в архив');
  expect(await siteHeadings(admin, '/ru/about')).not.toContain(title);

  await admin.locator('li', { hasText: title }).getByRole('button', { name: 'Вернуть' }).click();
  await saved(admin, 'возвращён из архива');
  expect((await siteHeadings(admin, '/ru/about')).at(-1)).toBe(title);
});

test('правка и откат к прежней версии', async () => {
  await admin.goto('/admin?page=about&lang=ru');
  const card = admin.locator('article[id^="block-"]').first();
  const before = await card.locator('input[name=title]').inputValue();

  await card.locator('input[name=title]').fill('Испорченный заголовок');
  await card.getByRole('button', { name: 'Сохранить текст' }).click();
  await saved(admin, 'Текст сохранён');

  const first = admin.locator('article[id^="block-"]').first();
  await first.locator('summary', { hasText: 'История правок' }).click();
  await first.getByRole('button', { name: 'Вернуть эту версию' }).first().click();
  await saved(admin, 'Прежняя версия возвращена');
  expect((await siteHeadings(admin, '/ru/about'))[0]).toBe(before);
});

test('перевод: польский текст блока — на польской странице', async () => {
  const title = `Pierwszy ekran ${RUN}`;
  await admin.goto('/admin?page=home&lang=pl');
  const card = admin.locator('article[id^="block-"]').first();
  await card.locator('input[name=title]').fill(title);
  await card.getByRole('button', { name: /Сохранить текст|Создать перевод/ }).click();
  await saved(admin, 'Текст сохранён');

  expect((await siteHeadings(admin, '/pl'))[0]).toBe(title);
  expect((await siteHeadings(admin, '/ru'))[0]).not.toBe(title);
});

test('страница: создать скрытой, опубликовать, в меню, в архив', async () => {
  const slug = `e2e-${RUN}`;
  const title = `Проверка ${RUN}`;
  await admin.goto('/admin?page=home&lang=ru');

  const create = admin.locator('form:has(input[name=slug])');
  await admin.locator('summary', { hasText: '+ Новая страница' }).click();
  await create.locator('input[name=slug]').fill(slug);
  await create.locator('input[name=title]').fill(title);
  await create.getByRole('button', { name: 'Создать скрытой' }).click();
  await saved(admin, 'Страница создана скрытой');
  expect((await admin.request.get(`/ru/${slug}`)).status()).toBe(404);

  await admin.getByRole('button', { name: '+ Текст' }).last().click();
  await saved(admin, 'Блок добавлен');
  const card = admin.locator('article[id^="block-"]').last();
  await card.locator('input[name=title]').fill(title);
  await card.getByRole('button', { name: 'Сохранить текст' }).click();
  await saved(admin, 'Текст сохранён');

  await admin.locator('summary', { hasText: 'Настройки страницы' }).click();
  await admin.locator('input[name=title_pl]').fill(`Sprawdzenie ${RUN}`);
  await admin.locator('input[name=showInHeader]').check();
  await admin.locator('input[name=isPublished]').check();
  await admin.getByRole('button', { name: 'Сохранить настройки' }).click();
  await saved(admin, 'Настройки страницы сохранены');

  const site = await admin.context().newPage();
  await site.goto('/pl');
  await expect(site.getByRole('navigation', { name: 'Menu główne' })).toContainText(
    `Sprawdzenie ${RUN}`
  );
  await site.goto(`/ru/${slug}`);
  await expect(site.locator('main h1')).toHaveText(title);
  await site.close();

  await admin.locator('summary', { hasText: 'Настройки страницы' }).click();
  await admin.getByRole('button', { name: 'Страницу в архив' }).click();
  await saved(admin, 'Страница убрана в архив');
  expect((await admin.request.get(`/ru/${slug}`)).status()).toBe(404);
});

test('главную нельзя скрыть и убрать в архив', async () => {
  await admin.goto('/admin?page=home&lang=ru');
  await admin.locator('summary', { hasText: 'Настройки страницы' }).click();
  await expect(admin.locator('input[name=isPublished]')).toBeDisabled();
  await expect(admin.getByRole('button', { name: 'Страницу в архив' })).toHaveCount(0);
});
