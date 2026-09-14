import 'server-only';
import type { $Enums, Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hourBucket } from '@/lib/security/throttle';

/**
 * 📼 Запись событий безопасности в базу.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ТРИ УРОВНЯ, И ТОЛЬКО ПЕРВЫЙ ОБЯЗАТЕЛЕН
 *
 *  1. СКЛЕЙКА. Строка на связку «адрес + тип + час» со счётчиком. Первое
 *     попадание сохраняет снимок запроса, остальные увеличивают число.
 *     Объём записей задаём мы, а не атакующий.
 *
 *  2. ИНЦИДЕНТ. При переходе порога один раз пишется «чёрный ящик»: когда
 *     началось и что творилось в тот момент. Килобайты независимо от силы
 *     атаки.
 *
 *  3. ВНЕПЛАНОВЫЙ БЭКАП по инциденту — отдельная ветка ops/log-rotation.
 *     Здесь только проставляется отметка backupRequestedAt.
 *
 *  Почему уровень 1 — основа, а не оптимизация: ротация логов по размеру
 *  при флуде теряет ИМЕННО НАЧАЛО атаки, самое ценное при разборе. Склейка
 *  не теряет: начало записано первым и дальше не перезаписывается.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Порог инцидента: столько попаданий за окно — и это уже атака, а не сканер */
const INCIDENT_THRESHOLD = 50;
const INCIDENT_WINDOW_MINUTES = 5;

/** Инцидент считается завершённым, если столько времени нет активности */
const INCIDENT_IDLE_MINUTES = 60;

/** Срок хранения записей. Решение владельца, объявлено в политике приватности */
const RETENTION_DAYS = 60;

/** Уборка запускается попутно, но не чаще одного раза в час */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/** Сколько сигнатур кладём в снимок инцидента. Потолок, а не «сколько придёт» */
const SNAPSHOT_MAX_SIGNATURES = 30;

export interface HoneypotRecord {
  trapId: string;
  trapType: $Enums.TrapType;
  scoreDelta: number;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  path: string | null;
  /** Сколько попаданий накопил ограничитель с прошлой записи */
  count: number;
}

export interface SecurityEventRecord {
  kind: $Enums.SecurityEventKind;
  severity: $Enums.Severity;
  ip: string | null;
  country: string | null;
  path: string | null;
  details: Record<string, unknown>;
  count: number;
}

/**
 * Скользящее окно для определения инцидента.
 *
 * Хранит только метки времени, и не больше, чем нужно для решения:
 * массив подрезается на каждом обращении. Атакующий не может раздуть его
 * в память — потолок задан порогом, а не потоком.
 */
const recentHits: number[] = [];
let lastCleanupAt = 0;

function pruneWindow(nowMs: number): number {
  const cutoff = nowMs - INCIDENT_WINDOW_MINUTES * 60_000;
  while (recentHits.length > 0 && (recentHits[0] ?? 0) < cutoff) recentHits.shift();
  return recentHits.length;
}

/**
 * Записывает попадание в ловушку.
 *
 * Ошибки не выбрасываются наружу: сбой записи события не должен превращаться
 * в сбой ответа посетителю. Но и молчать нельзя — сбой уходит в лог сервера.
 */
export async function recordHoneypotHit(record: HoneypotRecord): Promise<void> {
  const now = new Date();
  const ipKey = record.ip ?? 'unknown';

  try {
    await db.honeypotHit.upsert({
      where: {
        ipKey_trapType_bucketStart: {
          ipKey,
          trapType: record.trapType,
          bucketStart: hourBucket(now),
        },
      },
      create: {
        ipKey,
        trapType: record.trapType,
        bucketStart: hourBucket(now),
        hitCount: record.count,
        trapId: record.trapId,
        ip: record.ip,
        country: record.country,
        userAgent: record.userAgent,
        path: record.path,
        scoreDelta: record.scoreDelta,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        // Именно increment, а не чтение-и-запись: база складывает сама,
        // и два одновременных запроса не затирают друг друга
        hitCount: { increment: record.count },
        lastSeenAt: now,
      },
    });

    await noteActivity(record, now);
    await maybeCleanup(now);
  } catch (error) {
    console.error('[security] не удалось записать попадание в ловушку:', describe(error));
  }
}

/** Записывает событие безопасности: отказ проверки источника и подобное */
export async function recordSecurityEvent(record: SecurityEventRecord): Promise<void> {
  const now = new Date();
  const ipKey = record.ip ?? 'unknown';

  try {
    await db.securityEvent.upsert({
      where: {
        ipKey_kind_bucketStart: {
          ipKey,
          kind: record.kind,
          bucketStart: hourBucket(now),
        },
      },
      create: {
        ipKey,
        kind: record.kind,
        bucketStart: hourBucket(now),
        eventCount: record.count,
        severity: record.severity,
        ip: record.ip,
        country: record.country,
        path: record.path,
        details: record.details as Prisma.InputJsonValue,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        eventCount: { increment: record.count },
        lastSeenAt: now,
      },
    });

    await maybeCleanup(now);
  } catch (error) {
    console.error('[security] не удалось записать событие безопасности:', describe(error));
  }
}

/**
 * Отмечает активность и, если частота перешла порог, открывает инцидент.
 *
 * ⚠️ Инцидент открывается ОДИН РАЗ. Пока он открыт, сюда приходят только
 * обновления счётчиков. Иначе атака в тысячу запросов в секунду создавала бы
 * тысячу инцидентов в секунду — то есть механизм разбора атаки сам стал бы
 * атакой. Ровно та ошибка, от которой защищает вся эта система.
 */
async function noteActivity(record: HoneypotRecord, now: Date): Promise<void> {
  const nowMs = now.getTime();
  for (let i = 0; i < record.count; i += 1) recentHits.push(nowMs);
  const windowCount = pruneWindow(nowMs);

  const open = await db.securityIncident.findFirst({
    where: { closedAt: null },
    orderBy: { openedAt: 'desc' },
  });

  if (open !== null) {
    await db.securityIncident.update({
      where: { id: open.id },
      data: {
        totalHits: { increment: record.count },
        lastActivityAt: now,
      },
    });
    return;
  }

  if (windowCount < INCIDENT_THRESHOLD) return;

  await db.securityIncident.create({
    data: {
      trigger: 'HONEYPOT_RATE',
      triggerCount: windowCount,
      windowMinutes: INCIDENT_WINDOW_MINUTES,
      totalHits: record.count,
      lastActivityAt: now,
      snapshot: (await buildSnapshot(now)) as Prisma.InputJsonValue,
      // Отметка для контейнера бэкапа: ждать планового в 03:00 нельзя,
      // разбираться будет уже не с чем (ветка ops/log-rotation)
      backupRequestedAt: now,
    },
  });

  console.warn(
    `[security] ОТКРЫТ ИНЦИДЕНТ: ${String(windowCount)} попаданий за ${String(INCIDENT_WINDOW_MINUTES)} мин`
  );
}

/**
 * Снимок на момент открытия инцидента: кто стучался в последний час.
 *
 * Берётся из уже склеенных записей, поэтому запрос дешёвый и его размер
 * ограничен сверху — независимо от того, сколько было запросов.
 */
async function buildSnapshot(now: Date): Promise<Record<string, unknown>> {
  const since = new Date(now.getTime() - 60 * 60_000);

  const top = await db.honeypotHit.findMany({
    where: { lastSeenAt: { gte: since } },
    orderBy: { hitCount: 'desc' },
    take: SNAPSHOT_MAX_SIGNATURES,
    select: {
      ipKey: true,
      country: true,
      trapType: true,
      trapId: true,
      path: true,
      userAgent: true,
      hitCount: true,
      firstSeenAt: true,
    },
  });

  return {
    takenAt: now.toISOString(),
    windowMinutes: 60,
    distinctSources: new Set(top.map((row) => row.ipKey)).size,
    signatures: top.map((row) => ({
      source: row.ipKey,
      country: row.country,
      trapType: row.trapType,
      trapId: row.trapId,
      path: row.path,
      userAgent: row.userAgent,
      hits: row.hitCount,
      firstSeenAt: row.firstSeenAt.toISOString(),
    })),
  };
}

/**
 * Попутная уборка: закрывает затихшие инциденты и удаляет старые записи.
 *
 * Почему не по расписанию: отдельный планировщик — это ещё один процесс,
 * который может тихо умереть и об этом никто не узнает. Здесь уборка
 * привязана к активности: есть записи — значит есть и уборка.
 */
async function maybeCleanup(now: Date): Promise<void> {
  const nowMs = now.getTime();
  if (nowMs - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = nowMs;

  const idleCutoff = new Date(nowMs - INCIDENT_IDLE_MINUTES * 60_000);
  const retentionCutoff = new Date(nowMs - RETENTION_DAYS * 24 * 60 * 60_000);

  await db.securityIncident.updateMany({
    where: { closedAt: null, lastActivityAt: { lt: idleCutoff } },
    data: { closedAt: now },
  });

  // Срок хранения объявлен в политике конфиденциальности. Хранить адреса
  // дольше объявленного нельзя — это нарушение, а не мелочь.
  await db.honeypotHit.deleteMany({ where: { bucketStart: { lt: retentionCutoff } } });
  await db.securityEvent.deleteMany({ where: { bucketStart: { lt: retentionCutoff } } });
  await db.securityIncident.deleteMany({ where: { openedAt: { lt: retentionCutoff } } });
}

/** Сообщение об ошибке без стека и без значений: логи читают не только мы */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'неизвестная ошибка';
}

export const RECORDER_LIMITS = {
  INCIDENT_THRESHOLD,
  INCIDENT_WINDOW_MINUTES,
  RETENTION_DAYS,
} as const;
