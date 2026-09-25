import { describe, expect, it } from 'vitest';
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  contentBlockDataSchema,
  i18nTextSchema,
  parseContentBlockEdit,
} from './content-schema';

/**
 * Тесты правки текстов из админки.
 *
 * Главное здесь — отказ вместо тихой порчи: раньше длинный текст обрезался
 * без предупреждения, а подсунутый файл или невидимые символы уходили в базу.
 */

const ID = '3f2b8c1e-6a4d-4e5f-9b7a-1c2d3e4f5a6b';

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe('правка блока: что сохраняется', () => {
  it('обычный заголовок и текст проходят как есть', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: 'Обо мне', body: 'Первый абзац.\n\nВторой абзац.' })
    );
    expect(result).toEqual({
      ok: true,
      value: { id: ID, title: 'Обо мне', body: 'Первый абзац.\n\nВторой абзац.' },
    });
  });

  it('переводы строк Windows приводятся к \\n, края обрезаются', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: '  Заголовок  ', body: 'а\r\nб\rв\n' })
    );
    expect(result).toEqual({ ok: true, value: { id: ID, title: 'Заголовок', body: 'а\nб\nв' } });
  });

  it('невидимый мусор от вставки удаляется, а не отклоняет правку', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: '\uFEFFОб\u200Bо мне', body: 'Пер\u2060вый\u200C абзац\uFEFF' })
    );
    expect(result).toEqual({ ok: true, value: { id: ID, title: 'Обо мне', body: 'Первый абзац' } });
  });

  it('составные эмодзи с соединителем нулевой ширины сохраняются', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
    const result = parseContentBlockEdit(form({ id: ID, title: 'Т', body: `Семья ${family}` }));
    expect(result).toEqual({ ok: true, value: { id: ID, title: 'Т', body: `Семья ${family}` } });
  });

  it('пустое поле сохраняется как отсутствие текста, а не пустая строка', () => {
    const result = parseContentBlockEdit(form({ id: ID, title: '   ', body: '' }));
    expect(result).toEqual({ ok: true, value: { id: ID, title: null, body: null } });
  });

  it('служебные поля Next.js в форме не мешают и не попадают в результат', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: 'Т', body: 'Б', $ACTION_ID_abc: '', role: 'admin' })
    );
    expect(result).toEqual({ ok: true, value: { id: ID, title: 'Т', body: 'Б' } });
  });

  it('текст ровно на пределе длины проходит', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: 'т'.repeat(TITLE_MAX_LENGTH), body: 'б'.repeat(BODY_MAX_LENGTH) })
    );
    expect(result.ok).toBe(true);
  });
});

describe('правка блока: что отклоняется', () => {
  it.each([
    ['нет id', { title: 'Т', body: 'Б' }, 'id'],
    ['id не UUID', { id: '1 OR 1=1', title: 'Т', body: 'Б' }, 'id'],
    [
      'заголовок длиннее предела',
      { id: ID, title: 'т'.repeat(TITLE_MAX_LENGTH + 1), body: 'Б' },
      'title',
    ],
    ['заголовок в две строки', { id: ID, title: 'Строка\nещё строка', body: 'Б' }, 'title'],
    [
      'текст длиннее предела',
      { id: ID, title: 'Т', body: 'б'.repeat(BODY_MAX_LENGTH + 1) },
      'body',
    ],
    ['нулевой байт', { id: ID, title: 'Т', body: 'до\u0000после' }, 'body'],
    ['смена направления письма', { id: ID, title: 'Т', body: 'цена \u202E001' }, 'body'],
    ['изоляция направления письма', { id: ID, title: 'Т\u2066x\u2069', body: 'Б' }, 'title'],
    ['метка направления справа налево', { id: ID, title: 'Т', body: 'а\u200Fб' }, 'body'],
  ])('%s', (_, fields, field) => {
    expect(parseContentBlockEdit(form(fields))).toEqual({ ok: false, field });
  });

  it('файл вместо текста отклоняется, а не превращается в «[object File]»', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: 'Т', body: new Blob(['<script>'], { type: 'text/html' }) })
    );
    expect(result).toEqual({ ok: false, field: 'body' });
  });

  it('длинный текст не обрезается молча — отклоняется целиком', () => {
    const result = parseContentBlockEdit(
      form({ id: ID, title: 'Т', body: 'б'.repeat(BODY_MAX_LENGTH + 500) })
    );
    expect(result.ok).toBe(false);
  });
});

describe('чтение JSON из базы', () => {
  it('объект data проходит как есть', () => {
    expect(contentBlockDataSchema.parse({ items: ['a', 'b'] })).toEqual({ items: ['a', 'b'] });
  });

  it.each([[null], [[1, 2]], ['строка'], [42]])('data = %j → пустой объект', (value) => {
    expect(contentBlockDataSchema.parse(value)).toEqual({});
  });

  it('переводы: язык → строка', () => {
    expect(i18nTextSchema.parse({ ru: 'Консультация', pl: 'Konsultacja' })).toEqual({
      ru: 'Консультация',
      pl: 'Konsultacja',
    });
  });

  it('испорченные переводы не роняют страницу услуг', () => {
    expect(i18nTextSchema.parse({ ru: 42 })).toEqual({});
    expect(i18nTextSchema.parse(null)).toEqual({});
  });
});
