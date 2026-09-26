import Link from 'next/link';

/**
 * Разделы админки — одна строка на всех её страницах. Будущие разделы
 * видны заранее пунктиром: владелец знает, что они запланированы.
 */

const SECTIONS = [
  { href: '/admin', label: 'Страницы и тексты' },
  { href: '/admin/profile', label: 'Данные владельца' },
] as const;

const PLANNED = ['Услуги и цены', 'Правовые документы'] as const;

export function AdminNav({ current }: { current: (typeof SECTIONS)[number]['href'] }) {
  return (
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
      {PLANNED.map((label) => (
        <span
          key={label}
          className="rounded border border-dashed border-[var(--color-line)] px-3 py-1 text-[var(--color-ink-soft)]"
        >
          {label} — далее
        </span>
      ))}
    </nav>
  );
}
