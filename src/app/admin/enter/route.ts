import { headers } from 'next/headers';
import type { NextResponse } from 'next/server';
import { relativeRedirect } from '@/lib/http/redirect';
import {
  consumeLoginToken,
  createAdminSession,
  createPendingSecondFactor,
  isTotpEnabled,
} from '@/lib/auth/admin';
import { audit } from '@/lib/audit/log';
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
    return deny(ip, 'no_token');
  }

  const result = await consumeLoginToken(token, ip);

  if (!result.ok) {
    return deny(ip, result.reason);
  }

  // Второй фактор включён — ссылка даёт только пропуск к странице кода
  if (isTotpEnabled()) {
    await createPendingSecondFactor();
    return relativeRedirect('/admin/2fa', 303, { 'Cache-Control': 'no-store' });
  }

  await createAdminSession();

  await recordSecurityEvent({
    kind: 'ANOMALY',
    severity: 'MEDIUM',
    ip,
    country: null,
    path: '/admin/enter',
    details: { event: 'ADMIN_LOGIN', outcome: 'success', factors: 'link' },
    count: 1,
  });
  await audit('session.login', null, { factors: 'link' });

  // 303: после входа браузер идёт в админку обычным GET
  return relativeRedirect('/admin', 303, { 'Cache-Control': 'no-store' });
}

async function deny(ip: string | null, reason: string): Promise<NextResponse> {
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

  return relativeRedirect('/admin/denied', 303, { 'Cache-Control': 'no-store' });
}
