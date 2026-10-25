import { isLocale, splitLocale, type Locale } from '@/lib/i18n';

/**
 * Переключатель языка без JavaScript (docs/14 п.4.4).
 *
 * Публичная страница кэшируется Cloudflare и одна на всех, поэтому cookie
 * с выбором языка она ставить не может: Set-Cookie в общем кэше достался бы
 * каждому. Ссылка переключателя ведёт на служебный адрес /api/lang?to=/pl/about:
 * он ставит cookie и перебрасывает на страницу. Ответ — no-store.
 *
 * Cookie ставится только по щелчку человека — это запоминание явно
 * выбранной настройки интерфейса, согласия на него не требуется (docs/13 п.3.4).
 *
 * Файл без 'server-only': чистые функции, их проверяют тесты.
 */

export const LANG_SWITCH_PATH = '/api/lang';

/** Адрес ссылки переключателя; язык — первая часть пути: /pl/about */
export function langSwitchHref(path: string): string {
  return `${LANG_SWITCH_PATH}?to=${encodeURIComponent(path)}`;
}

/**
 * Куда перебросить и какой язык запомнить — или null, если адрес не наш.
 *
 * ⚠️ Открытый переброс. Параметр to приходит из адреса, его может подставить
 * кто угодно: «//evil.example», «/\evil.example», «https://…». Принимается
 * только путь своего сайта, начинающийся с языка, из латинских букв, цифр,
 * дефиса, подчёркивания (id ролика YouTube) и косой черты. Всё остальное —
 * отказ, а не «примерно похоже».
 */
export function langSwitchTarget(to: string | null): { locale: Locale; path: string } | null {
  if (to === null || to.length > 200 || !to.startsWith('/')) return null;
  // По частям, а не одним выражением с вложенным повтором: так проверка
  // линейна по длине при любом входе
  const parts = to.slice(1).split('/');
  if (!parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const { locale } = splitLocale(to);
  if (!isLocale(locale)) return null;
  return { locale, path: to };
}
