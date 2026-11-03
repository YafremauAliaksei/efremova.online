/**
 * Каналы оповещений сторожа. Включён тот канал, для которого заданы
 * переменные в .env; можно все сразу — сообщение уйдёт в каждый.
 *
 * Безопасность:
 *  • сторож только ОТПРАВЛЯЕТ: бот Telegram не читает входящие, команд нет —
 *    атаковать через мессенджер нечего;
 *  • токены проверяются по формату до подстановки в адрес: значение из .env
 *    не может увести запрос на чужой хост;
 *  • в журнал попадает только имя канала и код ответа, никогда — токен;
 *  • в тексте сообщений нет данных посетителей (checks.mjs, formatAlert).
 */

const TIMEOUT_MS = 10_000;

/**
 * Какие каналы настроены. Неверно заданный канал не молчит — попадает в
 * список ошибок, и сторож сообщит о нём при запуске.
 *
 * @param {Record<string, string | undefined>} env
 */
export function configuredChannels(env) {
  /** @type {{ name: string, send: (text: string, f: typeof fetch) => Promise<void> }[]} */
  const channels = [];
  /** @type {string[]} */
  const problems = [];
  const set = (name) => (env[name] ?? '') !== '';

  if (set('ALERT_TELEGRAM_BOT_TOKEN') || set('ALERT_TELEGRAM_CHAT_ID')) {
    const token = env.ALERT_TELEGRAM_BOT_TOKEN ?? '';
    const chatId = env.ALERT_TELEGRAM_CHAT_ID ?? '';
    if (!/^\d{5,15}:[A-Za-z0-9_-]{30,64}$/.test(token) || !/^-?\d{1,20}$/.test(chatId)) {
      problems.push('telegram: неверный ALERT_TELEGRAM_BOT_TOKEN или ALERT_TELEGRAM_CHAT_ID');
    } else {
      channels.push({
        name: 'telegram',
        send: (text, f) =>
          post(f, 'telegram', `https://api.telegram.org/bot${token}/sendMessage`, {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
          }),
      });
    }
  }

  if (set('ALERT_NTFY_URL')) {
    const url = safeHttpsUrl(env.ALERT_NTFY_URL ?? '');
    if (url === null) problems.push('ntfy: ALERT_NTFY_URL должен быть https-адресом');
    else {
      channels.push({
        name: 'ntfy',
        send: (text, f) => post(f, 'ntfy', url, { body: text }),
      });
    }
  }

  if (set('ALERT_EMAIL_TO') || set('ALERT_RESEND_API_KEY')) {
    const to = env.ALERT_EMAIL_TO ?? '';
    const from = env.ALERT_EMAIL_FROM ?? '';
    const key = env.ALERT_RESEND_API_KEY ?? '';
    const email = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
    if (!email.test(to) || !email.test(from) || !/^re_[A-Za-z0-9_]{10,}$/.test(key)) {
      problems.push('email: нужны ALERT_EMAIL_TO, ALERT_EMAIL_FROM и ALERT_RESEND_API_KEY');
    } else {
      channels.push({
        name: 'email',
        send: (text, f) =>
          post(f, 'email', 'https://api.resend.com/emails', {
            headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
            body: JSON.stringify({
              from,
              to: [to],
              subject: text.split('\n', 2).join(' ').slice(0, 120),
              text,
            }),
          }),
      });
    }
  }

  return { channels, problems };
}

/**
 * Пульс во внешний сервис (Healthchecks.io и подобные): «сторож жив».
 * Если умрёт весь сервер, сторож ничего не пошлёт — а сервис пульса
 * заметит тишину и сам напишет владельцу.
 *
 * @param {string | undefined} value
 */
export function heartbeatUrl(value) {
  return value === undefined || value === '' ? null : safeHttpsUrl(value);
}

/** Отправить во все каналы; сбой одного не мешает остальным */
export async function sendAll(channels, text, f = fetch, log = console.error) {
  const results = await Promise.allSettled(channels.map((channel) => channel.send(text, f)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : 'ошибка';
      log(`[watchdog] канал ${channels[index]?.name ?? '?'} не принял сообщение: ${reason}`);
    }
  });
}

/** @param {string} value */
function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === ''
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/**
 * POST с таймаутом. Ошибка содержит имя канала и код ответа — но не адрес:
 * в адресе Telegram лежит токен бота.
 */
async function post(f, name, url, init) {
  const response = await f(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
  });
  if (!response.ok) throw new Error(`${name}: ответ ${String(response.status)}`);
}
