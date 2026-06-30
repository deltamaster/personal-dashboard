#!/usr/bin/env bash
# Adopt QA resources created outside Terraform state (e.g. a CDN domain already
# added in the console, or a partial apply) so re-apply is idempotent — mirrors
# the production scripts/import-existing.sh, scoped to the QA root.
set -euo pipefail

OTS_INSTANCE="${OTS_INSTANCE:-pd-dash-qa}"
SEARCH_INDEX_TYPE="${SEARCH_INDEX_TYPE:-Search}"
OSS_WEB_BUCKET="${OSS_WEB_BUCKET:-pd-web-qa}"
OSS_VAULT_BUCKET="${OSS_VAULT_BUCKET:-pd-vault-qa}"
CDN_DOMAIN="${CDN_DOMAIN:-pd-qa.huhansen.com}"

tf_cli_args() {
  local args=(-input=false)
  if [ -n "${TFVARS_FILE:-}" ] && [ -f "$TFVARS_FILE" ]; then
    args+=(-var-file="$TFVARS_FILE")
  fi
  printf '%s\n' "${args[@]}"
}

import_if_missing() {
  local addr="$1"
  local id="$2"
  if terraform state show "$addr" >/dev/null 2>&1; then
    echo "Already in state: $addr"
    return 0
  fi
  echo "Importing $addr ($id)..."
  # shellcheck disable=SC2046
  if terraform import $(tf_cli_args) "$addr" "$id"; then
    echo "Imported: $addr"
  else
    echo "Import skipped: $addr ($id)"
  fi
}

import_if_missing alicloud_ots_instance.main "$OTS_INSTANCE"

if terraform state show alicloud_ots_instance.main >/dev/null 2>&1; then
  OTS_TABLES=(pd_holdings pd_snapshots pd_visits pd_visit_images pd_flights pd_trains pd_movies)
  for table in "${OTS_TABLES[@]}"; do
    import_if_missing "alicloud_ots_table.tables[\"$table\"]" "${OTS_INSTANCE}:${table}"
  done

  declare -A OTS_SEARCH_INDEXES=(
    [pd_holdings]="idx_holdings"
    [pd_visits]="idx_visits"
    [pd_flights]="idx_flights"
    [pd_trains]="idx_trains"
    [pd_movies]="idx_movies"
    [pd_visit_images]="idx_visit_images"
  )
  for table in "${!OTS_SEARCH_INDEXES[@]}"; do
    index="${OTS_SEARCH_INDEXES[$table]}"
    import_if_missing \
      "alicloud_ots_search_index.indexes[\"$table\"]" \
      "${OTS_INSTANCE}:${table}:${index}:${SEARCH_INDEX_TYPE}"
  done
fi

import_if_missing alicloud_oss_bucket.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_public_access_block.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_acl.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_website.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket.vault "$OSS_VAULT_BUCKET"
import_if_missing alicloud_oss_bucket_public_access_block.vault "$OSS_VAULT_BUCKET"
import_if_missing alicloud_oss_bucket_acl.vault "$OSS_VAULT_BUCKET"
import_if_missing alicloud_oss_bucket_cors.vault "$OSS_VAULT_BUCKET"

if [ -n "${CDN_DOMAIN:-}" ]; then
  import_if_missing 'alicloud_cdn_domain_new.media[0]' "$CDN_DOMAIN"
fi
