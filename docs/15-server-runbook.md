# 15. Сервер: запуск, туннель Cloudflare, переезд

Инструкция для владельца. Сервер — сейчас ноутбук, позже VPS; порядок один
и тот же. Всё, что умеет Cloudflare (TLS, защита от ботов и DDoS, сокрытие
IP, вход в админку), отдано Cloudflare — на сервере остаётся только сайт.

```
посетитель ──HTTPS──▶ Cloudflare ──туннель──▶ cloudflared ──▶ nginx ──▶ app ──▶ postgres
                                   (исходящее соединение с сервера; входящих портов нет)
```

## 1. Что нужно один раз

1. Домен добавлен в Cloudflare (бесплатный тариф), DNS — у Cloudflare.
2. Zero Trust включён (бесплатно до 50 пользователей): dash.cloudflare.com → Zero Trust.
3. На сервере: Docker с compose, репозиторий, файл `.env` из `.env.example`
   с правами `600` (`chmod 600 .env`).

## 2. Туннель

1. Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared →
   имя `efremova-site`.
2. На шаге установки скопировать **только токен** (длинная строка после
   `--token`) в `.env`: `CLOUDFLARE_TUNNEL_TOKEN=…`. Ставить cloudflared на
   саму систему не нужно — он уже есть в `docker-compose.yml`.
3. Public hostnames — две записи, обе `Type: HTTP`, `URL: nginx:80`:
   - `efremova.online`
   - `www.efremova.online` (nginx перебросит на адрес без www)
4. Панель сама создаёт DNS-записи на туннель. Старые A-записи на IP сервера,
   если были, — удалить: IP нигде не должен публиковаться.

Токен туннеля — ключ входа сайта в интернет. Утёк — в той же панели
туннель → Refresh token, новый — в `.env`, `docker compose up -d cloudflared`.

## 3. Защита на стороне Cloudflare

- SSL/TLS → Edge Certificates: **Always Use HTTPS** — вкл., **Minimum TLS** — 1.2,
  **HSTS** — вкл. (max-age 2 года, includeSubDomains).
- Security → Bots: **Bot Fight Mode** — вкл.
- Security → WAF: бесплатный управляемый набор правил Cloudflare включён по
  умолчанию — не выключать. Им Cloudflare закрывает массовые уязвимости в
  первые часы, ещё до обновления нашего кода.
- Caching → Cache Rules → правило «Публичные страницы»: выражение
  `not starts_with(http.request.uri.path, "/admin") and not starts_with(http.request.uri.path, "/api")`,
  **Eligible for cache**, Edge TTL — «Use cache-control header». Без него
  Cloudflare HTML не кэширует вовсе, и обещанная копия страницы на время
  простоя сервера (заголовок `CDN-Cache-Control`, docs/13) не работает.
  Админку и API приложение и так отдаёт с `no-store`.
- Остальные настройки зоны описаны кодом в `infra/terraform/` (необязательно:
  панели достаточно).

## 4. Вход в админку через Cloudflare Access

Первая линия защиты входа — у Cloudflare: до `/admin` не дойти, не введя
код, присланный на почту владельца. Наша ссылка из терминала и код 2FA
остаются второй и третьей линией.

1. Zero Trust → Access → Applications → **Add an application** → Self-hosted.
2. Домен `efremova.online`, путь `admin`. Session Duration — 24 часа.
3. Policy: Action **Allow**, Include → **Emails** → почта владельца.
4. Login methods: **One-time PIN** (код на почту, без паролей).
5. Проверка: открыть `https://efremova.online/admin/denied` в приватном окне —
   должна появиться страница входа Cloudflare, а не сайт.

Так недоступны снаружи и сами серверные действия админки: ошибка класса
«выполнение кода без входа» в Next.js или React до нашего кода не дойдёт —
её остановит Cloudflare.

## 5. Запуск и проверка

```bash
docker compose up -d --build
docker compose ps          # app, postgres, nginx — healthy; cloudflared — running
```

В панели туннель должен стать **Healthy**. Сайт открывается по домену.

## 6. Переезд ноутбук → VPS

1. На VPS: Docker, репозиторий, тот же `.env`; база — из бэкапа.
2. **Остановить ноутбук** (`docker compose down`): два сервера на одном
   токене Cloudflare делит запросы между ними пополам.
3. На VPS: `docker compose up -d --build`. DNS менять не нужно — он указывает
   на туннель, а не на IP.
4. Firewall VPS: входящие закрыть все, кроме SSH (лучше — SSH только по ключу).

## 7. Новость о критической уязвимости в Node.js / Next.js / React

1. Проверить, затронута ли наша версия (`package.json`); есть исправление —
   обновить и выкатить в тот же день (`docker compose up -d --build`).
2. Нет исправления, а уязвимость эксплуатируют — Security → Settings →
   **Under Attack Mode** на время; крайний случай — `docker compose stop app`:
   при правиле кэша из п.3 Cloudflare отдаёт последние сохранённые копии
   публичных страниц, админка и так закрыта Access.
