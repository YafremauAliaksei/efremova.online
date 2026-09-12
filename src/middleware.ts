/**
 * Middleware — код, который выполняется ДО любой страницы и любого API-обработчика.
 * Это третий рубеж обороны (docs/03-security-policy.md, п.1).
 *
 * Порядок проверок важен: сначала самое дешёвое и самое опасное.
 *
 *   1. Ловушки (honeypot)     — сканер отсекается сразу, дальше не идёт
 *   2. Защита от CSRF         — проверка источника для изменяющих запросов
 *   3. Гейт кабинета          — нет сессии → редирект на вход
 *   4. Заголовки безопасности — CSP с nonce на каждый ответ
 *
 * ⚠️ Middleware работает в Edge Runtime: здесь НЕТ доступа к Node.js API,
 * к Prisma и к Redis. Поэтому запись событий делается «выстрелил и забыл» —
 * через внутренний обработчик, который уже работает в обычной Node-среде.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  buildContentSecurityPolicy,
  generateNonce,
  getBaseSecurityHeaders,
  getPrivateAreaHeaders,
} from '@/lib/security/headers';
import { buildCanaryPayload, checkPathTrap, looksLikeLegitimateBot } from '@/lib/security/honeypot';

const SESSION_COOKIE = '__Host-session';
const PRIVATE_PREFIXES = ['/cabinet', '/api/private'] as const;

/**
 * Админка закрыта целиком, кроме двух адресов: обмена одноразовой ссылки
 * на сессию и страницы отказа. Проверка здесь дешёвая — только наличие
 * cookie; подпись проверяется в самой странице (два независимых рубежа).
 */
const ADMIN_PREFIX = '/admin';
const ADMIN_PUBLIC_PATHS = ['/admin/enter', '/admin/denied'] as const;
const ADMIN_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-admin-session' : 'admin-session';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === 'development';
  const isAdminArea =
    (pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)) &&
    !ADMIN_PUBLIC_PATHS.some((allowed) => pathname === allowed);

  const isPrivate =
    isAdminArea ||
    PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  // ────────────────────────────────────────────────────────────────
  // 1. ЛОВУШКИ
  // ────────────────────────────────────────────────────────────────
  const userAgent = request.headers.get('user-agent') ?? '';

  // Легальный пентест по договору не должен спотыкаться о ловушки
  const pentestToken = process.env.PENTEST_BYPASS_TOKEN;
  const isAuthorizedPentest =
    typeof pentestToken === 'string' &&
    pentestToken.length > 0 &&
    request.headers.get('x-pentest-token') === pentestToken;

  if (process.env.HONEYPOT_ENABLED !== 'false' && !isAuthorizedPentest) {
    const hit = checkPathTrap(pathname);

    if (hit !== null && !looksLikeLegitimateBot(userAgent)) {
      // Событие уходит в фон: middleware не должен ждать записи в базу
      void reportHoneypotHit(request, hit.trapId, hit.trapType, hit.scoreDelta);

      // Намеренная задержка: сканер перебирает тысячи путей, каждая секунда
      // ожидания снижает скорость его работы и повышает шанс, что он уйдёт
      await sleep(hit.delayMs);

      // Фальшивый API отдаёт «утёкшие» данные с канарейками.
      // Остальные ловушки — обычный 404, чтобы не выдать факт обнаружения.
      if (hit.trapType === 'FAKE_API') {
        return NextResponse.json(buildCanaryPayload(hit.trapId), {
          status: 200,
          headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
        });
      }

      return new NextResponse('Not Found', {
        status: 404,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 2. ЗАЩИТА ОТ CSRF
  //
  // Атака: чужой сайт заставляет браузер пользователя отправить запрос
  // на наш сайт от его имени. Браузер честно приложит куки сессии.
  // Защита: современные браузеры сами сообщают, откуда пришёл запрос.
  // ────────────────────────────────────────────────────────────────
  if (MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    const selfOrigin = request.nextUrl.origin;

    const sameSite = fetchSite === 'same-origin' || fetchSite === 'none';
    const originOk = origin === null || origin === selfOrigin;

    // Webhooks платёжных систем приходят с чужих доменов — для них
    // работает своя проверка HMAC-подписи, эта проверка их не касается.
    const isWebhook = pathname.startsWith('/api/webhooks/');

    if (!isWebhook && (!originOk || !sameSite)) {
      void reportSecurityEvent(request, 'CSRF_FAIL', 'HIGH', {
        origin,
        fetchSite,
        path: pathname,
      });
      return withPrivateHeaders(new NextResponse('Forbidden', { status: 403 }));
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 3. ГЕЙТ ЛИЧНОГО КАБИНЕТА
  //
  // Здесь проверяется только НАЛИЧИЕ куки — это дешёвый фильтр.
  // Настоящая проверка подписи JWT и прав доступа делается в самой
  // странице/обработчике: middleware не должен быть единственной
  // преградой (принцип «не доверяй одному рубежу»).
  // ────────────────────────────────────────────────────────────────
  if (isAdminArea && !request.cookies.has(ADMIN_COOKIE)) {
    // Без объяснений и без редиректа на форму входа: формы входа в админку
    // не существует, войти можно только по ссылке из терминала сервера
    return withPrivateHeaders(NextResponse.redirect(new URL('/admin/denied', request.url)));
  }

  if (isPrivate && !isAdminArea) {
    const hasSession = request.cookies.has(SESSION_COOKIE);

    if (!hasSession) {
      if (pathname.startsWith('/api/')) {
        return withPrivateHeaders(NextResponse.json({ error: 'unauthorized' }, { status: 401 }));
      }
      const loginUrl = new URL('/login', request.url);
      // Запоминаем, куда человек шёл, чтобы вернуть его туда после входа.
      // Сохраняем только путь — открытый редирект на чужой домен невозможен.
      loginUrl.searchParams.set('next', pathname);

      // ⚠️ Заголовки обязательны и на редиректе.
      // Сам факт «этот адрес существует и требует входа» — тоже информация,
      // и промежуточный прокси не должен её кэшировать или отдать поисковику.
      return withPrivateHeaders(NextResponse.redirect(loginUrl));
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 4. ЗАГОЛОВКИ БЕЗОПАСНОСТИ
  // ────────────────────────────────────────────────────────────────
  const nonce = generateNonce();

  // Передаём nonce внутрь приложения: компоненты возьмут его из заголовка
  // и проставят своим <script nonce={...}>
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(
    'Content-Security-Policy',
    buildContentSecurityPolicy(nonce, isDev, isPrivate)
  );

  for (const [key, value] of Object.entries(getBaseSecurityHeaders())) {
    if (value === '') {
      response.headers.delete(key);
    } else {
      response.headers.set(key, value);
    }
  }

  // 🔒 Кабинет: запрет кэширования и индексации. Нарушение = утечка данных.
  if (isPrivate) {
    for (const [key, value] of Object.entries(getPrivateAreaHeaders())) {
      response.headers.set(key, value);
    }
  }

  return response;
}

/**
 * Навешивает заголовки закрытой зоны на ответ, который возвращается
 * до основного блока с заголовками: редирект на вход, 401, 403.
 */
function withPrivateHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(getBaseSecurityHeaders())) {
    if (value === '') response.headers.delete(key);
    else response.headers.set(key, value);
  }
  for (const [key, value] of Object.entries(getPrivateAreaHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Отправка события о ловушке во внутренний обработчик.
 *
 * Почему не пишем в базу прямо здесь: в Edge Runtime нет драйвера PostgreSQL.
 * Почему не ждём ответа: скорость ответа пользователю важнее, а событие
 * безопасности не критично к доставке «прямо сейчас».
 */
async function reportHoneypotHit(
  request: NextRequest,
  trapId: string,
  trapType: string,
  scoreDelta: number
): Promise<void> {
  await postInternal(request, '/api/internal/security/honeypot', {
    trapId,
    trapType,
    scoreDelta,
    ip: clientIp(request),
    country: request.headers.get('cf-ipcountry'),
    userAgent: request.headers.get('user-agent'),
    path: request.nextUrl.pathname,
    method: request.method,
  });
}

async function reportSecurityEvent(
  request: NextRequest,
  kind: string,
  severity: string,
  details: Record<string, unknown>
): Promise<void> {
  await postInternal(request, '/api/internal/security/event', {
    kind,
    severity,
    ip: clientIp(request),
    country: request.headers.get('cf-ipcountry'),
    details,
  });
}

async function postInternal(
  request: NextRequest,
  path: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await fetch(new URL(path, request.nextUrl.origin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Общий секрет: обработчик принимает вызовы только от middleware
        'x-internal-token': process.env.AUTH_SECRET ?? '',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Молча: сбой записи события не должен ломать ответ пользователю.
    // Потеря такого события отслеживается отдельно, по счётчику в мониторинге.
  }
}

/**
 * Реальный IP клиента.
 *
 * ⚠️ Порядок важен. CF-Connecting-IP ставит сам Cloudflare и подделать его снаружи
 * нельзя — при условии, что firewall сервера принимает трафик ТОЛЬКО с IP-диапазонов
 * Cloudflare (см. infra/terraform). Без этого условия заголовку доверять нельзя.
 */
function clientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const config = {
  // Middleware не трогает статику — иначе теряем скорость на каждой картинке
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|woff2)$).*)',
  ],
};
