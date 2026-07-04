#!/usr/bin/env bash
# Adopt resources created outside Terraform state (e.g. partial CI applies).
set -euo pipefail

OTS_INSTANCE="${OTS_INSTANCE:-pd-dashboard}"
FC_FUNCTION="${FC_FUNCTION:-api}"
FC_HTTP_TRIGGER="${FC_HTTP_TRIGGER:-http}"
FC_RUNTIME_MIGRATED=0

ALIYUN_FC_PROFILE="import-fc"

configure_aliyun_cli() {
  if ! command -v aliyun >/dev/null 2>&1; then
    return 1
  fi
  local region="${ALICLOUD_REGION:-cn-shanghai}"
  if [ -z "${ALICLOUD_ACCESS_KEY:-}" ] || [ -z "${ALICLOUD_SECRET_KEY:-}" ]; then
    return 1
  fi

  aliyun configure set \
    --profile import-base \
    --mode AK \
    --access-key-id "$ALICLOUD_ACCESS_KEY" \
    --access-key-secret "$ALICLOUD_SECRET_KEY" \
    --region "$region" >/dev/null

  # FC delete/update requires AssumeRole — raw RAM user lacks fc:DeleteFunction.
  if [ -n "${ALICLOUD_ROLE_ARN:-}" ]; then
    local creds
    creds=$(aliyun sts AssumeRole \
      --RoleArn "$ALICLOUD_ROLE_ARN" \
      --RoleSessionName "terraform-import-fc" \
      --DurationSeconds 3600 \
      --profile import-base)
    aliyun configure set \
      --profile "$ALIYUN_FC_PROFILE" \
      --mode StsToken \
      --access-key-id "$(echo "$creds" | jq -r '.Credentials.AccessKeyId')" \
      --access-key-secret "$(echo "$creds" | jq -r '.Credentials.AccessKeySecret')" \
      --sts-token "$(echo "$creds" | jq -r '.Credentials.SecurityToken')" \
      --region "$region" >/dev/null
  else
    aliyun configure set \
      --profile "$ALIYUN_FC_PROFILE" \
      --mode AK \
      --access-key-id "$ALICLOUD_ACCESS_KEY" \
      --access-key-secret "$ALICLOUD_SECRET_KEY" \
      --region "$region" >/dev/null
  fi
  return 0
}

fc_api() {
  aliyun fc "$@" --profile "$ALIYUN_FC_PROFILE" --region "${ALICLOUD_REGION:-cn-shanghai}"
}

# FC v3 cannot change runtime in-place (custom-container → custom.debian10). Delete legacy
# function via AssumeRole, drop from state, and let Terraform create the zip runtime.
migrate_legacy_fc_container_runtime() {
  if ! configure_aliyun_cli; then
    echo "aliyun CLI not configured — skipping FC runtime migration check"
    return 0
  fi

  local runtime=""
  local get_rc=0
  runtime=$(fc_api GET "/2023-03-30/functions/${FC_FUNCTION}" 2>/dev/null | jq -r '.runtime // empty') || get_rc=$?

  if [ "$get_rc" -ne 0 ] || [ -z "$runtime" ]; then
    if terraform state show alicloud_fcv3_function.api >/dev/null 2>&1; then
      echo "FC function ${FC_FUNCTION} absent in cloud but present in state — clearing FC state for recreate"
      for addr in \
        'alicloud_fcv3_custom_domain.api[0]' \
        alicloud_fcv3_custom_domain.api \
        alicloud_fcv3_provision_config.api \
        alicloud_fcv3_trigger.http \
        alicloud_fcv3_function.api; do
        if terraform state show "$addr" >/dev/null 2>&1; then
          echo "  terraform state rm $addr"
          terraform state rm "$addr"
        fi
      done
      FC_RUNTIME_MIGRATED=1
    fi
    return 0
  fi

  if [ "$runtime" != "custom-container" ]; then
    return 0
  fi

  echo "::warning::Legacy FC function ${FC_FUNCTION} uses custom-container — removing for custom.debian10 zip runtime migration"

  local custom_domain="${FC_CUSTOM_DOMAIN:-api.${CDN_DOMAIN:-pd.huhansen.cn}}"
  fc_api DELETE "/2023-03-30/custom-domains/${custom_domain}" >/dev/null 2>&1 || true
  fc_api DELETE "/2023-03-30/functions/${FC_FUNCTION}/triggers/${FC_HTTP_TRIGGER}" >/dev/null 2>&1 || true
  if ! fc_api DELETE "/2023-03-30/functions/${FC_FUNCTION}" >/dev/null 2>&1; then
    echo "::error::Failed to delete legacy FC function ${FC_FUNCTION} (need fc:DeleteFunction on AssumeRole)"
    fc_api GET "/2023-03-30/functions/${FC_FUNCTION}" 2>&1 || true
    exit 1
  fi

  # Confirm delete succeeded — do not re-import custom-container into state.
  if fc_api GET "/2023-03-30/functions/${FC_FUNCTION}" >/dev/null 2>&1; then
    echo "::error::FC function ${FC_FUNCTION} still exists after delete — aborting before re-import"
    exit 1
  fi

  for addr in \
    'alicloud_fcv3_custom_domain.api[0]' \
    alicloud_fcv3_custom_domain.api \
    alicloud_fcv3_provision_config.api \
    alicloud_fcv3_trigger.http \
    alicloud_fcv3_function.api; do
    if terraform state show "$addr" >/dev/null 2>&1; then
      echo "  terraform state rm $addr"
      terraform state rm "$addr"
    fi
  done

  FC_RUNTIME_MIGRATED=1
  echo "Legacy FC function removed — Terraform will create custom.debian10 runtime"
}

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

# Search indexes were removed from Terraform; drop any leftover state so apply does not
# re-attempt destroys or fight address moves.
prune_retired_ots_search_index_state() {
  local addrs
  addrs=$(terraform state list 2>/dev/null | grep '^alicloud_ots_search_index\.indexes' || true)
  if [ -z "$addrs" ]; then
    return 0
  fi
  echo "Pruning retired OTS search index state (no longer managed in Terraform)"
  while IFS= read -r addr; do
    [ -z "$addr" ] && continue
    echo "  terraform state rm $addr"
    terraform state rm "$addr"
  done <<< "$addrs"
}

# Prevent duplicate api / api[0] FC custom-domain state from destroying the live domain.
reconcile_fc_custom_domain_state() {
  local domain="${FC_CUSTOM_DOMAIN:-}"
  if [ -z "$domain" ] && [ -n "${CDN_DOMAIN:-}" ]; then
    domain="api.${CDN_DOMAIN}"
  fi
  if [ -z "$domain" ]; then
    return 0
  fi

  local legacy_addr="alicloud_fcv3_custom_domain.api"
  local indexed_addr='alicloud_fcv3_custom_domain.api[0]'
  local has_legacy=0 has_indexed=0

  terraform state show "$legacy_addr" >/dev/null 2>&1 && has_legacy=1
  terraform state show "$indexed_addr" >/dev/null 2>&1 && has_indexed=1

  if [ "$has_legacy" = "1" ] && [ "$has_indexed" = "1" ]; then
    echo "Duplicate FC custom domain in state — removing legacy $legacy_addr (cloud resource stays under api[0])"
    terraform state rm "$legacy_addr"
    has_legacy=0
  elif [ "$has_legacy" = "1" ] && [ "$has_indexed" = "0" ]; then
    echo "Migrating FC custom domain state: $legacy_addr -> $indexed_addr"
    terraform state mv "$legacy_addr" "$indexed_addr"
    has_legacy=0
    has_indexed=1
  fi

  if ! configure_aliyun_cli; then
    echo "aliyun CLI unavailable — skipping FC custom domain cloud/state sync"
    return 0
  fi

  local cloud_exists=0
  if fc_api GET "/2023-03-30/custom-domains/${domain}" >/dev/null 2>&1; then
    cloud_exists=1
  fi

  if [ "$cloud_exists" = "1" ]; then
    if [ "$has_indexed" = "0" ]; then
      import_if_missing "$indexed_addr" "$domain"
    fi
    return 0
  fi

  if [ "$has_indexed" = "1" ]; then
    echo "FC custom domain ${domain} missing in cloud — removing stale state $indexed_addr so Terraform can recreate"
    terraform state rm "$indexed_addr"
  fi
  if [ "$has_legacy" = "1" ]; then
    echo "FC custom domain ${domain} missing in cloud — removing stale state $legacy_addr"
    terraform state rm "$legacy_addr"
  fi
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
  prune_retired_ots_search_index_state
fi

migrate_legacy_fc_container_runtime

if [ "$FC_RUNTIME_MIGRATED" = "1" ]; then
  echo "Skipping FC import — fresh custom.debian10 function will be created by Terraform"
else
  import_if_missing alicloud_fcv3_function.api "$FC_FUNCTION"

  if ! terraform state show alicloud_fcv3_function.api >/dev/null 2>&1; then
    echo "FC function ${FC_FUNCTION} not in state — clearing orphaned FC entries"
    prune_state_prefix "alicloud_fcv3_"
  else
    import_if_missing alicloud_fcv3_trigger.http "${FC_FUNCTION}:${FC_HTTP_TRIGGER}"
    import_if_missing alicloud_fcv3_provision_config.api "$FC_FUNCTION"
    reconcile_fc_custom_domain_state
  fi
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

  # Reconcile api-path rule-engine children (fixes ConfigParentExceedLimit on partial applies).
  if [ -f scripts/cdn-sync-api-origin.sh ]; then
    bash scripts/cdn-sync-api-origin.sh
  fi
fi

OSS_WWW_BUCKET="${OSS_WWW_BUCKET:-huhansen-www}"
WWW_CDN_DOMAIN="${WWW_CDN_DOMAIN:-www.huhansen.cn}"

import_if_missing 'alicloud_oss_bucket.www[0]' "$OSS_WWW_BUCKET"
import_if_missing 'alicloud_oss_bucket_public_access_block.www[0]' "$OSS_WWW_BUCKET"
import_if_missing 'alicloud_oss_bucket_acl.www[0]' "$OSS_WWW_BUCKET"
import_if_missing 'alicloud_oss_bucket_website.www[0]' "$OSS_WWW_BUCKET"

if [ -n "${WWW_CDN_DOMAIN:-}" ]; then
  import_if_missing 'alicloud_cdn_domain_new.www[0]' "$WWW_CDN_DOMAIN"
fi
