# Mirrors the production OSS schema: a public-read web bucket and a private vault
# bucket. The QA app normally runs locally (npm run dev), so the web bucket is
# optional for serving but kept to clone the prod layout.

resource "alicloud_oss_bucket" "web" {
  bucket = var.oss_web_bucket
  tags   = local.tags
}

resource "alicloud_oss_bucket_public_access_block" "web" {
  bucket              = alicloud_oss_bucket.web.id
  block_public_access = false
}

resource "alicloud_oss_bucket_acl" "web" {
  bucket = alicloud_oss_bucket.web.id
  acl    = "public-read"

  depends_on = [alicloud_oss_bucket_public_access_block.web]
}

resource "alicloud_oss_bucket_website" "web" {
  bucket = alicloud_oss_bucket.web.id

  index_document {
    suffix          = "index.html"
    support_sub_dir = true
    type            = "0"
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
    allowed_origins = [var.vault_cors_allowed_origin]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_headers = ["*"]
    max_age_seconds = 3600
  }
}
