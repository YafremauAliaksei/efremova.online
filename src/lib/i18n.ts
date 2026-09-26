/**
 * Языки сайта: одна проверка на весь проект (docs/13, п.3.5).
 *
 * Язык приходит снаружи — из адреса, из cookie, из заголовка браузера.
 * Ни одно из этих значений не используется напрямую: всё, что не входит
 * в список, заменяется языком по умолчанию. Подделанная cookie `lang=<script>`
 * не становится ни текстом страницы, ни путём, ни ключом перевода.
 *
 * Файл без 'server-only' и без обращений к базе: его импортирует middleware
 * (Edge Runtime) и клиентский переключатель языка, а проверяют тесты.
 */

export const LOCALES = ['ru', 'pl', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Русский — язык сайта по умолчанию (docs/13, п.3.1) */
export const DEFAULT_LOCALE: Locale = 'ru';

/** Cookie ставит только переключатель — по щелчку человека (docs/13, п.3.4) */
export const LOCALE_COOKIE = 'lang';

/** Год: выбор языка — настройка интерфейса, а не сеанс */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Название языка на нём самом: человек ищет «Polski», а не «польский» */
export const LOCALE_NAMES: Record<Locale, string> = {
  ru: 'Русский',
  pl: 'Polski',
  en: 'English',
};

/** Тег для атрибутов lang и hreflang */
export const LOCALE_TAGS: Record<Locale, string> = {
  ru: 'ru-RU',
  pl: 'pl-PL',
  en: 'en',
};

/** Формат Open Graph: язык_СТРАНА */
export const OG_LOCALES: Record<Locale, string> = {
  ru: 'ru_RU',
  pl: 'pl_PL',
  en: 'en_GB',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Вес q из параметров языка; нет или испорчен — 1, как велит RFC 9110 */
function qualityOf(params: string[]): number {
  const raw = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
  if (raw === undefined) return 1;
  const q = Number(raw.slice(2));
  return Number.isFinite(q) && q >= 0 && q <= 1 ? q : 1;
}

/**
 * Первый поддерживаемый язык из Accept-Language с учётом веса q.
 * "de-DE,pl;q=0.9,ru;q=0.8" → pl. Разбор без библиотеки: формат простой,
 * а лишняя зависимость в middleware — лишний код на каждом запросе.
 */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (header === null) return null;

  const ranked = header
    .split(',')
    .slice(0, 20) // заголовок задаёт клиент: длину разбора ограничиваем мы
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      return { code: tag.trim().slice(0, 2).toLowerCase(), q: qualityOf(params), index };
    })
    .filter((entry) => entry.q > 0 && isLocale(entry.code))
    .sort((a, b) => b.q - a.q || a.index - b.index);

  const best = ranked[0]?.code;
  return isLocale(best) ? best : null;
}

/** Выбор человека (cookie) важнее языка браузера, браузер — важнее умолчания */
export function negotiateLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** "/pl/about" → { locale: 'pl', rest: '/about' }; "/about" → { locale: null, rest: '/about' } */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const end = pathname.indexOf('/', 1);
  const first = end === -1 ? pathname.slice(1) : pathname.slice(1, end);
  if (!pathname.startsWith('/') || !isLocale(first)) return { locale: null, rest: pathname };
  return { locale: first, rest: end === -1 ? '/' : pathname.slice(end) };
}

/** Адрес страницы на языке: ("pl", "/about") → "/pl/about", ("pl", "/") → "/pl" */
export function localizedPath(locale: Locale, path = '/'): string {
  return path === '/' || path === '' ? `/${locale}` : `/${locale}${path}`;
}

/** lang для текста, язык которого отличается от языка страницы (перевода нет) */
export function langIfDifferent(textLocale: Locale, pageLocale: Locale): string | undefined {
  return textLocale === pageLocale ? undefined : LOCALE_TAGS[textLocale];
}

/**
 * canonical и hreflang для страницы: поисковик должен знать, что /ru/about,
 * /pl/about и /en/about — одна страница на разных языках, а не три дубля.
 * x-default — адрес без языка: он сам перебросит человека на подходящий.
 */
export function languageAlternates(locale: Locale, path = '/') {
  const languages: Record<string, string> = {};
  for (const other of LOCALES) languages[LOCALE_TAGS[other]] = localizedPath(other, path);
  languages['x-default'] = path;
  return { canonical: localizedPath(locale, path), languages };
}

/**
 * Адреса, у которых языка нет и быть не может: админка, API, служебные
 * файлы Next.js, security.txt и всё, что похоже на файл (robots.txt, icon.svg).
 */
export function isLocaleNeutral(pathname: string): boolean {
  if (/^\/(admin|api|_next|\.well-known)(\/|$)/.test(pathname)) return true;
  const last = pathname.split('/').pop() ?? '';
  return last.includes('.');
}

/**
 * Куда перебросить адрес без языка — или null, если перебрасывать не нужно.
 *
 * Параметр ?lang= — наследие ссылок вида /privacy?lang=pl: такие ссылки уже
 * разосланы и должны открыться на том языке, который в них указан.
 */
export function localeRedirectTarget(
  pathname: string,
  search: URLSearchParams,
  cookie: string | undefined,
  acceptLanguage: string | null
): string | null {
  if (isLocaleNeutral(pathname) || splitLocale(pathname).locale !== null) return null;

  const legacy = search.get('lang');
  const locale = isLocale(legacy) ? legacy : negotiateLocale(cookie, acceptLanguage);

  const rest = new URLSearchParams(search);
  rest.delete('lang');
  const query = rest.toString();
  return `${localizedPath(locale, pathname)}${query === '' ? '' : `?${query}`}`;
}
