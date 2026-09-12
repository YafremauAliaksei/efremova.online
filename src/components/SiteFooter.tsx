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
              <Link href="/o-mne" className="underline underline-offset-4">
                Обо мне
              </Link>
            </li>
            <li>
              <Link href="/uslugi" className="underline underline-offset-4">
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
                Публичная оферта
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
