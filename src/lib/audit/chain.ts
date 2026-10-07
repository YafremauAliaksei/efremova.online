import { createHash } from 'node:crypto';

/**
 * Цепочка журнала действий: каждая запись хранит хеш предыдущей.
 *
 * Зачем: таблицу audit_logs база не даёт ни править, ни чистить (триггер
 * в миграции). Но тот, кто получил права владельца базы, триггер снимет.
 * Цепочка делает такую правку заметной: изменённая, удалённая или
 * вставленная в середину запись перестаёт сходиться с соседями.
 *
 * Честная граница: злоумышленник с полным доступом к базе может
 * пересчитать всю цепочку заново. От этого защищает только внешняя
 * копия последнего хеша — поэтому журнал показывает его владельцу.
 */

export interface AuditFields {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}

export interface AuditRow extends AuditFields {
  id: string;
  prevHash: string | null;
  rowHash: string;
}

/**
 * JSON с ключами по алфавиту. jsonb в Postgres хранит ключи в своём
 * порядке, а не в порядке записи: без сортировки хеш прочитанной записи
 * не совпал бы с хешем записанной.
 */
export function canonicalJson(value: unknown): string {
  // Как JSON.stringify внутри массива: undefined превращается в null
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
}

export function hashEntry(entry: AuditFields, prevHash: string | null): string {
  const payload = canonicalJson({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
    prevHash,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export type ChainCheck =
  | { ok: true; count: number; lastHash: string | null }
  | { ok: false; count: number; brokenAt: string };

/** Строки — в порядке записи, от первой к последней */
export function verifyChain(rows: readonly AuditRow[]): ChainCheck {
  let prev: string | null = null;
  for (const row of rows) {
    if (row.prevHash !== prev || row.rowHash !== hashEntry(row, prev)) {
      return { ok: false, count: rows.length, brokenAt: row.id };
    }
    prev = row.rowHash;
  }
  return { ok: true, count: rows.length, lastHash: prev };
}
