import { z } from 'zod';
import { textField } from '../content-schema';
import { LOCALES, type Locale } from '../i18n';
import { isLinkTarget } from './pages';
import {
  BLOCKS,
  BLOCK_ALIGNS,
  BLOCK_BACKGROUNDS,
  BLOCK_WIDTHS,
  type BlockStyle,
  type BlockTexts,
  type BlockType,
} from './registry';

/**
 * Правка текстов блока на одном языке из формы админки.
 *
 * Поле формы — данные от браузера, а не от человека: их может подменить
 * расширение, вставка с невидимыми символами или украденная сессия.
 * Неверное значение отклоняется целиком, и админка говорит, какое поле
 * не так. Берутся только поля, объявленные у типа блока: служебные ключи
 * Next.js и подброшенные лишние поля в базу не попадают.
 */

export type BlockEditResult =
  | { ok: true; value: { blockId: string; locale: Locale; texts: BlockTexts } }
  | { ok: false; field: string };

const baseSchema = z.object({ blockId: z.string().uuid(), locale: z.enum(LOCALES) });

export function parseBlockTextForm(formData: FormData, type: BlockType): BlockEditResult {
  const base = baseSchema.safeParse({
    blockId: formData.get('blockId') ?? undefined,
    locale: formData.get('locale') ?? undefined,
  });
  if (!base.success) {
    return { ok: false, field: base.error.issues[0]?.path[0] === 'locale' ? 'locale' : 'blockId' };
  }

  const texts: BlockTexts = {};
  for (const field of BLOCKS[type].fields) {
    const parsed = textField(field.max, field.kind === 'line').safeParse(
      formData.get(field.name) ?? ''
    );
    if (!parsed.success) return { ok: false, field: field.name };
    texts[field.name] = parsed.data;
  }
  return { ok: true, value: { ...base.data, texts } };
}

/**
 * Новое содержимое блока: тексты одного языка заменены, остальные языки
 * не тронуты. Все поля пусты — язык убирается целиком, и на сайте снова
 * показывается русский текст, а админка считает блок непереведённым.
 */
export function withLocaleTexts(
  content: unknown,
  locale: Locale,
  texts: BlockTexts
): Record<string, Record<string, string>> {
  const current = z
    .record(z.string(), z.record(z.string(), z.string()).catch({}))
    .catch({})
    .parse(content);
  const entry = Object.fromEntries(
    Object.entries(texts).filter((pair): pair is [string, string] => pair[1] !== null)
  );

  const others = Object.fromEntries(Object.entries(current).filter(([key]) => key !== locale));
  return Object.keys(entry).length === 0 ? others : { ...others, [locale]: entry };
}

/**
 * Оформление и общие данные блока из формы админки. Здесь строже, чем при
 * чтении из базы: там неизвестное значение молча становится значением по
 * умолчанию, а здесь — отказ, чтобы в базу не попадало то, что сайт выбросит.
 */
export type BlockSettingsResult =
  | { ok: true; value: { blockId: string; style: BlockStyle; data: Record<string, string> } }
  | { ok: false; field: string };

const settingsSchema = z.object({
  blockId: z.string().uuid(),
  width: z.enum(BLOCK_WIDTHS),
  align: z.enum(BLOCK_ALIGNS),
  background: z.enum(BLOCK_BACKGROUNDS),
});

export function parseBlockSettingsForm(formData: FormData, type: BlockType): BlockSettingsResult {
  const parsed = settingsSchema.safeParse({
    blockId: formData.get('blockId') ?? undefined,
    width: formData.get('width') ?? undefined,
    align: formData.get('align') ?? undefined,
    background: formData.get('background') ?? undefined,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { ok: false, field: typeof field === 'string' ? field : 'blockId' };
  }

  const { blockId, ...style } = parsed.data;
  const data: Record<string, string> = {};
  if (type === 'cta') {
    const link = formData.get('link');
    if (link !== null && link !== '') {
      if (!isLinkTarget(link)) return { ok: false, field: 'link' };
      data.link = link;
    }
  }
  return { ok: true, value: { blockId, style, data } };
}
