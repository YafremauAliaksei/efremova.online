import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';
import { env, missingKeys, type ServerEnv } from '@/lib/env';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ДОСТУПНОСТЬ СПОСОБОВ ВХОДА
 *
 *  Задача (сформулирована владельцем):
 *  кнопка «Войти через Google» должна исчезать/гаснуть НЕ потому, что кто-то
 *  вручную выставил флажок «выключить», а потому, что система реально сходила
 *  к провайдеру и убедилась: учётные данные не работают.
 *
 *  Почему так правильно:
 *  ручной флажок рассинхронизируется с реальностью. Отозвали ключ в Google
 *  Cloud полгода спустя — флажок об этом не узнает, и клиент упрётся в
 *  страницу ошибки Google. Проверка «изнутри» узнаёт об этом за минуту.
 *
 *  Две ступени проверки:
 *    1. КОНФИГУРАЦИЯ — есть ли вообще нужные переменные окружения (мгновенно)
 *    2. ЖИВАЯ ПРОБА   — принимает ли провайдер наши ключи прямо сейчас (сеть)
 *
 *  🔒 ВАЖНО ДЛЯ ПРИВАТНОСТИ (ответ на вопрос про IP и шрифты):
 *  проба выполняется СЕРВЕРОМ. К Google/Apple/Telegram ходит наш сервер со
 *  своего IP. IP посетителя сайта не попадает к провайдеру до тех пор, пока
 *  человек сам не нажмёт кнопку входа. Это принципиальное отличие от
 *  Google Fonts, где браузер посетителя дёргает чужой домен без его ведома.
 *  Подробно: docs/08-auth-availability-and-privacy.md
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type AuthMethodId = 'google' | 'apple' | 'telegram' | 'whatsapp';

export type AuthAvailabilityState =
  /** Работает: провайдер принял наши учётные данные */
  | 'AVAILABLE'
  /** Переменные окружения не заданы — метод просто не подключали */
  | 'NOT_CONFIGURED'
  /** Переменные заданы, но провайдер их отверг: ключ отозван, удалён, истёк */
  | 'MISCONFIGURED'
  /** Не смогли проверить: сеть, таймаут, провайдер лежит */
  | 'PROVIDER_ERROR';

export interface AuthMethodStatus {
  id: AuthMethodId;
  label: string;
  /** Короткое описание для пользователя: как именно он войдёт */
  hint: string;
  state: AuthAvailabilityState;
  /** Человеческое объяснение. Видно всем — НИКОГДА не содержит секретов. */
  reason: string;
  /** Уходит ли IP пользователя третьей стороне при использовании метода */
  thirdPartyDataFlow: string;
  checkedAt: string;
}

export function isUsable(status: AuthMethodStatus): boolean {
  return status.state === 'AVAILABLE';
}

interface ProbeResult {
  state: AuthAvailabilityState;
  reason: string;
}

interface CacheEntry {
  result: ProbeResult;
  expiresAt: number;
}

/**
 * Кэш результатов проб в памяти процесса.
 *
 * Почему разный срок жизни для успеха и неудачи:
 *   • Всё хорошо  → проверяем редко (10 мин), не дёргаем провайдера зря.
 *   • Что-то сломалось → проверяем часто (1 мин), чтобы кнопка вернулась
 *     сразу после того, как проблему починили.
 */
const probeCache = new Map<AuthMethodId, CacheEntry>();

/** Сброс кэша — для тестов и для ручной кнопки «проверить сейчас» в админке */
export function invalidateAuthProbeCache(id?: AuthMethodId): void {
  if (id === undefined) probeCache.clear();
  else probeCache.delete(id);
}

interface MethodDefinition {
  id: AuthMethodId;
  label: string;
  hint: string;
  thirdPartyDataFlow: string;
  requiredEnv: readonly (keyof ServerEnv)[];
  probe: (config: ServerEnv, signal: AbortSignal) => Promise<ProbeResult>;
}

const METHODS: readonly MethodDefinition[] = [
  {
    id: 'google',
    label: 'Google',
    hint: 'Вход одним нажатием через аккаунт Google',
    thirdPartyDataFlow:
      'Google увидит ваш IP-адрес и факт входа на этот сайт. Данные о сессиях с психологом не передаются.',
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    probe: probeGoogle,
  },
  {
    id: 'apple',
    label: 'Apple',
    hint: 'Вход через Apple ID, можно скрыть настоящий e-mail',
    thirdPartyDataFlow:
      'Apple увидит ваш IP-адрес и факт входа. Функция «Скрыть e-mail» поддерживается.',
    requiredEnv: ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'],
    probe: probeApple,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    hint: 'Бот пришлёт одноразовый код из 6 цифр',
    thirdPartyDataFlow:
      'Telegram увидит факт отправки сообщения ботом. IP-адрес сайту вы не раскрываете сверх обычного.',
    requiredEnv: ['TELEGRAM_BOT_TOKEN'],
    probe: probeTelegram,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    hint: 'Одноразовый код придёт сообщением в WhatsApp',
    thirdPartyDataFlow: 'Meta увидит факт отправки сообщения на ваш номер.',
    requiredEnv: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
    probe: probeWhatsApp,
  },
];

/**
 * Статус всех способов входа.
 * Пробы идут параллельно: общее время ≈ время самой медленной, а не сумма.
 */
export async function getAuthMethodsStatus(): Promise<AuthMethodStatus[]> {
  const config = env();
  const now = new Date().toISOString();

  const results = await Promise.all(
    METHODS.map(async (method) => {
      const result = await resolveMethod(method, config);
      return {
        id: method.id,
        label: method.label,
        hint: method.hint,
        thirdPartyDataFlow: method.thirdPartyDataFlow,
        state: result.state,
        reason: result.reason,
        checkedAt: now,
      } satisfies AuthMethodStatus;
    })
  );

  return results;
}

export async function getAuthMethodStatus(id: AuthMethodId): Promise<AuthMethodStatus | null> {
  const all = await getAuthMethodsStatus();
  return all.find((status) => status.id === id) ?? null;
}

async function resolveMethod(method: MethodDefinition, config: ServerEnv): Promise<ProbeResult> {
  // ─── Ступень 1: конфигурация. Сеть не трогаем. ───
  const missing = missingKeys(method.requiredEnv);
  if (missing.length > 0) {
    return {
      state: 'NOT_CONFIGURED',
      // Имена переменных показывать безопасно и полезно: видно, чего не хватает.
      // Значения не показываются никогда.
      reason: `Метод не подключён: не заданы ${missing.join(', ')}`,
    };
  }

  // AUTH_SECRET нужен для подписи сессии — без него вход невозможен ни одним способом
  if (missingKeys(['AUTH_SECRET']).length > 0) {
    return {
      state: 'NOT_CONFIGURED',
      reason: 'Не задан AUTH_SECRET — подписывать сессии нечем',
    };
  }

  // ─── Ступень 2: живая проба ───
  const cached = probeCache.get(method.id);
  if (cached !== undefined && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, config.AUTH_PROBE_TIMEOUT_MS);

  let result: ProbeResult;
  try {
    result = await method.probe(config, controller.signal);
  } catch (error) {
    // Fail-closed: не смогли подтвердить работоспособность — кнопка гаснет.
    // Лучше честное «временно недоступно», чем кнопка, ведущая в ошибку провайдера.
    result = {
      state: 'PROVIDER_ERROR',
      reason:
        error instanceof Error && error.name === 'AbortError'
          ? 'Провайдер не ответил вовремя'
          : 'Не удалось связаться с провайдером',
    };
  } finally {
    clearTimeout(timeout);
  }

  probeCache.set(method.id, {
    result,
    expiresAt:
      Date.now() +
      (result.state === 'AVAILABLE' ? config.AUTH_PROBE_TTL_OK_MS : config.AUTH_PROBE_TTL_FAIL_MS),
  });

  return result;
}

/**
 * Google.
 *
 * Приём: отправляем запрос на обмен заведомо недействительного refresh-токена.
 * Ответ различает две принципиально разные ситуации:
 *   • invalid_grant  — «токен плохой, но КТО ТЫ я понял» → наши ключи приняты ✅
 *   • invalid_client — «я тебя не знаю» → ключ отозван или удалён ❌
 *
 * Ни одного пользователя проба не затрагивает, персональных данных не передаёт.
 */
async function probeGoogle(config: ServerEnv, signal: AbortSignal): Promise<ProbeResult> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID ?? '',
      client_secret: config.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: 'availability-probe-not-a-real-token',
    }),
    signal,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => ({}));
  const error = extractOAuthError(body);

  if (error === 'invalid_grant') {
    return { state: 'AVAILABLE', reason: 'Google принимает наши учётные данные' };
  }
  if (error === 'invalid_client' || error === 'unauthorized_client') {
    return {
      state: 'MISCONFIGURED',
      reason: 'Google отверг учётные данные: ключ отозван, удалён или неверен',
    };
  }
  if (response.status >= 500) {
    return { state: 'PROVIDER_ERROR', reason: 'На стороне Google сбой' };
  }
  return {
    state: 'PROVIDER_ERROR',
    reason: `Неожиданный ответ Google (${String(response.status)})`,
  };
}

/**
 * Apple.
 *
 * Сложнее остальных: «секрет клиента» у Apple — это JWT, который мы сами
 * подписываем приватным ключом. Проба проверяет обе части сразу:
 *   1. Ключ читается и им удаётся подписать JWT (иначе ключ битый/не тот формат)
 *   2. Apple принимает подпись (иначе ключ отозван или Team/Key ID не совпадают)
 */
async function probeApple(config: ServerEnv, signal: AbortSignal): Promise<ProbeResult> {
  let clientSecret: string;

  try {
    // В .env перевод строки хранится как \n — возвращаем настоящие переносы
    const pkcs8 = (config.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    const key = await importPKCS8(pkcs8, 'ES256');

    clientSecret = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: config.APPLE_KEY_ID ?? '' })
      .setIssuer(config.APPLE_TEAM_ID ?? '')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience('https://appleid.apple.com')
      .setSubject(config.APPLE_CLIENT_ID ?? '')
      .sign(key);
  } catch {
    return {
      state: 'MISCONFIGURED',
      reason: 'Приватный ключ Apple не читается или имеет неверный формат (нужен PKCS#8, ES256)',
    };
  }

  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.APPLE_CLIENT_ID ?? '',
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: 'availability-probe-not-a-real-code',
    }),
    signal,
    cache: 'no-store',
  });

  const body: unknown = await response.json().catch(() => ({}));
  const error = extractOAuthError(body);

  if (error === 'invalid_grant') {
    return { state: 'AVAILABLE', reason: 'Apple принимает нашу подпись' };
  }
  if (error === 'invalid_client') {
    return {
      state: 'MISCONFIGURED',
      reason: 'Apple отверг учётные данные: проверьте Team ID, Key ID и срок жизни ключа',
    };
  }
  if (response.status >= 500) {
    return { state: 'PROVIDER_ERROR', reason: 'На стороне Apple сбой' };
  }
  return {
    state: 'PROVIDER_ERROR',
    reason: `Неожиданный ответ Apple (${String(response.status)})`,
  };
}

/**
 * Telegram — самая прямая проба: getMe возвращает данные бота.
 * Токен отозвали в @BotFather → 401, и кнопка гаснет в течение минуты.
 */
async function probeTelegram(config: ServerEnv, signal: AbortSignal): Promise<ProbeResult> {
  const token = config.TELEGRAM_BOT_TOKEN ?? '';
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    method: 'GET',
    signal,
    cache: 'no-store',
  });

  if (response.status === 401) {
    return { state: 'MISCONFIGURED', reason: 'Токен бота отозван или неверен' };
  }
  if (!response.ok) {
    return {
      state: 'PROVIDER_ERROR',
      reason: `Telegram ответил ошибкой (${String(response.status)})`,
    };
  }

  const body: unknown = await response.json().catch(() => ({}));
  const ok = typeof body === 'object' && body !== null && (body as { ok?: unknown }).ok === true;

  return ok
    ? { state: 'AVAILABLE', reason: 'Бот отвечает' }
    : { state: 'MISCONFIGURED', reason: 'Telegram не подтвердил работоспособность бота' };
}

/** WhatsApp Business: запрашиваем сам номер. 401/403 = токен истёк или отозван. */
async function probeWhatsApp(config: ServerEnv, signal: AbortSignal): Promise<ProbeResult> {
  const phoneId = config.WHATSAPP_PHONE_NUMBER_ID ?? '';
  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=id`, {
    headers: { authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN ?? ''}` },
    signal,
    cache: 'no-store',
  });

  if (response.ok) {
    return { state: 'AVAILABLE', reason: 'Номер WhatsApp Business доступен' };
  }
  if (response.status === 401 || response.status === 403) {
    return { state: 'MISCONFIGURED', reason: 'Токен доступа WhatsApp истёк или отозван' };
  }
  return {
    state: 'PROVIDER_ERROR',
    reason: `WhatsApp ответил ошибкой (${String(response.status)})`,
  };
}

/** Достаёт поле error из ответа OAuth-провайдера, не доверяя его форме */
function extractOAuthError(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const error = (body as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}
