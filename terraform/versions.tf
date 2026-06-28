terraform {
  required_version = ">= 1.3.0"

  # State is persisted by GitHub Actions (cache + artifact), not OSS.
  # Alibaba accounts with OSS API restrictions (UserDisable) cannot use an OSS backend.

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.230.0"
    }
  }
}
