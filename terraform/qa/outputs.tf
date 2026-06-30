data "alicloud_account" "current" {}

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

# --- ARNs (for RAM policies / reference) ---

output "ots_instance_arn" {
  value = "acs:ots:${var.region}:${data.alicloud_account.current.id}:instance/${var.ots_instance_name}"
}

output "ots_tables_arn" {
  value = "acs:ots:${var.region}:${data.alicloud_account.current.id}:instance/${var.ots_instance_name}/table/*"
}

output "oss_web_bucket_arn" {
  value = "acs:oss:*:${data.alicloud_account.current.id}:${var.oss_web_bucket}"
}

output "oss_vault_bucket_arn" {
  value = "acs:oss:*:${data.alicloud_account.current.id}:${var.oss_vault_bucket}"
}

# Convenience: values to drop into .env.local for the QA app.
output "env_local_hints" {
  value = {
    OTS_ENDPOINT       = local.ots_endpoint
    OTS_INSTANCE_NAME  = var.ots_instance_name
    OSS_VAULT_BUCKET   = var.oss_vault_bucket
    OSS_VAULT_REGION   = "oss-${var.region}"
    OSS_VAULT_ENDPOINT = local.oss_endpoint
  }
}
