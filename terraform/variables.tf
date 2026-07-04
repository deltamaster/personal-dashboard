variable "region" {
  description = "Alibaba Cloud region, e.g. cn-shanghai or ap-southeast-1."
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
  description = "CDN accelerated subdomain for this stack, e.g. pd.huhansen.com or pd.huhansen.cn."
  type        = string
  default     = "pd.huhansen.cn"
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

variable "fc_function_name" {
  type    = string
  default = "api"
}

variable "fc_execution_role_arn" {
  description = "Optional RAM role ARN attached to the FC function (OTS/OSS at runtime)."
  type        = string
  default     = ""
}

variable "cdn_scope" {
  description = "CDN acceleration region: domestic (cn, needs ICP), overseas (global excl. mainland), or global."
  type        = string
  default     = "domestic"
}

variable "fc_api_origin" {
  description = "FC custom-domain CNAME for CDN /api/* back-to-origin DNS (no scheme). Defaults to {account_id}.{region}.fc.aliyuncs.com."
  type        = string
  default     = ""
}

variable "fc_custom_domain" {
  description = "FC custom domain for OAuth redirects (must CNAME to {account_id}.{region}.fc.aliyuncs.com). Defaults to api.{domain}."
  type        = string
  default     = ""
}

variable "create_fc_custom_domain" {
  description = "Bind FC custom domain (api.{domain}). Requires CNAME to {account_id}.{region}.fc.aliyuncs.com first."
  type        = bool
  default     = true
}

variable "create_cdn_domain" {
  description = "Create CDN domain via Terraform. Set false until the subdomain is verified in Alibaba CDN console."
  type        = bool
  default     = false
}

variable "cdn_https_enabled" {
  description = "Enable HTTPS on the CDN domain via CAS certificate (requires cdn_cas_cert_id at apply time)."
  type        = bool
  default     = false
}

variable "cdn_cas_cert_id" {
  description = "CAS CertificateId (numeric) for CDN HTTPS — not the cas_dv-cn-… InstanceId. CI or tfvars."
  type        = string
  default     = ""
}

variable "cas_cert_region" {
  description = "CAS region for cert_type=cas (China site: cn-hangzhou; international: ap-southeast-1). Empty = auto from cdn_scope."
  type        = string
  default     = ""
}

variable "cas_dns_zone" {
  description = "Alibaba DNS zone for auto CAS domain-validation TXT (e.g. huhansen.cn). Empty = parent zone of domain."
  type        = string
  default     = ""
}

variable "cas_contact_name" {
  description = "Applicant name for CAS free DV certificate orders."
  type        = string
  default     = "Personal Dashboard"
}

variable "cas_contact_phone" {
  description = "Applicant phone for CAS free DV certificate orders (required by CAS API)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cas_contact_email" {
  description = "Applicant email for CAS free DV certificate orders."
  type        = string
  default     = ""
}

# --- FC runtime secrets (Auth.js + data access) ---

variable "auth_url" {
  description = "Public app URL for Auth.js, e.g. https://pd.huhansen.com (must match CDN subdomain)."
  type        = string
  default     = "https://pd.huhansen.cn"
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

# --- Public personal site (www.huhansen.cn) ---

variable "create_www_site" {
  description = "Provision OSS bucket + CDN for the public personal site at www_domain."
  type        = bool
  default     = false
}

variable "www_domain" {
  description = "CDN domain for the public personal site."
  type        = string
  default     = "www.huhansen.cn"
}

variable "oss_www_bucket" {
  description = "Public OSS bucket for the www personal site."
  type        = string
  default     = "huhansen-www"
}

variable "www_cdn_cas_cert_id" {
  description = "CAS CertificateId for www CDN HTTPS. Required for HTTPS on www.huhansen.cn (order via scripts/cdn-ensure-cas-cert.sh)."
  type        = string
  default     = ""
}
