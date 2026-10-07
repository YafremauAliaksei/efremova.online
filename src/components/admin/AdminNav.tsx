import Link from 'next/link';
import { isTotpEnabled } from '@/lib/auth/admin';

/** Разделы админки — одна строка на всех её страницах */

const SECTIONS = [
  { href: '/admin', label: 'Страницы и тексты' },
  { href: '/admin/services', label: 'Услуги и цены' },
  { href: '/admin/media', label: 'Картинки' },
  { href: '/admin/testimonials', label: 'Отзывы' },
  { href: '/admin/legal', label: 'Правовые документы' },
  { href: '/admin/profile', label: 'Данные владельца' },
  { href: '/admin/journal', label: 'Журнал' },
] as const;

export function AdminNav({ current }: { current: (typeof SECTIONS)[number]['href'] }) {
  return (
    <>
      {!isTotpEnabled() && <SecondFactorWarning />}
      <nav aria-label="Разделы админки" className="mt-6 flex flex-wrap gap-3 text-sm">
        {SECTIONS.map((section) =>
          section.href === current ? (
            <span
              key={section.href}
              aria-current="page"
              className="rounded border border-[var(--color-accent)] px-3 py-1 text-[var(--color-accent)]"
            >
              {section.label}
            </span>
          ) : (
            <Link
              key={section.href}
              href={section.href}
              className="rounded border border-[var(--color-line)] px-3 py-1 underline-offset-4 hover:underline"
            >
              {section.label}
            </Link>
          )
        )}
      </nav>
    </>
  );
}

/**
 * Пока второй фактор не настроен, вход — по одной ссылке. Для разработки
 * это нормально, для рабочего сайта — нет: плашка видна на каждой странице
 * админки, а перевести сайт в рабочий режим нельзя (profile/page.tsx).
 */
export function SecondFactorWarning() {
  return (
    <p
      role="alert"
      className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      Вход защищён только ссылкой — второй фактор не настроен. Выпустите секрет командой{' '}
      <code>npm run admin:2fa</code>, добавьте его в <code>.env</code> как{' '}
      <code>ADMIN_TOTP_SECRET</code> и перезапустите сайт.
    </p>
  );
}
