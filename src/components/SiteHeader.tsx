import Link from 'next/link';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { pagePath } from '@/lib/blocks/pages';
import { localizedPath, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { getNavigation } from '@/lib/pages';

/**
 * Шапка сайта: меню и переключатель языка.
 *
 * Какие страницы в меню и в каком порядке — решает владелец в админке
 * (флаг «в шапке» у страницы). «Услуги» — страница со своим кодом, она
 * в меню всегда. Без базы меню короче, но шапка на месте.
 */
export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = messages(locale);
  const pages = (await getNavigation(locale)).filter((item) => item.inHeader);
  const items = [
    ...pages.map((item) => ({ key: item.slug, href: pagePath(item.slug), label: item.title })),
    { key: 'services', href: '/services', label: t.nav.services },
  ];

  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 pt-4">
      <nav aria-label={t.mainNav}>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={localizedPath(locale, item.href)}
                className="underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <LanguageSwitcher current={locale} label={t.languageNav} />
    </header>
  );
}
