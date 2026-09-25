import Link from 'next/link';
import { Filled } from '@/components/Filled';
import { getSiteProfile } from '@/lib/site-profile';

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
export async function SiteFooter() {
  const { values } = await getSiteProfile();

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
                Условия консультаций
              </Link>
            </li>
            <li>
              <Link href="/site-terms" className="underline underline-offset-4">
                Положения о сайте
              </Link>
            </li>
            <li>
              <Link href="/provider" className="underline underline-offset-4">
                Данные владельца
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
            Warunki konsultacji (PL)
          </Link>
          {' · '}
          <Link
            href="/site-terms?lang=pl"
            hrefLang="pl-PL"
            className="underline underline-offset-4"
          >
            Regulamin serwisu (PL)
          </Link>
          {' · '}
          <Link href="/provider?lang=pl" hrefLang="pl-PL" className="underline underline-offset-4">
            Informacje o usługodawcy (PL)
          </Link>
        </p>

        {/* Сайт психолога может открыть человек, которому помощь нужна сейчас,
            а не после записи. Номера — на каждой странице, не только в документе */}
        <p lang="pl-PL" className="mt-4 text-xs">
          W kryzysie lub zagrożeniu życia: <strong>112</strong> · całodobowo{' '}
          <strong>800 70 2222</strong> ·{' '}
          <Link href="/site-terms?lang=pl#kryzys" className="underline underline-offset-4">
            więcej numerów
          </Link>
        </p>

        <p lang="pl-PL" className="mt-4 text-xs">
          <Filled
            values={values}
            text="Usługodawca: {{owner.fullName}}, {{owner.address}} · NIP {{owner.nip}} · {{owner.email}} · {{owner.professionalTitle}}, nr prawa wykonywania zawodu {{owner.licenseNumber}}"
          />
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
