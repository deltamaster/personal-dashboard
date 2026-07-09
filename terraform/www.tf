# Public personal site — www.huhansen.cn (static only, separate from dashboard CDN).

resource "alicloud_oss_bucket" "www" {
  count  = var.create_www_site ? 1 : 0
  bucket = var.oss_www_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_public_access_block" "www" {
  count               = var.create_www_site ? 1 : 0
  bucket              = alicloud_oss_bucket.www[0].id
  block_public_access = false
}

resource "alicloud_oss_bucket_acl" "www" {
  count  = var.create_www_site ? 1 : 0
  bucket = alicloud_oss_bucket.www[0].id
  acl    = "public-read"

  depends_on = [alicloud_oss_bucket_public_access_block.www]
}

resource "alicloud_oss_bucket_website" "www" {
  count  = var.create_www_site ? 1 : 0
  bucket = alicloud_oss_bucket.www[0].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key         = "404.html"
    http_status = 404
  }
}

resource "alicloud_cdn_domain_new" "www" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name = var.www_domain
  cdn_type    = "web"
  scope       = var.cdn_scope

  sources {
    type     = "oss"
    content  = "${var.oss_www_bucket}.${local.oss_endpoint}"
    priority = 20
    port     = 80
    weight   = 10
  }

  dynamic "certificate_config" {
    for_each = local.www_cdn_https_active ? [1] : []
    content {
      server_certificate_status = "on"
      cert_type                 = "cas"
      cert_id                   = local.www_cdn_cas_cert_id
      cert_region               = local.cas_cert_region
    }
  }
}

resource "alicloud_cdn_domain_config" "www_force_https" {
  count = local.www_cdn_https_active ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "https_force"

  function_args {
    arg_name  = "enable"
    arg_value = "on"
  }
  function_args {
    arg_name  = "https_rewrite"
    arg_value = "301"
  }
}

# HTML: 1-day edge TTL; deploy purge refreshes immediately on release.
resource "alicloud_cdn_domain_config" "www_html_short_cache" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "filetype_based_ttl_set"

  function_args {
    arg_name  = "file_type"
    arg_value = "html"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = tostring(local.cdn_ttl_html_seconds)
  }
  function_args {
    arg_name  = "weight"
    arg_value = "90"
  }
  function_args {
    arg_name  = "swift_origin_cache_high"
    arg_value = "on"
  }
  function_args {
    arg_name  = "swift_follow_cachetime"
    arg_value = "on"
  }
}

resource "alicloud_cdn_domain_config" "www_root_index_rewrite" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
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
