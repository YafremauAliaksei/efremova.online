import { z } from 'zod';
import { textField } from '../content-schema';
import { DEFAULT_LOCALE, LOCALES } from '../i18n';
import { HOME_SLUG, isFreePageSlug } from './pages';

/**
 * Формы страниц в админке: новая страница и её настройки.
 *
 * Как и у блоков: поле формы — данные от браузера, неверное значение
 * отклоняется целиком, а админка говорит, какое поле не так. Берутся
 * только известные поля.
 */

export const PAGE_TITLE_MAX = 80;
export const PAGE_DESCRIPTION_MAX = 300;

const title = textField(PAGE_TITLE_MAX, true);
const description = textField(PAGE_DESCRIPTION_MAX, true);

export type PageFormResult<T> = { ok: true; value: T } | { ok: false; field: string };

/**
 * Новая страница: адрес и русское название. Остальное — в настройках
 * после создания. Главную создать нельзя: она есть всегда.
 */
export function parseNewPageForm(
  formData: FormData
): PageFormResult<{ slug: string; title: string }> {
  const slug = formData.get('slug');
  if (typeof slug !== 'string' || !isFreePageSlug(slug.trim()) || slug.trim() === HOME_SLUG) {
    return { ok: false, field: 'slug' };
  }
  const parsed = title.safeParse(formData.get('title') ?? '');
  if (!parsed.success || parsed.data === null) return { ok: false, field: 'title' };
  return { ok: true, value: { slug: slug.trim(), title: parsed.data } };
}

export interface PageSettings {
  pageId: string;
  titleI18n: Record<string, string>;
  descriptionI18n: Record<string, string>;
  showInHeader: boolean;
  showInFooter: boolean;
  isPublished: boolean;
}

/**
 * Настройки страницы: название и описание на каждом языке, меню, видимость.
 * Название на русском обязательно — это подпись в меню и в админке;
 * пустые переводы не хранятся, и сайт показывает русское.
 */
export function parsePageSettingsForm(formData: FormData): PageFormResult<PageSettings> {
  const pageId = z.string().uuid().safeParse(formData.get('pageId'));
  if (!pageId.success) return { ok: false, field: 'pageId' };

  const titleI18n: Record<string, string> = {};
  const descriptionI18n: Record<string, string> = {};
  for (const locale of LOCALES) {
    const t = title.safeParse(formData.get(`title_${locale}`) ?? '');
    if (!t.success) return { ok: false, field: `title_${locale}` };
    if (t.data !== null) titleI18n[locale] = t.data;

    const d = description.safeParse(formData.get(`description_${locale}`) ?? '');
    if (!d.success) return { ok: false, field: `description_${locale}` };
    if (d.data !== null) descriptionI18n[locale] = d.data;
  }
  if (titleI18n[DEFAULT_LOCALE] === undefined)
    return { ok: false, field: `title_${DEFAULT_LOCALE}` };

  // Флажок формы: есть в запросе — включён; нет — выключен
  const flag = (name: string) => formData.get(name) === 'on';
  return {
    ok: true,
    value: {
      pageId: pageId.data,
      titleI18n,
      descriptionI18n,
      showInHeader: flag('showInHeader'),
      showInFooter: flag('showInFooter'),
      isPublished: flag('isPublished'),
    },
  };
}
