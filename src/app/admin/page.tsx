import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { AdminNav } from '@/components/admin/AdminNav';
import { db } from '@/lib/db';
import { isAdmin } from '@/lib/auth/admin';
import { i18nTextSchema } from '@/lib/content-schema';
import { parseBlockTextForm, withLocaleTexts } from '@/lib/blocks/edit';
import { pagePath } from '@/lib/blocks/pages';
import {
  BLOCKS,
  editableTexts,
  isBlockType,
  isTranslated,
  type BlockType,
} from '@/lib/blocks/registry';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  isLocale,
  localizedPath,
  type Locale,
} from '@/lib/i18n';

/**
 * Админка: тексты страниц сайта на трёх языках.
 *
 * ── ЗАЧЕМ ОНА ВООБЩЕ ──────────────────────────────────────────────────────
 * Весь текст сайта хранится в базе, а не в коде — чтобы репозиторий можно
 * было держать публичным (docs/06). Но тогда нужен инструмент, которым эти
 * тексты правят. Иначе «контент отдельно от кода» остаётся теорией.
 *
 * ── ЧТО ЗДЕСЬ, А ЧТО ДАЛЬШЕ ───────────────────────────────────────────────
 * Страница → её блоки → тексты блока на выбранном языке. Поля формы задаёт
 * тип блока (src/lib/blocks/registry.ts): новый тип появится здесь сам.
 * Добавить, переставить, скрыть и вернуть блок — задача admin-page-builder.
 */

export const metadata: Metadata = {
  title: 'Страницы и тексты',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Итог сохранения передаётся через адрес (?saved / ?error), а текст берётся
 * только отсюда или из подписи поля в реестре: из адреса на страницу не
 * попадает ни одной строки, кроме известного кода.
 */
const MESSAGES = {
  saved: 'Сохранено. Прежний текст — в истории блока.',
  missing: 'Блок не найден — обновите страницу.',
  blockId: 'Блок не найден — обновите страницу.',
  locale: 'Неизвестный язык — обновите страницу.',
} as const;

function statusMessage(code: string | undefined, type: BlockType | undefined): string | null {
  if (code === undefined) return null;
  if (code in MESSAGES) return MESSAGES[code as keyof typeof MESSAGES];
  const field = type === undefined ? undefined : BLOCKS[type].fields.find((f) => f.name === code);
  if (field === undefined) return null;
  const shape = field.kind === 'line' ? 'одна строка' : 'текст';
  return `«${field.label}» не сохранено: ${shape} до ${String(field.max)} знаков, без служебных символов.`;
}

interface PageProps {
  searchParams: Promise<{
    page?: string;
    lang?: string;
    saved?: string;
    error?: string;
    block?: string;
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
    include: {
      blocks: {
        where: { archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  const page = pages.find((p) => p.slug === params.page) ?? pages[0];
  const blocks = page?.blocks ?? [];

  const missing = (lang: Locale) =>
    blocks.filter((b) => isBlockType(b.type) && !isTranslated(b.type, b.content, lang)).length;

  // Сообщение об итоге — только для блока, который действительно есть на странице
  const statusBlock = blocks.find((b) => b.id === params.block);
  const statusType =
    statusBlock !== undefined && isBlockType(statusBlock.type) ? statusBlock.type : undefined;
  const status =
    params.saved !== undefined ? MESSAGES.saved : statusMessage(params.error, statusType);
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
                {i18nTextSchema.parse(p.titleI18n).ru ?? p.slug}
                {!p.isPublished && ' (скрыта)'}
              </Link>
            ))}
          </nav>

          {/* Вкладки языков. Непереведённый блок на сайте показывается по-русски,
              поэтому счётчик рядом с языком — список того, что осталось перевести */}
          <nav
            aria-label="Язык текстов"
            className="mt-6 flex flex-wrap gap-2 border-b border-[var(--color-line)]"
          >
            {LOCALES.map((lang) => {
              const count = missing(lang);
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
              role={params.saved !== undefined ? 'status' : 'alert'}
              className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
                params.saved !== undefined
                  ? 'border-[var(--color-line)] text-[var(--color-ink-soft)]'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {status}
            </p>
          )}

          <div className="mt-8 space-y-8">
            {blocks.map((block, index) => {
              const number = `№${String(index + 1)}`;
              if (!isBlockType(block.type)) {
                return (
                  <p
                    key={block.id}
                    className="rounded-lg border border-dashed border-[var(--color-line)] p-5 text-sm text-[var(--color-ink-soft)]"
                  >
                    {number} · тип «{block.type}» этой версией сайта не поддерживается — на сайте
                    блок пропускается.
                  </p>
                );
              }
              const def = BLOCKS[block.type];
              const texts = editableTexts(block.type, block.content, locale);
              const reference =
                locale === DEFAULT_LOCALE
                  ? null
                  : editableTexts(block.type, block.content, DEFAULT_LOCALE);
              const translated = isTranslated(block.type, block.content, locale);

              return (
                <form
                  key={`${block.id}-${locale}`}
                  action={saveBlockText}
                  className="rounded-lg border border-[var(--color-line)] bg-white p-5"
                >
                  <input type="hidden" name="blockId" value={block.id} />
                  <input type="hidden" name="locale" value={locale} />

                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {number} · {def.label}
                    </span>
                    {!block.isPublished && (
                      <span className="rounded-full bg-[var(--color-paper-alt)] px-2 text-xs">
                        скрыт
                      </span>
                    )}
                    {!translated && locale !== DEFAULT_LOCALE && (
                      <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-900">
                        перевода нет — на сайте показан русский текст
                      </span>
                    )}
                  </p>

                  {reference !== null && Object.values(reference).some((v) => v !== null) && (
                    <details className="mt-3 text-sm text-[var(--color-ink-soft)]">
                      <summary className="cursor-pointer">Русский текст для образца</summary>
                      {def.fields.map((field) =>
                        reference[field.name] === null ? null : (
                          <p key={field.name} className="mt-2 whitespace-pre-line">
                            <span className="font-medium">{field.label}:</span>{' '}
                            {reference[field.name]}
                          </p>
                        )
                      )}
                    </details>
                  )}

                  {def.fields.map((field) => (
                    <label key={field.name} className="mt-4 block text-sm font-medium">
                      {field.label}
                      {field.kind === 'line' ? (
                        <input
                          name={field.name}
                          lang={LOCALE_TAGS[locale]}
                          defaultValue={texts[field.name] ?? ''}
                          maxLength={field.max}
                          className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
                        />
                      ) : (
                        <textarea
                          name={field.name}
                          lang={LOCALE_TAGS[locale]}
                          defaultValue={texts[field.name] ?? ''}
                          maxLength={field.max}
                          rows={6}
                          className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
                        />
                      )}
                    </label>
                  ))}

                  <button
                    type="submit"
                    className="mt-4 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white"
                  >
                    {translated || locale === DEFAULT_LOCALE ? 'Сохранить' : 'Создать перевод'}
                  </button>
                </form>
              );
            })}
          </div>

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

async function saveBlockText(formData: FormData) {
  'use server';
  if (!(await isAdmin())) redirect('/admin/denied');

  const blockId = formData.get('blockId');
  const block =
    typeof blockId === 'string' && /^[0-9a-f-]{36}$/.test(blockId)
      ? await db.pageBlock.findFirst({
          where: { id: blockId, archivedAt: null },
          include: { page: { select: { slug: true } } },
        })
      : null;
  if (block === null || !isBlockType(block.type)) redirect('/admin?error=missing');

  const rawLocale = formData.get('locale');
  const back = `/admin?page=${block.page.slug}&lang=${isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE}&block=${block.id}`;

  const parsed = parseBlockTextForm(formData, block.type);
  if (!parsed.ok) redirect(`${back}&error=${parsed.field}`);

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

  // Страницы читают тексты из базы — после правки сбрасывается кэш всех
  // языковых версий, иначе изменения «не видно»
  revalidatePath('/[locale]', 'layout');
  revalidatePath('/admin');
  redirect(`${back}&saved=1`);
}

async function logout() {
  'use server';
  const { destroyAdminSession } = await import('@/lib/auth/admin');
  await destroyAdminSession();
  redirect('/');
}
