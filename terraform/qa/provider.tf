provider "alicloud" {
  region     = var.region
  access_key = var.access_key
  secret_key = var.secret_key

  assume_role {
    role_arn     = var.role_arn
    session_name = var.role_session_name
  }
}
