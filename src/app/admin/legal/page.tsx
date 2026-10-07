import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LegalEditor } from '@/app/admin/legal/LegalEditor';
import { restoreLegal } from '@/app/admin/legal/actions';
import { AdminNav } from '@/components/admin/AdminNav';
import { isAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { LOCALES, LOCALE_NAMES, isLocale, localizedPath, type Locale } from '@/lib/i18n';
import { LEGAL_SLUGS, type LegalSlug } from '@/lib/legal';
import { sectionsToText } from '@/lib/legal-text';
import type { LegalSection } from '../../../../prisma/legal-content';

/**
 * Правовые документы (задача 10): новая редакция вместо правки опубликованной.
 *
 * Список — документы по языкам с действующей редакцией. Открытый документ —
 * форма новой редакции (текущий текст как отправная точка) и вся история:
 * любую прежнюю редакцию можно вернуть, и это тоже новая редакция.
 */

export const metadata: Metadata = {
  title: 'Правовые документы',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const NAMES: Record<LegalSlug, string> = {
  privacy: 'Политика конфиденциальности',
  terms: 'Условия оказания услуг',
  provider: 'Информация об исполнителе',
  'site-terms': 'Правила пользования сайтом',
};

const SAVED = {
  published: 'Новая редакция опубликована. Прежняя — в истории ниже.',
  restored: 'Прежний текст опубликован новой редакцией.',
} as const;

const SMALL_BUTTON =
  'rounded border border-[var(--color-line)] px-2 py-1 text-xs hover:bg-[var(--color-paper-alt)]';

function isLegalSlug(value: unknown): value is LegalSlug {
  return typeof value === 'string' && (LEGAL_SLUGS as readonly string[]).includes(value);
}

function day(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

interface PageProps {
  searchParams: Promise<{ doc?: string; lang?: string; saved?: string; error?: string }>;
}

export default async function LegalAdminPage({ searchParams }: PageProps) {
  if (!(await isAdmin())) redirect('/admin/denied');
  const params = await searchParams;
  const slug = isLegalSlug(params.doc) ? params.doc : null;
  const locale = isLocale(params.lang) ? params.lang : null;

  return (
    <main id="main" className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          ← Страницы и тексты
        </Link>
      </p>
      <h1 className="mt-4 text-2xl font-semibold">Правовые документы</h1>
      <AdminNav current="/admin/legal" />
      {params.error === 'missing' && (
        <p role="alert" className="mt-6 text-sm text-red-800">
          Документ не найден — обновите страницу.
        </p>
      )}
      {slug !== null && locale !== null ? (
        <DocumentEditor slug={slug} locale={locale} saved={params.saved} />
      ) : (
        <DocumentList />
      )}
    </main>
  );
}

async function DocumentList() {
  const current = await db.legalDocument.findMany({
    where: { isCurrent: true },
    select: { slug: true, locale: true, version: true, isDraft: true, publishedAt: true },
  });

  return (
    <>
      <p className="mt-6 text-sm text-[var(--color-ink-soft)]">
        Опубликованный текст не меняется: каждое сохранение — новая редакция, прежние остаются в
        истории. Польская версия — основная, по ней ведётся деятельность.
      </p>
      {LEGAL_SLUGS.map((docSlug) => (
        <section key={docSlug} className="mt-8">
          <h2 className="text-lg font-semibold">{NAMES[docSlug]}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {LOCALES.map((docLocale) => {
              const doc = current.find(
                (item) => item.slug === docSlug && item.locale === docLocale
              );
              return (
                <li key={docLocale}>
                  <Link
                    href={`/admin/legal?doc=${docSlug}&lang=${docLocale}`}
                    className="underline underline-offset-4"
                  >
                    {LOCALE_NAMES[docLocale]}
                  </Link>{' '}
                  <span className="text-[var(--color-ink-soft)]">
                    {doc === undefined
                      ? '— нет текста'
                      : `— ${doc.version}, ${day(doc.publishedAt)} UTC${doc.isDraft ? ', образец' : ''}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}

async function DocumentEditor({
  slug,
  locale,
  saved,
}: {
  slug: LegalSlug;
  locale: Locale;
  saved: string | undefined;
}) {
  const versions = await db.legalDocument.findMany({
    where: { slug, locale },
    orderBy: { publishedAt: 'desc' },
  });
  const current = versions.find((doc) => doc.isCurrent);
  const savedText =
    saved !== undefined && Object.hasOwn(SAVED, saved) ? SAVED[saved as keyof typeof SAVED] : null;

  return (
    <>
      <p className="mt-6 text-sm">
        <Link href="/admin/legal" className="underline underline-offset-4">
          ← Все документы
        </Link>
      </p>
      <h2 className="mt-4 text-xl font-semibold">
        {NAMES[slug]} · {LOCALE_NAMES[locale]}
      </h2>
      {current !== undefined && (
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Действует: <code>{current.version}</code> с {day(current.publishedAt)} UTC
          {current.isDraft ? ' · образец, не проверен юристом' : ' · проверен юристом'} ·{' '}
          <Link href={localizedPath(locale, `/${slug}`)} className="underline underline-offset-4">
            на сайте
          </Link>
        </p>
      )}
      {savedText !== null && (
        <p
          role="status"
          className="mt-4 rounded border border-[var(--color-line)] px-3 py-2 text-sm"
        >
          {savedText}
        </p>
      )}

      <details className="mt-6 text-sm text-[var(--color-ink-soft)]">
        <summary className="cursor-pointer">Как размечен текст</summary>
        <ul className="mt-2 space-y-1">
          <li>
            <code>## Заголовок раздела</code> — новый раздел; <code>{'{#cookies}'}</code> в конце
            строки — якорь для ссылки вида <code>/pl/privacy#cookies</code>.
          </li>
          <li>Пустая строка разделяет абзацы; соседние строки — один абзац.</li>
          <li>
            <code>- пункт</code> — пункт списка; список идёт после абзацев своего раздела.
          </li>
          <li>
            <code>{'{{owner.fullName}}'}</code> — данные из «Данных владельца»;{' '}
            <code>⟦ЮРИСТ: …⟧</code> — место, которое должен заполнить юрист.
          </li>
        </ul>
      </details>

      <LegalEditor
        slug={slug}
        locale={locale}
        title={current?.title ?? ''}
        text={
          current === undefined ? '' : sectionsToText(current.sections as unknown as LegalSection[])
        }
        approved={current === undefined ? false : !current.isDraft}
      />

      {versions.length > 0 && (
        <section className="mt-10">
          <h3 className="font-semibold">История редакций</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {versions.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-2">
                <code>{doc.version}</code>
                <span className="text-[var(--color-ink-soft)]">
                  {day(doc.publishedAt)} UTC{doc.isDraft ? ' · образец' : ''}
                  {doc.fromAdmin ? '' : ' · из кода'}
                </span>
                {doc.isCurrent ? (
                  <span className="text-xs text-[var(--color-accent)]">действует</span>
                ) : (
                  <form action={restoreLegal}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <button type="submit" className={SMALL_BUTTON}>
                      Вернуть этот текст
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
