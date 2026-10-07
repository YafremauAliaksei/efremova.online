import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { type AuditAction, entityTypeOf } from './actions';
import { type ChainCheck, hashEntry, verifyChain } from './chain';

/**
 * Журнал действий админки (PROJECT_LOG, задача 13).
 *
 * Действующее лицо одно — владелец, поэтому actorId постоянный. IP и
 * браузер сюда не пишутся: они уже есть в событиях безопасности при входе,
 * а журнал, который нельзя чистить, — не место для персональных данных.
 */

const ACTOR = 'owner';

/**
 * Номер блокировки Postgres для записи в журнал. Две записи одновременно
 * прочитали бы один и тот же «последний хеш» и раздвоили цепочку —
 * блокировка на время транзакции выстраивает их в очередь.
 */
const CHAIN_LOCK = 0x6a6f75726e616cn; // «journal» в hex

export async function audit(
  action: AuditAction,
  entityId: string | null = null,
  metadata: Record<string, Prisma.InputJsonValue> = {}
): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK})`;
    const last = await tx.auditLog.findFirst({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { rowHash: true, createdAt: true },
    });
    // Время строго растёт: по нему цепочка читается обратно в порядке записи.
    // Две записи в одну миллисекунду — вторая на миллисекунду позже
    const createdAt = new Date(Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1));
    const prevHash = last?.rowHash ?? null;
    const entry = {
      actorId: ACTOR,
      action,
      entityType: entityTypeOf(action),
      entityId,
      metadata,
      createdAt,
    };
    await tx.auditLog.create({
      data: { ...entry, prevHash, rowHash: hashEntry(entry, prevHash) },
    });
  });
}

export async function recentAudit(take: number) {
  return db.auditLog.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });
}

/** Проверка всей цепочки. Записей — единицы в день, читать всё дёшево */
export async function checkAuditChain(): Promise<ChainCheck> {
  const rows = await db.auditLog.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      prevHash: true,
      rowHash: true,
    },
  });
  return verifyChain(rows);
}
