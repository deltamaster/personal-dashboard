#!/usr/bin/env bash
# Ensure CDN root-domain ownership is verified before AddCdnDomain (DomainOwnerVerifyFail).
set -euo pipefail

CDN_DOMAIN="${CDN_DOMAIN:-}"
CDN_ROOT_DOMAIN="${CDN_ROOT_DOMAIN:-}"
REGION="${ALICLOUD_REGION:-cn-shanghai}"

if [ -z "$CDN_DOMAIN" ]; then
  echo "CDN_DOMAIN not set — skipping CDN ownership check"
  exit 0
fi

if [ -z "$CDN_ROOT_DOMAIN" ]; then
  CDN_ROOT_DOMAIN=$(echo "$CDN_DOMAIN" | awk -F. 'NF >= 2 { print $(NF - 1)"."$NF }')
fi

echo "Checking CDN root-domain ownership for ${CDN_ROOT_DOMAIN} (accelerated domain: ${CDN_DOMAIN})..."

if aliyun cdn VerifyDomainOwner \
  --DomainName "$CDN_ROOT_DOMAIN" \
  --VerifyType dnsCheck \
  --region "$REGION" >/dev/null 2>&1; then
  echo "Root domain ${CDN_ROOT_DOMAIN} ownership verified"
  exit 0
fi

CONTENT=$(aliyun cdn DescribeVerifyContent \
  --DomainName "$CDN_ROOT_DOMAIN" \
  --region "$REGION" 2>/dev/null | jq -r '.Content // empty')

echo "::error::CDN root domain ${CDN_ROOT_DOMAIN} is not verified (DomainOwnerVerifyFail)."
echo ""
echo "Add this TXT record in Alibaba Cloud DNS for ${CDN_ROOT_DOMAIN}:"
echo "  Host (RR): verification"
echo "  Type:      TXT"
echo "  Value:     ${CONTENT:-<run DescribeVerifyContent>}"
echo ""
echo "Wait for DNS propagation (~10 minutes), then re-run Terraform apply."
echo "Verify: aliyun cdn VerifyDomainOwner --DomainName ${CDN_ROOT_DOMAIN} --VerifyType dnsCheck"
exit 1
