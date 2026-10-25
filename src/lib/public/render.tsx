import 'server-only';
import { prerender } from 'react-dom/static';
import { PublicDocument } from '@/components/PublicDocument';
import { db } from '@/lib/db';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';
import { notFoundPage, resolvePublicPage } from '@/lib/public/pages';
import type { PublicView } from '@/lib/public/view';
import {
  DEGRADED_CACHE_HEADERS,
  NOT_FOUND_CACHE_HEADERS,
  PUBLIC_CACHE_HEADERS,
  buildPublicContentSecurityPolicy,
} from '@/lib/security/headers';

/**
 * Публичная страница как HTML без JavaScript (docs/14).
 *
 * prerender из react-dom/static ждёт все асинхронные компоненты (блоки сами
 * ходят в базу) и отдаёт готовый HTML. Скриптов «оживления» React в нём нет:
 * они не нужны, потому что на странице нечего оживлять, — и CSP их запрещает.
 *
 * ⚠️ Ответ ложится в общий кэш Cloudflare, поэтому в нём не должно быть
 * ничего, что зависит от посетителя: ни cookie, ни страны, ни заголовков
 * запроса. Отрисовка получает только язык и путь — больше ей знать нечего.
 */

export async function renderView(locale: Locale, view: PublicView): Promise<string> {
  const { prelude } = await prerender(
    <PublicDocument locale={locale} meta={view.meta}>
      {view.body}
    </PublicDocument>
  );
  return new Response(prelude).text();
}

export async function publicPageResponse(
  rawLocale: string,
  segments: readonly string[]
): Promise<Response> {
  // Обработчик стоит под [locale], но язык всё равно из адреса: middleware
  // перебрасывает незнакомые языки, а сюда он мог прийти и в обход
  const locale = isLocale(rawLocale) ? rawLocale : null;
  const view = locale === null ? null : await resolvePublicPage(locale, segments);
  const found = view !== null;
  const shownLocale = locale ?? DEFAULT_LOCALE;

  // <!DOCTYPE html> prerender ставит сам: корень разметки — <html>
  const [html, databaseUp] = await Promise.all([
    renderView(shownLocale, view ?? notFoundPage(shownLocale)),
    db.$queryRaw`SELECT 1`.then(
      () => true,
      () => false
    ),
  ]);
  return new Response(html, {
    status: found ? 200 : 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // База не отвечает — страница собрана на заглушках (src/lib/pages.ts):
      // показать её можно, класть в кэш нельзя. Иначе урезанная копия час
      // вытесняла бы в Cloudflare нормальную и после того, как база поднялась
      ...(!databaseUp
        ? DEGRADED_CACHE_HEADERS
        : found
          ? PUBLIC_CACHE_HEADERS
          : NOT_FOUND_CACHE_HEADERS),
      'Content-Security-Policy': buildPublicContentSecurityPolicy(),
    },
  });
}
