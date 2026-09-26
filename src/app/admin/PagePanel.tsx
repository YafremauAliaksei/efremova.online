import {
  archivePage,
  createPage,
  movePage,
  restorePage,
  savePageSettings,
} from '@/app/admin/actions';
import { i18nTextSchema } from '@/lib/content-schema';
import { PAGE_DESCRIPTION_MAX, PAGE_TITLE_MAX } from '@/lib/blocks/page-edit';
import { HOME_SLUG, pagePath } from '@/lib/blocks/pages';
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, type Locale } from '@/lib/i18n';

/**
 * Настройки страницы, новая страница и архив страниц.
 *
 * Страница — это адрес, название в меню и описание для поисковика на трёх
 * языках, флажки «в шапке», «в подвале», «опубликована» и место в меню.
 * Новая страница создаётся скрытой: сначала блоки, потом публикация.
 */

const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)] disabled:opacity-40';
const INPUT = 'mt-1 w-full rounded border border-[var(--color-line)] px-3 py-2 font-normal';

export interface AdminPage {
  id: string;
  slug: string;
  titleI18n: unknown;
  descriptionI18n: unknown;
  showInHeader: boolean;
  showInFooter: boolean;
  isPublished: boolean;
}

export function PageSettings({
  page,
  locale,
  isFirst,
  isLast,
}: {
  page: AdminPage;
  locale: Locale;
  isFirst: boolean;
  isLast: boolean;
}) {
  const titles = i18nTextSchema.parse(page.titleI18n);
  const descriptions = i18nTextSchema.parse(page.descriptionI18n);
  const isHome = page.slug === HOME_SLUG;

  return (
    <details className="mt-6 rounded-lg border border-[var(--color-line)] bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Настройки страницы · адрес <code>{pagePath(page.slug)}</code>
        {!page.isPublished && (
          <span className="ml-2 rounded-full bg-amber-100 px-2 text-xs text-amber-900">
            скрыта с сайта
          </span>
        )}
      </summary>

      <form action={savePageSettings} className="mt-4 space-y-4">
        <input type="hidden" name="pageId" value={page.id} />
        <input type="hidden" name="lang" value={locale} />

        {LOCALES.map((lang) => (
          <fieldset key={lang} className="rounded border border-[var(--color-line)] p-3">
            <legend className="px-1 text-xs text-[var(--color-ink-soft)]">
              {LOCALE_NAMES[lang]}
            </legend>
            <label className="block">
              Название в меню и заголовок вкладки{lang === 'ru' ? ' (обязательно)' : ''}
              <input
                name={`title_${lang}`}
                lang={LOCALE_TAGS[lang]}
                defaultValue={titles[lang] ?? ''}
                maxLength={PAGE_TITLE_MAX}
                required={lang === 'ru'}
                className={INPUT}
              />
            </label>
            <label className="mt-2 block">
              Описание для поисковика
              <input
                name={`description_${lang}`}
                lang={LOCALE_TAGS[lang]}
                defaultValue={descriptions[lang] ?? ''}
                maxLength={PAGE_DESCRIPTION_MAX}
                className={INPUT}
              />
            </label>
          </fieldset>
        ))}

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showInHeader" defaultChecked={page.showInHeader} />в шапке
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="showInFooter" defaultChecked={page.showInFooter} />в
            подвале
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={page.isPublished}
              disabled={isHome}
            />
            опубликована{isHome ? ' (главная всегда)' : ''}
          </label>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-5 py-2 font-medium text-white"
        >
          Сохранить настройки
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-4">
        <span className="text-[var(--color-ink-soft)]">Место в меню:</span>
        {(['up', 'down'] as const).map((direction) => (
          <form key={direction} action={movePage}>
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="lang" value={locale} />
            <button
              type="submit"
              name="direction"
              value={direction}
              disabled={direction === 'up' ? isFirst : isLast}
              aria-label={direction === 'up' ? 'Раньше в меню' : 'Позже в меню'}
              className={SMALL_BUTTON}
            >
              {direction === 'up' ? '←' : '→'}
            </button>
          </form>
        ))}
        {!isHome && (
          <form action={archivePage} className="ml-auto">
            <input type="hidden" name="pageId" value={page.id} />
            <input type="hidden" name="lang" value={locale} />
            <button type="submit" className={SMALL_BUTTON}>
              Страницу в архив
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

export function NewPageForm({ locale, open }: { locale: Locale; open: boolean }) {
  return (
    <details open={open} className="mt-3 text-sm">
      <summary className="cursor-pointer text-[var(--color-accent)]">+ Новая страница</summary>
      <form action={createPage} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="lang" value={locale} />
        <label className="block">
          Адрес: латиница, цифры, дефис
          <input
            name="slug"
            required
            maxLength={48}
            pattern="[a-z0-9-]+"
            placeholder="kontakty"
            className="mt-1 block rounded border border-[var(--color-line)] px-3 py-2"
          />
        </label>
        <label className="block">
          Название по-русски
          <input
            name="title"
            required
            maxLength={PAGE_TITLE_MAX}
            placeholder="Контакты"
            className="mt-1 block rounded border border-[var(--color-line)] px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-lg border border-[var(--color-line)] px-4 py-2">
          Создать скрытой
        </button>
      </form>
    </details>
  );
}

export function ArchivedPages({
  pages,
  locale,
}: {
  pages: { id: string; slug: string; titleI18n: unknown }[];
  locale: Locale;
}) {
  if (pages.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Архив страниц</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        На сайте их нет, из базы они не удаляются. «Вернуть» возвращает страницу скрытой, в конец
        меню.
      </p>
      <ul className="mt-4 space-y-2">
        {pages.map((page) => (
          <li
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-dashed border-[var(--color-line)] px-4 py-2 text-sm"
          >
            <span>
              {i18nTextSchema.parse(page.titleI18n).ru ?? page.slug} ·{' '}
              <code>{pagePath(page.slug)}</code>
            </span>
            <form action={restorePage}>
              <input type="hidden" name="pageId" value={page.id} />
              <input type="hidden" name="lang" value={locale} />
              <button type="submit" className={SMALL_BUTTON}>
                Вернуть
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
