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

resource "alicloud_ots_search_index" "indexes" {
  for_each = local.ots_search_indexes

  instance_name = alicloud_ots_instance.main.name
  table_name    = each.key
  index_name    = each.value.index_name
  time_to_live  = -1

  schema {
    dynamic "field_schema" {
      for_each = merge(
        { (each.value.pk_name) = "Text" },
        each.value.fields
      )
      content {
        field_name          = field_schema.key
        field_type          = field_schema.value
        index               = true
        store               = true
        analyzer            = field_schema.value == "Text" ? "SingleWord" : null
        enable_sort_and_agg = field_schema.value == "Long" ? true : null
      }
    }
  }

  depends_on = [alicloud_ots_table.tables]
}
