#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  Ночной бэкап базы данных. Картинки тоже в базе — дамп покрывает всё.
#
#  Цепочка: дамп → сжатие → ШИФРОВАНИЕ → три места (docs/17):
#    1. том backups на этом сервере        — последние BACKUP_LOCAL_DAYS дней;
#    2. S3-совместимое хранилище другого    — последние BACKUP_RETENTION_DAYS;
#       поставщика (Cloudflare R2, B2)
#    3. офлайн-диск владельца дома          — сгружает он сам (docs/17).
#
#  Шифрование — age, публичным ключом. Приватного ключа на сервере НЕТ:
#  сервер умеет зашифровать, но не расшифровать — взлом сервера не
#  открывает ни один старый бэкап.
#
#  ⚠️ Скрипт работает в BusyBox (postgres:*-alpine): только POSIX sh и
#  BusyBox-версии date/find. Проверено на BusyBox 1.36.
# ═══════════════════════════════════════════════════════════════════════
set -eu
# Без pipefail статус конвейера — статус последней команды (age): оборванный
# pg_dump давал «успешный» бэкап из половины базы
set -o pipefail

fail() {
  echo "[$(date -u)] [ОШИБКА] $1"
  exit 1
}

# Пустая переменная set -u не ловит — проверяем сами, до дампа
[ -n "${BACKUP_AGE_PUBLIC_KEY:-}" ] || fail "BACKUP_AGE_PUBLIC_KEY не задан"
case "${BACKUP_AGE_PUBLIC_KEY}" in
  age1*) ;;
  *) fail "BACKUP_AGE_PUBLIC_KEY — не публичный ключ age (age1…)" ;;
esac
if [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -z "${BACKUP_S3_ENDPOINT:-}" ]; then
  # Без адреса aws-cli молча ушёл бы на AWS
  fail "BACKUP_S3_ENDPOINT не задан при заданном BACKUP_S3_BUCKET"
fi

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_NAME="efremova-${TIMESTAMP}.sql.gz.age"
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/backups}"
LOCAL_DAYS="${BACKUP_LOCAL_DAYS:-14}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
PART="${LOCAL_DIR}/.${BACKUP_NAME}.part"

# Любой выход с ошибкой — строка в журнале: по ней видно, что бэкапа за эту
# ночь нет (сторож сервера заметит это и по свежести отметки)
trap 'rc=$?; rm -f "${PART}"; [ "${rc}" -eq 0 ] || echo "[$(date -u)] [ОШИБКА] бэкап не сделан (код ${rc})"' EXIT

echo "[$(date -u)] Начало резервного копирования"

# 1. Дамп + сжатие + шифрование одним потоком.
#    Незашифрованная копия НИКОГДА не ложится на диск — только в памяти.
#    Пишем во временный файл: недописанный бэкап не выглядит готовым
pg_dump --format=plain --no-owner --no-acl \
  | gzip -9 \
  | age --recipient "${BACKUP_AGE_PUBLIC_KEY}" \
  > "${PART}"

SIZE="$(stat -c %s "${PART}")"
# Пустая база всё равно даёт дамп в несколько КБ — меньше значит сбой
[ "${SIZE}" -ge 1024 ] || fail "бэкап подозрительно мал (${SIZE} байт)"

mv "${PART}" "${LOCAL_DIR}/${BACKUP_NAME}"
# Контрольная сумма рядом: дома по ней видно, что файл скачался целым
(cd "${LOCAL_DIR}" && sha256sum "${BACKUP_NAME}" > "${BACKUP_NAME}.sha256")
echo "[$(date -u)] Дамп готов: ${BACKUP_NAME} (${SIZE} байт)"

# 2. Копия на сервере: старше LOCAL_DAYS дней — удаляется
find "${LOCAL_DIR}" -maxdepth 1 -name 'efremova-*' -mtime "+${LOCAL_DAYS}" -exec rm -f {} \;

# 3. Копия у другого поставщика (если настроена)
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  for file in "${BACKUP_NAME}" "${BACKUP_NAME}.sha256"; do
    aws s3 cp "${LOCAL_DIR}/${file}" "s3://${BACKUP_S3_BUCKET}/postgres/${file}" \
      --endpoint-url "${BACKUP_S3_ENDPOINT}" --only-show-errors
  done
  echo "[$(date -u)] Выгружено в ${BACKUP_S3_BUCKET}"

  # Граница через секунды epoch: BusyBox date не понимает «-30 days»,
  # и раньше скрипт падал здесь каждую ночь — старые копии не удалялись
  CUTOFF="$(date -u -d "@$(( $(date +%s) - RETENTION_DAYS * 86400 ))" +%Y%m%d)"
  aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --endpoint-url "${BACKUP_S3_ENDPOINT}" \
    | awk '{print $4}' \
    | while read -r file; do
        file_date="$(echo "${file}" | sed -n 's/^efremova-\([0-9]\{8\}\)-.*/\1/p')"
        if [ -n "${file_date}" ] && [ "${file_date}" -lt "${CUTOFF}" ]; then
          aws s3 rm "s3://${BACKUP_S3_BUCKET}/postgres/${file}" \
            --endpoint-url "${BACKUP_S3_ENDPOINT}" --only-show-errors
          echo "[$(date -u)] Удалена устаревшая копия: ${file}"
        fi
      done
else
  echo "[$(date -u)] ⚠️ BACKUP_S3_BUCKET не задан: копия только на этом сервере"
fi

# 4. Сигнал мониторингу «я жив». Не пришёл — придёт тревога: молча
#    сломавшийся бэкап обнаруживается в худший из возможных моментов
if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "${BACKUP_HEARTBEAT_URL}" > /dev/null || true
fi

# 5. Отметка для сторожа сервера (scripts/watchdog): время последнего
#    успешного прохода. Старше суток — сторож пишет владельцу сам
touch "${BACKUP_STATUS_DIR:-/status}/last-backup"

echo "[$(date -u)] Резервное копирование завершено успешно"
