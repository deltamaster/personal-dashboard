variable "region" {
  description = "Alibaba Cloud region (all resources in cn-shanghai)."
  type        = string
  default     = "cn-shanghai"
}

variable "access_key" {
  description = "RAM user AccessKey ID. Optional in CI — uses ALICLOUD_ACCESS_KEY env var."
  type        = string
  sensitive   = true
  default     = null
}

variable "secret_key" {
  description = "RAM user AccessKey secret. Optional in CI — uses ALICLOUD_SECRET_KEY env var."
  type        = string
  sensitive   = true
  default     = null
}

variable "role_arn" {
  description = "ARN of the RAM role to assume for provisioning."
  type        = string
}

variable "role_session_name" {
  description = "Session name passed to AssumeRole."
  type        = string
  default     = "terraform-personal-dashboard"
}

variable "project" {
  description = "Resource name prefix / tag."
  type        = string
  default     = "personal-dashboard"
}

variable "domain" {
  description = "Production domain served by CDN."
  type        = string
  default     = "huhansen.cn"
}

variable "ots_instance_name" {
  type    = string
  default = "pd-dashboard"
}

variable "oss_web_bucket" {
  type    = string
  default = "huhansen-web"
}

variable "oss_vault_bucket" {
  type    = string
  default = "personal-dashboard-vault"
}

variable "acr_namespace" {
  type    = string
  default = "personal-dashboard"
}

variable "acr_repo" {
  type    = string
  default = "api"
}

variable "acr_registry" {
  description = "ACR login server, e.g. crpi-xxxxx.cn-shanghai.personal.cr.aliyuncs.com"
  type        = string
}

variable "fc_function_name" {
  type    = string
  default = "api"
}

variable "fc_execution_role_arn" {
  description = "Optional RAM role ARN attached to the FC function (OTS/OSS at runtime)."
  type        = string
  default     = ""
}

variable "initial_fc_image" {
  description = "Container image for first FC deploy. Push to ACR before apply, or re-apply after Deploy API workflow."
  type        = string
  default     = ""
}

variable "create_cdn_domain" {
  description = "Set false if huhansen.cn is already on CDN (import instead)."
  type        = bool
  default     = true
}

# --- FC runtime secrets (Auth.js + data access) ---

variable "auth_url" {
  type    = string
  default = "https://huhansen.cn"
}

variable "auth_secret" {
  type      = string
  sensitive = true
}

variable "auth_microsoft_entra_id_id" {
  type      = string
  sensitive = true
}

variable "auth_microsoft_entra_id_secret" {
  type      = string
  sensitive = true
}

variable "allowed_user_email" {
  type    = string
  default = "huhansen318@hotmail.com"
}

variable "runtime_access_key" {
  description = "AccessKey the FC function uses for OTS/OSS SDK calls."
  type        = string
  sensitive   = true
}

variable "runtime_secret_key" {
  type      = string
  sensitive = true
}
