#!/bin/sh
# Точка входа контейнера бэкапов: ставит задачи в cron (бэкап, логи nginx)
# и становится crond — главным процессом контейнера.
set -eu

SCHEDULE="${BACKUP_SCHEDULE:-0 3 * * *}"
# Вывод задач — в stdout главного процесса: docker compose logs backup
# показывает каждый бэкап, а не файл внутри контейнера
OUT='>/proc/1/fd/1 2>/proc/1/fd/2'

echo "${SCHEDULE} /usr/local/bin/backup.sh ${OUT}" > /etc/crontabs/root
# Логи nginx — отдельной задачей: сбой бэкапа не должен задерживать их удаление
echo "5 0 * * * /usr/local/bin/rotate-logs.sh ${OUT}" >> /etc/crontabs/root

echo "[entrypoint] Расписание бэкапов: ${SCHEDULE}"

# exec: crond получает сигнал остановки сам (docker stop не ждёт 10 секунд
# до SIGKILL), а его падение завершает контейнер — и restart поднимает его
exec crond -f -l 8
