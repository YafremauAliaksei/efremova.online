/**
 * Заголовки безопасности и Content-Security-Policy.
 *
 * Это первый рубеж обороны внутри приложения (см. docs/03-security-policy.md, п.1).
 * Заголовки — это инструкции браузеру: «вот это делать можно, а вот это запрещено».
 * Их сила в том, что они работают даже если в коде приложения допущена ошибка.
 */

/**
 * Генерирует nonce — одноразовое случайное число для текущего запроса.
 *
 * Смысл: в CSP мы говорим браузеру «выполняй только те скрипты, у которых есть
 * вот этот nonce». Атакующий, сумевший вставить <script> в страницу, nonce не знает,
 * и браузер его скрипт просто не запустит. Это превращает XSS из катастрофы в ничто.
 *
 * Используется Web Crypto API (доступен в Edge Runtime, где работает middleware).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Собирает Content-Security-Policy.
 *
 * @param nonce      одноразовый код для этого запроса
 * @param isDev      в режиме разработки Next.js требует 'unsafe-eval' для hot reload
 *
 * ── НИ ОДНОГО ВНЕШНЕГО ДОМЕНА ─────────────────────────────────────────────
 *
 * Сайт самодостаточен: ни скриптов, ни шрифтов, ни картинок, ни кадров
 * с чужих серверов. Это не строгость ради строгости, а три выгоды сразу:
 *
 *   • приватность: браузер посетителя не обращается ни к кому, кроме нас,
 *     значит его IP не уходит третьим лицам и согласия на это не требуется;
 *   • безопасность: взлом чужого сервера не превращается во взлом нашего сайта —
 *     именно так ломают через рекламные сети и виджеты;
 *   • скорость: ни одного лишнего DNS-запроса и TLS-рукопожатия.
 *
 * Политика поэтому одна на весь сайт: у админки отличаются не источники,
 * а заголовки кэширования и индексации — см. getPrivateAreaHeaders().
 *
 * Раньше здесь были разрешены youtube-nocookie, player.vimeo и plausible.io.
 * Ни один из них не использовался ни строкой кода. Обложки роликов теперь
 * скачиваются к себе и отдаются со своего домена (docs/13-site-architecture.md).
 */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],

    // strict-dynamic: скрипт с правильным nonce может подгрузить свои зависимости.
    // Без него Next.js не сможет загрузить чанки приложения.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // ⚠️ Компромисс, который стоит понимать:
    // 'unsafe-inline' для стилей оставлен, потому что React и Tailwind вставляют
    // inline-стили (например, CSS-переменные для анимаций). Риск от inline-СТИЛЕЙ
    // на порядки ниже, чем от inline-СКРИПТОВ: украсть данные стилем крайне трудно.
    // Отраслевая практика допускает это. Убрать можно — ценой заметного усложнения.
    'style-src': ["'self'", "'unsafe-inline'"],

    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"], // шрифты только со своего домена (GDPR, docs/13 п.1.1)
    'connect-src': ["'self'"],
    'frame-src': ["'none'"], // ни одного кадра: ни чужого, ни своего

    'object-src': ["'none'"], // Flash/Java-плагины: только источник проблем
    'base-uri': ["'none'"], // запрет подмены <base href> — защита от угона относительных путей
    'form-action': ["'self'"], // форму нельзя отправить на чужой сервер
    'frame-ancestors': ["'none'"], // наш сайт нельзя встроить в iframe — защита от clickjacking
    'manifest-src': ["'self'"],
    'worker-src': ["'self'", 'blob:'],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');

  // upgrade-insecure-requests — браузер сам переписывает http:// на https://
  return `${policy}; upgrade-insecure-requests`;
}

/**
 * Заголовки, одинаковые для всех ответов.
 * Каждый закрывает конкретный класс атак.
 */
export function getBaseSecurityHeaders(): Record<string, string> {
  return {
    // Два года HTTPS-только. preload = попадание в список, вшитый в браузеры.
    // ⚠️ Включать ТОЛЬКО когда HTTPS точно работает: откатить нельзя быстро.
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',

    // Запрет «угадывания» типа файла. Без него загруженный .txt может быть выполнен как .js
    'X-Content-Type-Options': 'nosniff',

    // Дублирует frame-ancestors для старых браузеров
    'X-Frame-Options': 'DENY',

    // На чужой сайт уходит только домен, без пути.
    // Иначе referrer выдал бы /cabinet/appointment/12345 — это утечка.
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Явно отключаем всё, что нам не нужно. Если библиотека вдруг попросит
    // микрофон или геолокацию — браузер откажет.
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()',
      'interest-cohort=()', // отказ от FLoC-трекинга Google
    ].join(', '),

    // Изоляция вкладки — защита от атак вида Spectre и от window.opener
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',

    // Прячем, на чём работает сайт: меньше информации для подбора эксплойта
    'X-Powered-By': '',
    Server: '',
  };
}

/**
 * Дополнительные заголовки для личного кабинета.
 *
 * 🔒 ЖЁСТКОЕ ПРАВИЛО (CLAUDE.md, закрытая зона): ни один байт данных клиента
 * не должен осесть в кэше браузера, прокси или CDN.
 */
export function getPrivateAreaHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',

    // Кабинет не должен попасть в поисковую выдачу ни при каких обстоятельствах
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',

    // Полная изоляция процесса браузера для страниц с медицинскими данными
    'Cross-Origin-Embedder-Policy': 'require-corp',
  };
}
