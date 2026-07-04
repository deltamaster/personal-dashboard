locals {
  tags = {
    project = var.project
    managed = "terraform"
  }

  cas_cert_region = var.cas_cert_region != "" ? var.cas_cert_region : (
    var.cdn_scope == "domestic" ? "cn-hangzhou" : "ap-southeast-1"
  )
  cas_dns_zone = var.cas_dns_zone != "" ? var.cas_dns_zone : (
    length(regexall("\\.", var.domain)) >= 1 ? join(".", slice(split(".", var.domain), 1, length(split(".", var.domain)))) : var.domain
  )
  cdn_https_active = var.create_cdn_domain && var.cdn_https_enabled && var.cdn_cas_cert_id != ""

  www_cdn_cas_cert_id = var.www_cdn_cas_cert_id
  www_cdn_https_active = var.create_www_site && var.create_cdn_domain && var.cdn_https_enabled && var.www_cdn_cas_cert_id != ""

  ots_endpoint     = "https://${var.ots_instance_name}.${var.region}.ots.aliyuncs.com"
  oss_endpoint     = "oss-${var.region}.aliyuncs.com"
  fc_code_key      = "fc/${var.fc_function_name}.zip"
  fc_custom_domain = var.fc_custom_domain != "" ? var.fc_custom_domain : "api.${var.domain}"

  ots_tables = {
    pd_holdings = {
      pk_name = "holding_id"
      pk_type = "String"
    }
    pd_snapshots = {
      pk_name = "snapshot_date"
      pk_type = "String"
    }
    pd_visits = {
      pk_name = "visit_id"
      pk_type = "String"
    }
    pd_visit_images = {
      pk_name = "image_id"
      pk_type = "String"
    }
    pd_flights = {
      pk_name = "flight_id"
      pk_type = "String"
    }
    pd_trains = {
      pk_name = "train_id"
      pk_type = "String"
    }
    pd_movies = {
      pk_name = "douban_subject_id"
      pk_type = "String"
    }
  }

  fc_env = {
    AUTH_URL                        = var.auth_url
    AUTH_SECRET                     = var.auth_secret
    AUTH_MICROSOFT_ENTRA_ID_ID      = var.auth_microsoft_entra_id_id
    AUTH_MICROSOFT_ENTRA_ID_SECRET  = var.auth_microsoft_entra_id_secret
    ALLOWED_USER_EMAIL              = var.allowed_user_email
    ALIBABA_CLOUD_ACCESS_KEY_ID     = var.runtime_access_key
    ALIBABA_CLOUD_ACCESS_KEY_SECRET = var.runtime_secret_key
    ALIBABA_CLOUD_ROLE_ARN          = var.role_arn
    ALIBABA_CLOUD_ROLE_SESSION_NAME = "personal-dashboard-fc"
    ALIBABA_CLOUD_REGION            = var.region
    OTS_ENDPOINT                    = local.ots_endpoint
    OTS_INSTANCE_NAME               = var.ots_instance_name
    OSS_VAULT_BUCKET                = var.oss_vault_bucket
    OSS_VAULT_REGION                = "oss-${var.region}"
    OSS_VAULT_ENDPOINT              = local.oss_endpoint
    # Public bucket that stores visit photos, served via CDN /* at AUTH_URL.
    OSS_WEB_BUCKET   = var.oss_web_bucket
    OSS_MEDIA_BUCKET = var.oss_web_bucket
    PORT             = "9000"
    HOSTNAME         = "0.0.0.0"
    PATH             = "/code/node/bin:/usr/local/bin:/usr/bin:/bin"
  }
}
