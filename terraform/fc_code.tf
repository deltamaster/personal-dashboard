resource "alicloud_oss_bucket_object" "fc_code" {
  bucket = alicloud_oss_bucket.vault.bucket
  key    = local.fc_code_key
  source = data.archive_file.fc_bootstrap.output_path

  lifecycle {
    ignore_changes = all
  }
}
