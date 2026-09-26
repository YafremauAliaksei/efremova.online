import { NextResponse } from 'next/server';

/**
 * Адрес на своём сайте для переброса из middleware.
 *
 * В middleware относительный Location невозможен: Next.js сам разбирает его
 * через new URL и переписывает в абсолютный — от СВОЕГО имени сервера
 * (http://localhost:3000), а не от домена сайта. Так Next.js защищается от
 * подделки Host, но за nginx посетителя уносило на localhost.
 *
 * Поэтому домен берётся из APP_URL — канонического адреса сайта из .env,
 * на котором уже строятся canonical и sitemap. Нет APP_URL — адрес сервера:
 * так работает локальная разработка.
 */
export function siteUrl(path: string, appUrl: string | undefined, serverOrigin: string): URL {
  if (!isSafeRedirectPath(path)) throw new Error('Переброс разрешён только на путь своего сайта');
  let origin = serverOrigin;
  try {
    if (appUrl !== undefined && appUrl !== '') origin = new URL(appUrl).origin;
  } catch {
    // Испорченный APP_URL не должен ронять каждый запрос: env.ts сообщит о нём при старте
  }
  return new URL(path, origin);
}

/**
 * Переброс с относительным адресом в Location — для обработчиков маршрутов
 * (route handlers), где Next.js заголовок не трогает.
 *
 * ⚠️ Не NextResponse.redirect(new URL(path, request.url)): в standalone-сборке
 * request.url строится из адреса, который слушает сам сервер, а не из Host
 * запроса. За nginx это давало Location: https://localhost:3000/… — переброс
 * в никуда, в том числе после входа в админку. Относительный адрес браузер
 * достраивает сам, от того домена, который видит (RFC 9110, п.10.2.2).
 *
 * Принимается только путь своего сайта: «//host» и «/\host» браузер прочёл
 * бы как адрес чужого домена — такой переброс превратился бы в открытый
 * редирект, поэтому он отклоняется ошибкой, а не отправляется.
 */
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

export function relativeRedirect(
  path: string,
  status: 303 | 307 | 308 = 307,
  headers: Record<string, string> = {}
): NextResponse {
  if (!isSafeRedirectPath(path)) throw new Error('Переброс разрешён только на путь своего сайта');
  return new NextResponse(null, { status, headers: { ...headers, Location: path } });
}
