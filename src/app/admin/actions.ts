'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { parseBlockSettingsForm, parseBlockTextForm, withLocaleTexts } from '@/lib/blocks/edit';
import { insertAfter, moveId, numbered } from '@/lib/blocks/order';
import { parseNewPageForm, parsePageSettingsForm } from '@/lib/blocks/page-edit';
import { HOME_SLUG } from '@/lib/blocks/pages';
import { isBlockType } from '@/lib/blocks/registry';
import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

/**
 * Действия конструктора страниц в админке.
 *
 * ⚠️ Каждая функция этого файла — адрес, на который можно отправить запрос
 * из сети, а не внутренний вызов. Поэтому КАЖДАЯ сама проверяет сессию
 * администратора и сама проверяет всё, что пришло в форме: middleware
 * пропускает только наличие cookie, а форма — это данные от браузера.
 *
 * Ничего не удаляется (docs/13, п.5): «убрать» блок или страницу — это архив, а любая правка
 * содержимого сначала кладёт прежнюю версию в историю блока.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/denied');
}

function uuidFrom(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === 'string' && UUID.test(value) ? value : null;
}

/** Куда вернуться: страница блока, язык вкладки, сообщение об итоге */
function back(formData: FormData, slug: string, extra: string): never {
  const lang = formData.get('lang');
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  redirect(`/admin?page=${slug}&lang=${locale}${extra}`);
}

/** Сайт читает страницы из базы — после правки сбрасывается кэш всех языков */
function refresh(): void {
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin');
}

/** Блок, который можно править: существует, не в архиве, тип известен */
async function editableBlock(formData: FormData) {
  const id = uuidFrom(formData, 'blockId');
  const block =
    id === null
      ? null
      : await db.pageBlock.findFirst({
          where: { id, archivedAt: null },
          include: { page: { select: { id: true, slug: true } } },
        });
  if (block === null || !isBlockType(block.type)) redirect('/admin?error=missing');
  return { ...block, type: block.type };
}

/** Перенумеровать блоки страницы в заданном порядке одной транзакцией */
async function saveOrder(ids: string[]): Promise<void> {
  await db.$transaction(
    numbered(ids).map(({ id, sortOrder }) =>
      db.pageBlock.update({ where: { id }, data: { sortOrder } })
    )
  );
}

async function pageBlockIds(pageId: string): Promise<string[]> {
  const blocks = await db.pageBlock.findMany({
    where: { pageId, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return blocks.map((block) => block.id);
}

// ───────────────────────────── тексты ─────────────────────────────

export async function saveBlockText(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);

  const parsed = parseBlockTextForm(formData, block.type);
  if (!parsed.ok) back(formData, block.page.slug, `&block=${block.id}&error=${parsed.field}`);

  // Прежнее содержимое — в историю, затем новое: одной транзакцией, чтобы
  // не было ни правки без снимка, ни снимка без правки
  await db.$transaction([
    db.blockRevision.create({
      data: {
        blockId: block.id,
        content: block.content ?? {},
        data: block.data ?? {},
        style: block.style ?? {},
      },
    }),
    db.pageBlock.update({
      where: { id: block.id },
      data: { content: withLocaleTexts(block.content, parsed.value.locale, parsed.value.texts) },
    }),
  ]);
  refresh();
  back(formData, block.page.slug, `&block=${block.id}&saved=text`);
}

// ───────────────────────────── оформление ─────────────────────────────

export async function saveBlockSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);

  const parsed = parseBlockSettingsForm(formData, block.type);
  if (!parsed.ok) back(formData, block.page.slug, `&block=${block.id}&error=${parsed.field}`);

  await db.$transaction([
    db.blockRevision.create({
      data: {
        blockId: block.id,
        content: block.content ?? {},
        data: block.data ?? {},
        style: block.style ?? {},
      },
    }),
    db.pageBlock.update({
      where: { id: block.id },
      data: { style: parsed.value.style, data: parsed.value.data },
    }),
  ]);
  refresh();
  back(formData, block.page.slug, `&block=${block.id}&saved=settings`);
}

// ───────────────────────────── состав страницы ─────────────────────────────

/** Новый пустой блок: в конец страницы или сразу после выбранного */
export async function addBlock(formData: FormData): Promise<void> {
  await requireAdmin();
  const pageId = uuidFrom(formData, 'pageId');
  const type = formData.get('type');
  const page =
    pageId === null
      ? null
      : await db.page.findFirst({
          where: { id: pageId, archivedAt: null },
          select: { id: true, slug: true },
        });
  if (page === null) redirect('/admin?error=missing');
  if (!isBlockType(type)) back(formData, page.slug, '&error=type');

  const ids = await pageBlockIds(page.id);
  const after = uuidFrom(formData, 'after');
  // Пустой блок на сайте не виден: он появится, когда у него будет текст
  const created = await db.pageBlock.create({
    data: { pageId: page.id, type, sortOrder: ids.length * 10 },
    select: { id: true },
  });
  await saveOrder(insertAfter(ids, created.id, after));
  refresh();
  back(formData, page.slug, `&block=${created.id}&saved=added#block-${created.id}`);
}

export async function moveBlock(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';
  await saveOrder(moveId(await pageBlockIds(block.pageId), block.id, direction));
  refresh();
  back(formData, block.page.slug, `&block=${block.id}&saved=moved#block-${block.id}`);
}

export async function toggleBlock(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);
  await db.pageBlock.update({ where: { id: block.id }, data: { isPublished: !block.isPublished } });
  refresh();
  back(
    formData,
    block.page.slug,
    `&block=${block.id}&saved=${block.isPublished ? 'hidden' : 'shown'}`
  );
}

/** «Удалить» = в архив: с сайта блок исчезает, из базы — нет */
export async function archiveBlock(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);
  await db.pageBlock.update({ where: { id: block.id }, data: { archivedAt: new Date() } });
  refresh();
  back(formData, block.page.slug, '&saved=archived');
}

/** Из архива — в конец страницы, в том же состоянии, в каком убран */
export async function restoreBlock(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuidFrom(formData, 'blockId');
  const block =
    id === null
      ? null
      : await db.pageBlock.findFirst({
          where: { id, archivedAt: { not: null } },
          include: { page: { select: { slug: true } } },
        });
  if (block === null) redirect('/admin?error=missing');

  // Сначала вернуть, потом перенумеровать всю страницу: номер «в конец»,
  // посчитанный заранее, совпал бы с номером последнего блока
  const ids = await pageBlockIds(block.pageId);
  await db.pageBlock.update({ where: { id: block.id }, data: { archivedAt: null } });
  await saveOrder([...ids, block.id]);
  refresh();
  back(formData, block.page.slug, `&block=${block.id}&saved=restored#block-${block.id}`);
}

// ───────────────────────────── история ─────────────────────────────

/** Вернуть версию из истории. Текущая версия сама уходит в историю — откат обратим */
export async function restoreRevision(formData: FormData): Promise<void> {
  await requireAdmin();
  const block = await editableBlock(formData);
  const revisionId = uuidFrom(formData, 'revisionId');
  const revision =
    revisionId === null
      ? null
      : await db.blockRevision.findFirst({ where: { id: revisionId, blockId: block.id } });
  if (revision === null) back(formData, block.page.slug, `&block=${block.id}&error=revision`);

  await db.$transaction([
    db.blockRevision.create({
      data: {
        blockId: block.id,
        content: block.content ?? {},
        data: block.data ?? {},
        style: block.style ?? {},
      },
    }),
    db.pageBlock.update({
      where: { id: block.id },
      data: {
        content: revision.content ?? {},
        data: revision.data ?? {},
        style: revision.style ?? {},
      },
    }),
  ]);
  refresh();
  back(formData, block.page.slug, `&block=${block.id}&saved=reverted#block-${block.id}`);
}

// ───────────────────────────── страницы ─────────────────────────────

/** Страница, которую можно править: существует и не в архиве */
async function editablePage(formData: FormData) {
  const id = uuidFrom(formData, 'pageId');
  const page = id === null ? null : await db.page.findFirst({ where: { id, archivedAt: null } });
  if (page === null) redirect('/admin?error=missing');
  return page;
}

async function pageIdsInOrder(): Promise<string[]> {
  const pages = await db.page.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return pages.map((page) => page.id);
}

async function savePageOrder(ids: string[]): Promise<void> {
  await db.$transaction(
    numbered(ids).map(({ id, sortOrder }) => db.page.update({ where: { id }, data: { sortOrder } }))
  );
}

/**
 * Новая страница — скрытая и не в меню: владелец сначала наполняет её
 * блоками, потом включает. Адрес, занятый другой страницей (в том числе
 * из архива), — отказ, а не перезапись.
 */
export async function createPage(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = parseNewPageForm(formData);
  if (!parsed.ok) back(formData, '', `&newpage=1&error=${parsed.field}`);

  const taken = await db.page.findUnique({
    where: { slug: parsed.value.slug },
    select: { id: true },
  });
  if (taken !== null) back(formData, '', '&newpage=1&error=slugTaken');

  const ids = await pageIdsInOrder();
  await db.page.create({
    data: {
      slug: parsed.value.slug,
      titleI18n: { [DEFAULT_LOCALE]: parsed.value.title },
      isPublished: false,
      sortOrder: ids.length * 10,
    },
  });
  refresh();
  back(formData, parsed.value.slug, '&saved=pageCreated');
}

export async function savePageSettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const page = await editablePage(formData);
  const parsed = parsePageSettingsForm(formData);
  if (!parsed.ok) back(formData, page.slug, `&error=${parsed.field}`);

  const { titleI18n, descriptionI18n, showInHeader, showInFooter, isPublished } = parsed.value;
  await db.page.update({
    where: { id: page.id },
    data: {
      titleI18n,
      descriptionI18n,
      showInHeader,
      showInFooter,
      // Главную скрыть нельзя: без неё сайт — это пустой адрес
      isPublished: page.slug === HOME_SLUG ? true : isPublished,
    },
  });
  refresh();
  back(formData, page.slug, '&saved=pageSettings');
}

/** Порядок страниц — это порядок пунктов в шапке и подвале */
export async function movePage(formData: FormData): Promise<void> {
  await requireAdmin();
  const page = await editablePage(formData);
  const direction = formData.get('direction') === 'up' ? 'up' : 'down';
  await savePageOrder(moveId(await pageIdsInOrder(), page.id, direction));
  refresh();
  back(formData, page.slug, '&saved=pageMoved');
}

/** «Удалить» страницу = в архив, вместе с блоками; главную — нельзя */
export async function archivePage(formData: FormData): Promise<void> {
  await requireAdmin();
  const page = await editablePage(formData);
  if (page.slug === HOME_SLUG) back(formData, page.slug, '&error=homeArchive');
  await db.page.update({ where: { id: page.id }, data: { archivedAt: new Date() } });
  refresh();
  back(formData, HOME_SLUG, '&saved=pageArchived');
}

/** Из архива — скрытой и в конец меню: владелец сам решит, когда показать */
export async function restorePage(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuidFrom(formData, 'pageId');
  const page =
    id === null ? null : await db.page.findFirst({ where: { id, archivedAt: { not: null } } });
  if (page === null) redirect('/admin?error=missing');

  const ids = await pageIdsInOrder();
  await db.page.update({ where: { id: page.id }, data: { archivedAt: null, isPublished: false } });
  await savePageOrder([...ids, page.id]);
  refresh();
  back(formData, page.slug, '&saved=pageRestored');
}
