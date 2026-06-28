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
  value = var.oss_web_bucket
}

output "oss_vault_bucket" {
  value = var.oss_vault_bucket
}

output "acr_registry" {
  value = var.acr_registry
}

output "acr_image" {
  value = "${var.acr_registry}/${var.acr_namespace}/${var.acr_repo}:latest"
}

output "fc_function_name" {
  value = alicloud_fcv3_function.api.function_name
}

output "fc_http_trigger_url" {
  value = local.fc_http_url
}

output "cdn_domain" {
  value = var.create_cdn_domain ? alicloud_cdn_domain_new.main[0].domain_name : var.domain
}

output "github_actions_secrets" {
  description = "Values to copy into GitHub Actions repository secrets."
  value = {
    OSS_ENDPOINT   = local.oss_endpoint
    OSS_WEB_BUCKET = var.oss_web_bucket
    ACR_REGISTRY   = var.acr_registry
    FC_REGION      = var.region
    FC_FUNCTION    = var.fc_function_name
  }
}
