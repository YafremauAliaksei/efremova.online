'use client';

import { usePathname } from 'next/navigation';
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_NAMES,
  LOCALE_TAGS,
  localizedPath,
  splitLocale,
  type Locale,
} from '@/lib/i18n';

/**
 * Переключатель языка: ведёт на ту же страницу на другом языке.
 *
 * Cookie с выбором ставится ТОЛЬКО здесь, по щелчку человека (docs/13, п.3.4):
 * это запоминание явно запрошенной настройки интерфейса, согласия на него
 * не требуется. Просто открытая страница ничего не записывает.
 *
 * Обычная ссылка <a>, а не next/link: при смене языка меняется <html lang>,
 * и полная загрузка страницы надёжнее подмены на лету. Без JavaScript ссылка
 * тоже работает — просто без запоминания выбора.
 */
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  const { rest } = splitLocale(usePathname());

  function remember(locale: Locale) {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${String(LOCALE_COOKIE_MAX_AGE)}; SameSite=Lax${secure}`;
  }

  return (
    <nav aria-label={label}>
      <ul className="flex gap-2 text-sm">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <a
              href={localizedPath(locale, rest)}
              hrefLang={LOCALE_TAGS[locale]}
              lang={LOCALE_TAGS[locale]}
              aria-current={locale === current ? 'true' : undefined}
              onClick={() => {
                remember(locale);
              }}
              className={
                locale === current
                  ? 'rounded border border-[var(--color-accent)] px-2 py-1 font-medium text-[var(--color-accent)]'
                  : 'rounded border border-transparent px-2 py-1 text-[var(--color-ink-soft)] underline-offset-4 hover:underline'
              }
            >
              {LOCALE_NAMES[locale]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
