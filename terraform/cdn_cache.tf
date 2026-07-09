# CDN cache TTLs — see deploy-public-site.yml / deploy-web.yml for matching OSS Cache-Control.

locals {
  # HTML: long edge cache for hit rate; deploy workflow purges CDN when content changes.
  cdn_ttl_html_seconds = 86400 # 1 day
  # Static assets (css/js/images/fonts): long edge cache; deploy purge refreshes on release.
  cdn_ttl_static_seconds = 2592000 # 30 days
  # robots.txt, sitemap.xml
  cdn_ttl_seo_meta_seconds = 3600 # 1 hour
}

resource "alicloud_cdn_domain_config" "www_static_long_cache" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "filetype_based_ttl_set"

  function_args {
    arg_name  = "file_type"
    arg_value = "css,js,jpg,jpeg,png,gif,svg,webp,ico,woff,woff2,ttf,eot"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = tostring(local.cdn_ttl_static_seconds)
  }
  function_args {
    arg_name  = "weight"
    arg_value = "85"
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

resource "alicloud_cdn_domain_config" "www_seo_meta_cache" {
  count = var.create_www_site && var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "filetype_based_ttl_set"

  function_args {
    arg_name  = "file_type"
    arg_value = "txt,xml"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = tostring(local.cdn_ttl_seo_meta_seconds)
  }
  function_args {
    arg_name  = "weight"
    arg_value = "80"
  }
  function_args {
    arg_name  = "swift_origin_cache_high"
    arg_value = "on"
  }
}

resource "alicloud_cdn_domain_config" "static_long_cache" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "filetype_based_ttl_set"

  function_args {
    arg_name  = "file_type"
    arg_value = "css,js,jpg,jpeg,png,gif,svg,webp,ico,woff,woff2,ttf,eot,map"
  }
  function_args {
    arg_name  = "ttl"
    arg_value = tostring(local.cdn_ttl_static_seconds)
  }
  function_args {
    arg_name  = "weight"
    arg_value = "85"
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
