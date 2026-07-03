#!/usr/bin/env bash
# FC custom-domain binding requires api.{domain} CNAME → {account_id}.{region}.fc.aliyuncs.com.
set -euo pipefail

CDN_DOMAIN="${CDN_DOMAIN:-}"
FC_CUSTOM_DOMAIN="${FC_CUSTOM_DOMAIN:-}"
REGION="${ALICLOUD_REGION:-cn-shanghai}"

if [ -z "$CDN_DOMAIN" ]; then
  echo "CDN_DOMAIN not set — skipping FC custom-domain DNS check"
  exit 0
fi

FC_CUSTOM_DOMAIN="${FC_CUSTOM_DOMAIN:-api.${CDN_DOMAIN}}"

configure_aliyun() {
  [ -n "${ALICLOUD_ACCESS_KEY:-}" ] && [ -n "${ALICLOUD_SECRET_KEY:-}" ] || return 1
  aliyun configure set \
    --profile fc-dns-base \
    --mode AK \
    --access-key-id "$ALICLOUD_ACCESS_KEY" \
    --access-key-secret "$ALICLOUD_SECRET_KEY" \
    --region "$REGION" >/dev/null

  if [ -n "${ALICLOUD_ROLE_ARN:-}" ]; then
    local creds
    creds=$(aliyun sts AssumeRole \
      --RoleArn "$ALICLOUD_ROLE_ARN" \
      --RoleSessionName "fc-dns-verify" \
      --DurationSeconds 900 \
      --profile fc-dns-base)
    aliyun configure set \
      --profile fc-dns \
      --mode StsToken \
      --access-key-id "$(echo "$creds" | jq -r '.Credentials.AccessKeyId')" \
      --access-key-secret "$(echo "$creds" | jq -r '.Credentials.AccessKeySecret')" \
      --sts-token "$(echo "$creds" | jq -r '.Credentials.SecurityToken')" \
      --region "$REGION" >/dev/null
  else
    aliyun configure set \
      --profile fc-dns \
      --mode AK \
      --access-key-id "$ALICLOUD_ACCESS_KEY" \
      --access-key-secret "$ALICLOUD_SECRET_KEY" \
      --region "$REGION" >/dev/null
  fi
}

if ! command -v dig >/dev/null 2>&1; then
  echo "::warning::dig not installed — skipping FC custom-domain DNS check"
  exit 0
fi

ACCOUNT_ID="${FC_ACCOUNT_ID:-}"
if [ -z "$ACCOUNT_ID" ] && configure_aliyun; then
  ACCOUNT_ID=$(aliyun sts GetCallerIdentity --profile fc-dns 2>/dev/null | jq -r '.AccountId // empty' || true)
fi

if [ -z "$ACCOUNT_ID" ]; then
  echo "::warning::Could not resolve account ID — skipping FC custom-domain DNS check"
  exit 0
fi

EXPECTED="${ACCOUNT_ID}.${REGION}.fc.aliyuncs.com"
echo "Checking FC custom domain DNS: ${FC_CUSTOM_DOMAIN} → ${EXPECTED}"

normalize() {
  echo "$1" | sed 's/\.$//' | tr '[:upper:]' '[:lower:]'
}

EXPECTED_N=$(normalize "$EXPECTED")
RESOLVED=$(dig +short CNAME "${FC_CUSTOM_DOMAIN}." 2>/dev/null | head -1 || true)
RESOLVED_N=$(normalize "$RESOLVED")

if [ "$RESOLVED_N" = "$EXPECTED_N" ]; then
  echo "FC custom domain DNS verified"
  exit 0
fi

# Some DNS setups flatten to A/AAAA after CNAME — accept if any record mentions the FC endpoint.
if dig +short "${FC_CUSTOM_DOMAIN}." 2>/dev/null | tr '[:upper:]' '[:lower:]' | grep -qF "$EXPECTED_N"; then
  echo "FC custom domain DNS verified (via resolved records)"
  exit 0
fi

echo "::error::FC custom domain ${FC_CUSTOM_DOMAIN} is not resolved to ${EXPECTED} (DomainNameNotResolved)."
echo ""
echo "Add this CNAME in Alibaba Cloud DNS for $(echo "$CDN_DOMAIN" | awk -F. 'NF>=2 {print $(NF-1)"."$NF}'):"
echo "  Host (RR): api.pd"
echo "  Type:      CNAME"
echo "  Value:     ${EXPECTED}"
echo ""
echo "Wait for DNS propagation (~5–10 minutes), then re-run Terraform apply."
echo "Verify: dig +short CNAME ${FC_CUSTOM_DOMAIN}."
exit 1
