/**
 * Выбор валюты цен — обычные ссылки, без JavaScript (PROJECT_LOG, задача 9a).
 *
 * Валюта — в адресе: /pl/services?currency=EUR. Cloudflare кэширует каждый
 * такой адрес отдельно, поэтому страница по-прежнему одна на всех, кто
 * выбрал евро. Основная валюта — адрес без параметра. Поисковику по этим ссылкам
 * ходить незачем: canonical у страницы один — без валюты.
 */
export function CurrencySwitcher({
  path,
  currencies,
  current,
  defaultCurrency,
  label,
}: {
  /** Адрес страницы с языком: /pl/services */
  path: string;
  currencies: readonly string[];
  current: string;
  defaultCurrency: string;
  label: string;
}) {
  if (currencies.length < 2) return null;
  return (
    <nav aria-label={label} className="mt-6">
      <ul className="flex flex-wrap gap-2 text-sm">
        {currencies.map((currency) => (
          <li key={currency}>
            <a
              href={`${currency === defaultCurrency ? path : `${path}?currency=${currency}`}#prices`}
              rel="nofollow"
              aria-current={currency === current ? 'true' : undefined}
              className={
                currency === current
                  ? 'rounded border border-[var(--color-accent)] px-2 py-1 font-medium text-[var(--color-accent)]'
                  : 'rounded border border-[var(--color-line)] px-2 py-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-alt)]'
              }
            >
              {currency}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
