resource "alicloud_oss_bucket" "web" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = var.oss_web_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_acl" "web" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = alicloud_oss_bucket.web[0].id
  acl    = "public-read"
}

resource "alicloud_oss_bucket_website" "web" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = alicloud_oss_bucket.web[0].id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "404.html"
  }
}

resource "alicloud_oss_bucket" "vault" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = var.oss_vault_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_acl" "vault" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = alicloud_oss_bucket.vault[0].id
  acl    = "private"
}

resource "alicloud_oss_bucket_cors" "vault" {
  count  = var.create_oss_buckets ? 1 : 0
  bucket = alicloud_oss_bucket.vault[0].id

  cors_rule {
    allowed_origins = ["https://${var.domain}"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
