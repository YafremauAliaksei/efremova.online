import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { isAdmin } from '@/lib/auth/admin';
import { BODY_MAX_LENGTH, TITLE_MAX_LENGTH, parseContentBlockEdit } from '@/lib/content-schema';

/**
 * Админка: редактор текстов сайта.
 *
 * ── ЗАЧЕМ ОНА ВООБЩЕ ──────────────────────────────────────────────────────
 * Весь текст сайта хранится в базе, а не в коде — чтобы репозиторий можно
 * было держать публичным (docs/06). Но тогда нужен инструмент, которым эти
 * тексты правят. Иначе «контент отдельно от кода» остаётся теорией.
 *
 * ── МЕСТО ДЛЯ БУДУЩЕГО ДИЗАЙНА ────────────────────────────────────────────
 * Сейчас вид намеренно простой: формы и кнопки, без оформления. Смысл в том,
 * что структура данных (блоки с ключами hero.main, about.main и так далее)
 * от оформления не зависит. Новый визуал и новые блоки на странице
 * добавляются правкой вёрстки и добавлением ключей — эта страница
 * продолжит работать без переделки.
 */

export const metadata: Metadata = {
  title: 'Админка',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Итог сохранения передаётся через адрес страницы (?saved / ?error), а текст
 * сообщения берётся только отсюда: из адреса на страницу не попадает ни
 * одной строки, кроме известного кода.
 *
 * Отказ в браузере почти недостижим: длину и одну строку заголовка ограничивает
 * сама форма, невидимый мусор от вставки удаляется. Остаются служебные символы
 * и смена направления письма — их при обычном наборе не бывает.
 */
const MESSAGES = {
  saved: 'Сохранено.',
  missing: 'Блок не найден — обновите страницу, его могли удалить.',
  id: 'Блок не найден — обновите страницу, его могли удалить.',
  title: `Заголовок не сохранён: одна строка до ${String(TITLE_MAX_LENGTH)} знаков, без служебных символов.`,
  body: `Текст не сохранён: до ${String(BODY_MAX_LENGTH)} знаков, без служебных символов.`,
} as const;

type StatusCode = keyof typeof MESSAGES;

function isStatusCode(value: string | undefined): value is StatusCode {
  return value !== undefined && Object.hasOwn(MESSAGES, value);
}

interface PageProps {
  searchParams: Promise<{ saved?: string; error?: string; block?: string }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  // Middleware проверяет наличие cookie — здесь проверяется сама подпись.
  // Две независимые проверки: middleware дешёвая и быстрая, эта настоящая.
  if (!(await isAdmin())) redirect('/admin/denied');

  const blocks = await db.contentBlock.findMany({ orderBy: { key: 'asc' } });

  const params = await searchParams;
  const status: StatusCode | null =
    params.saved !== undefined ? 'saved' : isStatusCode(params.error) ? params.error : null;
  // Ключ блока показываем, только если такой блок действительно есть
  const statusBlock = blocks.find((block) => block.id === params.block);

  async function saveBlock(formData: FormData) {
    'use server';

    if (!(await isAdmin())) redirect('/admin/denied');

    const parsed = parseContentBlockEdit(formData);
    if (!parsed.ok) {
      const id = formData.get('id');
      const block =
        parsed.field !== 'id' && typeof id === 'string' ? `&block=${encodeURIComponent(id)}` : '';
      redirect(`/admin?error=${parsed.field}${block}`);
    }

    const { id, title, body } = parsed.value;
    // updateMany вместо update: несуществующий блок — это сообщение, а не ошибка 500
    const { count } = await db.contentBlock.updateMany({ where: { id }, data: { title, body } });
    if (count === 0) redirect('/admin?error=missing');

    // Страницы читают тексты из базы и кэшируются — после правки кэш
    // нужно сбросить, иначе изменения «не видно»
    revalidatePath('/');
    revalidatePath('/about');
    revalidatePath('/admin');
    redirect(`/admin?saved=1&block=${id}`);
  }

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Тексты сайта</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-[var(--color-ink-soft)] underline">
            Выйти
          </button>
        </form>
      </header>

      <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
        Эти тексты хранятся только в базе данных и никогда не попадают в публичный репозиторий.
        Сессия действует 30 минут.
      </p>

      <nav aria-label="Разделы админки" className="mt-6 flex flex-wrap gap-3 text-sm">
        <span className="rounded border border-[var(--color-accent)] px-3 py-1 text-[var(--color-accent)]">
          Тексты
        </span>
        <Link
          href="/admin/profile"
          className="rounded border border-[var(--color-line)] px-3 py-1 underline-offset-4 hover:underline"
        >
          Данные владельца
        </Link>
        <span className="rounded border border-dashed border-[var(--color-line)] px-3 py-1 text-[var(--color-ink-soft)]">
          Услуги и цены — далее
        </span>
        <span className="rounded border border-dashed border-[var(--color-line)] px-3 py-1 text-[var(--color-ink-soft)]">
          Правовые документы — далее
        </span>
      </nav>

      {status !== null && (
        <p
          role={status === 'saved' ? 'status' : 'alert'}
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            status === 'saved'
              ? 'border-[var(--color-line)] text-[var(--color-ink-soft)]'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          {statusBlock !== undefined && <span className="font-mono">{statusBlock.key}: </span>}
          {MESSAGES[status]}
        </p>
      )}

      {blocks.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
          Блоков пока нет. Выполните <code>npm run db:seed</code>.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {blocks.map((block) => (
            <form
              key={block.id}
              action={saveBlock}
              className="rounded-lg border border-[var(--color-line)] bg-white p-5"
            >
              <input type="hidden" name="id" value={block.id} />

              <p className="font-mono text-xs text-[var(--color-ink-soft)]">
                {block.key} · {block.locale}
              </p>

              <label className="mt-3 block text-sm font-medium">
                Заголовок
                <input
                  name="title"
                  defaultValue={block.title ?? ''}
                  maxLength={TITLE_MAX_LENGTH}
                  className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
                />
              </label>

              <label className="mt-4 block text-sm font-medium">
                Текст
                <textarea
                  name="body"
                  defaultValue={block.body ?? ''}
                  maxLength={BODY_MAX_LENGTH}
                  rows={5}
                  className="mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal"
                />
              </label>

              <button
                type="submit"
                className="mt-4 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white"
              >
                Сохранить
              </button>
            </form>
          ))}
        </div>
      )}

      <p className="mt-10 text-sm text-[var(--color-ink-soft)]">
        <Link href="/" className="underline underline-offset-4">
          Открыть сайт
        </Link>
      </p>
    </main>
  );
}

async function logout() {
  'use server';
  const { destroyAdminSession } = await import('@/lib/auth/admin');
  await destroyAdminSession();
  redirect('/');
}
