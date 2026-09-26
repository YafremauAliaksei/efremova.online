import { describe, expect, it } from 'vitest';
import { parseBlockSettingsForm, parseBlockTextForm, withLocaleTexts } from './edit';
import { isFreePageSlug, isLinkTarget, isPageSlug, pagePath } from './pages';
import {
  BLOCK_TYPES,
  blockStyleSchema,
  editableTexts,
  isBlockType,
  isTranslated,
  toRenderable,
} from './registry';

/**
 * Блоки страниц — это данные из базы, которые правит человек через браузер.
 * Тесты держат четыре правила docs/13, п.4.2: схема у каждого типа,
 * неизвестный тип пропускается, текст остаётся текстом, оформление — из набора.
 */

const ID = '3f2b8c1e-6a4d-4e5f-9b7a-1c2d3e4f5a6b';

function row(type: string, content: unknown, data: unknown = {}, style: unknown = {}) {
  return { id: ID, type, content, data, style };
}

function form(fields: Record<string, string | Blob>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe('типы блоков', () => {
  it('реестр знает объявленные типы', () => {
    expect(BLOCK_TYPES).toEqual(expect.arrayContaining(['hero', 'text', 'cta', 'services']));
    expect(isBlockType('hero')).toBe(true);
  });

  it.each(['script', 'constructor', '__proto__', 'toString', '', 42])(
    '%j — не тип блока',
    (value) => {
      expect(isBlockType(value)).toBe(false);
    }
  );

  it('неизвестный тип пропускается, а не роняет страницу', () => {
    expect(toRenderable(row('carousel-v2', { ru: { title: 'x' } }), 'ru')).toBeNull();
  });
});

describe('тексты по языкам', () => {
  const content = {
    ru: { title: 'Обо мне', body: 'Текст' },
    pl: { title: 'O mnie', body: 'Tekst' },
  };

  it('текст на языке страницы', () => {
    const block = toRenderable(row('text', content), 'pl');
    expect(block?.texts).toEqual({ title: 'O mnie', body: 'Tekst' });
    expect(block?.textLocale).toBe('pl');
  });

  it('перевода нет — русский, и это видно по textLocale', () => {
    const block = toRenderable(row('text', content), 'en');
    expect(block?.texts.title).toBe('Обо мне');
    expect(block?.textLocale).toBe('ru');
  });

  it('пустой перевод считается отсутствующим', () => {
    const block = toRenderable(row('text', { ...content, en: { title: '', body: null } }), 'en');
    expect(block?.textLocale).toBe('ru');
    expect(isTranslated('text', { ...content, en: { title: '' } }, 'en')).toBe(false);
    expect(isTranslated('text', content, 'pl')).toBe(true);
  });

  it('текст остаётся текстом: разметка не превращается ни во что', () => {
    const block = toRenderable(row('text', { ru: { body: '<script>alert(1)</script>' } }), 'ru');
    expect(block?.texts.body).toBe('<script>alert(1)</script>');
  });

  it('лишние поля в базе не попадают на страницу', () => {
    const block = toRenderable(
      row('hero', { ru: { title: 'Т', onclick: 'x', html: '<b>' } }),
      'ru'
    );
    expect(Object.keys(block?.texts ?? {})).toEqual(['title', 'body']);
  });

  it('испорченный текст (смена направления письма) — блок пропускается', () => {
    expect(toRenderable(row('text', { ru: { body: 'цена \u202E001' } }), 'ru')).toBeNull();
  });

  it.each([[null], ['строка'], [[1, 2]], [{ ru: 'не объект' }]])(
    'content = %j — блок без текста пропускается',
    (content) => {
      expect(toRenderable(row('text', content), 'ru')).toBeNull();
    }
  );

  it('список услуг рисуется и без заголовка', () => {
    expect(toRenderable(row('services', {}), 'pl')?.type).toBe('services');
  });

  it('форма админки получает текст языка как есть, без подмены русским', () => {
    expect(editableTexts('text', content, 'en')).toEqual({ title: null, body: null });
    expect(editableTexts('text', content, 'pl')).toEqual({ title: 'O mnie', body: 'Tekst' });
  });
});

describe('оформление — только из набора', () => {
  it('допустимые значения проходят', () => {
    expect(
      blockStyleSchema.parse({ width: 'full', align: 'center', background: 'tinted' })
    ).toEqual({
      width: 'full',
      align: 'center',
      background: 'tinted',
    });
  });

  it('произвольные значения заменяются значениями по умолчанию', () => {
    expect(
      blockStyleSchema.parse({
        width: '80%',
        align: 'right;}body{display:none',
        background: 'url(x)',
      })
    ).toEqual({ width: 'wide', align: 'left', background: 'base' });
    expect(blockStyleSchema.parse('мусор')).toEqual({
      width: 'wide',
      align: 'left',
      background: 'base',
    });
  });
});

describe('кнопка ведёт только на страницу своего сайта', () => {
  it.each([['services'], ['about'], ['home'], ['nowa-strona']])('%s — можно', (link) => {
    expect(toRenderable(row('cta', { ru: { button: 'Б' } }, { link }), 'ru')?.data.link).toBe(link);
  });

  it.each([
    ['https://evil.example'],
    ['//evil.example'],
    ['javascript:alert(1)'],
    ['../admin'],
    ['admin'],
  ])('%s — отбрасывается', (link) => {
    expect(
      toRenderable(row('cta', { ru: { button: 'Б' } }, { link }), 'ru')?.data.link
    ).toBeUndefined();
  });
});

describe('адреса страниц', () => {
  it.each([['about'], ['o-mnie'], ['a1'], ['home']])('%s — адрес страницы', (slug) => {
    expect(isFreePageSlug(slug)).toBe(true);
  });

  it.each([
    ['About'],
    ['-a'],
    ['a-'],
    ['a--b'],
    ['a/b'],
    ['a.b'],
    [''],
    ['x'.repeat(49)],
    ['о-мне'],
  ])('%j — не адрес', (slug) => {
    expect(isPageSlug(slug)).toBe(false);
  });

  it.each([['services'], ['privacy'], ['admin'], ['api'], ['pl']])(
    '%s — занят кодом сайта',
    (slug) => {
      expect(isFreePageSlug(slug)).toBe(false);
    }
  );

  it('на страницы с кодом ссылаться можно, на служебные адреса — нет', () => {
    expect(isLinkTarget('services')).toBe(true);
    expect(isLinkTarget('admin')).toBe(false);
  });

  it('главная — корень языка', () => {
    expect(pagePath('home')).toBe('/');
    expect(pagePath('about')).toBe('/about');
  });
});

describe('форма правки блока', () => {
  it('поля типа блока разбираются и проверяются', () => {
    expect(
      parseBlockTextForm(
        form({
          blockId: ID,
          locale: 'pl',
          title: ' O mnie ',
          body: 'Tekst',
          $ACTION_ID_x: '',
          extra: 'x',
        }),
        'text'
      )
    ).toEqual({
      ok: true,
      value: { blockId: ID, locale: 'pl', texts: { title: 'O mnie', body: 'Tekst' } },
    });
  });

  it.each([
    ['нет id', { locale: 'pl', title: 'Т' }, 'blockId'],
    ['id не UUID', { blockId: '1 OR 1=1', locale: 'pl' }, 'blockId'],
    ['чужой язык', { blockId: ID, locale: 'de' }, 'locale'],
    ['заголовок в две строки', { blockId: ID, locale: 'pl', title: 'а\nб' }, 'title'],
    ['смена направления письма', { blockId: ID, locale: 'pl', body: 'а\u202Eб' }, 'body'],
  ])('%s — отказ', (_, fields, field) => {
    expect(parseBlockTextForm(form(fields), 'text')).toEqual({ ok: false, field });
  });

  it('файл вместо текста — отказ', () => {
    const result = parseBlockTextForm(
      form({ blockId: ID, locale: 'pl', body: new Blob(['x']) }),
      'text'
    );
    expect(result).toEqual({ ok: false, field: 'body' });
  });

  it('сохранение меняет только свой язык', () => {
    const content = { ru: { title: 'Р' }, pl: { title: 'P' } };
    expect(withLocaleTexts(content, 'pl', { title: 'Nowy', body: null })).toEqual({
      ru: { title: 'Р' },
      pl: { title: 'Nowy' },
    });
  });

  it('все поля пусты — язык убирается, сайт снова покажет русский', () => {
    const content = { ru: { title: 'Р' }, pl: { title: 'P' } };
    expect(withLocaleTexts(content, 'pl', { title: null, body: null })).toEqual({
      ru: { title: 'Р' },
    });
  });
});

describe('форма оформления блока', () => {
  const base = { blockId: ID, width: 'full', align: 'center', background: 'tinted' };

  it('варианты из набора и ссылка кнопки', () => {
    expect(parseBlockSettingsForm(form({ ...base, link: 'services' }), 'cta')).toEqual({
      ok: true,
      value: {
        blockId: ID,
        style: { width: 'full', align: 'center', background: 'tinted' },
        data: { link: 'services' },
      },
    });
  });

  it('пустая ссылка — кнопки нет; у других типов ссылка не сохраняется', () => {
    expect(parseBlockSettingsForm(form({ ...base, link: '' }), 'cta')).toMatchObject({
      ok: true,
      value: { data: {} },
    });
    expect(parseBlockSettingsForm(form({ ...base, link: 'services' }), 'text')).toMatchObject({
      ok: true,
      value: { data: {} },
    });
  });

  it.each([
    ['ширина не из набора', { ...base, width: '80%' }, 'width'],
    ['фон не из набора', { ...base, background: 'url(x)' }, 'background'],
    ['чужой адрес в кнопке', { ...base, link: 'https://evil.example' }, 'link'],
    ['служебный адрес в кнопке', { ...base, link: 'admin' }, 'link'],
  ])('%s — отказ', (_, fields, field) => {
    expect(parseBlockSettingsForm(form(fields), 'cta')).toEqual({ ok: false, field });
  });
});
