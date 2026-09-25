import Link from 'next/link';

/**
 * Общий подвал сайта.
 *
 * Вынесен в отдельный компонент, потому что ссылки на правовые документы
 * обязаны быть на каждой странице: это требование GDPR (ст. 12 — информация
 * должна быть «легко доступна»), а не вопрос вкуса.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--color-ink-soft)]">
        <nav aria-label="Разделы сайта">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/" className="underline underline-offset-4">
                Главная
              </Link>
            </li>
            <li>
              <Link href="/about" className="underline underline-offset-4">
                Обо мне
              </Link>
            </li>
            <li>
              <Link href="/services" className="underline underline-offset-4">
                Услуги
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="underline underline-offset-4">
                Политика конфиденциальности
              </Link>
            </li>
            <li>
              <Link href="/terms" className="underline underline-offset-4">
                Условия услуг
              </Link>
            </li>
          </ul>
        </nav>

        {/* Прямые ссылки на языковые версии: по польскому праву документы
            должны быть доступны на польском, и попасть на них нужно
            в один клик, а не через автоопределение языка */}
        <p className="mt-4 text-xs">
          Dokumenty prawne:{' '}
          <Link href="/privacy?lang=pl" hrefLang="pl-PL" className="underline underline-offset-4">
            Polityka prywatności (PL)
          </Link>
          {' · '}
          <Link href="/terms?lang=pl" hrefLang="pl-PL" className="underline underline-offset-4">
            Regulamin (PL)
          </Link>
        </p>
      </div>
    </footer>
  );
}
