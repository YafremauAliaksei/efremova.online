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

variable "cloudflare_tunnel_id" {
  description = "ID туннеля Cloudflare (Zero Trust → Networks → Tunnels). IP сервера не нужен вовсе"
  type        = string

  validation {
    condition     = can(regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", var.cloudflare_tunnel_id))
    error_message = "Должен быть UUID туннеля."
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
