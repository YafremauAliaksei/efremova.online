/**
 * 🍯 Honeypot — ловушки для сканеров уязвимостей.
 *
 * Идея (подробно в docs/03-security-policy.md, п.4):
 * живой человек никогда не откроет /wp-admin/ на сайте психолога и никогда не заполнит
 * невидимое поле формы. Кто это сделал — сканер. Значит, его можно банить ДО того,
 * как он найдёт настоящую уязвимость.
 *
 * Ценность подхода — нулевой процент ложных срабатываний: случайно попасть нельзя.
 */

export type TrapType = 'PATH' | 'FORM_FIELD' | 'ROBOTS_BAIT' | 'FAKE_API' | 'JS_BEACON' | 'TIMING';

export interface TrapHit {
  trapId: string;
  trapType: TrapType;
  scoreDelta: number;
  /** Задержка ответа в мс — тратим время сканера, замедляя перебор */
  delayMs: number;
}

/**
 * ТИП 1 — фальшивые пути.
 * Всё, что типичный сканер проверяет в первые 10 секунд.
 * Наш стек — Next.js, поэтому ничего из этого у нас не существует и существовать не может.
 */
const TRAP_PATHS: ReadonlyMap<string, number> = new Map([
  // Разведка WordPress (самая массовая автоматика в интернете)
  ['/wp-admin', 50],
  ['/wp-login.php', 50],
  ['/wp-content', 40],
  ['/wp-includes', 40],
  ['/xmlrpc.php', 60],

  // Поиск утёкших секретов — самая опасная категория, балл максимальный
  ['/.env', 100],
  ['/.env.local', 100],
  ['/.env.production', 100],
  ['/.git/config', 100],
  ['/.git/HEAD', 100],
  ['/.aws/credentials', 100],
  ['/.ssh/id_rsa', 100],
  ['/config.json', 70],
  ['/appsettings.json', 70],

  // Поиск панелей управления
  ['/phpmyadmin', 60],
  ['/adminer.php', 60],
  ['/admin.php', 50],
  ['/administrator', 50],
  ['/manager/html', 60], // Tomcat
  ['/solr/admin', 60],

  // Поиск бэкапов и дампов базы
  ['/backup.sql', 100],
  ['/dump.sql', 100],
  ['/database.sql', 100],
  ['/backup.zip', 90],
  ['/www.zip', 90],

  // Попытки найти отладочные интерфейсы
  ['/debug', 40],
  ['/actuator/env', 80], // Spring Boot
  ['/server-status', 60], // Apache
  ['/.well-known/security.txt.bak', 50],
]);

/**
 * ТИП 3 — приманка из robots.txt.
 * В robots.txt пишем `Disallow: /internal-admin-v2/`.
 * Честный краулер послушается. Сканер полезет именно туда — «запрещено, значит интересно».
 */
const ROBOTS_BAIT_PATHS: readonly string[] = [
  '/internal-admin-v2',
  '/private-backup-2024',
  '/staging-api',
];

/**
 * ТИП 4 — фальшивый API.
 * Выглядит как случайно открытая ручка экспорта пользователей.
 * Отдаём правдоподобные фейковые данные с email-«канарейками»: если такой адрес
 * когда-нибудь всплывёт в утечке или спаме — мы точно знаем дату и IP источника.
 */
const FAKE_API_PATHS: readonly string[] = [
  '/api/internal/users',
  '/api/v1/admin/export',
  '/api/debug/config',
  '/api/users/dump',
];

/**
 * ТИП 2 — невидимые поля форм.
 *
 * ⚠️ Важная деталь: прятать поле нужно CSS-классом со смещением за экран,
 * а НЕ через display:none — продвинутые боты пропускают скрытые display:none поля.
 * Имена подобраны так, чтобы автозаполнение бота на них клюнуло.
 */
export const HONEYPOT_FIELD_NAMES: readonly string[] = [
  'website_url',
  'company_name',
  'fax_number',
];

/** Быстрее этого человек форму не заполнит — значит, это бот (ТИП 5) */
export const MIN_FORM_FILL_MS = 1500;

/**
 * Белый список: настоящие поисковые боты не должны попадать под раздачу.
 * ⚠️ User-Agent легко подделать, поэтому это лишь первичный фильтр.
 * Окончательная проверка — обратный DNS-резолв (делается в фоновом обработчике,
 * а не здесь: в middleware нет времени на DNS-запрос).
 */
const LEGITIMATE_BOT_PATTERNS: readonly RegExp[] = [
  /Googlebot/i,
  /Bingbot/i,
  /DuckDuckBot/i,
  /YandexBot/i,
  /Applebot/i,
];

export function looksLikeLegitimateBot(userAgent: string): boolean {
  return LEGITIMATE_BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Главная проверка: попал ли запрос в ловушку.
 *
 * @returns TrapHit, если ловушка сработала; null — если это обычный запрос
 */
export function checkPathTrap(pathname: string): TrapHit | null {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '');

  for (const [trapPath, score] of TRAP_PATHS) {
    if (normalized === trapPath || normalized.startsWith(`${trapPath}/`)) {
      return {
        trapId: trapPath,
        trapType: 'PATH',
        scoreDelta: score,
        delayMs: randomDelay(2000, 5000),
      };
    }
  }

  for (const baitPath of ROBOTS_BAIT_PATHS) {
    if (normalized.startsWith(baitPath)) {
      return {
        trapId: baitPath,
        trapType: 'ROBOTS_BAIT',
        scoreDelta: 60,
        delayMs: randomDelay(2000, 5000),
      };
    }
  }

  for (const apiPath of FAKE_API_PATHS) {
    if (normalized.startsWith(apiPath)) {
      return {
        trapId: apiPath,
        trapType: 'FAKE_API',
        scoreDelta: 90,
        delayMs: randomDelay(1000, 3000),
      };
    }
  }

  return null;
}

/** Проверка невидимых полей формы (ТИП 2) — вызывается в обработчике submit */
export function checkFormTrap(formData: Record<string, unknown>): TrapHit | null {
  for (const fieldName of HONEYPOT_FIELD_NAMES) {
    const value = formData[fieldName];
    if (typeof value === 'string' && value.trim().length > 0) {
      return {
        trapId: `form:${fieldName}`,
        trapType: 'FORM_FIELD',
        scoreDelta: 80,
        delayMs: 0,
      };
    }
  }
  return null;
}

/** Проверка времени заполнения (ТИП 5) */
export function checkTimingTrap(renderedAtMs: number, submittedAtMs: number): TrapHit | null {
  const elapsed = submittedAtMs - renderedAtMs;
  if (elapsed >= 0 && elapsed < MIN_FORM_FILL_MS) {
    return {
      trapId: `timing:${String(elapsed)}ms`,
      trapType: 'TIMING',
      scoreDelta: 40,
      delayMs: 0,
    };
  }
  return null;
}

/**
 * Решение по накопленным баллам.
 * Пороговые значения настраиваются через переменные окружения — их можно
 * ужесточить или ослабить, не трогая код.
 */
export type EnforcementAction = 'OBSERVE' | 'CHALLENGE' | 'BLOCK';

export function decideAction(
  totalScore: number,
  challengeThreshold = 50,
  blockThreshold = 100
): EnforcementAction {
  if (totalScore >= blockThreshold) return 'BLOCK';
  if (totalScore >= challengeThreshold) return 'CHALLENGE';
  return 'OBSERVE';
}

/**
 * Правдоподобная «утечка» для фальшивого API.
 * Все адреса — канарейки на нашем домене: попадание такого адреса в спам-базу
 * однозначно указывает на дату и источник слива.
 */
export function buildCanaryPayload(trapId: string): Record<string, unknown> {
  const stamp = Date.now().toString(36);
  return {
    status: 'ok',
    total: 3,
    users: [
      { id: 1, email: `canary-${stamp}-a@efremova.online`, role: 'admin', active: true },
      { id: 2, email: `canary-${stamp}-b@efremova.online`, role: 'user', active: true },
      { id: 3, email: `canary-${stamp}-c@efremova.online`, role: 'user', active: false },
    ],
    _trap: trapId,
  };
}

/** Случайная задержка: замедляет сканер и мешает измерять время ответа */
function randomDelay(minMs: number, maxMs: number): number {
  const range = maxMs - minMs;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const value = bytes[0] ?? 0;
  return minMs + (value % (range + 1));
}
