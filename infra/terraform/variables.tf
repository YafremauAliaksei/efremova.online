# Переменные Terraform.
#
# Значения задаются в terraform.tfvars (этот файл в .gitignore)
# или через переменные окружения: TF_VAR_cloudflare_api_token=...
#
# ⚠️ Секреты в git не попадают никогда — даже в приватный репозиторий.

variable "cloudflare_api_token" {
  description = "API-токен Cloudflare. Права: Zone.DNS(Edit), Zone.Firewall(Edit), Zone.Settings(Edit), Zone.Cache Rules(Edit)"
  type        = string
  sensitive   = true # Terraform не покажет значение в выводе plan/apply
}

variable "cloudflare_zone_id" {
  description = "ID зоны. Находится: панель Cloudflare → домен → правая колонка Overview"
  type        = string
}

variable "cloudflare_account_id" {
  description = "ID аккаунта Cloudflare"
  type        = string
  default     = ""
}

variable "cloudflare_plan" {
  description = "Тариф Cloudflare: free | pro | business | enterprise. От него зависит доступность управляемого WAF"
  type        = string
  default     = "free"

  validation {
    condition     = contains(["free", "pro", "business", "enterprise"], var.cloudflare_plan)
    error_message = "Допустимые значения: free, pro, business, enterprise."
  }
}

variable "server_ip" {
  description = "Публичный IPv4 сервера Hetzner. ⚠️ Снаружи не виден благодаря proxied=true"
  type        = string

  validation {
    condition     = can(regex("^(\\d{1,3}\\.){3}\\d{1,3}$", var.server_ip))
    error_message = "Должен быть корректный IPv4-адрес."
  }
}

variable "domain" {
  description = "Основной домен проекта"
  type        = string
  default     = "efremova.online"
}

variable "environment" {
  description = "Окружение: production | staging"
  type        = string
  default     = "production"
}

variable "alert_email" {
  description = "Почта для уведомлений Cloudflare об атаках"
  type        = string
  default     = ""
}
