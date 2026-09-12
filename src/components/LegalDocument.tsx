import Link from 'next/link';
import { LOCALE_NAMES, LOCALE_TAGS, type LegalDocumentView, type Locale } from '@/lib/legal';

/**
 * Отрисовка правового документа.
 *
 * Текст приходит из базы структурой (заголовок + абзацы + списки), а не
 * разметкой HTML. Поэтому здесь нет и не может быть dangerouslySetInnerHTML:
 * даже если в базу попадёт «<script>», он отобразится как текст.
 * Это же требование зафиксировано правилом линтера (docs/03, п.3).
 */

const UI_TEXT = {
  pl: {
    draftTitle: 'Projekt dokumentu',
    draftBody:
      'Dokument jest w przygotowaniu i przed uruchomieniem serwisu wymaga weryfikacji prawnej.',
    version: 'Wersja dokumentu',
    updated: 'aktualizacja',
    otherLanguages: 'Wersje językowe',
    missing: 'Dokument nie został jeszcze wprowadzony do bazy danych.',
  },
  ru: {
    draftTitle: 'Черновик документа',
    draftBody: 'Документ в подготовке и до запуска сайта должен быть проверен юристом.',
    version: 'Версия документа',
    updated: 'обновлено',
    otherLanguages: 'Версии на других языках',
    missing: 'Документ ещё не заполнен в базе данных.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function LegalDocument({
  document,
  basePath,
}: {
  document: LegalDocumentView;
  basePath: string;
}) {
  const t = UI_TEXT[document.locale];

  return (
    // lang на самом блоке: если документ показан на польском, а интерфейс
    // на русском, скринридер прочитает текст с правильным произношением
    <article lang={LOCALE_TAGS[document.locale]}>
      <h1 className="text-3xl font-semibold">{document.title}</h1>

      <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
        {t.version}: <code>{document.version}</code> · {t.updated}{' '}
        {document.publishedAt.toISOString().slice(0, 10)}
      </p>

      {/* Переключатель языка: прямые ссылки, которые можно отправить и сохранить */}
      {document.availableLocales.length > 1 && (
        <nav aria-label={t.otherLanguages} className="mt-4">
          <ul className="flex flex-wrap gap-3 text-sm">
            {document.availableLocales.map((locale) => {
              const isCurrent = locale === document.locale;
              return (
                <li key={locale}>
                  <Link
                    href={`${basePath}?lang=${locale}`}
                    hrefLang={LOCALE_TAGS[locale]}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={
                      isCurrent
                        ? 'rounded border border-[var(--color-accent)] px-3 py-1 font-medium text-[var(--color-accent)]'
                        : 'rounded border border-[var(--color-line)] px-3 py-1 text-[var(--color-ink-soft)] underline-offset-4 hover:underline'
                    }
                  >
                    {LOCALE_NAMES[locale]}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {document.isDraft && (
        <div
          role="note"
          className="mt-6 rounded-lg border border-[var(--color-warning)] bg-[#fdf8f0] p-5"
        >
          <p className="font-medium text-[var(--color-warning)]">{t.draftTitle}</p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{t.draftBody}</p>
        </div>
      )}

      {document.sections.map((section) => (
        <section
          key={section.heading}
          id={section.anchor}
          className={section.anchor === undefined ? 'mt-10' : 'mt-10 scroll-mt-8'}
        >
          <h2 className="text-2xl font-semibold">{section.heading}</h2>

          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="mt-3 text-[var(--color-ink-soft)]">
              {paragraph}
            </p>
          ))}

          {section.items !== undefined && section.items.length > 0 && (
            <ul className="mt-3 space-y-2 text-[var(--color-ink-soft)]">
              {section.items.map((item) => (
                <li key={item.slice(0, 40)} className="pl-4 -indent-4">
                  — {item}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  );
}

export function LegalDocumentMissing({ locale }: { locale: Locale }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
      {UI_TEXT[locale].missing} <code>npm run db:seed</code>
    </div>
  );
}
