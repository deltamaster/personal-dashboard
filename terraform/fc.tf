resource "alicloud_fcv3_function" "api" {
  function_name = var.fc_function_name
  description   = "${var.project} API (Next.js + Auth.js)"
  runtime       = "custom.debian10"
  handler       = "bootstrap"
  memory_size   = 1024
  cpu           = 0.5
  disk_size     = 512
  timeout       = 60
  instance_concurrency = 1
  internet_access      = true

  role = var.fc_execution_role_arn != "" ? var.fc_execution_role_arn : null

  custom_runtime_config {
    command = ["/var/fc/lang/nodejs20/bin/node"]
    args    = ["server.js"]
    port    = 9000
  }

  code {
    oss_bucket_name = alicloud_oss_bucket.vault.bucket
    oss_object_name = local.fc_code_key
  }

  environment_variables = local.fc_env

  log_config {
    log_begin_rule = "None"
  }

  lifecycle {
    ignore_changes = [
      code,
    ]
  }

  depends_on = [alicloud_oss_bucket_object.fc_code]
}

resource "alicloud_fcv3_trigger" "http" {
  function_name  = alicloud_fcv3_function.api.function_name
  trigger_type   = "http"
  trigger_name   = "http"
  description    = "Public HTTP trigger for CDN /api/* origin"
  qualifier      = "LATEST"
  trigger_config = jsonencode({
    authType = "anonymous"
    methods  = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]
  })
}

# Explicitly zero provisioned instances (pay-per-use only).
resource "alicloud_fcv3_provision_config" "api" {
  function_name = alicloud_fcv3_function.api.function_name
  qualifier     = "LATEST"
  target        = 0
}

# OAuth sign-in returns 302 to Microsoft; FC blocks external redirects on *.fcapp.run.
# Bind the public app domain so CDN can back-to-origin with Host: var.domain.
resource "alicloud_fcv3_custom_domain" "api" {
  custom_domain_name = var.domain
  protocol           = "HTTP"

  route_config {
    routes {
      path          = "/api/*"
      function_name = alicloud_fcv3_function.api.function_name
      qualifier     = "LATEST"
      methods       = ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"]
    }
  }

  depends_on = [alicloud_fcv3_trigger.http]
}
