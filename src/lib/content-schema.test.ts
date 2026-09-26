import { describe, expect, it } from 'vitest';
import { BODY_MAX_LENGTH, TITLE_MAX_LENGTH, i18nTextSchema, textField } from './content-schema';

/**
 * Тесты проверки текстов из админки.
 *
 * Главное здесь — отказ вместо тихой порчи: раньше длинный текст обрезался
 * без предупреждения, а невидимые символы уходили в базу.
 */

const title = textField(TITLE_MAX_LENGTH, true);
const body = textField(BODY_MAX_LENGTH, false);

describe('текст: что сохраняется', () => {
  it('обычный текст с абзацами проходит как есть', () => {
    expect(body.parse('Первый абзац.\n\nВторой абзац.')).toBe('Первый абзац.\n\nВторой абзац.');
  });

  it('переводы строк Windows приводятся к \\n, края обрезаются', () => {
    expect(title.parse('  Заголовок  ')).toBe('Заголовок');
    expect(body.parse('а\r\nб\rв\n')).toBe('а\nб\nв');
  });

  it('невидимый мусор от вставки удаляется, а не отклоняет правку', () => {
    expect(title.parse('\uFEFFОб\u200Bо мне')).toBe('Обо мне');
    expect(body.parse('Пер\u2060вый\u200C абзац\uFEFF')).toBe('Первый абзац');
  });

  it('составные эмодзи с соединителем нулевой ширины сохраняются', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    expect(body.parse(`Семья ${family}`)).toBe(`Семья ${family}`);
  });

  it('пустое поле — отсутствие текста, а не пустая строка', () => {
    expect(title.parse('   ')).toBeNull();
    expect(body.parse('')).toBeNull();
  });

  it('текст ровно на пределе длины проходит', () => {
    expect(title.safeParse('т'.repeat(TITLE_MAX_LENGTH)).success).toBe(true);
    expect(body.safeParse('б'.repeat(BODY_MAX_LENGTH)).success).toBe(true);
  });
});

describe('текст: что отклоняется', () => {
  it.each([
    ['заголовок длиннее предела', title, 'т'.repeat(TITLE_MAX_LENGTH + 1)],
    ['заголовок в две строки', title, 'Строка\nещё строка'],
    ['текст длиннее предела', body, 'б'.repeat(BODY_MAX_LENGTH + 1)],
    ['нулевой байт', body, 'до\u0000после'],
    ['смена направления письма', body, 'цена \u202E001'],
    ['изоляция направления письма', title, 'Т\u2066x\u2069'],
    ['метка направления справа налево', body, 'а\u200Fб'],
  ])('%s', (_, field, value) => {
    expect(field.safeParse(value).success).toBe(false);
  });

  it('не строка — отказ, а не «[object File]»', () => {
    expect(body.safeParse(new Blob(['<script>'])).success).toBe(false);
    expect(body.safeParse(42).success).toBe(false);
  });
});

describe('переводы в JSON из базы', () => {
  it('язык → строка', () => {
    expect(i18nTextSchema.parse({ ru: 'Консультация', pl: 'Konsultacja' })).toEqual({
      ru: 'Консультация',
      pl: 'Konsultacja',
    });
  });

  it('испорченные переводы не роняют страницу', () => {
    expect(i18nTextSchema.parse({ ru: 42 })).toEqual({});
    expect(i18nTextSchema.parse(null)).toEqual({});
  });
});
