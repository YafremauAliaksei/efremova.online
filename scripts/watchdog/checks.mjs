/**
 * Сторож сервера: проверки и решение «кому и что сообщить».
 *
 * Здесь только чистые функции — без сети, файлов и часов, поэтому всё
 * покрыто тестами (checks.test.mjs). Сеть и файлы — в watchdog.mjs.
 *
 * Сторож работает на уровне сервера, а не сайта: о падении, нехватке диска
 * или памяти, несвежем бэкапе владелец узнаёт сам, не заходя в админку.
 */

/** Повтор напоминания, пока сбой не прошёл */
export const REMIND_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Пороги из окружения с безопасными умолчаниями.
 * Испорченное значение не выключает проверку — берётся умолчание.
 *
 * @param {Record<string, string | undefined>} env
 */
export function readThresholds(env) {
  const number = (value, fallback, min, max) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
  };
  return {
    diskPercent: number(env.WATCHDOG_DISK_PERCENT, 85, 1, 99),
    memoryPercent: number(env.WATCHDOG_MEMORY_PERCENT, 90, 1, 99),
    // Нагрузка за 5 минут на одно ядро: больше 2 — очередь процессов растёт
    loadPerCpu: number(env.WATCHDOG_LOAD_PER_CPU, 2, 0.5, 64),
    slowMs: number(env.WATCHDOG_SLOW_MS, 5000, 100, 60_000),
    backupMaxHours: number(env.WATCHDOG_BACKUP_MAX_HOURS, 26, 1, 24 * 14),
    summaryHourUtc: number(env.WATCHDOG_SUMMARY_HOUR_UTC, 7, 0, 23),
  };
}

/**
 * Память хоста из /proc/meminfo (в контейнере файл показывает хост).
 * @param {string} text
 * @returns {number | null} занято, %
 */
export function memoryUsedPercent(text) {
  const read = (pattern) => {
    const match = pattern.exec(text);
    return match === null ? null : Number(match[1]);
  };
  const total = read(/^MemTotal:\s+(\d+)\s+kB$/m);
  const available = read(/^MemAvailable:\s+(\d+)\s+kB$/m);
  if (total === null || available === null || total === 0) return null;
  return Math.round(((total - available) / total) * 100);
}

/**
 * Нагрузка за 5 минут из /proc/loadavg.
 * @param {string} text
 * @returns {number | null}
 */
export function loadAverage5(text) {
  const value = Number(text.trim().split(/\s+/)[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Занятость диска по результату fs.statfs.
 * @param {{ blocks: number, bavail: number }} stats
 * @returns {number | null} занято, %
 */
export function diskUsedPercent(stats) {
  if (!(stats.blocks > 0)) return null;
  return Math.round(((stats.blocks - stats.bavail) / stats.blocks) * 100);
}

/**
 * Итог одной проверки адреса.
 * @param {string} id
 * @param {string} label
 * @param {{ status: number, ms: number, challenged: boolean } | { error: string }} result
 * @param {number} slowMs
 */
export function judgeHttp(id, label, result, slowMs) {
  if ('error' in result) return { id, ok: false, text: `${label}: нет ответа (${result.error})` };
  // Cloudflare проверяет запрос сторожа как бота — сайт при этом жив
  if (result.challenged) return { id, ok: true, text: `${label}: отвечает (проверка Cloudflare)` };
  if (result.status < 200 || result.status >= 300) {
    return { id, ok: false, text: `${label}: ответ ${String(result.status)}` };
  }
  if (result.ms > slowMs) {
    return { id, ok: false, text: `${label}: медленно, ${String(result.ms)} мс` };
  }
  return { id, ok: true, text: `${label}: ок, ${String(result.ms)} мс` };
}

/**
 * Итог проверки числа с порогом.
 * @param {string} id
 * @param {string} label
 * @param {number | null} value
 * @param {number} limit
 * @param {string} unit
 */
export function judgeLimit(id, label, value, limit, unit) {
  if (value === null) return { id, ok: false, text: `${label}: не удалось измерить` };
  const shown = `${String(value)}${unit}`;
  return value > limit
    ? { id, ok: false, text: `${label}: ${shown} (порог ${String(limit)}${unit})` }
    : { id, ok: true, text: `${label}: ${shown}` };
}

/**
 * Свежесть бэкапа по отметке времени последнего успешного.
 * @param {number | null} lastBackupMs
 * @param {number} nowMs
 * @param {number} maxHours
 */
export function judgeBackup(lastBackupMs, nowMs, maxHours) {
  if (lastBackupMs === null) {
    return { id: 'backup', ok: false, text: 'Бэкап: ни одного успешного' };
  }
  const hours = Math.floor((nowMs - lastBackupMs) / 3_600_000);
  return hours > maxHours
    ? { id: 'backup', ok: false, text: `Бэкап: последний ${String(hours)} ч назад` }
    : { id: 'backup', ok: true, text: `Бэкап: ${String(hours)} ч назад` };
}

/**
 * Что сообщить по итогам круга проверок.
 *
 * Сообщение — только при смене состояния (сбой / восстановление) и
 * напоминание раз в REMIND_EVERY_MS, пока сбой держится: иначе владелец
 * получал бы сообщение каждую минуту и перестал бы их читать.
 *
 * @param {Record<string, { ok: boolean, since: number, notifiedAt: number }>} previous
 * @param {{ id: string, ok: boolean, text: string }[]} results
 * @param {number} now
 */
export function decide(previous, results, now) {
  /** @type {Record<string, { ok: boolean, since: number, notifiedAt: number }>} */
  const next = {};
  /** @type {string[]} */
  const failed = [];
  /** @type {string[]} */
  const recovered = [];
  /** @type {string[]} */
  const reminders = [];

  for (const result of results) {
    const before = previous[result.id];
    if (before === undefined || before.ok !== result.ok) {
      next[result.id] = { ok: result.ok, since: now, notifiedAt: now };
      // Первый круг после запуска: о «всё хорошо» не сообщаем
      if (!result.ok) failed.push(result.text);
      else if (before !== undefined) recovered.push(result.text);
      continue;
    }
    if (!result.ok && now - before.notifiedAt >= REMIND_EVERY_MS) {
      reminders.push(result.text);
      next[result.id] = { ...before, notifiedAt: now };
      continue;
    }
    next[result.id] = before;
  }

  return { state: next, failed, recovered, reminders };
}

/**
 * Текст сообщения. Без IP, адресов посетителей и секретов — только
 * состояние сервера: такой текст можно отправить в любой мессенджер.
 *
 * @param {string} server
 * @param {{ failed: string[], recovered: string[], reminders: string[] }} decision
 */
export function formatAlert(server, decision) {
  const parts = [];
  if (decision.failed.length > 0) parts.push(`🔴 Сбой:\n${decision.failed.join('\n')}`);
  if (decision.reminders.length > 0)
    parts.push(`🟠 Всё ещё сбой:\n${decision.reminders.join('\n')}`);
  if (decision.recovered.length > 0)
    parts.push(`🟢 Восстановлено:\n${decision.recovered.join('\n')}`);
  return parts.length === 0 ? null : `[${server}]\n${parts.join('\n\n')}`;
}

/**
 * Пора ли ежедневной сводки: раз в сутки, в заданный час UTC.
 * @param {number | undefined} lastSummaryMs
 * @param {number} now
 * @param {number} hourUtc
 */
export function summaryDue(lastSummaryMs, now, hourUtc) {
  const date = new Date(now);
  if (date.getUTCHours() !== hourUtc) return false;
  if (lastSummaryMs === undefined) return true;
  return new Date(lastSummaryMs).toISOString().slice(0, 10) !== date.toISOString().slice(0, 10);
}
