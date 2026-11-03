/**
 * Вызовы middleware → внутренний обработчик того же процесса.
 *
 * Адрес — свой сервер напрямую, а не request.nextUrl.origin. За nginx
 * Next.js собирает nextUrl из своего HOSTNAME и X-Forwarded-Proto:
 * получается https://0.0.0.0:3000, а сервер внутри контейнера слушает
 * обычный http — запрос падал на TLS, и ни одно событие безопасности
 * не доходило до базы. В e2e (без nginx) этого не видно, поэтому адрес
 * не зависит от заголовков запроса вовсе.
 *
 * ⚠️ Работает в Edge Runtime: только Web API, без node:*.
 */

const INTERNAL_PREFIX = '/api/internal/';
const DEFAULT_PORT = '3000';

/** Адрес внутреннего обработчика на этом же сервере */
export function internalUrl(path: string, port: string | undefined): URL {
  // Секрет уходит в заголовке — значит, только на свои внутренние пути
  if (!path.startsWith(INTERNAL_PREFIX) || path.includes('..')) {
    throw new Error('Внутренний вызов разрешён только на /api/internal/*');
  }
  const safePort = port !== undefined && /^\d{1,5}$/.test(port) ? port : DEFAULT_PORT;
  return new URL(path, `http://127.0.0.1:${safePort}`);
}

/**
 * Сравнение секретов за постоянное время — в Edge Runtime, где нет
 * node:crypto.timingSafeEqual. Сравниваются хеши, поэтому длина секрета
 * по времени ответа тоже не угадывается.
 */
export async function secretsEqual(provided: string, expected: string): Promise<boolean> {
  if (provided.length === 0 || expected.length === 0) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

/**
 * Сбой внутреннего вызова — в журнал контейнера, но не чаще раза в минуту.
 *
 * Раньше сбой глотался молча, и потеря всех событий безопасности выглядела
 * как «атак нет». Ответ посетителю он по-прежнему не ломает, но в логах
 * его видно — и сторож сервера (мониторинг) может на него среагировать.
 */
export function createFailureReporter(
  log: (message: string) => void,
  now: () => number = Date.now
): (path: string, error: unknown) => void {
  let lastReportAt = Number.NEGATIVE_INFINITY;
  let suppressed = 0;
  return (path, error) => {
    const at = now();
    if (at - lastReportAt < 60_000) {
      suppressed += 1;
      return;
    }
    const reason = error instanceof Error ? error.message : String(error);
    const tail = suppressed > 0 ? ` (ещё ${String(suppressed)} с прошлого сообщения)` : '';
    log(`[security] внутренний вызов ${path} не прошёл: ${reason}${tail}`);
    lastReportAt = at;
    suppressed = 0;
  };
}
