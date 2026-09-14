# ═══════════════════════════════════════════════════════════════════════════
#  CLOUDFLARE — щит перед сервером (docs/00, п.5; docs/03, рубеж №1)
#
#  «Инфраструктура как код»: вместо кликанья в веб-панели настройки описаны
#  файлом в git. Плюсы: видно историю изменений, можно откатиться, можно
#  поднять копию окружения за минуту, и аудитор видит, кто что менял.
#
#  Применение:
#     terraform init
#     terraform plan      # показать, что изменится — ВСЕГДА смотреть глазами
#     terraform apply     # применить
#
#  ⚠️ Синтаксис соответствует провайдеру Cloudflare v4.x.
#     В v5 часть ресурсов переименована — при обновлении сверяться с CHANGELOG.
# ═══════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.9.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
  # Состояние Terraform содержит чувствительные данные — хранить только
  # в зашифрованном удалённом бэкенде, никогда не коммитить в git
  backend "s3" {
    bucket  = "efremova-tfstate"
    key     = "cloudflare/terraform.tfstate"
    region  = "eu-central-1"
    encrypt = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ─────────────────────────────── DNS ───────────────────────────────

# proxied = true — ключевая настройка. Она означает: трафик идёт ЧЕРЕЗ
# Cloudflare, реальный IP сервера снаружи не виден, DDoS гасится у них.
# Если поставить false — сервер окажется голым в интернете.
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  content = var.server_ip
  type    = "A"
  proxied = true
  ttl     = 1 # 1 = автоматический, обязателен при proxied
  comment = "Основной сервер, Hetzner"
}

resource "cloudflare_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  content = "efremova.online"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# ─── Почта: защита от подделки писем от нашего имени ───

resource "cloudflare_record" "spf" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "TXT"
  content = "v=spf1 include:_spf.resend.com ~all"
  ttl     = 3600
  comment = "SPF: кто имеет право слать письма от efremova.online"
}

resource "cloudflare_record" "dmarc" {
  zone_id = var.cloudflare_zone_id
  name    = "_dmarc"
  type    = "TXT"
  content = "v=DMARC1; p=quarantine; rua=mailto:dmarc@efremova.online; pct=100; adkim=s; aspf=s"
  ttl     = 3600
  comment = "DMARC: что делать с подделками. Начать с p=quarantine, через месяц перейти на p=reject"
}

# ─────────────────────── НАСТРОЙКИ БЕЗОПАСНОСТИ ЗОНЫ ───────────────────────

resource "cloudflare_zone_settings_override" "security" {
  zone_id = var.cloudflare_zone_id

  settings {
    # TLS: только современные версии. 1.0 и 1.1 содержат известные дыры.
    min_tls_version = "1.2"
    tls_1_3         = "on"
    ssl             = "strict" # Cloudflare проверяет сертификат нашего сервера
    always_use_https = "on"

    # HSTS: браузер запоминает «этот сайт только по HTTPS» на 2 года.
    # ⚠️ preload = true включать ТОЛЬКО когда HTTPS гарантированно работает:
    # откат из списка браузеров занимает месяцы.
    security_header {
      enabled            = true
      include_subdomains = true
      max_age            = 63072000
      nosniff            = true
      preload            = true
    }

    # Автоматическая защита от известных атак
    security_level = "medium"  # при атаке переключается на "under_attack"
    challenge_ttl  = 1800
    browser_check  = "on"

    # Производительность (docs/04)
    brotli           = "on"
    early_hints      = "on"  # браузер начинает грузить CSS до ответа сервера
    http3            = "on"
    zero_rtt         = "off" # ⚠️ выключено намеренно: 0-RTT допускает replay-атаки
    websockets       = "on"
    opportunistic_encryption = "on"

    # ⚠️ Минификацию и Rocket Loader НЕ включаем: они переписывают HTML и JS,
    # что ломает CSP с nonce (docs/03, п.5). Next.js и так всё минифицирует.
    rocket_loader = "off"

    # Конфиденциальность
    privacy_pass = "on"
  }
}

# ─────────────────────── WAF: СВОИ ПРАВИЛА ФИЛЬТРАЦИИ ───────────────────────

resource "cloudflare_ruleset" "waf_custom" {
  zone_id     = var.cloudflare_zone_id
  name        = "efremova-waf-custom"
  description = "Собственные правила фильтрации (docs/03-security-policy.md)"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # ─── Правило 1: сканеры уязвимостей по User-Agent ───
  # Инструменты автоматического сканирования честно представляются.
  # Сначала блокируем очевидное, чтобы не тратить ресурсы сервера.
  rules {
    action      = "block"
    description = "Блокировка известных сканеров уязвимостей"
    expression  = <<-EOT
      (http.user_agent contains "sqlmap") or
      (http.user_agent contains "nikto") or
      (http.user_agent contains "nmap") or
      (http.user_agent contains "masscan") or
      (http.user_agent contains "nessus") or
      (http.user_agent contains "acunetix") or
      (http.user_agent contains "havij") or
      (http.user_agent eq "")
    EOT
    enabled     = true
  }

  # ─── Правило 2: пути-ловушки (honeypot, docs/03 п.4) ───
  # managed_challenge вместо block: даём шанс живому человеку,
  # но автоматика через CAPTCHA не пройдёт.
  rules {
    action      = "managed_challenge"
    description = "Honeypot: пути, которых у нас не существует"
    expression  = <<-EOT
      (http.request.uri.path contains "/wp-admin") or
      (http.request.uri.path contains "/wp-login") or
      (http.request.uri.path contains "/xmlrpc.php") or
      (http.request.uri.path contains "/phpmyadmin") or
      (http.request.uri.path contains "/.env") or
      (http.request.uri.path contains "/.git") or
      (http.request.uri.path contains "/.aws") or
      (http.request.uri.path contains "/backup.sql")
    EOT
    enabled     = true
  }

  # ─── Правило 3: админка — только для людей ───
  # Единственная закрытая зона основного домена. Формы входа тут нет:
  # войти можно лишь по одноразовой ссылке из терминала сервера. Проверка
  # на бота отсекает сканеры, которые перебирают /admin по словарю.
  rules {
    action      = "managed_challenge"
    description = "Админка: боты не допускаются"
    expression  = "(http.request.uri.path contains \"/admin\") and (cf.client.bot) and not (cf.verified_bot_category eq \"Search Engine Crawler\")"
    enabled     = true
  }

  # ⚠️ Здесь были ещё два правила: проверка на страницах авторизации
  # (/api/auth, /api/otp) и пропуск webhooks Stripe мимо всех проверок.
  # Убраны вместе с кабинетом и платежами (docs/13-site-architecture.md).
  #
  # Особенно второе: правило с action = "skip" открывает путь в обход WAF.
  # Правило, которое ничего не сторожит, но умеет пропускать, — это дверь,
  # оставленная в стене снесённого здания. Вернётся вместе с платежами,
  # в конфигурации того поддомена, где они будут.
}

# ─────────────────── ОГРАНИЧЕНИЕ ЧАСТОТЫ ЗАПРОСОВ ───────────────────
# Третий рубеж после Cloudflare-WAF и nginx. Здесь лимиты считаются
# по всей сети Cloudflare, то есть работают даже при распределённой атаке.

resource "cloudflare_ruleset" "rate_limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "efremova-rate-limit"
  description = "Лимиты частоты запросов"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action      = "block"
    description = "Админка: не более 5 обращений в минуту с одного IP"
    expression  = "(http.request.uri.path contains \"/admin\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 5
      mitigation_timeout  = 600 # блокировка на 10 минут
    }
  }

  rules {
    action      = "managed_challenge"
    description = "API: не более 100 запросов в минуту"
    expression  = "(http.request.uri.path contains \"/api/\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 60
      requests_per_period = 100
      mitigation_timeout  = 60
    }
  }

  # ⚠️ Здесь было правило для /api/payments. Платежей на основном домене нет —
  # правило вернётся в конфигурацию поддомена с кабинетом.
}

# ─────────────────── ПРАВИЛА КЭШИРОВАНИЯ ───────────────────
# 🔒 Критично: персональные данные не должны попасть в кэш CDN.
# Нарушение = чужие данные показываются другому пользователю.

resource "cloudflare_ruleset" "cache" {
  zone_id     = var.cloudflare_zone_id
  name        = "efremova-cache"
  description = "Правила кэширования (docs/04, п.3.3)"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # Правило идёт ПЕРВЫМ: запрет кэша важнее любых оптимизаций
  rules {
    action      = "set_cache_settings"
    description = "НИКОГДА не кэшировать админку и API"
    expression  = <<-EOT
      (http.request.uri.path contains "/admin") or
      (http.request.uri.path contains "/api/")
    EOT
    enabled     = true
    action_parameters {
      cache = false
    }
  }

  rules {
    action      = "set_cache_settings"
    description = "Статика: кэшировать на год"
    expression  = "(http.request.uri.path contains \"/_next/static/\") or (http.request.uri.path contains \"/fonts/\")"
    enabled     = true
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
  }
}

# ─────────────────── УПРАВЛЯЕМЫЕ ПРАВИЛА CLOUDFLARE ───────────────────
# Готовый набор от Cloudflare: OWASP Top-10, защита от SQLi, XSS, RCE.
# Обновляется их командой безопасности автоматически.
# ⚠️ Доступно на тарифе Pro и выше.

resource "cloudflare_ruleset" "managed_waf" {
  count       = var.cloudflare_plan == "free" ? 0 : 1
  zone_id     = var.cloudflare_zone_id
  name        = "efremova-managed-waf"
  description = "Управляемые правила Cloudflare + OWASP"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action      = "execute"
    description = "Cloudflare Managed Ruleset"
    expression  = "true"
    enabled     = true
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }

  rules {
    action      = "execute"
    description = "OWASP Core Ruleset"
    expression  = "true"
    enabled     = true
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f"
      overrides {
        # Уровень паранойи. PL2 — разумный баланс.
        # PL3+ даёт ложные срабатывания на обычных пользователях.
        categories {
          category = "paranoia-level-3"
          enabled  = false
        }
        categories {
          category = "paranoia-level-4"
          enabled  = false
        }
      }
    }
  }
}
