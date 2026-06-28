#!/usr/bin/env bash
# Adopt resources created outside Terraform state (e.g. partial CI applies).
set -euo pipefail

OTS_INSTANCE="${OTS_INSTANCE:-pd-dashboard}"
SEARCH_INDEX_TYPE="${SEARCH_INDEX_TYPE:-Search}"
FC_FUNCTION="${FC_FUNCTION:-api}"
FC_HTTP_TRIGGER="${FC_HTTP_TRIGGER:-http}"

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

prune_state_prefix() {
  local prefix="$1"
  local addrs
  addrs=$(terraform state list 2>/dev/null | grep "^${prefix}" || true)
  if [ -z "$addrs" ]; then
    return 0
  fi
  echo "Pruning stale state entries matching ${prefix}*"
  while IFS= read -r addr; do
    [ -z "$addr" ] && continue
    echo "  terraform state rm $addr"
    terraform state rm "$addr"
  done <<< "$addrs"
}

import_if_missing alicloud_ots_instance.main "$OTS_INSTANCE"

if ! terraform state show alicloud_ots_instance.main >/dev/null 2>&1; then
  echo "OTS instance ${OTS_INSTANCE} not in state — clearing orphaned OTS entries"
  prune_state_prefix "alicloud_ots_"
fi

OTS_TABLES=(
  pd_holdings
  pd_snapshots
  pd_visits
  pd_visit_images
  pd_flights
  pd_trains
  pd_movies
)

if terraform state show alicloud_ots_instance.main >/dev/null 2>&1; then
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

import_if_missing alicloud_fcv3_function.api "$FC_FUNCTION"

if ! terraform state show alicloud_fcv3_function.api >/dev/null 2>&1; then
  echo "FC function ${FC_FUNCTION} not in state — clearing orphaned FC entries"
  prune_state_prefix "alicloud_fcv3_"
else
  import_if_missing alicloud_fcv3_trigger.http "${FC_FUNCTION}:${FC_HTTP_TRIGGER}"
  import_if_missing alicloud_fcv3_provision_config.api "$FC_FUNCTION"
fi

OSS_WEB_BUCKET="${OSS_WEB_BUCKET:-huhansen-web}"
OSS_VAULT_BUCKET="${OSS_VAULT_BUCKET:-personal-dashboard-vault}"

import_if_missing alicloud_oss_bucket.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_public_access_block.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket.vault "$OSS_VAULT_BUCKET"
import_if_missing alicloud_oss_bucket_acl.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_acl.vault "$OSS_VAULT_BUCKET"
import_if_missing alicloud_oss_bucket_website.web "$OSS_WEB_BUCKET"
import_if_missing alicloud_oss_bucket_cors.vault "$OSS_VAULT_BUCKET"

if [ -n "${CDN_DOMAIN:-}" ]; then
  if terraform state show 'alicloud_cdn_domain_new.main[0]' >/dev/null 2>&1; then
    echo "Already in state: alicloud_cdn_domain_new.main[0]"
  else
    echo "Importing alicloud_cdn_domain_new.main[0] ($CDN_DOMAIN)..."
    # shellcheck disable=SC2046
    if terraform import $(tf_cli_args) 'alicloud_cdn_domain_new.main[0]' "$CDN_DOMAIN"; then
      echo "Imported CDN domain: $CDN_DOMAIN"
    else
      echo "CDN import skipped (domain may not exist yet — Terraform will create it)"
    fi
  fi
fi
