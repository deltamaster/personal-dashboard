# FC custom domain gained `count` when create_fc_custom_domain was added (commit 1b9db0d).
# Without this, cached state at the old address is destroyed on apply — deleting the live domain.
moved {
  from = alicloud_fcv3_custom_domain.api
  to   = alicloud_fcv3_custom_domain.api[0]
}

# www_songs moved onto the shared table map so QA and Shanghai both have it.
moved {
  from = alicloud_ots_table.www_songs[0]
  to   = alicloud_ots_table.tables["www_songs"]
}
