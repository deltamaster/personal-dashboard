resource "alicloud_oss_bucket" "web" {
  bucket = var.oss_web_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_acl" "web" {
  bucket = alicloud_oss_bucket.web.id
  acl    = "public-read"
}

resource "alicloud_oss_bucket_website" "web" {
  bucket = alicloud_oss_bucket.web.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key         = "404.html"
    http_status = 404
  }
}

resource "alicloud_oss_bucket" "vault" {
  bucket = var.oss_vault_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_acl" "vault" {
  bucket = alicloud_oss_bucket.vault.id
  acl    = "private"
}

resource "alicloud_oss_bucket_cors" "vault" {
  bucket = alicloud_oss_bucket.vault.id

  cors_rule {
    allowed_origins = ["https://${var.domain}"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
