import Link from 'next/link';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, localizedPath } from '@/lib/i18n';
import { messages } from '@/lib/messages';

/**
 * «Страница не найдена» на языке адреса.
 *
 * not-found в Next.js не получает params, поэтому язык передаёт middleware
 * заголовком запроса x-locale (как и nonce). Значение проходит ту же
 * проверку, что и везде: не из списка — русский.
 */
export default async function NotFound() {
  const raw = (await headers()).get('x-locale');
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = messages(locale).notFound;

  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="mt-4 text-[var(--color-ink-soft)]">{t.body}</p>
      <Link href={localizedPath(locale)} className="mt-8 inline-block underline underline-offset-4">
        {t.home}
      </Link>
    </main>
  );
}
