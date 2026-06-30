# QA / test stack — provisions ONLY OTS + OSS (no FC/CDN). Separate state from the
# production root so it never touches the live Singapore/Shanghai resources.

variable "region" {
  description = "Alibaba Cloud region for the QA stack."
  type        = string
  default     = "ap-southeast-1"
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
  default     = "terraform-personal-dashboard-qa"
}

variable "project" {
  description = "Resource name prefix / tag."
  type        = string
  default     = "personal-dashboard-qa"
}

variable "ots_instance_name" {
  type    = string
  default = "pd-dash-qa"
}

variable "oss_web_bucket" {
  type    = string
  default = "pd-web-qa"
}

variable "oss_vault_bucket" {
  type    = string
  default = "pd-vault-qa"
}

variable "vault_cors_allowed_origin" {
  description = "Origin allowed to PUT/GET vault objects (local QA app)."
  type        = string
  default     = "http://localhost:3000"
}
