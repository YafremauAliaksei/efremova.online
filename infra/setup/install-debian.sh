#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  Подготовка сервера сайта: ноутбук или VPS с Debian 12/13.
#
#  Поставили чистый Debian → склонировали репозиторий → запустили:
#
#      sudo bash infra/setup/install-debian.sh
#
#  Скрипт можно запускать повторно: каждый шаг проверяет, сделан ли он.
#  Что делает и почему — в docs/15, п.0. После него — .env и
#  `docker compose up -d --build` (docs/15, п.5).
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

say() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
die() {
  printf '\n\033[31m✖ %s\033[0m\n' "$1" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || die "Запускать от root: sudo bash $0"
# shellcheck source=/dev/null
. /etc/os-release
[ "${ID:-}" = debian ] || die "Скрипт для Debian; здесь ${PRETTY_NAME:-неизвестная система}"

say "1/6 Пакеты системы и автообновления безопасности"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw unattended-upgrades >/dev/null
# Только обновления безопасности, без перезагрузки посреди дня: ядро
# применится при следующей перезагрузке, а сайт тем временем работает
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

say "2/6 Docker из официального репозитория"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
fi
# Контейнеры с restart: unless-stopped поднимутся сами после перезагрузки —
# если сам Docker стартует при загрузке
systemctl enable --now docker >/dev/null

say "3/6 Firewall: входящие — закрыты"
# Сайту входящие не нужны вовсе: туннель Cloudflare соединяется наружу сам.
# Портов наружу compose не публикует — Docker в обход ufw ничего не откроет
ufw --force default deny incoming >/dev/null
ufw --force default allow outgoing >/dev/null
if [ -x /usr/sbin/sshd ]; then
  # SSH — только из домашней/локальной сети; на VPS заменить на свой адрес
  for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
    ufw allow from "${net}" to any port 22 proto tcp >/dev/null
  done
fi
ufw --force enable >/dev/null

say "4/6 Ноутбук не засыпает (крышка, простой)"
install -d /etc/systemd/logind.conf.d
cat >/etc/systemd/logind.conf.d/efremova-server.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
IdleAction=ignore
EOF
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target >/dev/null 2>&1
# Применится при следующем входе; перезапуск logind оборвал бы сеанс сейчас

say "5/6 Точное время"
# Подписи сессий, TOTP и отметки бэкапов зависят от часов
timedatectl set-ntp true || true

say "6/6 Права на .env"
if [ -f "${REPO_DIR}/.env" ]; then
  chmod 600 "${REPO_DIR}/.env"
  echo "  .env: только владелец файла"
else
  echo "  .env ещё нет: cp .env.example .env, заполнить (docs/15), затем chmod 600 .env"
fi

say "Готово"
cat <<EOF
  Дальше (docs/15):
    1. Заполнить ${REPO_DIR}/.env — токен туннеля, ключи, каналы оповещений.
    2. cd ${REPO_DIR} && docker compose up -d --build
    3. docker compose ps — все сервисы healthy/running.
  Ноутбук: держать на зарядке; крышку можно закрыть.
EOF
