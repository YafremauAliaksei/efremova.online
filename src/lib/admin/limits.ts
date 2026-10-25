/**
 * Потолки записи из админки (docs/03, п.3.1).
 *
 * ── ОТ ЧЕГО ЗАЩИЩАЕТ ──────────────────────────────────────────────────────
 * Каждое сохранение в админке оставляет след, который нельзя стереть: журнал
 * действий запрещает удаление на уровне базы, редакции правовых документов
 * не удаляются по закону, снимки блоков и картинки лежат в той же базе.
 * Тот, кто унёс cookie сессии, мог бы в цикле сохранять документ по 100 000
 * знаков и за ночь забить диск сервера — сайт ляжет, а чистить журнал нельзя.
 *
 * Предел на адрес в nginx (5 запросов в минуту на /admin) такой поток не
 * держит: у ботнета адресов сколько угодно. Поэтому предел здесь — на сессию,
 * по журналу действий в базе: он переживает перезапуск процесса, и сменой
 * адреса его не обойти. Новую сессию даёт только ссылка из терминала сервера
 * и код из телефона — тот, кто унёс cookie, второй сессии не получит.
 *
 * Превышение — не «подождите», а авария: все сессии отзываются, новый вход —
 * только новой ссылкой. Владелец столько изменений за одну сессию не делает;
 * делает скрипт.
 *
 * Считаются все действия с момента выпуска сессии, а не только её: если
 * cookie унесли, а владелец вошёл заново, старая сессия видит и действия
 * новой и упирается в предел раньше — авария закрывает обе.
 *
 * Файл без 'server-only' и без базы: чистые функции, их проверяют тесты.
 */

export const WRITE_LIMITS = {
  /**
   * Сессия живёт 30 минут. Перестановка десяти блоков стрелками — около
   * тридцати действий; 150 — с большим запасом на час работы над сайтом
   */
  perSession: 150,
} as const;

export const STORAGE_LIMITS = {
  /**
   * Вся база. Тексты сайта — мегабайты, картинки — до сотен мегабайт;
   * два гигабайта — это уже не правка сайта, а заполнение диска. Дальше
   * админка ничего не создаёт, пока владелец не разберётся.
   */
  databaseBytes: 2 * 1024 ** 3,
  /** Все варианты всех картинок, включая архив: из архива их можно вернуть */
  mediaBytes: 512 * 1024 ** 2,
  /** Новых картинок (загрузки и обложки роликов) за сутки */
  mediaPerDay: 40,
  /** Новых редакций одного документа на одном языке за сутки */
  legalPerDocPerDay: 20,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export type WriteVerdict = { ok: true } | { ok: false; reason: 'session' | 'full' };

export interface WriteUsage {
  /** Действий в журнале с момента выпуска текущей сессии */
  sinceSession: number;
  databaseBytes: number;
}

/**
 * Можно ли ещё одно действие. Проверка — до действия, поэтому «ровно
 * предел» уже отказ: после него записей стало бы больше предела.
 * Авария важнее переполнения: сначала предел сессии, потом размер базы.
 */
export function judgeWrite(
  usage: WriteUsage,
  limits: { perSession: number } = WRITE_LIMITS
): WriteVerdict {
  if (usage.sinceSession >= limits.perSession) return { ok: false, reason: 'session' };
  if (usage.databaseBytes >= STORAGE_LIMITS.databaseBytes) return { ok: false, reason: 'full' };
  return { ok: true };
}

export function dayAgo(now: Date): Date {
  return new Date(now.getTime() - DAY_MS);
}

/** Сколько дат не раньше from */
export function countSince(dates: readonly Date[], from: Date): number {
  return dates.filter((date) => date.getTime() >= from.getTime()).length;
}

export type MediaVerdict = { ok: true } | { ok: false; reason: 'quota' };

/** Можно ли сохранить ещё одну картинку из bytes байт */
export function judgeMedia(usage: {
  storedBytes: number;
  incomingBytes: number;
  lastDay: number;
}): MediaVerdict {
  if (usage.lastDay >= STORAGE_LIMITS.mediaPerDay) return { ok: false, reason: 'quota' };
  if (usage.storedBytes + usage.incomingBytes > STORAGE_LIMITS.mediaBytes) {
    return { ok: false, reason: 'quota' };
  }
  return { ok: true };
}

/**
 * Отметка отзыва сессий: следующая целая секунда.
 *
 * Время выпуска в JWT (iat) — целые секунды. Сессия, выпущенная за полсекунды
 * до отзыва, получила бы ту же секунду, что и отзыв, и пережила бы его.
 * Округление вверх закрывает это ценой одной секунды, в которую войти нельзя.
 */
export function revocationMark(now: Date): Date {
  return new Date(Math.floor(now.getTime() / 1000) * 1000 + 1000);
}

/** Сессия выпущена после последнего отзыва */
export function issuedAfterRevocation(issuedAtSeconds: number, validAfter: Date | null): boolean {
  return validAfter === null || issuedAtSeconds * 1000 >= validAfter.getTime();
}

/**
 * Отметка из хранилища настроек. Испорченная — как «отзыв сейчас», а не
 * «отзыва не было»: подменить её можно только правкой базы, и такая правка
 * не должна возвращать к жизни отозванные сессии
 */
export function parseRevocationMark(raw: string | undefined, now: Date): Date | null {
  if (raw === undefined) return null;
  const ms = Number(raw);
  return Number.isSafeInteger(ms) && ms > 0 ? new Date(ms) : revocationMark(now);
}
