terraform {
  required_version = ">= 1.3.0"

  backend "oss" {}

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.230.0"
    }
  }
}
