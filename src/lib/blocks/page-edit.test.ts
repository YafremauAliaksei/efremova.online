import { describe, expect, it } from 'vitest';
import { PAGE_TITLE_MAX, parseNewPageForm, parsePageSettingsForm } from './page-edit';

const ID = '3f2b8c1e-6a4d-4e5f-9b7a-1c2d3e4f5a6b';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe('новая страница', () => {
  it('адрес и название', () => {
    expect(parseNewPageForm(form({ slug: ' kontakty ', title: 'Контакты' }))).toEqual({
      ok: true,
      value: { slug: 'kontakty', title: 'Контакты' },
    });
  });

  it.each([
    ['главная', { slug: 'home', title: 'Т' }, 'slug'],
    ['адрес занят кодом сайта', { slug: 'services', title: 'Т' }, 'slug'],
    ['служебный адрес', { slug: 'admin', title: 'Т' }, 'slug'],
    ['кириллица в адресе', { slug: 'контакты', title: 'Т' }, 'slug'],
    ['путь в адресе', { slug: 'a/b', title: 'Т' }, 'slug'],
    ['без названия', { slug: 'kontakty', title: '  ' }, 'title'],
    ['название в две строки', { slug: 'kontakty', title: 'а\nб' }, 'title'],
    [
      'название длиннее предела',
      { slug: 'kontakty', title: 'т'.repeat(PAGE_TITLE_MAX + 1) },
      'title',
    ],
  ])('%s — отказ', (_, fields, field) => {
    expect(parseNewPageForm(form(fields))).toEqual({ ok: false, field });
  });
});

describe('настройки страницы', () => {
  const base = { pageId: ID, title_ru: 'Контакты' };

  it('названия и описания по языкам, пустые переводы не хранятся, флажки', () => {
    expect(
      parsePageSettingsForm(
        form({
          ...base,
          title_pl: 'Kontakt',
          title_en: '',
          description_ru: 'Как связаться',
          showInHeader: 'on',
          isPublished: 'on',
        })
      )
    ).toEqual({
      ok: true,
      value: {
        pageId: ID,
        titleI18n: { ru: 'Контакты', pl: 'Kontakt' },
        descriptionI18n: { ru: 'Как связаться' },
        showInHeader: true,
        showInFooter: false,
        isPublished: true,
      },
    });
  });

  it.each([
    ['нет id', { title_ru: 'Т' }, 'pageId'],
    ['без русского названия', { pageId: ID, title_pl: 'P' }, 'title_ru'],
    ['служебный символ в описании', { ...base, description_pl: 'a\u202Eb' }, 'description_pl'],
    ['описание в две строки', { ...base, description_en: 'a\nb' }, 'description_en'],
  ])('%s — отказ', (_, fields, field) => {
    expect(parsePageSettingsForm(form(fields))).toEqual({ ok: false, field });
  });

  it('флажок с любым значением, кроме «on», — выключен', () => {
    const result = parsePageSettingsForm(form({ ...base, showInHeader: 'true' }));
    expect(result.ok && result.value.showInHeader).toBe(false);
  });
});
