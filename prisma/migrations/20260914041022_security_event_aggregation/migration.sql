-- ═══════════════════════════════════════════════════════════════════════════
--  Склейка записей безопасности + журнал инцидентов
--
--  Написана руками, а не сгенерирована: автоматическая версия отказалась
--  добавлять обязательные колонки к таблице с данными и предложила стереть
--  их. Стирать журнал безопасности ради удобства миграции нельзя, поэтому
--  ниже существующие записи ПЕРЕНОСЯТСЯ в новую форму.
--
--  Порядок важен: сначала добавляем колонки пустыми, потом заполняем,
--  потом схлопываем то, что после склейки стало бы дубликатами, и только
--  затем включаем ограничения. Обратный порядок упал бы на первой же строке.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────── ПОПАДАНИЯ В ЛОВУШКИ ───────────────────────

ALTER TABLE "honeypot_hits"
  ADD COLUMN "ipKey"       TEXT,
  ADD COLUMN "bucketStart" TIMESTAMPTZ,
  ADD COLUMN "hitCount"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "path"        TEXT,
  ADD COLUMN "firstSeenAt" TIMESTAMPTZ,
  ADD COLUMN "lastSeenAt"  TIMESTAMPTZ;

-- host() отбрасывает маску подсети: нужен именно адрес как строка.
-- 'unknown' вместо NULL — потому что в уникальном индексе PostgreSQL
-- считает два NULL разными значениями, и склейка перестала бы работать.
UPDATE "honeypot_hits" SET
  "ipKey"       = COALESCE(host("ip"), 'unknown'),
  "bucketStart" = date_trunc('hour', "createdAt"),
  "firstSeenAt" = "createdAt",
  "lastSeenAt"  = "createdAt";

-- Складываем счётчики у строк, которые после склейки становятся одной
UPDATE "honeypot_hits" h SET
  "hitCount"    = g.total,
  "firstSeenAt" = g.first_seen,
  "lastSeenAt"  = g.last_seen
FROM (
  SELECT (array_agg("id" ORDER BY "createdAt"))[1] AS keep_id,
         count(*)::int AS total,
         min("createdAt") AS first_seen,
         max("createdAt") AS last_seen
  FROM "honeypot_hits"
  GROUP BY "ipKey", "trapType", "bucketStart"
) g
WHERE h."id" = g.keep_id;

-- Ссылки на строки, которые сейчас исчезнут, обнуляем: иначе внешний ключ
-- не даст их удалить, и миграция упадёт на проде, а не здесь
UPDATE "security_events" SET "honeypotHitId" = NULL
WHERE "honeypotHitId" IS NOT NULL
  AND "honeypotHitId" NOT IN (
    SELECT (array_agg("id" ORDER BY "createdAt"))[1]
    FROM "honeypot_hits" GROUP BY "ipKey", "trapType", "bucketStart"
  );

DELETE FROM "honeypot_hits"
WHERE "id" NOT IN (
  SELECT (array_agg("id" ORDER BY "createdAt"))[1]
  FROM "honeypot_hits" GROUP BY "ipKey", "trapType", "bucketStart"
);

ALTER TABLE "honeypot_hits"
  ALTER COLUMN "ipKey"       SET NOT NULL,
  ALTER COLUMN "bucketStart" SET NOT NULL,
  ALTER COLUMN "firstSeenAt" SET NOT NULL,
  ALTER COLUMN "lastSeenAt"  SET NOT NULL,
  ALTER COLUMN "firstSeenAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "lastSeenAt"  SET DEFAULT CURRENT_TIMESTAMP,
  DROP COLUMN "createdAt";

DROP INDEX IF EXISTS "honeypot_hits_ip_createdAt_idx";
DROP INDEX IF EXISTS "honeypot_hits_trapType_createdAt_idx";

CREATE UNIQUE INDEX "honeypot_hits_ipKey_trapType_bucketStart_key"
  ON "honeypot_hits" ("ipKey", "trapType", "bucketStart");
CREATE INDEX "honeypot_hits_bucketStart_idx" ON "honeypot_hits" ("bucketStart");
CREATE INDEX "honeypot_hits_ipKey_bucketStart_idx" ON "honeypot_hits" ("ipKey", "bucketStart");

-- ─────────────────────── СОБЫТИЯ БЕЗОПАСНОСТИ ───────────────────────

ALTER TABLE "security_events"
  ADD COLUMN "ipKey"       TEXT,
  ADD COLUMN "bucketStart" TIMESTAMPTZ,
  ADD COLUMN "eventCount"  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "firstSeenAt" TIMESTAMPTZ,
  ADD COLUMN "lastSeenAt"  TIMESTAMPTZ;

UPDATE "security_events" SET
  "ipKey"       = COALESCE(host("ip"), 'unknown'),
  "bucketStart" = date_trunc('hour', "createdAt"),
  "firstSeenAt" = "createdAt",
  "lastSeenAt"  = "createdAt";

UPDATE "security_events" e SET
  "eventCount"  = g.total,
  "firstSeenAt" = g.first_seen,
  "lastSeenAt"  = g.last_seen
FROM (
  SELECT (array_agg("id" ORDER BY "createdAt"))[1] AS keep_id,
         count(*)::int AS total,
         min("createdAt") AS first_seen,
         max("createdAt") AS last_seen
  FROM "security_events"
  GROUP BY "ipKey", "kind", "bucketStart"
) g
WHERE e."id" = g.keep_id;

DELETE FROM "security_events"
WHERE "id" NOT IN (
  SELECT (array_agg("id" ORDER BY "createdAt"))[1]
  FROM "security_events" GROUP BY "ipKey", "kind", "bucketStart"
);

ALTER TABLE "security_events"
  ALTER COLUMN "ipKey"       SET NOT NULL,
  ALTER COLUMN "bucketStart" SET NOT NULL,
  ALTER COLUMN "firstSeenAt" SET NOT NULL,
  ALTER COLUMN "lastSeenAt"  SET NOT NULL,
  ALTER COLUMN "firstSeenAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "lastSeenAt"  SET DEFAULT CURRENT_TIMESTAMP,
  DROP COLUMN "createdAt";

DROP INDEX IF EXISTS "security_events_ip_createdAt_idx";
DROP INDEX IF EXISTS "security_events_kind_severity_createdAt_idx";

CREATE UNIQUE INDEX "security_events_ipKey_kind_bucketStart_key"
  ON "security_events" ("ipKey", "kind", "bucketStart");
CREATE INDEX "security_events_bucketStart_idx" ON "security_events" ("bucketStart");
CREATE INDEX "security_events_kind_severity_bucketStart_idx"
  ON "security_events" ("kind", "severity", "bucketStart");

-- ─────────────────────── ИНЦИДЕНТЫ ───────────────────────

CREATE TABLE "security_incidents" (
  "id"                UUID         NOT NULL,
  "openedAt"          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"          TIMESTAMPTZ,
  "trigger"           TEXT         NOT NULL,
  "triggerCount"      INTEGER      NOT NULL,
  "windowMinutes"     INTEGER      NOT NULL,
  "snapshot"          JSONB        NOT NULL DEFAULT '{}',
  "totalHits"         INTEGER      NOT NULL DEFAULT 0,
  "droppedHits"       INTEGER      NOT NULL DEFAULT 0,
  "lastActivityAt"    TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "backupRequestedAt" TIMESTAMPTZ,

  CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_incidents_openedAt_idx" ON "security_incidents" ("openedAt");
CREATE INDEX "security_incidents_closedAt_lastActivityAt_idx"
  ON "security_incidents" ("closedAt", "lastActivityAt");
