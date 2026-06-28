resource "alicloud_ots_instance" "main" {
  name        = var.ots_instance_name
  description = var.project
  accessed_by = "Any"

  tags = local.tags
}

resource "alicloud_ots_table" "tables" {
  for_each = local.ots_tables

  instance_name = alicloud_ots_instance.main.name
  table_name    = each.key
  time_to_live  = -1
  max_version   = 1

  primary_key {
    name = each.value.pk_name
    type = each.value.pk_type
  }
}
