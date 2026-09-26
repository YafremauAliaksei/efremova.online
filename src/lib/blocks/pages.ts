/**
 * Адреса страниц из базы.
 *
 * Страница из базы живёт по адресу /<язык>/<slug>, главная — slug «home»
 * по адресу /<язык>. Slug задаёт владелец в админке, поэтому формат строгий:
 * он становится частью адреса и ссылок в меню.
 *
 * Файл без 'server-only': его проверяют тесты и использует админка.
 */

export const HOME_SLUG = 'home';

/**
 * Адреса, у которых есть свой код: страница из базы с таким slug была бы
 * не видна (код побеждает) или перекрыла бы служебный адрес. Ссылаться
 * на них из блоков можно, создавать страницы с такими slug — нет.
 */
export const CODE_PAGE_SLUGS = ['services', 'privacy', 'terms', 'site-terms', 'provider'] as const;

const RESERVED = new Set<string>([...CODE_PAGE_SLUGS, 'admin', 'api', '_next', 'ru', 'pl', 'en']);

/** latin, цифры и дефис; без дефиса по краям и двойного дефиса; до 48 знаков */
export function isPageSlug(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-z0-9-]{1,48}$/.test(value) &&
    !value.startsWith('-') &&
    !value.endsWith('-') &&
    !value.includes('--')
  );
}

/** Можно ли завести страницу из базы с таким адресом */
export function isFreePageSlug(value: unknown): value is string {
  return isPageSlug(value) && !RESERVED.has(value);
}

/** Куда может вести кнопка блока: страница из базы или страница с кодом */
export function isLinkTarget(value: unknown): value is string {
  return isFreePageSlug(value) || (CODE_PAGE_SLUGS as readonly string[]).includes(String(value));
}

/** Адрес страницы без языка: home → "/", about → "/about" */
export function pagePath(slug: string): string {
  return slug === HOME_SLUG ? '/' : `/${slug}`;
}
