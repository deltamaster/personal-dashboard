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
}

locals {
  fc_http_url = try(alicloud_fcv3_trigger.http.http_trigger[0].url_internet, "")
  fc_origin_host = var.fc_api_origin != "" ? var.fc_api_origin : replace(replace(local.fc_http_url, "https://", ""), "http://", "")
}
