import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, localizedPath, type Locale } from '@/lib/i18n';
import { langSwitchHref } from '@/lib/public/lang-switch';

/**
 * Переключатель языка: ведёт на ту же страницу на другом языке.
 *
 * Обычные ссылки, без JavaScript (docs/14 п.4.4): выбор запоминает
 * служебный адрес /api/lang — он ставит cookie и перебрасывает на страницу.
 * Просто открытая страница ничего не записывает (docs/13, п.3.4).
 *
 * nofollow: поисковику незачем ходить по служебному адресу — языковые
 * версии он находит по hreflang в <head>.
 */
export function LanguageSwitcher({
  current,
  path,
  label,
}: {
  current: Locale;
  /** Адрес страницы без языка: /about */
  path: string;
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-2 text-sm">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <a
              href={langSwitchHref(localizedPath(locale, path))}
              hrefLang={LOCALE_TAGS[locale]}
              lang={LOCALE_TAGS[locale]}
              rel="nofollow"
              aria-current={locale === current ? 'true' : undefined}
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
