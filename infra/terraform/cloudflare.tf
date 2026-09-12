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

  # ─── Правило 3: защита формы входа ───
  # Вход — самая атакуемая точка. Требуем прохождения проверки на бота.
  rules {
    action      = "managed_challenge"
    description = "Усиленная проверка на страницах авторизации"
    expression  = <<-EOT
      (http.request.uri.path contains "/api/auth" and cf.threat_score > 10) or
      (http.request.uri.path contains "/api/otp" and cf.threat_score > 5)
    EOT
    enabled     = true
  }

  # ─── Правило 4: кабинет — только для людей ───
  rules {
    action      = "managed_challenge"
    description = "Личный кабинет: боты не допускаются"
    expression  = "(http.request.uri.path contains \"/cabinet\") and (cf.client.bot) and not (cf.verified_bot_category eq \"Search Engine Crawler\")"
    enabled     = true
  }

  # ─── Правило 5: webhooks только от известных источников ───
  # Webhook меняет статус платежа — доступ к нему должен быть максимально узким.
  # Подпись проверяется в приложении, но лишний фильтр здесь не помешает.
  rules {
    action      = "skip"
    description = "Пропускать webhooks платёжных систем без проверок"
    expression  = "(http.request.uri.path contains \"/api/webhooks/stripe\") and (ip.src in $stripe_ips)"
    enabled     = false # включить после заполнения списка IP-адресов Stripe
    action_parameters {
      ruleset = "current"
    }
  }
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
    description = "Вход: не более 5 попыток в минуту с одного IP"
    expression  = "(http.request.uri.path contains \"/api/auth\" or http.request.uri.path contains \"/api/otp\")"
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

  rules {
    action      = "block"
    description = "Платежи: не более 10 запросов в минуту"
    expression  = "(http.request.uri.path contains \"/api/payments\")"
    enabled     = true
    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 300
    }
  }
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
    description = "НИКОГДА не кэшировать кабинет, API и авторизацию"
    expression  = <<-EOT
      (http.request.uri.path contains "/cabinet") or
      (http.request.uri.path contains "/api/") or
      (http.request.uri.path contains "/login")
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
