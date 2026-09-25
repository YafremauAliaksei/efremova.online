import { getSiteProfile } from '@/lib/site-profile';

/**
 * Плашка «сайт в разработке» на каждой странице (docs/03 п.11.3).
 *
 * Пока практики ещё нет, сайт — образец: имена, адреса и тексты в нём
 * примерные, услуги не оказываются. Посетитель должен понять это сразу,
 * а не из мелкого шрифта в правовых документах. Три языка, потому что
 * посетитель может прийти на любом из них; lang у каждой строки — чтобы
 * скринридер прочитал её с верным произношением.
 */
export async function DevelopmentNotice() {
  const { status } = await getSiteProfile();
  if (status !== 'development') return null;

  return (
    <div role="note" className="border-b border-amber-300 bg-amber-50 text-sm text-amber-950">
      <div className="mx-auto max-w-3xl space-y-1 px-6 py-3">
        <p lang="pl-PL">
          <strong>Serwis w budowie.</strong> Usługi nie są świadczone; dane i treści są przykładowe
          i nie stanowią porady prawnej.
        </p>
        <p lang="ru">
          <strong>Сайт в разработке.</strong> Услуги не оказываются; данные и тексты — образцы и не
          являются юридической информацией.
        </p>
        <p lang="en">
          <strong>Site under construction.</strong> No services are provided; all data and texts are
          samples and not legal advice.
        </p>
      </div>
    </div>
  );
}
