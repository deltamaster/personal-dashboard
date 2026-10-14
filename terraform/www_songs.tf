# Public song list for www.huhansen.cn/songs.
# Static page stays on OSS. GET /api/songs is a separate pay-per-invocation function
# (min instances 0, no search index) that GetRange-scans OTS table www_songs.

data "archive_file" "www_songs_bootstrap" {
  count = var.create_www_site ? 1 : 0

  type        = "zip"
  output_path = "${path.module}/.generated/www-songs-bootstrap.zip"

  source {
    content  = file("${path.module}/../functions/www-songs/placeholder.js")
    filename = "index.js"
  }
}

resource "alicloud_oss_bucket_object" "www_songs_code" {
  count = var.create_www_site ? 1 : 0

  bucket = alicloud_oss_bucket.vault.bucket
  key    = "fc/www-songs.zip"
  source = data.archive_file.www_songs_bootstrap[0].output_path

  lifecycle {
    ignore_changes = all
  }
}

resource "alicloud_ots_table" "www_songs" {
  count = var.create_www_site ? 1 : 0

  instance_name = alicloud_ots_instance.main.name
  table_name    = "www_songs"
  time_to_live  = -1
  max_version   = 1

  primary_key {
    name = "song_id"
    type = "String"
  }
}

resource "alicloud_fcv3_function" "www_songs" {
  count = var.create_www_site ? 1 : 0

  function_name        = "www-songs"
  description          = "Public song list for www.huhansen.cn/songs"
  runtime              = "nodejs20"
  handler              = "index.handler"
  memory_size          = 256
  cpu                  = 0.15
  disk_size            = 512
  timeout              = 30
  instance_concurrency = 10
  internet_access      = true

  code {
    oss_bucket_name = alicloud_oss_bucket.vault.bucket
    oss_object_name = alicloud_oss_bucket_object.www_songs_code[0].key
  }

  environment_variables = {
    OTS_ENDPOINT                    = local.ots_endpoint
    OTS_INSTANCE_NAME               = var.ots_instance_name
    SONGS_TABLE                     = "www_songs"
    ALIBABA_CLOUD_ACCESS_KEY_ID     = var.runtime_access_key
    ALIBABA_CLOUD_ACCESS_KEY_SECRET = var.runtime_secret_key
    ALIBABA_CLOUD_ROLE_ARN          = var.role_arn
    ALIBABA_CLOUD_ROLE_SESSION_NAME = "www-songs"
    ALIBABA_CLOUD_REGION            = var.region
  }

  log_config {
    log_begin_rule = "None"
  }

  lifecycle {
    ignore_changes = [
      code,
    ]
  }

  depends_on = [alicloud_oss_bucket_object.www_songs_code]
}

resource "alicloud_fcv3_trigger" "www_songs" {
  count = var.create_www_site ? 1 : 0

  function_name = alicloud_fcv3_function.www_songs[0].function_name
  trigger_type  = "http"
  trigger_name  = "http"
  description   = "Anonymous HTTP trigger for www /api/songs"
  qualifier     = "LATEST"
  trigger_config = jsonencode({
    authType = "anonymous"
    methods  = ["GET", "HEAD", "OPTIONS"]
  })
}

resource "alicloud_fcv3_provision_config" "www_songs" {
  count = var.create_www_site ? 1 : 0

  function_name = alicloud_fcv3_function.www_songs[0].function_name
  qualifier     = "LATEST"
  target        = 0
}

locals {
  www_songs_origin_host = var.create_www_site ? regex(
    "^https?://([^/]+)",
    alicloud_fcv3_trigger.www_songs[0].http_trigger[0].url_internet
  )[0] : ""
}

resource "alicloud_cdn_domain_config" "www_songs_path_rule" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "condition"

  function_args {
    arg_name = "rule"
    arg_value = jsonencode({
      match = {
        logic = "and"
        criteria = [{
          matchType     = "uri"
          matchOperator = "contains"
          matchValue    = ["/api/songs"]
          negate        = false
        }]
      }
      name   = "www-songs-api"
      status = "enable"
    })
  }
}

resource "alicloud_cdn_domain_config" "www_songs_origin" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "origin_dns_host"
  parent_id     = alicloud_cdn_domain_config.www_songs_path_rule[0].config_id

  function_args {
    arg_name  = "ali_origin_dns_host"
    arg_value = local.www_songs_origin_host
  }

  depends_on = [alicloud_fcv3_trigger.www_songs]
}

resource "alicloud_cdn_domain_config" "www_songs_origin_host" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "origin_host"

  function_args {
    arg_name  = "origin"
    arg_value = local.www_songs_origin_host
  }
  function_args {
    arg_name  = "host"
    arg_value = local.www_songs_origin_host
  }

  depends_on = [alicloud_cdn_domain_config.www_songs_origin]
}

resource "alicloud_cdn_domain_config" "www_songs_no_cache" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "path_based_ttl_set"

  function_args {
    arg_name  = "path"
    arg_value = "/api/songs"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = "1"
  }
  function_args {
    arg_name  = "weight"
    arg_value = "99"
  }
  function_args {
    arg_name  = "swift_no_cache_low"
    arg_value = "on"
  }
  function_args {
    arg_name  = "swift_origin_cache_high"
    arg_value = "off"
  }
  function_args {
    arg_name  = "swift_follow_cachetime"
    arg_value = "off"
  }
}
