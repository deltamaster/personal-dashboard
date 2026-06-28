#!/usr/bin/env bash
# Reconcile CDN api-path conditional origin with Terraform state.
# Keeps one origin_dns_host child (routes /api/* to FC); removes wrong children under api-path.
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

prune_stale_state() {
  local addr="$1"
  if state_has "$addr"; then
    echo "Removing stale state entry: $addr"
    terraform state rm "$addr" || true
  fi
}

fetch_configs() {
  aliyun cdn DescribeCdnDomainConfigs --DomainName "$DOMAIN" --region "$REGION"
}

normalize_configs() {
  jq -c '
    .DomainConfigs.DomainConfig // []
    | if type == "array" then . else [.] end
  '
}

configure_aliyun || exit 0

echo "Syncing CDN api-path rule children for $DOMAIN..."

if ! RESP=$(fetch_configs 2>&1); then
  echo "DescribeCdnDomainConfigs failed — skipping api-path sync"
  echo "$RESP"
  exit 0
fi

CONFIGS=$(echo "$RESP" | normalize_configs)

# advanced_origin conflicts with origin_dns_host (even when switch=off).
echo "$CONFIGS" | jq -c '.[] | select(.FunctionName == "advanced_origin")' | while IFS= read -r cfg; do
  [ -z "$cfg" ] && continue
  delete_cdn_config "$(echo "$cfg" | jq -r '.ConfigId | tostring')" "advanced_origin"
done

API_PATH_PARENT_IDS=$(echo "$CONFIGS" | jq -r '
  [.[] | select(.FunctionName == "condition") |
    select(
      ((.FunctionArgs.FunctionArg // []) | if type == "array" then . else [.] end) |
      map(select(.ArgName == "rule")) | .[0].ArgValue // "" |
      test("api-path")
    ) | (.ConfigId | tostring)
  ] | unique | .[]
')

if [ -z "$API_PATH_PARENT_IDS" ]; then
  echo "No api-path condition in CDN — Terraform will create it"
  exit 0
fi

PARENT_ID=$(echo "$API_PATH_PARENT_IDS" | head -n1 | tr -d '\r\n')
echo "api-path condition ConfigId: $PARENT_ID"

import_cdn_config \
  'alicloud_cdn_domain_config.api_path_rule[0]' \
  "${DOMAIN}:condition:${PARENT_ID}" || true

# Drop renamed / obsolete state from earlier iterations.
prune_stale_state 'alicloud_cdn_domain_config.api_origin_host[0]'

if [ -z "${FC_ORIGIN_DNS:-}" ]; then
  ACCOUNT_ID=$(aliyun sts GetCallerIdentity --region "$REGION" 2>/dev/null | jq -r '.AccountId // empty')
  if [ -n "$ACCOUNT_ID" ]; then
    FC_ORIGIN_DNS="${ACCOUNT_ID}.${REGION}.fc.aliyuncs.com"
  fi
fi
echo "Expected FC origin DNS: ${FC_ORIGIN_DNS:-<unknown>}"

child_of_api_path() {
  jq -c --arg pid "$PARENT_ID" '
    [.[] | select(.ParentId != null and .ParentId != "" and (.ParentId | tostring) == $pid)
      | {ConfigId: (.ConfigId | tostring), FunctionName}]
  '
}

CHILDREN=$(echo "$CONFIGS" | child_of_api_path)
CHILD_COUNT=$(echo "$CHILDREN" | jq 'length')
echo "Children under api-path: $CHILD_COUNT"
echo "Children detail: $CHILDREN"

ORIGIN_DNS=$(echo "$CHILDREN" | jq -c '[.[] | select(.FunctionName == "origin_dns_host") | .ConfigId]')
ORIGIN_DNS_COUNT=$(echo "$ORIGIN_DNS" | jq 'length')

# Remove wrong children: origin_host under api-path, duplicate origin_dns_host, parent-linked cache rules.
echo "$CHILDREN" | jq -c '.[]' | while IFS= read -r child; do
  fn=$(echo "$child" | jq -r '.FunctionName')
  cid=$(echo "$child" | jq -r '.ConfigId')
  case "$fn" in
    origin_host|path_based_ttl_set)
      delete_cdn_config "$cid" "$fn"
      ;;
    origin_dns_host)
      if [ "$ORIGIN_DNS_COUNT" -gt 1 ]; then
        keep_id=$(echo "$ORIGIN_DNS" | jq -r '.[0]')
        state_id=""
        if state_has 'alicloud_cdn_domain_config.api_origin_dns[0]'; then
          state_id=$(state_config_id 'alicloud_cdn_domain_config.api_origin_dns[0]')
        fi
        if [ -n "$state_id" ]; then
          keep_id="$state_id"
        fi
        if [ "$cid" != "$keep_id" ]; then
          delete_cdn_config "$cid" "$fn"
        fi
      fi
      ;;
  esac
done

RESP=$(fetch_configs)
CONFIGS=$(echo "$RESP" | normalize_configs)
ORIGIN_DNS=$(echo "$CONFIGS" | child_of_api_path | jq -c '[.[] | select(.FunctionName == "origin_dns_host") | .ConfigId]')
ORIGIN_DNS_COUNT=$(echo "$ORIGIN_DNS" | jq 'length')

if [ "$ORIGIN_DNS_COUNT" -eq 0 ]; then
  prune_stale_state 'alicloud_cdn_domain_config.api_origin_dns[0]'
  echo "No origin_dns_host child — Terraform will create api_origin_dns"
else
  CLOUD_DNS_ID=$(echo "$ORIGIN_DNS" | jq -r '.[0]')
  echo "Cloud origin_dns_host ConfigId: $CLOUD_DNS_ID"
  import_cdn_config \
    'alicloud_cdn_domain_config.api_origin_dns[0]' \
    "${DOMAIN}:origin_dns_host:${CLOUD_DNS_ID}" || {
      echo "Import failed — deleting cloud origin_dns_host so Terraform can recreate"
      delete_cdn_config "$CLOUD_DNS_ID" "origin_dns_host"
    }
fi

# Top-level origin_host for FC CNAME (no ParentId) — per-origin Host header.
TOP_LEVEL_HOSTS=$(echo "$CONFIGS" | jq -c '
  [.[] | select(.FunctionName == "origin_host")
    | select(.ParentId == null or .ParentId == "" or (.ParentId | tostring) == "0")
    | {ConfigId: (.ConfigId | tostring), FunctionName}]
')

echo "Top-level origin_host configs: $TOP_LEVEL_HOSTS"

if [ -n "$FC_ORIGIN_DNS" ]; then
  MATCHING_HOST=$(echo "$CONFIGS" | jq -r --arg origin "$FC_ORIGIN_DNS" '
    [.[] | select(.FunctionName == "origin_host")
      | select(.ParentId == null or .ParentId == "" or (.ParentId | tostring) == "0")
      | select(
          ((.FunctionArgs.FunctionArg // []) | if type == "array" then . else [.] end)
          | map(select(.ArgName == "origin")) | .[0].ArgValue // "" | . == $origin
        )
      | (.ConfigId | tostring)][0] // empty
  ')
  if [ -n "$MATCHING_HOST" ]; then
    import_cdn_config \
      'alicloud_cdn_domain_config.api_fc_origin_host[0]' \
      "${DOMAIN}:origin_host:${MATCHING_HOST}" || true
  fi
fi

echo "CDN api-path sync complete"
