# Personal Edition ACR (classic namespace/repo API).
resource "alicloud_cr_namespace" "main" {
  name               = var.acr_namespace
  auto_create        = false
  default_visibility = "PRIVATE"
}

resource "alicloud_cr_repo" "api" {
  namespace = alicloud_cr_namespace.main.name
  name      = var.acr_repo
  summary   = "${var.project} API container"
  detail    = "Next.js standalone API for Function Compute"
  repo_type = "PRIVATE"
}
