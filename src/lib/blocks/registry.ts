import { z } from 'zod';
import { BODY_MAX_LENGTH, TITLE_MAX_LENGTH, textField } from '../content-schema';
import { DEFAULT_LOCALE, type Locale } from '../i18n';
import { isLinkTarget } from './pages';

/**
 * Реестр типов блоков (docs/13, п.4).
 *
 * Граница проекта: В БАЗЕ ДАННЫЕ, В КОДЕ — КАК ИХ РИСОВАТЬ. Здесь объявлено,
 * какие блоки бывают, какие у них текстовые поля и какие данные они принимают.
 * Новый тип блока (видео, отзывы, картинка с текстом) — это новая запись здесь
 * и компонент отрисовки, а не новая таблица.
 *
 * Четыре правила из docs/13, п.4.2, и где они живут:
 *   1. у каждого типа своя схема — `fields` и `data` ниже, toRenderable();
 *   2. неизвестный тип пропускается — toRenderable() возвращает null;
 *   3. текст выводится как текст — поля здесь строки, HTML нет нигде;
 *   4. оформление — набор вариантов — blockStyleSchema.
 *
 * Файл без 'server-only' и без базы: его проверяют тесты и читает админка.
 */

// ───────────────────────────── оформление ─────────────────────────────

export const BLOCK_WIDTHS = ['narrow', 'wide', 'full'] as const;
export const BLOCK_ALIGNS = ['left', 'center'] as const;
export const BLOCK_BACKGROUNDS = ['base', 'tinted'] as const;

export const DEFAULT_STYLE = { width: 'wide', align: 'left', background: 'base' } as const;

/**
 * Оформление — только из набора. Неизвестное значение молча заменяется
 * значением по умолчанию: «80%» из базы не попадёт в стили страницы.
 */
export const blockStyleSchema = z
  .object({
    width: z.enum(BLOCK_WIDTHS).catch(DEFAULT_STYLE.width),
    align: z.enum(BLOCK_ALIGNS).catch(DEFAULT_STYLE.align),
    background: z.enum(BLOCK_BACKGROUNDS).catch(DEFAULT_STYLE.background),
  })
  .catch({ ...DEFAULT_STYLE });

export type BlockStyle = z.infer<typeof blockStyleSchema>;

// ───────────────────────────── поля и типы ─────────────────────────────

export interface TextFieldDef {
  name: string;
  /** Подпись в админке */
  label: string;
  /** line — одна строка, text — абзацы */
  kind: 'line' | 'text';
  max: number;
}

const TITLE: TextFieldDef = {
  name: 'title',
  label: 'Заголовок',
  kind: 'line',
  max: TITLE_MAX_LENGTH,
};
const BODY: TextFieldDef = { name: 'body', label: 'Текст', kind: 'text', max: BODY_MAX_LENGTH };
const BUTTON: TextFieldDef = { name: 'button', label: 'Надпись на кнопке', kind: 'line', max: 60 };

/** У блока без общих данных — пустой объект, лишние ключи отбрасываются */
const noData = z.object({}).strip().catch({});

export const BLOCKS = {
  hero: {
    label: 'Первый экран',
    hint: 'Крупный заголовок и подзаголовок в начале страницы',
    fields: [TITLE, BODY],
    data: noData,
  },
  text: {
    label: 'Текст',
    hint: 'Заголовок и абзацы; пустая строка между абзацами',
    fields: [TITLE, BODY],
    data: noData,
  },
  cta: {
    label: 'Призыв с кнопкой',
    hint: 'Короткий текст и кнопка, ведущая на страницу сайта',
    fields: [TITLE, BODY, BUTTON],
    data: z
      .object({
        /** slug страницы сайта; чужих адресов кнопка не принимает */
        link: z.string().refine(isLinkTarget).optional().catch(undefined),
      })
      .catch({}),
  },
  services: {
    label: 'Список услуг',
    hint: 'Услуги и цены в валюте посетителя; сами услуги — в разделе «Услуги»',
    fields: [TITLE],
    data: noData,
  },
} as const satisfies Record<
  string,
  { label: string; hint: string; fields: readonly TextFieldDef[]; data: z.ZodType<unknown> }
>;

export type BlockType = keyof typeof BLOCKS;
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === 'string' && Object.hasOwn(BLOCKS, value);
}

// ───────────────────────────── тексты по языкам ─────────────────────────────

/** content блока: язык → поле → строка. Всё остальное — пусто. */
const contentSchema = z.record(z.string(), z.record(z.string(), z.unknown()).catch({})).catch({});

export type BlockTexts = Record<string, string | null>;

/**
 * Тексты блока на одном языке, проверенные теми же правилами, что и форма
 * админки. undefined — текст испорчен (служебные символы, лишняя длина):
 * такой блок не рисуется. Пустые поля — null.
 */
function textsFor(type: BlockType, entry: Record<string, unknown>): BlockTexts | undefined {
  const texts: BlockTexts = {};
  for (const field of BLOCKS[type].fields) {
    const raw = entry[field.name];
    if (raw === undefined || raw === null) {
      texts[field.name] = null;
      continue;
    }
    const parsed = textField(field.max, field.kind === 'line').safeParse(raw);
    if (!parsed.success) return undefined;
    texts[field.name] = parsed.data;
  }
  return texts;
}

function hasText(texts: BlockTexts): boolean {
  return Object.values(texts).some((value) => value !== null);
}

/** Есть ли у блока текст на этом языке — для счётчика «не переведено» */
export function isTranslated(type: BlockType, content: unknown, locale: Locale): boolean {
  const entry = contentSchema.parse(content)[locale];
  if (entry === undefined) return false;
  const texts = textsFor(type, entry);
  return texts !== undefined && hasText(texts);
}

/** Тексты для формы админки: как есть на этом языке, без подмены русским */
export function editableTexts(type: BlockType, content: unknown, locale: Locale): BlockTexts {
  const entry = contentSchema.parse(content)[locale] ?? {};
  const texts: BlockTexts = {};
  for (const field of BLOCKS[type].fields) {
    const raw = entry[field.name];
    texts[field.name] = typeof raw === 'string' ? raw : null;
  }
  return texts;
}

// ───────────────────────────── к отрисовке ─────────────────────────────

export interface RenderableBlock {
  id: string;
  type: BlockType;
  texts: BlockTexts;
  /** Язык, на котором текст на самом деле написан (нет перевода — русский) */
  textLocale: Locale;
  data: Record<string, unknown>;
  style: BlockStyle;
}

export interface StoredBlock {
  id: string;
  type: string;
  content: unknown;
  data: unknown;
  style: unknown;
}

/**
 * Строка базы → блок для отрисовки, или null, если рисовать нечего.
 *
 * Перевода нет — русский текст (пустое место хуже текста на другом языке),
 * и textLocale это честно сообщает. Неизвестный тип, испорченный текст —
 * null: пропадает один блок, а не вся страница.
 */
export function toRenderable(row: StoredBlock, locale: Locale): RenderableBlock | null {
  if (!isBlockType(row.type)) return null;
  const type = row.type;
  const content = contentSchema.parse(row.content);

  for (const candidate of [locale, DEFAULT_LOCALE]) {
    const entry = content[candidate];
    if (entry === undefined) continue;
    const texts = textsFor(type, entry);
    if (texts === undefined) return null;
    if (!hasText(texts)) continue;
    return {
      id: row.id,
      type,
      texts,
      textLocale: candidate,
      data: BLOCKS[type].data.parse(row.data),
      style: blockStyleSchema.parse(row.style),
    };
  }

  // Блок без текста совсем: услуги рисуются и без заголовка, остальным нечего показать
  if (type !== 'services') return null;
  return {
    id: row.id,
    type,
    texts: { title: null },
    textLocale: DEFAULT_LOCALE,
    data: {},
    style: blockStyleSchema.parse(row.style),
  };
}
