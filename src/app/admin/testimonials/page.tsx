import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createTestimonial,
  moveTestimonial,
  saveTestimonial,
  toggleTestimonial,
  withdrawTestimonial,
} from '@/app/admin/testimonials/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n';
import { ALIAS_MAX, TESTIMONIAL_MAX } from '@/lib/testimonials/edit';

/**
 * Отзывы (задача 8): обезличенные, с датой письменного согласия автора.
 *
 * Согласие берётся вне сайта — письмом или на бумаге — и хранится у
 * владельца; здесь только его дата. Без даты отзыв не показать: это
 * проверяют и действие, и ограничение в базе (docs/13 п.8).
 */

export const metadata: Metadata = {
  title: 'Отзывы',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const SAVED = {
  created: 'Отзыв добавлен скрытым. Проверьте дату согласия и нажмите «Показать на сайте».',
  saved: 'Отзыв сохранён.',
  hiddenNoConsent: 'Отзыв сохранён и скрыт: без даты согласия его нельзя показывать.',
  shown: 'Отзыв показан на сайте.',
  hidden: 'Отзыв скрыт с сайта.',
  moved: 'Порядок изменён.',
  withdrawn: 'Отзыв удалён из базы. С сайта он пропал сразу.',
} as const;

const ERRORS = {
  missing: 'Отзыв не найден — обновите страницу.',
  alias: `Подпись — одна строка до ${String(ALIAS_MAX)} знаков.`,
  body: `Текст отзыва — до ${String(TESTIMONIAL_MAX)} знаков, без служебных символов.`,
  locale: 'Выберите язык отзыва.',
  consent: 'Дата согласия — не позже сегодняшней и не раньше 2020 года.',
  noConsent: 'Без даты согласия отзыв нельзя показать. Укажите дату и сохраните.',
  confirm: 'Отметьте галочку «Автор отозвал согласие» — без неё отзыв не удаляется.',
} as const;

function known<T extends Record<string, string>>(table: T, code: string | undefined) {
  return code !== undefined && Object.hasOwn(table, code) ? table[code as keyof T] : null;
}

const INPUT = 'mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal';
const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)] disabled:opacity-40';
const BUTTON =
  'rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60';

interface PageProps {
  searchParams: Promise<{ open?: string; new?: string; saved?: string; error?: string }>;
}

function TestimonialFields({
  alias,
  body,
  locale,
  consentAt,
}: {
  alias: string;
  body: string;
  locale: string;
  consentAt: Date | null;
}) {
  return (
    <>
      <label className="block font-medium">
        Подпись — без имени и деталей, по которым можно узнать человека
        <input
          name="alias"
          defaultValue={alias}
          maxLength={ALIAS_MAX}
          required
          placeholder="Клиентка, 34 года"
          className={INPUT}
        />
      </label>
      <label className="block font-medium">
        Текст отзыва
        <textarea
          name="body"
          defaultValue={body}
          maxLength={TESTIMONIAL_MAX}
          required
          rows={5}
          className={INPUT}
        />
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="block font-medium">
          Язык отзыва
          <select name="locale" defaultValue={locale} className={INPUT}>
            {LOCALES.map((item) => (
              <option key={item} value={item}>
                {LOCALE_NAMES[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block font-medium">
          Дата письменного согласия
          <input
            type="date"
            name="consentAt"
            defaultValue={consentAt?.toISOString().slice(0, 10) ?? ''}
            className={INPUT}
          />
        </label>
      </div>
    </>
  );
}

export default async function TestimonialsAdminPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');
  const params = await searchParams;

  const rows = await db.testimonial.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const savedText = known(SAVED, params.saved);
  const errorText = known(ERRORS, params.error);

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Страницы и тексты
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Отзывы</h1>
      <AdminNav current="/admin/testimonials" />
      <div className="mt-6 space-y-2 text-sm text-[var(--color-ink-soft)]">
        <p>
          Отзыв на сайте психолога сообщает, что человек был клиентом, — это данные о здоровье.
          Поэтому: согласие автора — письменное, вне сайта (письмо или бумага), хранится у вас;
          здесь — только его дата. Подпись — без имени, города и профессии: «клиентка, 34 года», а
          не «Анна, преподаватель из Гданьска».
        </p>
        <p>
          Автор отозвал согласие — «Удалить» в карточке отзыва: он исчезает с сайта и из базы сразу,
          без архива. Отзывы видны на странице «Отзывы» и в блоке «Отзывы».
        </p>
      </div>

      {savedText !== null && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-[var(--color-line)] px-4 py-3 text-sm"
        >
          {savedText}
        </p>
      )}
      {params.error !== undefined && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          {errorText ?? 'Не сохранено — проверьте поля и попробуйте ещё раз.'}
        </p>
      )}

      <ol className="mt-8 space-y-4">
        {rows.map((row, index) => (
          <li key={row.id}>
            <details
              open={params.open === row.id}
              className="rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm"
            >
              <summary className="cursor-pointer">
                <span className="font-medium">{row.authorAlias}</span>{' '}
                <span className="text-[var(--color-ink-soft)]">
                  · {row.locale} ·{' '}
                  {row.consentAt === null
                    ? 'нет даты согласия'
                    : `согласие ${row.consentAt.toISOString().slice(0, 10)}`}
                </span>
                {!row.isPublished && (
                  <span className="ml-2 rounded-full bg-[var(--color-paper-alt)] px-2 text-xs">
                    скрыт
                  </span>
                )}
              </summary>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {(['up', 'down'] as const).map((direction) => (
                  <form key={direction} action={moveTestimonial}>
                    <input type="hidden" name="testimonialId" value={row.id} />
                    <input type="hidden" name="direction" value={direction} />
                    <button
                      type="submit"
                      className={SMALL_BUTTON}
                      disabled={direction === 'up' ? index === 0 : index === rows.length - 1}
                      aria-label={direction === 'up' ? 'Выше в списке' : 'Ниже в списке'}
                    >
                      {direction === 'up' ? '↑' : '↓'}
                    </button>
                  </form>
                ))}
                <form action={toggleTestimonial}>
                  <input type="hidden" name="testimonialId" value={row.id} />
                  <button
                    type="submit"
                    className={SMALL_BUTTON}
                    disabled={!row.isPublished && row.consentAt === null}
                  >
                    {row.isPublished ? 'Скрыть с сайта' : 'Показать на сайте'}
                  </button>
                </form>
              </div>

              <form action={saveTestimonial} className="mt-4 space-y-3">
                <input type="hidden" name="testimonialId" value={row.id} />
                <TestimonialFields
                  alias={row.authorAlias}
                  body={row.body}
                  locale={row.locale}
                  consentAt={row.consentAt}
                />
                <button type="submit" className={BUTTON}>
                  Сохранить
                </button>
              </form>

              <form
                action={withdrawTestimonial}
                className="mt-6 space-y-2 border-t border-[var(--color-line)] pt-4"
              >
                <input type="hidden" name="testimonialId" value={row.id} />
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="confirm" />
                  Автор отозвал согласие — удалить отзыв насовсем
                </label>
                <button
                  type="submit"
                  className="rounded border border-red-300 px-3 py-1 text-red-900 hover:bg-red-50"
                >
                  Удалить
                </button>
              </form>
            </details>
          </li>
        ))}
      </ol>

      <details
        open={params.new === '1' || rows.length === 0}
        className="mt-8 rounded-lg border border-dashed border-[var(--color-line)] p-4 text-sm"
      >
        <summary className="cursor-pointer font-medium">+ Новый отзыв</summary>
        <form action={createTestimonial} className="mt-4 space-y-3">
          <TestimonialFields alias="" body="" locale="ru" consentAt={null} />
          <button type="submit" className={BUTTON}>
            Добавить скрытым
          </button>
        </form>
      </details>
    </main>
  );
}
