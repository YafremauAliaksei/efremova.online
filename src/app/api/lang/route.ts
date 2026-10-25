import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { relativeRedirect } from '@/lib/http/redirect';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n';
import { langSwitchTarget } from '@/lib/public/lang-switch';

/**
 * Запомнить язык по щелчку и перебросить на страницу (src/lib/public/lang-switch.ts).
 *
 * Единственный публичный адрес, который ставит cookie, — и именно поэтому
 * он отдельный и no-store: страницы сайта лежат в общем кэше Cloudflare,
 * и Set-Cookie на них достался бы всем посетителям.
 */

export const dynamic = 'force-dynamic';

export function GET(request: Request): NextResponse {
  const target = langSwitchTarget(new URL(request.url).searchParams.get('to'));
  if (target === null) {
    return new NextResponse('Bad Request', {
      status: 400,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  }

  const response = relativeRedirect(target.path, 303, {
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  });
  response.cookies.set(LOCALE_COOKIE, target.locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    // Сайт за Cloudflare и nginx: сам запрос до приложения идёт по http,
    // поэтому «защищённость» берётся из канонического адреса, а не из запроса
    secure: new URL(env().APP_URL).protocol === 'https:',
    // Читать выбор скриптом незачем: его читает только middleware
    httpOnly: true,
  });
  return response;
}
