import { execFileSync } from 'node:child_process';
import { expect, test, type Page } from '@playwright/test';
import { base32Decode, totp } from '../src/lib/auth/totp';
import { E2E_TOTP_KEY } from './totp-key';
import sharp from 'sharp';

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

const TOTP_KEY = base32Decode(E2E_TOTP_KEY) ?? new Uint8Array();

/**
 * Вход как у владельца: ссылка из терминала, затем код из «телефона».
 * Код текущего шага уже мог уйти на предыдущий вход в те же 30 секунд —
 * сервер второй раз его не примет (так и задумано), и тогда берётся код
 * следующего шага: его сервер тоже принимает.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto(loginLink());
  await expect(page).toHaveURL(/\/admin\/2fa$/);
  for (const offset of [0, 30_000]) {
    await page.locator('input[name=code]').fill(totp(TOTP_KEY, new Date(Date.now() + offset)));
    await page.getByRole('button', { name: 'Войти' }).click();
    await page.waitForURL(/\/admin(\/2fa\?left=\d)?$/);
    if (new URL(page.url()).pathname === '/admin') return;
  }
  throw new Error('Код второго фактора не принят');
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
  await signIn(admin);
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
  await expect(page).toHaveURL(/\/admin\/2fa$/);
  const again = await request.get(link, { maxRedirects: 0 });
  expect(again.headers().location).toMatch(/\/admin\/denied$/);
});

test('второй фактор: одной ссылки мало, пять неверных кодов — нужна новая ссылка', async ({
  page,
}) => {
  // Без пропуска из ссылки страницы кода нет
  await page.goto('/admin/2fa');
  await expect(page).toHaveURL(/\/admin\/denied$/);

  await page.goto(loginLink());
  await expect(page).toHaveURL(/\/admin\/2fa$/);
  // Страница до входа — тоже закрытая зона: не кэшируется и не индексируется
  const headers = (await page.request.get('/admin/2fa')).headers();
  expect(headers['cache-control']).toContain('no-store');
  expect(headers['x-robots-tag']).toContain('noindex');

  // С пропуском, но без кода — в админку не пускает
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/denied$/);

  for (const left of [4, 3, 2, 1]) {
    await page.goto('/admin/2fa');
    await page.locator('input[name=code]').fill('000000');
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.locator('main [role=alert]')).toContainText(
      `Осталось попыток: ${String(left)}`
    );
  }
  await page.locator('input[name=code]').fill('000000');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/admin\/denied$/);

  // Пропуск сгорел: даже верный код теперь не нужен — страницы кода нет
  await page.goto('/admin/2fa');
  await expect(page).toHaveURL(/\/admin\/denied$/);
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

  await admin.getByRole('button', { name: '+ Текст', exact: true }).last().click();
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

  await admin.getByRole('button', { name: '+ Текст', exact: true }).last().click();
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

test('картинки: загрузка без EXIF, отказ SVG, архив', async () => {
  // Как фото с телефона: модель и координаты в EXIF
  const photo = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 90, g: 140, b: 120 } },
  })
    .withExif({ IFD0: { Make: 'DemoPhone' }, IFD3: { GPSLatitudeRef: 'N' } })
    // Свой цвет на каждый прогон: иначе второй прогон на той же базе — «уже загружена»
    .composite([
      {
        input: { create: { width: 10, height: 10, channels: 3, background: `#${RUN}` } },
        left: 0,
        top: 0,
      },
    ])
    .jpeg()
    .toBuffer();

  await admin.goto('/admin/media');
  await admin.locator('input[name=file]').setInputFiles({
    name: 'IMG_home.jpg',
    mimeType: 'image/jpeg',
    buffer: photo,
  });
  await admin.locator('input[name=label]').first().fill(`Проверка ${RUN}`);
  await admin.getByRole('button', { name: 'Загрузить' }).click();
  await saved(admin, 'Картинка загружена');

  const preview = admin.locator(`img[alt="Проверка ${RUN}"]`);
  const src = await preview.getAttribute('src');
  expect(src).toMatch(/^\/media\/[0-9a-f]{64}\.webp$/);

  // Отдаётся со своего домена, кэшируется навсегда, данных о съёмке нет
  const file = await admin.request.get(src ?? '');
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('image/webp');
  expect(file.headers()['cache-control']).toContain('immutable');
  expect(file.headers()['x-content-type-options']).toBe('nosniff');
  const body = await file.body();
  expect(body.includes('DemoPhone')).toBe(false);
  expect((await sharp(body).metadata()).exif).toBeUndefined();

  // SVG под видом PNG — отказ
  await admin.locator('input[name=file]').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  });
  await admin.getByRole('button', { name: 'Загрузить' }).click();
  await expect(admin.locator('main [role=alert]')).toContainText('SVG не принимается');

  // В архиве — с сайта пропадает
  await admin
    .locator('li', { has: admin.locator(`img[alt="Проверка ${RUN}"]`) })
    .getByRole('button', { name: 'В архив' })
    .click();
  await saved(admin, 'убрана в архив');
  expect((await admin.request.get(src ?? '')).status()).toBe(404);
});

test('текст и фото: блок с картинкой — на сайте, со своего домена', async () => {
  // Своя картинка для этого теста: прошлую тест картинок убрал в архив
  const photo = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: `#${RUN.split('').reverse().join('')}`,
    },
  })
    .jpeg()
    .toBuffer();
  await admin.goto('/admin/media');
  await admin.locator('input[name=file]').setInputFiles({
    name: 'office.jpg',
    mimeType: 'image/jpeg',
    buffer: photo,
  });
  await admin.locator('input[name=label]').first().fill(`Кабинет ${RUN}`);
  await admin.getByRole('button', { name: 'Загрузить' }).click();
  await saved(admin, 'Картинка загружена');

  const title = `С фото ${RUN}`;
  await admin.goto('/admin?page=about&lang=ru');
  await admin.getByRole('button', { name: '+ Текст и фото' }).last().click();
  await saved(admin, 'Блок добавлен');

  const card = admin.locator('article[id^="block-"]').last();
  await card.locator('input[name=title]').fill(title);
  await card.locator('input[name=alt]').fill('Кресло у окна');
  await card.getByRole('button', { name: 'Сохранить текст' }).click();
  await saved(admin, 'Текст сохранён');

  await card.locator('summary', { hasText: 'Оформление' }).click();
  await card.locator('select[name=image]').selectOption({ label: `Кабинет ${RUN} · 1200×900` });
  await card.locator('select[name=side]').selectOption('left');
  await card.getByRole('button', { name: 'Применить' }).click();
  await saved(admin, 'Оформление сохранено');

  const site = await admin.context().newPage();
  await site.goto('/ru/about');
  const section = site.locator('main section', { hasText: title });
  const img = section.locator('picture img');
  await expect(img).toHaveAttribute('alt', 'Кресло у окна');
  await expect(section.locator('picture source[type="image/avif"]')).toHaveCount(1);
  // Все адреса — свой домен
  const srcset = (await img.getAttribute('srcset')) ?? '';
  for (const entry of srcset.split(','))
    expect(entry.trim()).toMatch(/^\/media\/[0-9a-f]{64}\.webp \d+w$/);
  // loading="lazy": фото грузится, когда до него доходит прокрутка
  await img.scrollIntoViewIfNeeded();
  await expect(img).toHaveJSProperty('complete', true);
  expect(await img.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
  await site.close();
});

test('видео: карточка ведёт на предупреждение, на YouTube — только вторым щелчком', async () => {
  const id = 'dQw4w9WgXcQ';
  const title = `Ролик ${RUN}`;
  await admin.goto('/admin?page=about&lang=ru');
  await admin.getByRole('button', { name: '+ Видео' }).last().click();
  await saved(admin, 'Блок добавлен');

  const card = admin.locator('article[id^="block-"]').last();
  await card.locator('input[name=title]').fill(title);
  await card.getByRole('button', { name: 'Сохранить текст' }).click();
  await saved(admin, 'Текст сохранён');

  await card.locator('summary', { hasText: 'Оформление' }).click();
  await card.locator('input[name=video]').fill(`https://youtu.be/${id}?si=share`);
  await card.getByRole('button', { name: 'Применить' }).click();
  // Обложку сервер качает с YouTube; нет сети — блок сохраняется без неё
  await expect(admin.locator('main [role=status]')).toContainText(
    /Оформление сохранено|обложку с YouTube скачать не удалось/
  );

  // Ни одного запроса браузера к чужому домену на странице с роликом
  const site = await admin.context().newPage();
  const foreign: string[] = [];
  site.on('request', (request) => {
    if (!request.url().startsWith('http://localhost:3000/')) foreign.push(request.url());
  });
  await site.goto('/ru/about');
  const link = site.locator('main section', { hasText: title }).locator(`a[data-video="${id}"]`);
  await expect(link).toHaveAttribute('href', `/ru/out/youtube/${id}`);
  await link.click();
  await expect(site.locator('main h1')).toHaveText('Переход на YouTube');
  expect(foreign).toEqual([]);

  const go = site.getByRole('link', { name: 'Перейти на YouTube' });
  await expect(go).toHaveAttribute('href', `https://www.youtube.com/watch?v=${id}`);
  await expect(go).toHaveAttribute('rel', /noreferrer/);
  expect((await site.request.get('/ru/out/youtube/too-short')).status()).toBe(404);
  await site.close();
});

test('услуги: создать, назначить цены по регионам, показать, сменить цену', async ({ browser }) => {
  const title = `Проверка услуги ${RUN}`;
  await admin.goto('/admin/services');
  await admin.locator('summary', { hasText: '+ Новая услуга' }).click();
  await admin.locator('input[name=slug]').fill(`check-${RUN}`);
  await admin.locator('input[name=title]').fill(title);
  await admin.getByRole('button', { name: 'Создать скрытой' }).click();
  await saved(admin, 'Услуга создана скрытой');

  // Открыта карточка новой услуги; общая цена — в евро с центами
  const card = admin.locator('li details[open]');
  await expect(card.locator('summary')).toContainText(title);
  await card.locator('input[name=region]').fill('default');
  await card.locator('select[name=currency]').selectOption('EUR');
  await card.locator('input[name=amount]').fill('60,50');
  await card.getByRole('button', { name: 'Назначить цену' }).click();
  await saved(admin, 'Цена назначена');

  await card.locator('input[name=region]').fill('pl');
  await card.locator('select[name=currency]').selectOption('PLN');
  await card.locator('input[name=amount]').fill('250');
  await card.getByRole('button', { name: 'Назначить цену' }).click();
  // Сообщение то же, что после первой цены: ждём саму цену, а не текст
  await expect(card.locator('summary')).toContainText('PL 250');

  await card.locator('input[name=title_pl]').fill(`Konsultacja ${RUN}`);
  await card.locator('input[name=isActive]').check();
  await card.getByRole('button', { name: 'Сохранить услугу' }).click();
  await saved(admin, 'Услуга сохранена');

  // Посетитель из Польши — злотые, из другой страны — общая цена, копейки не округлены
  const poland = await browser.newContext({ extraHTTPHeaders: { 'cf-ipcountry': 'PL' } });
  const site = await poland.newPage();
  await site.goto('/pl/services');
  const item = site.locator('main li', { hasText: `Konsultacja ${RUN}` });
  await expect(item).toContainText(/250\szł/);

  const other = await browser.newContext({ extraHTTPHeaders: { 'cf-ipcountry': 'DE' } });
  const elsewhere = await other.newPage();
  await elsewhere.goto('/en/services');
  await expect(elsewhere.locator('main li', { hasText: title })).toContainText('€60.50');

  // Новая цена закрывает прежнюю: на сайте новая, прежняя — в истории
  await card.locator('input[name=region]').fill('PL');
  await card.locator('select[name=currency]').selectOption('PLN');
  await card.locator('input[name=amount]').fill('260');
  await card.getByRole('button', { name: 'Назначить цену' }).click();
  await saved(admin, 'Цена назначена');
  await expect(card.locator('summary', { hasText: 'История цен: 1' })).toBeVisible();

  await site.reload();
  await expect(item).toContainText(/260\szł/);
  await poland.close();
  await other.close();
});

test('контакты: адреса из профиля — кнопками на странице контактов', async () => {
  const site = await admin.context().newPage();

  // Пока адресов нет, вместо кнопок — честное «скоро появятся»
  await site.goto('/ru/contacts');
  await expect(site.locator('main h1')).toHaveText('Контакты');

  await admin.goto('/admin/profile');
  await admin.locator('input[name="contact.telegram"]').fill('https://t.me/demo_contact');
  await admin.locator('input[name="contact.whatsapp"]').fill('+48 600 000 000');
  await admin.locator('input[name="contact.viber"]').fill('600');
  await admin.locator('input[name="owner.email"]').fill('kontakt@example.pl');
  await admin.getByRole('button', { name: 'Сохранить', exact: true }).click();
  // Номер без кода страны не сохраняется, остальное — сохраняется
  await expect(admin.locator('main [role=alert]')).toContainText('Viber');
  await expect(admin.locator('input[name="contact.telegram"]')).toHaveValue('demo_contact');

  await site.goto('/ru/contacts');
  await expect(site.locator('a[data-contact=telegram]')).toHaveAttribute(
    'href',
    'https://t.me/demo_contact'
  );
  await expect(site.locator('a[data-contact=whatsapp]')).toHaveAttribute(
    'href',
    'https://wa.me/48600000000'
  );
  await expect(site.locator('a[data-contact=email]')).toHaveAttribute(
    'href',
    'mailto:kontakt@example.pl'
  );
  await expect(site.locator('a[data-contact=viber]')).toHaveCount(0);

  // На польской странице подписи польские, а адреса те же
  await site.goto('/pl/contacts');
  await expect(site.locator('a[data-contact=email]')).toContainText('E-mail');
  await expect(site.locator('main section').first()).not.toHaveAttribute('lang', 'ru');

  // С главной до контактов — одна кнопка
  await site.goto('/ru');
  await site.getByRole('link', { name: 'Связаться' }).click();
  await expect(site).toHaveURL(/\/ru\/contacts$/);
  await site.close();
});

test('журнал: действия видны, данные владельца — только именами полей', async () => {
  await admin.goto('/admin/journal');
  await expect(admin.locator('main h1')).toHaveText('Журнал действий');
  await expect(admin.locator('main')).toContainText('Цепочка цела');

  const rows = admin.locator('main tbody tr');
  // Новые сверху: последним было сохранение контактов
  await expect(rows.first()).toContainText('Данные владельца');
  await expect(rows.first()).toContainText('contact.telegram');
  await expect(admin.locator('main tbody')).toContainText('Вход в админку');
  await expect(admin.locator('main tbody')).toContainText('Новая цена');
  await expect(admin.locator('main tbody')).toContainText('Блок: возврат версии');
  // Значения из профиля в журнал не попадают: его нельзя чистить
  await expect(admin.locator('main')).not.toContainText('demo_contact');
  await expect(admin.locator('main')).not.toContainText('kontakt@example.pl');
});

test('правовой документ: новая редакция, ошибка не теряет текст, возврат прежней', async () => {
  await admin.goto('/admin/legal');
  await admin.getByRole('link', { name: 'Polski' }).first().click();
  await expect(admin).toHaveURL(/doc=privacy&lang=pl/);

  const text = admin.locator('textarea[name=text]');
  const original = await text.inputValue();
  expect(original).toMatch(/^## /);

  // Ошибка разметки: сообщение со строкой, введённый текст на месте
  await text.fill(`текст до заголовка\n${original}`);
  await admin.getByRole('button', { name: 'Опубликовать новую редакцию' }).click();
  await expect(admin.locator('main [role=alert]')).toContainText('Строка 1');
  await expect(text).toHaveValue(/^текст до заголовка/);

  // Неизвестная метка не проходит: на сайте она была бы «не заполнено»
  await text.fill(`${original}\n\n## Kontakt\n{{owner.nope}}`);
  await admin.getByRole('button', { name: 'Опубликовать новую редакцию' }).click();
  await expect(admin.locator('main [role=alert]')).toContainText('{{owner.nope}}');

  // Без изменений — новой редакции нет
  await text.fill(original);
  await admin.getByRole('button', { name: 'Опубликовать новую редакцию' }).click();
  await expect(admin.locator('main [role=alert]')).toContainText('не изменились');

  await text.fill(`${original}\n\n## Test ${RUN} {#e2e-${RUN}}\nAkapit testowy ${RUN}.`);
  await admin.getByRole('button', { name: 'Опубликовать новую редакцию' }).click();
  await saved(admin, 'Новая редакция опубликована');

  const site = await admin.context().newPage();
  await site.goto(`/pl/privacy#e2e-${RUN}`);
  await expect(site.locator(`#e2e-${RUN}`)).toContainText(`Akapit testowy ${RUN}`);
  await expect(site.locator('article')).toContainText(/privacy-\d{4}-\d{2}-\d{2}/);

  // Вернуть прежнюю: её текст публикуется новой редакцией, история растёт
  const history = admin.locator('main section li');
  const before = await history.count();
  await history.nth(1).getByRole('button', { name: 'Вернуть этот текст' }).click();
  await saved(admin, 'Прежний текст опубликован');
  await expect(history).toHaveCount(before + 1);
  await site.reload();
  await expect(site.locator(`#e2e-${RUN}`)).toHaveCount(0);
  await site.close();

  await admin.goto('/admin/journal');
  await expect(admin.locator('main tbody tr').first()).toContainText('Документ: возврат редакции');
});
