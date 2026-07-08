# TLS 1.2+ only + Enhanced (strict) cipher suite on HTTPS CDN domains.
# Alibaba CDN function: https_tls_version (see CDN API docs).

locals {
  cdn_tls_function_args = [
    { name = "tls10", value = "off" },
    { name = "tls11", value = "off" },
    { name = "tls12", value = "on" },
    { name = "tls13", value = "on" },
    { name = "ciphersuitegroup", value = "strict" },
  ]
}

resource "alicloud_cdn_domain_config" "tls_policy" {
  count = local.cdn_https_active ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.main[0].domain_name
  function_name = "https_tls_version"

  dynamic "function_args" {
    for_each = local.cdn_tls_function_args
    content {
      arg_name  = function_args.value.name
      arg_value = function_args.value.value
    }
  }
}

resource "alicloud_cdn_domain_config" "www_tls_policy" {
  count = local.www_cdn_https_active ? 1 : 0

  domain_name   = alicloud_cdn_domain_new.www[0].domain_name
  function_name = "https_tls_version"

  dynamic "function_args" {
    for_each = local.cdn_tls_function_args
    content {
      arg_name  = function_args.value.name
      arg_value = function_args.value.value
    }
  }
}
