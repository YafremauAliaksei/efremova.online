import type { ContactLink } from '@/lib/contacts';
import type { Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';

/**
 * Кнопки «написать» — ради них существует сайт (docs/13, п.1).
 *
 * Адреса собраны кодом из проверенных значений профиля (src/lib/contacts.ts).
 * Ссылка открывается только по щелчку посетителя — до этого браузер к
 * мессенджеру не обращается. rel="noreferrer": мессенджер не узнаёт,
 * с какой страницы пришёл человек.
 */
export function ContactList({ links, locale }: { links: ContactLink[]; locale: Locale }) {
  const t = messages(locale).contacts;

  if (links.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
        {t.empty}
      </p>
    );
  }

  return (
    <ul aria-label={t.listLabel} className="mt-8 grid gap-3 sm:grid-cols-2">
      {links.map((link) => (
        <li key={link.kind}>
          <a
            href={link.href}
            rel="noreferrer"
            data-contact={link.kind}
            className="flex h-full flex-col rounded-lg border border-[var(--color-line)] bg-white px-5 py-4 text-left transition-colors hover:border-[var(--color-accent)]"
          >
            <span className="font-medium">{t.kinds[link.kind]}</span>
            {/* Адрес и номер не переводятся: переводчик браузера испортил бы их */}
            <span translate="no" className="mt-1 break-all text-sm text-[var(--color-ink-soft)]">
              {link.shown}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
