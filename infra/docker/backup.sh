#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  Ночной бэкап базы данных.
#
#  Цепочка: дамп → сжатие → ШИФРОВАНИЕ → выгрузка в другую страну.
#  Шифрование обязательно: незашифрованный дамп в облаке — это та же
#  утечка медицинских данных, только добровольная.
#
#  Используется age — современная замена GPG: один публичный ключ,
#  никаких колец доверия и непонятных ошибок.
# ═══════════════════════════════════════════════════════════════════════
set -eu

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_NAME="efremova-${TIMESTAMP}.sql.gz.age"
TMP_DIR="/tmp/backup"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "${TMP_DIR}"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

echo "[$(date -u)] Начало резервного копирования"

# 1. Дамп + сжатие + шифрование одним потоком.
#    Незашифрованная копия НИКОГДА не ложится на диск — только в памяти.
pg_dump --format=plain --no-owner --no-acl \
  | gzip -9 \
  | age --recipient "${BACKUP_AGE_PUBLIC_KEY}" \
  > "${TMP_DIR}/${BACKUP_NAME}"

SIZE="$(stat -c %s "${TMP_DIR}/${BACKUP_NAME}")"
echo "[$(date -u)] Дамп готов: ${BACKUP_NAME} (${SIZE} байт)"

# Защита от «успешного» пустого бэкапа: файл меньше 1 КБ — это сбой
if [ "${SIZE}" -lt 1024 ]; then
  echo "[ОШИБКА] Бэкап подозрительно мал — вероятен сбой дампа"
  exit 1
fi

# 2. Выгрузка в хранилище (регион ЕС — данные не покидают юрисдикцию GDPR)
aws s3 cp "${TMP_DIR}/${BACKUP_NAME}" \
  "s3://${BACKUP_S3_BUCKET}/postgres/${BACKUP_NAME}" \
  --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  --storage-class STANDARD

echo "[$(date -u)] Выгружено в ${BACKUP_S3_BUCKET}"

# 3. Удаление старых копий (хранение по умолчанию — 30 дней)
CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y%m%d)"
aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "${BACKUP_S3_ENDPOINT}" \
  | awk '{print $4}' \
  | while read -r file; do
      file_date="$(echo "${file}" | sed -n 's/efremova-\([0-9]\{8\}\)-.*/\1/p')"
      if [ -n "${file_date}" ] && [ "${file_date}" -lt "${CUTOFF}" ]; then
        aws s3 rm "s3://${BACKUP_S3_BUCKET}/postgres/${file}" --endpoint-url "${BACKUP_S3_ENDPOINT}"
        echo "[$(date -u)] Удалена устаревшая копия: ${file}"
      fi
    done

# 4. Сигнал мониторингу «я жив».
#    Если сигнал не придёт — придёт алерт. Это важнее самого бэкапа:
#    молча сломавшийся бэкап обнаруживается в худший из возможных моментов.
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "${BACKUP_HEARTBEAT_URL}" || true
fi

echo "[$(date -u)] Резервное копирование завершено успешно"
