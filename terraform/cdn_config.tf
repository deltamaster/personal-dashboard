# CDN path rules: /api/* → FC, default /* → OSS (via alicloud_cdn_domain_new sources).

resource "alicloud_cdn_domain_config" "api_advanced_origin" {
  count = var.create_cdn_domain && local.fc_origin_host != "" ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "advanced_origin"

  function_args {
    arg_name  = "variable_type"
    arg_value = "uri"
  }
  function_args {
    arg_name  = "variable"
    arg_value = "uri"
  }
  function_args {
    arg_name  = "conditions"
    arg_value = "=="
  }
  function_args {
    arg_name  = "value"
    arg_value = "/api"
  }
  function_args {
    arg_name  = "origin"
    arg_value = local.fc_origin_host
  }

  depends_on = [alicloud_fcv3_trigger.http]
}

resource "alicloud_cdn_domain_config" "api_no_cache" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "path_based_ttl_set"

  function_args {
    arg_name  = "path"
    arg_value = "/api"
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
}
