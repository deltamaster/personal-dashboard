data "archive_file" "fc_bootstrap" {
  type        = "zip"
  output_path = "${path.module}/.generated/fc-bootstrap.zip"

  source {
    content  = file("${path.module}/../fc/bootstrap")
    filename = "bootstrap"
  }

  source {
    content  = file("${path.module}/fc-placeholder-server.js")
    filename = "server.js"
  }
}
