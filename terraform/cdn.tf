resource "alicloud_cdn_domain_new" "main" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name = var.domain
  cdn_type    = "web"
  scope       = var.cdn_scope

  sources {
    type     = "oss"
    content  = "${var.oss_web_bucket}.${local.oss_endpoint}"
    priority = 20
    port     = 80
    weight   = 10
  }

  dynamic "certificate_config" {
    for_each = local.cdn_https_active ? [1] : []
    content {
      server_certificate_status = "on"
      cert_type                 = "cas"
      cert_id                   = var.cdn_cas_cert_id
      cert_region               = local.cas_cert_region
    }
  }
}

locals {
  fc_http_url = try(alicloud_fcv3_trigger.http.http_trigger[0].url_internet, "")
  # Back-to-origin DNS: FC custom-domain CNAME (not *.fcapp.run — external redirects forbidden).
  fc_origin_dns = var.fc_api_origin != "" ? var.fc_api_origin : "${data.alicloud_account.current.id}.${var.region}.fc.aliyuncs.com"
  # Host header sent to FC so requests hit the custom domain binding, not the default endpoint.
  fc_origin_host_header = local.fc_custom_domain
}
