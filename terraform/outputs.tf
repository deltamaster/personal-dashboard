output "account_id" {
  value = data.alicloud_account.current.id
}

output "ots_instance_name" {
  value = alicloud_ots_instance.main.name
}

output "ots_endpoint" {
  value = local.ots_endpoint
}

output "oss_web_bucket" {
  value = alicloud_oss_bucket.web.bucket
}

output "oss_vault_bucket" {
  value = alicloud_oss_bucket.vault.bucket
}

output "fc_code_oss_key" {
  value = local.fc_code_key
}

output "fc_function_name" {
  value = alicloud_fcv3_function.api.function_name
}

output "fc_http_trigger_url" {
  value = local.fc_http_url
}

output "fc_custom_domain" {
  value = alicloud_fcv3_custom_domain.api.custom_domain_name
}

output "fc_origin_dns" {
  description = "CDN back-to-origin DNS for /api/* (FC custom-domain CNAME)."
  value       = local.fc_origin_dns
}

output "cdn_cname" {
  value = var.create_cdn_domain ? alicloud_cdn_domain_new.main[0].cname : null
}

output "cdn_domain" {
  value = var.create_cdn_domain ? alicloud_cdn_domain_new.main[0].domain_name : var.domain
}

output "github_actions_secrets" {
  description = "Values to copy into GitHub Actions repository secrets."
  value = {
    OSS_ENDPOINT     = local.oss_endpoint
    OSS_WEB_BUCKET   = var.oss_web_bucket
    OSS_VAULT_BUCKET = var.oss_vault_bucket
    FC_CODE_KEY      = local.fc_code_key
    FC_REGION        = var.region
    FC_FUNCTION      = var.fc_function_name
  }
}
