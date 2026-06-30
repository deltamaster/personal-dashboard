# CDN domain fronting the QA photo bucket so images load in the browser at a
# stable custom domain (set MEDIA_PUBLIC_BASE_URL=https://<media_domain> in the
# app). OSS-only origin — no FC/API (the QA API runs locally).

resource "alicloud_cdn_domain_new" "media" {
  count = var.create_cdn_domain ? 1 : 0

  domain_name = var.media_domain
  cdn_type    = "web"
  scope       = var.cdn_scope

  sources {
    type     = "oss"
    content  = "${var.oss_vault_bucket}.${local.oss_endpoint}"
    priority = 20
    port     = 80
    weight   = 10
  }
}
