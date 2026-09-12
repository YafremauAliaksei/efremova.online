#!/bin/sh
# Точка входа контейнера бэкапов: ставит задачу в cron и ждёт.
set -eu

SCHEDULE="${BACKUP_SCHEDULE:-0 3 * * *}"

echo "${SCHEDULE} /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root

echo "[entrypoint] Расписание бэкапов: ${SCHEDULE}"

touch /var/log/backup.log
crond -f -l 8 &
tail -f /var/log/backup.log
