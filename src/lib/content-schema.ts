import { z } from 'zod';

/**
 * Схемы контента: что можно сохранить из админки и как читать JSON из базы.
 *
 * ── ПОЧЕМУ ПРОВЕРКА НУЖНА, ЕСЛИ ПИШЕТ ТОЛЬКО ВЛАДЕЛЕЦ ────────────────────
 * Поле формы — это данные от браузера, а не от человека. Их может подменить
 * расширение браузера, вставка из документа с невидимыми символами или
 * украденная сессия. Раньше текст молча обрезался по длине: владелец терял
 * конец абзаца и не знал об этом. Теперь неверное значение отклоняется
 * целиком, а админка говорит, что именно не так.
 *
 * Файл без 'server-only': схемы — чистые функции, их проверяют тесты.
 */

export const TITLE_MAX_LENGTH = 300;
export const BODY_MAX_LENGTH = 20_000;

/**
 * Символы, которые отклоняются: управляющие (кроме перевода строки и табуляции)
 * и смена направления письма. Обычным набором их не получить, а смена
 * направления умеет показывать один текст, а хранить другой (Trojan Source).
 */
const FORBIDDEN_CHARS =
  // eslint-disable-next-line no-control-regex -- управляющие символы здесь и ищутся
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/;

/**
 * Невидимый мусор от вставки из Word и мессенджеров: пробел нулевой ширины,
 * word joiner, BOM. Смысла не несёт — удаляется молча, чтобы правка владельца
 * не отклонялась из-за того, чего он не видит. Соединитель нулевой ширины
 * (U+200D) остаётся: без него разваливаются составные эмодзи.
 */
const INVISIBLE_JUNK = /[\u200B\u200C\u2060-\u2064\uFEFF]/g;

export type ContentField = 'id' | 'title' | 'body';

function textField(maxLength: number, singleLine: boolean) {
  return z
    .string()
    .transform((value) => value.replace(INVISIBLE_JUNK, '').replace(/\r\n?/g, '\n').trim())
    .pipe(
      z
        .string()
        .max(maxLength)
        .refine((value) => !FORBIDDEN_CHARS.test(value))
        .refine((value) => !singleLine || !value.includes('\n'))
    )
    .transform((value) => (value === '' ? null : value));
}

export const contentBlockEditSchema = z.object({
  id: z.string().uuid(),
  title: textField(TITLE_MAX_LENGTH, true),
  body: textField(BODY_MAX_LENGTH, false),
});

export type ContentBlockEdit = z.infer<typeof contentBlockEditSchema>;

export type ParseResult =
  { ok: true; value: ContentBlockEdit } | { ok: false; field: ContentField };

/**
 * Разбирает форму правки блока. Берутся только известные поля: Next.js
 * добавляет в форму служебные ключи, и они не должны ни ломать проверку,
 * ни попадать в базу. Файл вместо строки отклоняется схемой.
 */
export function parseContentBlockEdit(formData: FormData): ParseResult {
  const result = contentBlockEditSchema.safeParse({
    id: formData.get('id') ?? undefined,
    title: formData.get('title') ?? '',
    body: formData.get('body') ?? '',
  });
  if (result.success) return { ok: true, value: result.data };

  const field = result.error.issues[0]?.path[0];
  return { ok: false, field: field === 'title' || field === 'body' ? field : 'id' };
}

/** JSON-поле `data` блока: объект с любыми значениями, иначе — пустой объект. */
export const contentBlockDataSchema = z.record(z.string(), z.unknown()).catch({});

/** Переводы в JSON-полях (`titleI18n`): язык → строка, иначе — пусто. */
export const i18nTextSchema = z.record(z.string(), z.string()).catch({});
