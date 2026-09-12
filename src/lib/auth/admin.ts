import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Вход в админку.
 *
 * ── МОДЕЛЬ УГРОЗ ──────────────────────────────────────────────────────────
 * Админка открывает доступ ко всем текстам, ценам и правовым документам,
 * а в будущем — к данным клиентов. Поэтому здесь всё строже, чем в кабинете:
 *
 *   • Пароля нет вообще. Вход по одноразовой ссылке, которую можно выписать
 *     ТОЛЬКО из терминала сервера (npm run admin:link). Значит, для входа
 *     нужен доступ к серверу — это и есть проверка личности.
 *   • Токен в базе не хранится, только SHA-256 от него: дамп базы входа не даёт.
 *   • Ссылка живёт 15 минут и срабатывает один раз.
 *   • Сессия — 30 минут (у клиента 15 минут + продление; здесь продления нет:
 *     администратор заходит редко и ненадолго).
 *   • Cookie с префиксом __Host-: браузер не отдаст её поддомену и разрешит
 *     только по HTTPS. Украсть через соседний поддомен невозможно.
 *
 * ⚠️ До выхода в прод сюда добавляется второй фактор (PROJECT_LOG, шаг A.7).
 * Одной ссылки для боевой админки мало.
 */

const ADMIN_COOKIE = '__Host-admin-session';
const TOKEN_TTL_MINUTES = 15;
const SESSION_TTL_MINUTES = 30;

function secretKey(): Uint8Array {
  const secret = env().AUTH_SECRET;
  // eslint-disable-next-line security/detect-possible-timing-attacks -- это проверка на отсутствие значения, а не сравнение секретов
  if (secret === undefined) {
    throw new Error('AUTH_SECRET не задан — подписывать сессию администратора нечем');
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Выписывает одноразовый токен. Вызывается только из скрипта в терминале.
 * Возвращает сам токен — в базу уходит только его хеш.
 */
export async function issueLoginToken(
  issuedBy = 'cli'
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000);

  await db.adminLoginToken.create({
    data: { tokenHash: hashToken(token), issuedBy, expiresAt },
  });

  // Старые токены не копим: просроченные удаляются при каждой выдаче
  await db.adminLoginToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  return { token, expiresAt };
}

export type TokenCheck = { ok: true } | { ok: false; reason: string };

/**
 * Проверяет и «сжигает» токен.
 *
 * Порядок важен: сначала атомарно помечаем использованным, потом проверяем
 * результат. Если два запроса придут одновременно, сработает только один —
 * повторное использование ссылки невозможно даже в гонке.
 */
export async function consumeLoginToken(token: string, ip: string | null): Promise<TokenCheck> {
  const record = await db.adminLoginToken.findUnique({ where: { tokenHash: hashToken(token) } });

  if (record === null) return { ok: false, reason: 'Ссылка недействительна' };
  if (record.usedAt !== null) return { ok: false, reason: 'Ссылка уже была использована' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'Срок действия ссылки истёк' };

  const burned = await db.adminLoginToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date(), usedIp: ip },
  });

  if (burned.count === 0) return { ok: false, reason: 'Ссылка уже была использована' };

  return { ok: true };
}

/** Создаёт сессию администратора и кладёт её в cookie */
export async function createAdminSession(): Promise<void> {
  const token = await new SignJWT({ role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${String(SESSION_TTL_MINUTES)}m`)
    .setSubject('admin')
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(adminCookieName(), token, {
    httpOnly: true,
    // Префикс __Host- требует secure=true и работает только по HTTPS.
    // Локально сайт открывается по http, поэтому там и имя, и флаг другие.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MINUTES * 60,
  });
}

/** В разработке по http браузер отвергает __Host-, поэтому имя зависит от среды */
export function adminCookieName(): string {
  return process.env.NODE_ENV === 'production' ? ADMIN_COOKIE : 'admin-session';
}

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(adminCookieName())?.value;
  // eslint-disable-next-line security/detect-possible-timing-attacks -- проверяется наличие cookie; подпись сверяет jwtVerify в постоянном времени
  if (token === undefined) return false;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === 'ADMIN';
  } catch {
    // Подпись не сошлась или срок истёк — это не ошибка, а обычный отказ
    return false;
  }
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(adminCookieName());
}
