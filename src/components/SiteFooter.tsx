import Link from 'next/link';
import { Filled } from '@/components/Filled';
import { localizedPath, type Locale } from '@/lib/i18n';
import { messages } from '@/lib/messages';
import { getSiteProfile } from '@/lib/site-profile';
import { getNavigation } from '@/lib/pages';
import { pagePath } from '@/lib/blocks/pages';

/** Страницы со своим кодом: они в подвале всегда (ссылки на документы — требование GDPR) */
const CODE_LINKS = [
  ['services', '/services'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['siteTerms', '/site-terms'],
  ['provider', '/provider'],
] as const;

/**
 * Общий подвал сайта.
 *
 * Вынесен в отдельный компонент, потому что ссылки на правовые документы
 * обязаны быть на каждой странице: это требование GDPR (ст. 12 — информация
 * должна быть «легко доступна»), а не вопрос вкуса.
 *
 * Здесь же — данные владельца: закон об электронных услугах (ст. 5) и
 * директива 2000/31/ЕС (ст. 5) требуют, чтобы они были доступны постоянно
 * и прямо. Значения — из профиля в базе (docs/03 п.11.3).
 */
export async function SiteFooter({ locale }: { locale: Locale }) {
  const { values } = await getSiteProfile();
  const t = messages(locale);
  // Страницы из базы с флагом «в подвале», затем страницы со своим кодом
  const links = [
    ...(await getNavigation(locale))
      .filter((item) => item.inFooter)
      .map((item) => ({ key: item.slug, path: pagePath(item.slug), label: item.title })),
    ...CODE_LINKS.map(([key, path]) => ({ key, path, label: t.nav[key] })),
  ];

  return (
    <footer className="border-t border-[var(--color-line)]">
      <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[var(--color-ink-soft)]">
        <nav aria-label={t.sectionsNav}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {links.map((link) => (
              <li key={link.key}>
                <Link
                  href={localizedPath(locale, link.path)}
                  className="underline underline-offset-4"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Прямые ссылки на языковые версии: по польскому праву документы
            должны быть доступны на польском, и попасть на них нужно
            в один клик, а не через автоопределение языка */}
        <p lang="pl-PL" className="mt-4 text-xs">
          Dokumenty prawne:{' '}
          <Link href="/pl/privacy" hrefLang="pl-PL" className="underline underline-offset-4">
            Polityka prywatności (PL)
          </Link>
          {' · '}
          <Link href="/pl/terms" hrefLang="pl-PL" className="underline underline-offset-4">
            Warunki konsultacji (PL)
          </Link>
          {' · '}
          <Link href="/pl/site-terms" hrefLang="pl-PL" className="underline underline-offset-4">
            Regulamin serwisu (PL)
          </Link>
          {' · '}
          <Link href="/pl/provider" hrefLang="pl-PL" className="underline underline-offset-4">
            Informacje o usługodawcy (PL)
          </Link>
        </p>

        {/* Сайт психолога может открыть человек, которому помощь нужна сейчас,
            а не после записи. Номера — на каждой странице, не только в документе */}
        <p lang="pl-PL" className="mt-4 text-xs">
          W kryzysie lub zagrożeniu życia: <strong>112</strong> · całodobowo{' '}
          <strong>800 70 2222</strong> ·{' '}
          <Link href="/pl/site-terms#kryzys" className="underline underline-offset-4">
            więcej numerów
          </Link>
        </p>

        <p lang="pl-PL" className="mt-4 text-xs">
          <Filled
            values={values}
            text="Usługodawca: {{owner.fullName}}, {{owner.address}} · NIP {{owner.nip}} · {{owner.email}} · {{owner.professionalTitle}}, nr prawa wykonywania zawodu {{owner.licenseNumber}}"
          />
        </p>
      </div>
    </footer>
  );
}
