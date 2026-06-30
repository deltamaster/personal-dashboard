terraform {
  required_version = ">= 1.3.0"

  # State is persisted by GitHub Actions (cache + artifact), not OSS — same model
  # as the root stack. See .github/workflows/terraform-qa.yml.

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.230.0"
    }
  }
}
