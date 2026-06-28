# CDN path rules: /api/* → FC, default /* → OSS (via alicloud_cdn_domain_new sources).
# advanced_origin only supports exact URI match; use rules engine + conditional origin for /api/*.

locals {
  api_path_rule = jsonencode({
    match = {
      logic = "and"
      criteria = [{
        matchType     = "uri"
        matchOperator = "contains"
        matchValue    = ["/api/*"]
        negate        = false
      }]
    }
    name   = "api-path"
    status = "enable"
  })
}

resource "alicloud_cdn_domain_config" "api_path_rule" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "condition"

  function_args {
    arg_name  = "rule"
    arg_value = local.api_path_rule
  }
}

# One child on api-path (ConfigParentExceedLimit): conditional origin DNS only.
resource "alicloud_cdn_domain_config" "api_origin_dns" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "origin_dns_host"
  parent_id     = alicloud_cdn_domain_config.api_path_rule[0].config_id

  function_args {
    arg_name  = "ali_origin_dns_host"
    arg_value = local.fc_origin_dns
  }

  depends_on = [
    alicloud_cdn_domain_config.api_path_rule,
    alicloud_fcv3_custom_domain.api,
  ]
}

# Per-origin Host header when CDN fetches from the FC CNAME (no parent_id — not a rule child).
resource "alicloud_cdn_domain_config" "api_fc_origin_host" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "origin_host"

  function_args {
    arg_name  = "origin"
    arg_value = local.fc_origin_dns
  }
  function_args {
    arg_name  = "host"
    arg_value = local.fc_origin_host_header
  }

  depends_on = [alicloud_cdn_domain_config.api_origin_dns]
}

resource "alicloud_cdn_domain_config" "api_no_cache" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "path_based_ttl_set"

  function_args {
    arg_name  = "path"
    arg_value = "/api/"
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

# HTML pages change on every deploy; avoid serving stale index.html for sub-routes.
resource "alicloud_cdn_domain_config" "html_short_cache" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "filetype_based_ttl_set"

  function_args {
    arg_name  = "file_type"
    arg_value = "html"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = "1"
  }
  function_args {
    arg_name  = "weight"
    arg_value = "90"
  }
  function_args {
    arg_name  = "swift_no_cache_low"
    arg_value = "on"
  }
}

# CDN pulls OSS by object key; rewrite trailing-slash paths to index.html (skip /api/*).
resource "alicloud_cdn_domain_config" "root_index_rewrite" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "back_to_origin_url_rewrite"

  function_args {
    arg_name  = "source_url"
    arg_value = "^/$"
  }
  function_args {
    arg_name  = "target_url"
    arg_value = "/index.html"
  }
  function_args {
    arg_name  = "flag"
    arg_value = "break"
  }
}

resource "alicloud_cdn_domain_config" "subdir_index_rewrite" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "back_to_origin_url_rewrite"

  function_args {
    arg_name  = "source_url"
    arg_value = "^/(?!api/)(.+/)$"
  }
  function_args {
    arg_name  = "target_url"
    arg_value = "/$1index.html"
  }
  function_args {
    arg_name  = "flag"
    arg_value = "break"
  }
}
