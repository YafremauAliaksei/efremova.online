import {
  addBlock,
  archiveBlock,
  moveBlock,
  restoreRevision,
  saveBlockSettings,
  saveBlockText,
  toggleBlock,
} from '@/app/admin/actions';
import { CODE_PAGE_SLUGS } from '@/lib/blocks/pages';
import {
  BLOCKS,
  BLOCK_ALIGNS,
  BLOCK_BACKGROUNDS,
  BLOCK_TYPES,
  BLOCK_WIDTHS,
  blockStyleSchema,
  editableTexts,
  isTranslated,
  type BlockType,
} from '@/lib/blocks/registry';
import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from '@/lib/i18n';

/**
 * Карточка блока в конструкторе: тексты на выбранном языке, порядок,
 * видимость, оформление, история и «вставить блок ниже». Каждая кнопка —
 * своя маленькая форма: вложенных форм в HTML не бывает, а так любое
 * действие работает и без JavaScript.
 */

const WIDTH_LABELS: Record<(typeof BLOCK_WIDTHS)[number], string> = {
  narrow: 'узкий',
  wide: 'широкий',
  full: 'во всю ширину',
};
const ALIGN_LABELS: Record<(typeof BLOCK_ALIGNS)[number], string> = {
  left: 'слева',
  center: 'по центру',
};
const BACKGROUND_LABELS: Record<(typeof BLOCK_BACKGROUNDS)[number], string> = {
  base: 'основной',
  tinted: 'оттенённый',
};
const CODE_PAGE_LABELS: Record<(typeof CODE_PAGE_SLUGS)[number], string> = {
  services: 'Услуги и цены',
  privacy: 'Политика конфиденциальности',
  terms: 'Условия консультаций',
  'site-terms': 'Положения о сайте',
  provider: 'Данные владельца',
};

const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)] disabled:opacity-40';

export interface AdminBlock {
  id: string;
  type: BlockType;
  isPublished: boolean;
  content: unknown;
  data: unknown;
  style: unknown;
  revisions: { id: string; createdAt: Date; content: unknown }[];
}

/** Скрытые поля, общие для всех форм блока: какой блок и куда вернуться */
function Hidden({ blockId, locale }: { blockId: string; locale: Locale }) {
  return (
    <>
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="lang" value={locale} />
    </>
  );
}

/** Кнопки «добавить блок»: одна кнопка на тип — один щелчок */
export function AddBlockButtons({
  pageId,
  locale,
  after,
}: {
  pageId: string;
  locale: Locale;
  after: string | null;
}) {
  return (
    <form action={addBlock} className="flex flex-wrap gap-2">
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="lang" value={locale} />
      {after !== null && <input type="hidden" name="after" value={after} />}
      {BLOCK_TYPES.map((type) => (
        <button
          key={type}
          type="submit"
          name="type"
          value={type}
          title={BLOCKS[type].hint}
          className="rounded-lg border border-dashed border-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent)] hover:bg-[var(--color-paper-alt)]"
        >
          + {BLOCKS[type].label}
        </button>
      ))}
    </form>
  );
}

export function BlockCard({
  block,
  number,
  isFirst,
  isLast,
  locale,
  pageId,
  linkTargets,
}: {
  block: AdminBlock;
  number: number;
  isFirst: boolean;
  isLast: boolean;
  locale: Locale;
  pageId: string;
  /** Страницы из базы для кнопки: slug → название */
  linkTargets: { slug: string; title: string }[];
}) {
  const def = BLOCKS[block.type];
  const texts = editableTexts(block.type, block.content, locale);
  const reference =
    locale === DEFAULT_LOCALE ? null : editableTexts(block.type, block.content, DEFAULT_LOCALE);
  const translated = isTranslated(block.type, block.content, locale);
  const hasAnyText = isTranslated(block.type, block.content, DEFAULT_LOCALE) || translated;
  const style = blockStyleSchema.parse(block.style);
  const link =
    typeof (block.data as Record<string, unknown> | null)?.link === 'string'
      ? String((block.data as Record<string, unknown>).link)
      : '';

  return (
    <article
      id={`block-${block.id}`}
      className={`scroll-mt-6 rounded-lg border bg-white p-5 ${
        block.isPublished
          ? 'border-[var(--color-line)]'
          : 'border-dashed border-[var(--color-line)] opacity-80'
      }`}
    >
      {/* ── заголовок карточки и управление ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">
            №{number} · {def.label}
          </span>
          {!block.isPublished && (
            <span className="rounded-full bg-[var(--color-paper-alt)] px-2 text-xs">скрыт</span>
          )}
          {!hasAnyText && block.type !== 'services' && (
            <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-900">
              пустой — на сайте не виден
            </span>
          )}
          {block.type === 'cta' && link === '' && texts.button !== null && (
            <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-900">
              кнопка не показана — выберите в «Оформлении», куда она ведёт
            </span>
          )}
          {hasAnyText && !translated && locale !== DEFAULT_LOCALE && (
            <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-900">
              перевода нет — на сайте русский текст
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          <form action={moveBlock}>
            <Hidden blockId={block.id} locale={locale} />
            <button
              type="submit"
              name="direction"
              value="up"
              disabled={isFirst}
              className={SMALL_BUTTON}
              aria-label="Выше"
            >
              ↑
            </button>
          </form>
          <form action={moveBlock}>
            <Hidden blockId={block.id} locale={locale} />
            <button
              type="submit"
              name="direction"
              value="down"
              disabled={isLast}
              className={SMALL_BUTTON}
              aria-label="Ниже"
            >
              ↓
            </button>
          </form>
          <form action={toggleBlock}>
            <Hidden blockId={block.id} locale={locale} />
            <button type="submit" className={SMALL_BUTTON}>
              {block.isPublished ? 'Скрыть' : 'Показать'}
            </button>
          </form>
          <form action={archiveBlock}>
            <Hidden blockId={block.id} locale={locale} />
            <button type="submit" className={SMALL_BUTTON}>
              В архив
            </button>
          </form>
        </div>
      </div>

      {/* ── тексты на выбранном языке ── */}
      {reference !== null && Object.values(reference).some((value) => value !== null) && (
        <details className="mt-3 text-sm text-[var(--color-ink-soft)]">
          <summary className="cursor-pointer">Русский текст для образца</summary>
          {def.fields.map((field) =>
            reference[field.name] === null ? null : (
              <p key={field.name} className="mt-2 whitespace-pre-line">
                <span className="font-medium">{field.label}:</span> {reference[field.name]}
              </p>
            )
          )}
        </details>
      )}

      <form action={saveBlockText}>
        <Hidden blockId={block.id} locale={locale} />
        <input type="hidden" name="locale" value={locale} />
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
          {translated || locale === DEFAULT_LOCALE ? 'Сохранить текст' : 'Создать перевод'}
        </button>
      </form>

      {/* ── оформление ── */}
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-[var(--color-ink-soft)]">
          Оформление{block.type === 'cta' ? ' и кнопка' : ''}
        </summary>
        <form action={saveBlockSettings} className="mt-3 flex flex-wrap items-end gap-4">
          <Hidden blockId={block.id} locale={locale} />
          <label className="block">
            Ширина
            <select
              name="width"
              defaultValue={style.width}
              className="mt-1 block rounded border border-[var(--color-line)] px-2 py-1"
            >
              {BLOCK_WIDTHS.map((value) => (
                <option key={value} value={value}>
                  {WIDTH_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Выравнивание
            <select
              name="align"
              defaultValue={style.align}
              className="mt-1 block rounded border border-[var(--color-line)] px-2 py-1"
            >
              {BLOCK_ALIGNS.map((value) => (
                <option key={value} value={value}>
                  {ALIGN_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Фон
            <select
              name="background"
              defaultValue={style.background}
              className="mt-1 block rounded border border-[var(--color-line)] px-2 py-1"
            >
              {BLOCK_BACKGROUNDS.map((value) => (
                <option key={value} value={value}>
                  {BACKGROUND_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          {block.type === 'cta' && (
            <label className="block">
              Кнопка ведёт на
              <select
                name="link"
                defaultValue={link}
                className="mt-1 block rounded border border-[var(--color-line)] px-2 py-1"
              >
                <option value="">— кнопки нет —</option>
                {linkTargets.map((target) => (
                  <option key={target.slug} value={target.slug}>
                    {target.title}
                  </option>
                ))}
                {CODE_PAGE_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {CODE_PAGE_LABELS[slug]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            className="rounded-lg border border-[var(--color-line)] px-4 py-1.5"
          >
            Применить
          </button>
        </form>
      </details>

      {/* ── история ── */}
      {block.revisions.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[var(--color-ink-soft)]">
            История правок ({block.revisions.length})
          </summary>
          <ol className="mt-3 space-y-2">
            {block.revisions.map((revision) => {
              const before = editableTexts(block.type, revision.content, locale);
              const preview =
                Object.values(before).find((value) => value !== null) ??
                '— текста на этом языке не было —';
              return (
                <li
                  key={revision.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-t border-[var(--color-line)] pt-2"
                >
                  <span className="min-w-0 flex-1">
                    <time
                      dateTime={revision.createdAt.toISOString()}
                      className="font-mono text-xs text-[var(--color-ink-soft)]"
                    >
                      {revision.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC
                    </time>
                    <span className="mt-1 line-clamp-2 block">{preview}</span>
                  </span>
                  <form action={restoreRevision}>
                    <Hidden blockId={block.id} locale={locale} />
                    <input type="hidden" name="revisionId" value={revision.id} />
                    <button type="submit" className={SMALL_BUTTON}>
                      Вернуть эту версию
                    </button>
                  </form>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {/* ── вставить ниже ── */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-[var(--color-ink-soft)]">
          Вставить блок ниже
        </summary>
        <div className="mt-3">
          <AddBlockButtons pageId={pageId} locale={locale} after={block.id} />
        </div>
      </details>
    </article>
  );
}
