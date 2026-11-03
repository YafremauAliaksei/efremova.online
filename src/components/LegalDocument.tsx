import { Filled } from '@/components/Filled';
import { getSiteProfile } from '@/lib/site-profile';
import { LOCALE_NAMES, LOCALE_TAGS, localizedPath, type Locale } from '@/lib/i18n';
import type { LegalDocumentView } from '@/lib/legal';

/**
 * Отрисовка правового документа.
 *
 * Текст приходит из базы структурой (заголовок + абзацы + списки), а не
 * разметкой HTML. Поэтому здесь нет и не может быть dangerouslySetInnerHTML:
 * даже если в базу попадёт «<script>», он отобразится как текст.
 * Это же требование зафиксировано правилом линтера (docs/03, п.3).
 *
 * Данные владельца в тексте — метки {{owner.*}}, их подставляет <Filled>
 * из профиля в базе (docs/03 п.11.3).
 */

const UI_TEXT = {
  pl: {
    draftTitle: 'To nie jest dokument prawny, a jedynie przykład',
    draftBody:
      'Tekst pokazuje, jak będzie wyglądał dokument serwisu. Nie stanowi porady prawnej i nie wiąże ani usługodawcy, ani klientów. Ostateczną wersję przygotuje prawnik przed rozpoczęciem świadczenia usług.',
    version: 'Wersja dokumentu',
    updated: 'aktualizacja',
    otherLanguages: 'Wersje językowe',
    missing: 'Dokument jest chwilowo niedostępny.',
    current: 'Obowiązująca wersja z dnia',
    outdated: 'Ta wersja dokumentu jest nieaktualna. Obowiązująca wersja z dnia',
    open: 'otwórz',
    history: 'Wszystkie wersje dokumentu',
    currentTag: 'obowiązująca',
    draftTag: 'projekt',
    unknown: 'Nie ma takiej wersji dokumentu. Obowiązująca wersja z dnia',
  },
  ru: {
    draftTitle: 'Это не юридический документ, а всего лишь пример',
    draftBody:
      'Текст показывает, как будет выглядеть документ сайта. Он не является юридической консультацией и не обязывает ни исполнителя, ни клиентов. Окончательную редакцию подготовит юрист до начала оказания услуг.',
    version: 'Версия документа',
    updated: 'обновлено',
    otherLanguages: 'Версии на других языках',
    missing: 'Документ временно недоступен.',
    current: 'Действующая редакция от',
    outdated: 'Эта редакция документа устарела. Действующая редакция от',
    open: 'открыть',
    history: 'Все редакции документа',
    currentTag: 'действующая',
    draftTag: 'проект',
    unknown: 'Такой редакции документа нет. Действующая редакция от',
  },
  en: {
    draftTitle: 'This is not a legal document, only an example',
    draftBody:
      'This text shows what the site’s document will look like. It is not legal advice and binds neither the provider nor clients. A lawyer will prepare the final version before any services are provided.',
    version: 'Document version',
    updated: 'updated',
    otherLanguages: 'Other languages',
    missing: 'This document is temporarily unavailable.',
    current: 'Current version of',
    outdated: 'This version of the document is out of date. Current version of',
    open: 'open',
    history: 'All versions of the document',
    currentTag: 'current',
    draftTag: 'draft',
    unknown: 'There is no such version of the document. Current version of',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export async function LegalDocument({
  document,
  path,
}: {
  document: LegalDocumentView;
  /** Адрес документа без языка: /privacy */
  path: string;
}) {
  const t = UI_TEXT[document.locale];
  const { values, status } = await getSiteProfile();
  // Пока сайт в разработке, любой документ — образец, даже если в базе
  // он уже отмечен как окончательный
  const isSample = document.isDraft || status === 'development';

  return (
    // lang на самом блоке: если документ показан на польском, а интерфейс
    // на русском, скринридер прочитает текст с правильным произношением
    <article lang={LOCALE_TAGS[document.locale]}>
      <h1 className="text-3xl font-semibold">
        <Filled text={document.title} values={values} />
      </h1>

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
                  <a
                    href={localizedPath(locale, path)}
                    hrefLang={LOCALE_TAGS[locale]}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={
                      isCurrent
                        ? 'rounded border border-[var(--color-accent)] px-3 py-1 font-medium text-[var(--color-accent)]'
                        : 'rounded border border-[var(--color-line)] px-3 py-1 text-[var(--color-ink-soft)] underline-offset-4 hover:underline'
                    }
                  >
                    {LOCALE_NAMES[locale]}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Какая это редакция: ссылку с ?ver= человек сохраняет как «тот самый договор» */}
      {document.isCurrent ? (
        <p
          role="status"
          className="mt-6 rounded-lg border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-soft)]"
        >
          {`${t.current} ${day(document.publishedAt)}.`}
        </p>
      ) : (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-[var(--color-warning)] bg-[#fdf8f0] p-4 text-sm"
        >
          {`${t.outdated} ${day(document.current.publishedAt)}: `}
          <a
            href={revisionHref(document.locale, path, document.current.ver)}
            className="font-medium underline underline-offset-4"
          >
            {t.open}
          </a>
        </p>
      )}

      {isSample && (
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
          <h2 className="text-2xl font-semibold">
            <Filled text={section.heading} values={values} />
          </h2>

          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="mt-3 text-[var(--color-ink-soft)]">
              <Filled text={paragraph} values={values} />
            </p>
          ))}

          {section.items !== undefined && section.items.length > 0 && (
            <ul className="mt-3 space-y-2 text-[var(--color-ink-soft)]">
              {section.items.map((item) => (
                <li key={item.slice(0, 40)} className="pl-4 -indent-4">
                  — <Filled text={item} values={values} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className="mt-12 border-t border-[var(--color-line)] pt-6">
        <h2 className="text-lg font-semibold">{t.history}</h2>
        <ul className="mt-3 space-y-1 text-sm text-[var(--color-ink-soft)]">
          {document.revisions.map((revision) => {
            const label =
              revision.ver === day(revision.publishedAt)
                ? revision.ver
                : `${day(revision.publishedAt)} (${revision.ver})`;
            return (
              <li key={revision.ver}>
                {revision.ver === document.ver ? (
                  <strong aria-current="page">{label}</strong>
                ) : (
                  <a
                    href={revisionHref(document.locale, path, revision.ver)}
                    className="underline underline-offset-4"
                  >
                    {label}
                  </a>
                )}
                {revision.isCurrent && ` — ${t.currentTag}`}
                {revision.isDraft && ` · ${t.draftTag}`}
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

/** Дата редакции, UTC */
function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function revisionHref(locale: Locale, path: string, ver: string): string {
  return `${localizedPath(locale, path)}?ver=${encodeURIComponent(ver)}`;
}

/** Ссылка на несуществующую редакцию: не молча подменять, а сказать и дать действующую */
export function LegalVersionUnknown({
  locale,
  href,
  date,
}: {
  locale: Locale;
  href: string;
  date: Date;
}) {
  const t = UI_TEXT[locale];
  return (
    <p role="alert" className="rounded-lg border border-[var(--color-warning)] bg-[#fdf8f0] p-6">
      {`${t.unknown} ${day(date)}: `}
      <a href={href} className="font-medium underline underline-offset-4">
        {t.open}
      </a>
    </p>
  );
}

export function LegalDocumentMissing({ locale }: { locale: Locale }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-[var(--color-ink-soft)]">
      {UI_TEXT[locale].missing}
      {/* Подсказка для разработчика — посетителю незачем знать устройство сайта */}
      {process.env.NODE_ENV === 'development' && (
        <>
          {' '}
          <code>npm run db:seed</code>
        </>
      )}
    </div>
  );
}
