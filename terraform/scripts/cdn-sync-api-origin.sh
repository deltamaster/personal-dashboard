#!/usr/bin/env bash
# Reconcile CDN rules-engine children under api-path with Terraform state.
# Fixes ConfigParentExceedLimit when orphan origin_host / origin_dns_host configs exist in cloud
# but are missing from (or out of sync with) Terraform state.
set -euo pipefail

DOMAIN="${CDN_DOMAIN:-}"
REGION="${ALICLOUD_REGION:-${TF_VAR_region:-ap-southeast-1}}"

if [ -z "$DOMAIN" ]; then
  echo "CDN_DOMAIN not set — skipping api-path sync"
  exit 0
fi

if ! command -v aliyun >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "aliyun CLI or jq missing — skipping api-path sync"
  exit 0
fi

configure_aliyun() {
  local ak="${ALICLOUD_ACCESS_KEY:-${ALIBABA_CLOUD_ACCESS_KEY_ID:-}}"
  local sk="${ALICLOUD_SECRET_KEY:-${ALIBABA_CLOUD_ACCESS_KEY_SECRET:-}}"
  local role="${ALICLOUD_ROLE_ARN:-${ALIBABA_CLOUD_ROLE_ARN:-${TF_VAR_role_arn:-}}}"

  if [ -z "$ak" ] || [ -z "$sk" ]; then
    echo "No Alibaba credentials — skipping api-path sync"
    return 1
  fi

  aliyun configure set \
    --profile default \
    --mode AK \
    --access-key-id "$ak" \
    --access-key-secret "$sk" \
    --region "$REGION" >/dev/null

  if [ -n "$role" ]; then
    local creds
    creds=$(aliyun sts AssumeRole \
      --RoleArn "$role" \
      --RoleSessionName "terraform-cdn-sync" \
      --DurationSeconds 3600)
    ak=$(echo "$creds" | jq -r '.Credentials.AccessKeyId')
    sk=$(echo "$creds" | jq -r '.Credentials.AccessKeySecret')
    local token
    token=$(echo "$creds" | jq -r '.Credentials.SecurityToken')
    aliyun configure set \
      --profile default \
      --mode StsToken \
      --access-key-id "$ak" \
      --access-key-secret "$sk" \
      --sts-token "$token" \
      --region "$REGION" >/dev/null
  fi
}

delete_cdn_config() {
  local config_id="$1"
  local function_name="$2"
  echo "  DeleteSpecificConfig: $function_name ($config_id)"
  aliyun cdn DeleteSpecificConfig \
    --DomainName "$DOMAIN" \
    --ConfigId "$config_id" \
    --region "$REGION"
}

state_has() {
  terraform state show "$1" >/dev/null 2>&1
}

state_config_id() {
  terraform state show "$1" 2>/dev/null | awk -F'"' '/^[[:space:]]*config_id[[:space:]]*=/ {print $2; exit}'
}

import_cdn_config() {
  local addr="$1"
  local import_id="$2"
  if state_has "$addr"; then
    echo "Already in state: $addr"
    return 0
  fi
  echo "Importing $addr ($import_id)..."
  local args=(-input=false)
  if [ -n "${TFVARS_FILE:-}" ] && [ -f "$TFVARS_FILE" ]; then
    args+=(-var-file="$TFVARS_FILE")
  fi
  if terraform import "${args[@]}" "$addr" "$import_id"; then
    echo "Imported: $addr"
  else
    echo "Import failed: $addr ($import_id)"
    return 1
  fi
}

configure_aliyun || exit 0

echo "Syncing CDN api-path rule children for $DOMAIN..."

if ! RESP=$(aliyun cdn DescribeCdnDomainConfigs --DomainName "$DOMAIN" --region "$REGION" 2>&1); then
  echo "DescribeCdnDomainConfigs failed (domain may not exist yet) — skipping api-path sync"
  echo "$RESP"
  exit 0
fi
CONFIGS=$(echo "$RESP" | jq -c '
  .DomainConfigs.DomainConfig // []
  | if type == "array" then . else [.] end
')

API_PATH_PARENT_IDS=$(echo "$CONFIGS" | jq -r '
  [.[] | select(.FunctionName == "condition") |
    select(
      ((.FunctionArgs.FunctionArg // []) | if type == "array" then . else [.] end) |
      map(select(.ArgName == "rule")) | .[0].ArgValue // "" |
      test("api-path")
    ) | .ConfigId
  ] | unique | .[]
')

if [ -z "$API_PATH_PARENT_IDS" ]; then
  echo "No api-path condition in CDN — Terraform will create it"
  exit 0
fi

PARENT_COUNT=$(echo "$API_PATH_PARENT_IDS" | wc -l | tr -d ' ')
if [ "$PARENT_COUNT" -gt 1 ]; then
  echo "Warning: multiple api-path conditions found; using the first"
fi

PARENT_ID=$(echo "$API_PATH_PARENT_IDS" | head -n1)
echo "api-path condition ConfigId: $PARENT_ID"

import_cdn_config \
  'alicloud_cdn_domain_config.api_path_rule[0]' \
  "${DOMAIN}:condition:${PARENT_ID}" || true

CHILDREN=$(echo "$CONFIGS" | jq -c --arg pid "$PARENT_ID" '
  [.[] | select(.ParentId == $pid) | {ConfigId, FunctionName}]
')

CHILD_COUNT=$(echo "$CHILDREN" | jq 'length')
echo "Children under api-path: $CHILD_COUNT"

if [ "$CHILD_COUNT" -eq 0 ]; then
  if state_has 'alicloud_cdn_domain_config.api_origin_host[0]'; then
    echo "Removing stale state entry (no cloud child): alicloud_cdn_domain_config.api_origin_host[0]"
    terraform state rm 'alicloud_cdn_domain_config.api_origin_host[0]' || true
  fi
  exit 0
fi

ORIGIN_HOSTS=$(echo "$CHILDREN" | jq -c '[.[] | select(.FunctionName == "origin_host")]')
ORIGIN_COUNT=$(echo "$ORIGIN_HOSTS" | jq 'length')
STATE_ORIGIN_ID=""
if state_has 'alicloud_cdn_domain_config.api_origin_host[0]'; then
  STATE_ORIGIN_ID=$(state_config_id 'alicloud_cdn_domain_config.api_origin_host[0]')
  echo "Terraform state origin_host ConfigId: ${STATE_ORIGIN_ID:-<unknown>}"
fi

# Remove non-origin_host children (origin_dns_host, path_based_ttl_set with parent, etc.)
echo "$CHILDREN" | jq -c '.[] | select(.FunctionName != "origin_host")' | while IFS= read -r child; do
  cid=$(echo "$child" | jq -r '.ConfigId')
  fn=$(echo "$child" | jq -r '.FunctionName')
  delete_cdn_config "$cid" "$fn"
done

# Re-fetch after deletes
RESP=$(aliyun cdn DescribeCdnDomainConfigs --DomainName "$DOMAIN" --region "$REGION")
CONFIGS=$(echo "$RESP" | jq -c '
  .DomainConfigs.DomainConfig // []
  | if type == "array" then . else [.] end
')
ORIGIN_HOSTS=$(echo "$CONFIGS" | jq -c --arg pid "$PARENT_ID" '
  [.[] | select(.ParentId == $pid and .FunctionName == "origin_host") | .ConfigId]
')
ORIGIN_COUNT=$(echo "$ORIGIN_HOSTS" | jq 'length')

if [ "$ORIGIN_COUNT" -eq 0 ]; then
  if state_has 'alicloud_cdn_domain_config.api_origin_host[0]'; then
    echo "Removing stale state entry: alicloud_cdn_domain_config.api_origin_host[0]"
    terraform state rm 'alicloud_cdn_domain_config.api_origin_host[0]' || true
  fi
  echo "No origin_host child — Terraform will create api_origin_host"
  exit 0
fi

if [ "$ORIGIN_COUNT" -gt 1 ]; then
  echo "Multiple origin_host children — keeping one, deleting extras"
  KEEP_ID=""
  if [ -n "$STATE_ORIGIN_ID" ]; then
    if echo "$ORIGIN_HOSTS" | jq -e --arg id "$STATE_ORIGIN_ID" 'index($id)' >/dev/null; then
      KEEP_ID="$STATE_ORIGIN_ID"
    fi
  fi
  if [ -z "$KEEP_ID" ]; then
    KEEP_ID=$(echo "$ORIGIN_HOSTS" | jq -r '.[0]')
  fi
  echo "$ORIGIN_HOSTS" | jq -r '.[]' | while read -r cid; do
    if [ "$cid" != "$KEEP_ID" ]; then
      delete_cdn_config "$cid" "origin_host"
    fi
  done
  CLOUD_ORIGIN_ID="$KEEP_ID"
else
  CLOUD_ORIGIN_ID=$(echo "$ORIGIN_HOSTS" | jq -r '.[0]')
fi

echo "Cloud origin_host ConfigId: $CLOUD_ORIGIN_ID"

if state_has 'alicloud_cdn_domain_config.api_origin_host[0]'; then
  if [ -n "$STATE_ORIGIN_ID" ] && [ "$STATE_ORIGIN_ID" != "$CLOUD_ORIGIN_ID" ]; then
    echo "State/cloud origin_host mismatch — removing state entry for recreate"
    terraform state rm 'alicloud_cdn_domain_config.api_origin_host[0]' || true
    delete_cdn_config "$CLOUD_ORIGIN_ID" "origin_host"
    echo "Terraform will create api_origin_host"
  else
    echo "origin_host in sync"
  fi
else
  import_cdn_config \
    'alicloud_cdn_domain_config.api_origin_host[0]' \
    "${DOMAIN}:origin_host:${CLOUD_ORIGIN_ID}" || {
      echo "Import failed — deleting cloud origin_host so Terraform can create it"
      delete_cdn_config "$CLOUD_ORIGIN_ID" "origin_host"
    }
fi

echo "CDN api-path sync complete"
