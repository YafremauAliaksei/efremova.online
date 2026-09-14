import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { consumeLoginToken, createAdminSession } from '@/lib/auth/admin';
import { recordSecurityEvent } from '@/lib/security/recorder';

/**
 * Обмен одноразовой ссылки на сессию администратора.
 *
 * Единственный адрес админки, доступный без сессии. Всё остальное
 * под /admin закрыто в middleware.
 *
 * ⚠️ Важная деталь: ответ НИКОГДА не объясняет, почему именно ссылка
 * не подошла — «не существует», «просрочена» и «уже использована»
 * выглядят снаружи одинаково. Иначе перебор ссылок получил бы подсказку,
 * какая из них когда-то была настоящей.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get('token');
  const headerList = await headers();
  const ip =
    headerList.get('cf-connecting-ip') ??
    headerList.get('x-real-ip') ??
    headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  if (token === null || token.length < 20) {
    return deny(request, ip, 'no_token');
  }

  const result = await consumeLoginToken(token, ip);

  if (!result.ok) {
    return deny(request, ip, result.reason);
  }

  await createAdminSession();

  await recordSecurityEvent({
    kind: 'ANOMALY',
    severity: 'MEDIUM',
    ip,
    country: null,
    path: '/admin/enter',
    details: { event: 'ADMIN_LOGIN', outcome: 'success' },
    count: 1,
  });

  return NextResponse.redirect(new URL('/admin', request.url), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function deny(request: Request, ip: string | null, reason: string): Promise<NextResponse> {
  // Неудачная попытка входа в админку — событие безопасности, а не мелочь:
  // это либо ошибка владельца, либо чужая попытка подобрать ссылку.
  //
  // Запись идёт через общий recorder, а не прямой записью в базу: там живут
  // склейка по часу и потолок записей. Перебор ссылок — это тоже поток,
  // и он не должен создавать строку на каждую попытку.
  await recordSecurityEvent({
    kind: 'ANOMALY', // отдельного типа для админки в перечислении пока нет
    severity: 'HIGH',
    ip,
    country: null,
    path: '/admin/enter',
    details: { event: 'ADMIN_LOGIN_FAILED', reason },
    count: 1,
  });

  const url = new URL('/admin/denied', request.url);
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'no-store' } });
}
