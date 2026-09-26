import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { restoreBlock } from '@/app/admin/actions';
import { AddBlockButtons, BlockCard, type AdminBlock } from '@/app/admin/BlockCard';
import { ArchivedPages, NewPageForm, PageSettings } from '@/app/admin/PagePanel';
import { AdminNav } from '@/components/admin/AdminNav';
import { db } from '@/lib/db';
import { isAdmin } from '@/lib/auth/admin';
import { i18nTextSchema } from '@/lib/content-schema';
import { pagePath } from '@/lib/blocks/pages';
import { BLOCKS, isBlockType, isTranslated, type BlockType } from '@/lib/blocks/registry';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  isLocale,
  localizedPath,
  type Locale,
} from '@/lib/i18n';

/**
 * Админка: конструктор страниц сайта на трёх языках.
 *
 * ── ЗАЧЕМ ОНА ВООБЩЕ ──────────────────────────────────────────────────────
 * Весь текст сайта хранится в базе, а не в коде — чтобы репозиторий можно
 * было держать публичным (docs/06). Но тогда нужен инструмент, которым эти
 * тексты правят. Иначе «контент отдельно от кода» остаётся теорией.
 *
 * ── КОНСТРУКТОР ────────────────────────────────────────────────────────────
 * Страница → её блоки → тексты блока на выбранном языке. Блок добавляется
 * одной кнопкой, переставляется стрелками, скрывается, уходит в архив и
 * возвращается оттуда; у каждого — история правок с откатом. Поля формы
 * задаёт тип блока (src/lib/blocks/registry.ts): новый тип появится здесь
 * сам. Действия — в actions.ts, каждое проверяет сессию само.
 */

export const metadata: Metadata = {
  title: 'Страницы и тексты',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Итог действия передаётся через адрес (?saved / ?error), а текст берётся
 * только отсюда или из подписи поля в реестре: из адреса на страницу не
 * попадает ни одной строки, кроме известного кода.
 */
const SAVED = {
  text: 'Текст сохранён. Прежний — в истории блока.',
  settings: 'Оформление сохранено.',
  added: 'Блок добавлен. Пока в нём нет текста, на сайте его не видно.',
  moved: 'Порядок изменён.',
  hidden: 'Блок скрыт с сайта.',
  shown: 'Блок снова на сайте.',
  archived: 'Блок убран в архив — вернуть можно внизу страницы.',
  restored: 'Блок возвращён из архива в конец страницы.',
  reverted: 'Прежняя версия возвращена. Текущая — в истории, откат обратим.',
  pageCreated:
    'Страница создана скрытой. Добавьте блоки, затем включите «опубликована» в настройках.',
  pageSettings: 'Настройки страницы сохранены.',
  pageMoved: 'Место в меню изменено.',
  pageArchived: 'Страница убрана в архив — вернуть можно внизу страницы.',
  pageRestored: 'Страница возвращена из архива скрытой.',
} as const;

const ERRORS = {
  missing: 'Блок или страница не найдены — обновите страницу.',
  blockId: 'Блок не найден — обновите страницу.',
  locale: 'Неизвестный язык — обновите страницу.',
  type: 'Такого типа блока нет — обновите страницу.',
  revision: 'Эта версия не найдена в истории блока.',
  width: 'Ширина — только из списка.',
  align: 'Выравнивание — только из списка.',
  background: 'Фон — только из списка.',
  link: 'Кнопка может вести только на страницу этого сайта.',
  pageId: 'Страница не найдена — обновите страницу.',
  slug: 'Адрес: латиница, цифры и дефис, до 48 знаков; адреса home, services, privacy, terms и служебные заняты.',
  slugTaken: 'Такой адрес уже есть — у другой страницы или в архиве.',
  title: 'Нужно название по-русски: одна строка до 80 знаков.',
  homeArchive: 'Главную нельзя убрать в архив.',
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

function errorMessage(code: string | undefined, type: BlockType | undefined): string | null {
  const general = known(ERRORS, code);
  if (general !== null) return general;
  // Поля настроек страницы: title_ru, description_pl…
  const pageField = /^(title|description)_(ru|pl|en)$/.exec(code ?? '');
  if (pageField !== null) {
    const what = pageField[1] === 'title' ? 'Название' : 'Описание';
    const lang = LOCALE_NAMES[pageField[2] as Locale];
    return `${what} (${lang}) не сохранено: одна строка без служебных символов${
      pageField[1] === 'title' && pageField[2] === DEFAULT_LOCALE ? ', по-русски обязательно' : ''
    }.`;
  }
  const field = type === undefined ? undefined : BLOCKS[type].fields.find((f) => f.name === code);
  if (field === undefined) return null;
  const shape = field.kind === 'line' ? 'одна строка' : 'текст';
  return `«${field.label}» не сохранено: ${shape} до ${String(field.max)} знаков, без служебных символов.`;
}

/** Первая строка русского текста архивного блока — чтобы узнать его в списке */
function archivedPreview(type: BlockType, content: unknown): string {
  const texts = i18nTextSchema.parse(
    (content as Record<string, unknown> | null)?.[DEFAULT_LOCALE] ?? {}
  );
  const first = BLOCKS[type].fields.map((field) => texts[field.name]).find(Boolean) ?? '';
  return first.length > 80 ? `${first.slice(0, 80)}…` : first;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    lang?: string;
    saved?: string;
    error?: string;
    block?: string;
    newpage?: string;
  }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  // Middleware проверяет наличие cookie — здесь проверяется сама подпись.
  // Две независимые проверки: middleware дешёвая и быстрая, эта настоящая.
  if (!(await isAdmin())) redirect('/admin/denied');

  const params = await searchParams;
  const locale: Locale = isLocale(params.lang) ? params.lang : DEFAULT_LOCALE;

  const pages = await db.page.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      titleI18n: true,
      descriptionI18n: true,
      showInHeader: true,
      showInFooter: true,
      isPublished: true,
    },
  });
  const archivedPages = await db.page.findMany({
    where: { archivedAt: { not: null } },
    orderBy: { archivedAt: 'desc' },
    select: { id: true, slug: true, titleI18n: true },
  });
  const pageIndex = pages.findIndex((p) => p.slug === params.page);
  const page = pages[pageIndex === -1 ? 0 : pageIndex];
  const [blocks, archived] =
    page === undefined
      ? [[], []]
      : await Promise.all([
          db.pageBlock.findMany({
            where: { pageId: page.id, archivedAt: null },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            // Последние версии: история длинная, а откатываются на шаг-другой
            include: { revisions: { orderBy: { createdAt: 'desc' }, take: 10 } },
          }),
          db.pageBlock.findMany({
            where: { pageId: page.id, archivedAt: { not: null } },
            orderBy: { archivedAt: 'desc' },
          }),
        ]);

  const pageTitle = (p: { slug: string; titleI18n: unknown }) =>
    i18nTextSchema.parse(p.titleI18n)[DEFAULT_LOCALE] ?? p.slug;
  const linkTargets = pages.map((p) => ({ slug: p.slug, title: pageTitle(p) }));
  const missing = (lang: Locale) =>
    blocks.filter(
      (b) =>
        isBlockType(b.type) &&
        isTranslated(b.type, b.content, DEFAULT_LOCALE) &&
        !isTranslated(b.type, b.content, lang)
    ).length;

  // Сообщение об ошибке поля — только для блока, который есть на странице
  const statusBlock = blocks.find((b) => b.id === params.block);
  const statusType =
    statusBlock !== undefined && isBlockType(statusBlock.type) ? statusBlock.type : undefined;
  const saved = known(SAVED, params.saved);
  const status = saved ?? errorMessage(params.error, statusType);
  const query = (next: { page?: string; lang?: Locale }) =>
    `/admin?page=${next.page ?? page?.slug ?? ''}&lang=${next.lang ?? locale}`;

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Страницы и тексты</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-[var(--color-ink-soft)] underline">
            Выйти
          </button>
        </form>
      </header>

      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        Тексты хранятся только в базе данных и никогда не попадают в публичный репозиторий. Сессия
        действует 30 минут.
      </p>

      <AdminNav current="/admin" />

      {page === undefined ? (
        <p className="mt-10 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
          Страниц пока нет. Выполните <code>npm run db:seed</code>.
        </p>
      ) : (
        <>
          <nav aria-label="Страница" className="mt-8 flex flex-wrap gap-2 text-sm">
            {pages.map((p) => (
              <Link
                key={p.id}
                href={query({ page: p.slug })}
                aria-current={p.id === page.id ? 'page' : undefined}
                className={`rounded px-3 py-1 ${
                  p.id === page.id
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'border border-[var(--color-line)] hover:underline'
                }`}
              >
                {pageTitle(p)}
                {!p.isPublished && ' (скрыта)'}
              </Link>
            ))}
          </nav>
          <NewPageForm locale={locale} open={params.newpage !== undefined} />

          <PageSettings
            page={page}
            locale={locale}
            isFirst={page.id === pages[0]?.id}
            isLast={page.id === pages[pages.length - 1]?.id}
          />

          {/* Вкладки языков. Непереведённый блок на сайте показывается по-русски,
              поэтому счётчик рядом с языком — список того, что осталось перевести */}
          <nav
            aria-label="Язык текстов"
            className="mt-6 flex flex-wrap gap-2 border-b border-[var(--color-line)]"
          >
            {LOCALES.map((lang) => {
              const count = lang === DEFAULT_LOCALE ? 0 : missing(lang);
              return (
                <Link
                  key={lang}
                  href={query({ lang })}
                  aria-current={lang === locale ? 'page' : undefined}
                  className={`-mb-px rounded-t border px-4 py-2 text-sm ${
                    lang === locale
                      ? 'border-[var(--color-line)] border-b-[var(--color-paper)] bg-[var(--color-paper)] font-medium'
                      : 'border-transparent text-[var(--color-ink-soft)] hover:underline'
                  }`}
                >
                  {LOCALE_NAMES[lang]}
                  {count > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">
                      не переведено: {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {status !== null && (
            <p
              role={saved !== null ? 'status' : 'alert'}
              className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                saved !== null
                  ? 'border-[var(--color-line)] text-[var(--color-ink-soft)]'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {status}
            </p>
          )}

          <div className="mt-8 space-y-6">
            {blocks.length === 0 && (
              <p className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
                На странице пока нет блоков — добавьте первый кнопкой ниже.
              </p>
            )}
            {blocks.map((block, index) => {
              if (!isBlockType(block.type)) {
                return (
                  <p
                    key={block.id}
                    className="rounded-lg border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-ink-soft)]"
                  >
                    №{index + 1} · тип «{block.type}» этой версией сайта не поддерживается — на
                    сайте блок пропускается.
                  </p>
                );
              }
              const card: AdminBlock = { ...block, type: block.type };
              return (
                <BlockCard
                  key={`${block.id}-${locale}`}
                  block={card}
                  number={index + 1}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  locale={locale}
                  pageId={page.id}
                  linkTargets={linkTargets}
                />
              );
            })}
          </div>

          <section className="mt-8 rounded-lg border border-[var(--color-line)] p-5">
            <h2 className="text-sm font-medium">Добавить блок в конец страницы</h2>
            <div className="mt-3">
              <AddBlockButtons pageId={page.id} locale={locale} after={null} />
            </div>
          </section>

          {archived.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Архив блоков этой страницы</h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
                На сайте их нет, из базы они не удаляются. «Вернуть» ставит блок в конец страницы.
              </p>
              <ul className="mt-4 space-y-2">
                {archived.map((block) => (
                  <li
                    key={block.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded border border-dashed border-[var(--color-line)] px-4 py-2 text-sm"
                  >
                    <span>
                      {isBlockType(block.type) ? BLOCKS[block.type].label : block.type}
                      {isBlockType(block.type) && (
                        <span className="text-[var(--color-ink-soft)]">
                          {' · '}
                          {archivedPreview(block.type, block.content)}
                        </span>
                      )}
                    </span>
                    <form action={restoreBlock}>
                      <input type="hidden" name="blockId" value={block.id} />
                      <input type="hidden" name="lang" value={locale} />
                      <button
                        type="submit"
                        className="rounded border border-[var(--color-line)] px-2 py-1 text-xs"
                      >
                        Вернуть
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ArchivedPages pages={archivedPages} locale={locale} />

          <p className="mt-10 text-sm text-[var(--color-ink-soft)]">
            <Link
              href={localizedPath(locale, pagePath(page.slug))}
              className="underline underline-offset-4"
            >
              Открыть эту страницу на сайте
            </Link>
          </p>
        </>
      )}
    </main>
  );
}

async function logout() {
  'use server';
  const { destroyAdminSession } = await import('@/lib/auth/admin');
  await destroyAdminSession();
  redirect('/');
}
