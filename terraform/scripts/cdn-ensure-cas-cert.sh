#!/usr/bin/env bash
# Order (or reuse) a CAS free DV certificate and complete DNS validation for CDN HTTPS.
# Outputs cert_id to GITHUB_OUTPUT (cert_id) for TF_VAR_cdn_cas_cert_id.
set -euo pipefail

CDN_DOMAIN="${CDN_DOMAIN:-}"
CDN_HTTPS_ENABLED="${CDN_HTTPS_ENABLED:-0}"
CAS_REGION="${CAS_REGION:-cn-hangzhou}"
CAS_DNS_ZONE="${CAS_DNS_ZONE:-}"
CAS_PRODUCT_CODE="${CAS_PRODUCT_CODE:-symantec-free-1-free}"
CAS_CONTACT_NAME="${CAS_CONTACT_NAME:-Personal Dashboard}"
CAS_CONTACT_EMAIL="${CAS_CONTACT_EMAIL:-}"
CAS_CONTACT_PHONE="${CAS_CONTACT_PHONE:-}"
POLL_SECONDS="${CAS_POLL_SECONDS:-30}"
POLL_MAX="${CAS_POLL_MAX:-20}"

if [ "$CDN_HTTPS_ENABLED" != "1" ] && [ "$CDN_HTTPS_ENABLED" != "true" ]; then
  echo "CDN HTTPS not enabled — skipping CAS certificate"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "cert_id=" >>"$GITHUB_OUTPUT"
    echo "cert_ready=false" >>"$GITHUB_OUTPUT"
  fi
  exit 0
fi

if [ -z "$CDN_DOMAIN" ]; then
  echo "CDN_DOMAIN not set — skipping CAS certificate"
  exit 0
fi

if [ -z "$CAS_CONTACT_EMAIL" ]; then
  CAS_CONTACT_EMAIL="${ALLOWED_USER_EMAIL:-huhansen318@hotmail.com}"
fi

if [ -z "$CAS_CONTACT_PHONE" ]; then
  echo "::error::CAS_CONTACT_PHONE is required to order a free DV certificate (set GitHub secret or TF_VAR_cas_contact_phone)."
  exit 1
fi

if [ -z "$CAS_DNS_ZONE" ]; then
  CAS_DNS_ZONE=$(echo "$CDN_DOMAIN" | awk -F. 'NF >= 2 { print $(NF-1)"."$NF }')
fi

configure_aliyun() {
  [ -n "${ALICLOUD_ACCESS_KEY:-}" ] && [ -n "${ALICLOUD_SECRET_KEY:-}" ] || return 1
  aliyun configure set \
    --profile cas-base \
    --mode AK \
    --access-key-id "$ALICLOUD_ACCESS_KEY" \
    --access-key-secret "$ALICLOUD_SECRET_KEY" \
    --region "$CAS_REGION" >/dev/null

  if [ -n "${ALICLOUD_ROLE_ARN:-}" ]; then
    local creds
    creds=$(aliyun sts AssumeRole \
      --RoleArn "$ALICLOUD_ROLE_ARN" \
      --RoleSessionName "cdn-cas-cert" \
      --DurationSeconds 900 \
      --profile cas-base)
    aliyun configure set \
      --profile cas \
      --mode StsToken \
      --access-key-id "$(echo "$creds" | jq -r '.Credentials.AccessKeyId')" \
      --access-key-secret "$(echo "$creds" | jq -r '.Credentials.AccessKeySecret')" \
      --sts-token "$(echo "$creds" | jq -r '.Credentials.SecurityToken')" \
      --region "$CAS_REGION" >/dev/null
  else
    aliyun configure set \
      --profile cas \
      --mode AK \
      --access-key-id "$ALICLOUD_ACCESS_KEY" \
      --access-key-secret "$ALICLOUD_SECRET_KEY" \
      --region "$CAS_REGION" >/dev/null
  fi
}

cas_api() {
  aliyun cas "$@" --profile cas --region "$CAS_REGION"
}

dns_api() {
  aliyun alidns "$@" --profile cas --region "$CAS_REGION"
}

find_issued_cert_id() {
  local list
  list=$(cas_api ListUserCertificateOrder --OrderType CERT --Keyword "$CDN_DOMAIN" 2>/dev/null || true)
  echo "$list" | jq -r --arg d "$CDN_DOMAIN" '
    (.CertificateOrderList // [])[]
    | select((.Expired // true) == false)
    | select((.CommonName // .Domain // "") == $d)
    | (.CertificateId // .CertId // empty)
  ' | head -1
}

find_pending_order_id() {
  local list
  list=$(cas_api ListUserCertificateOrder --OrderType CPACK --Keyword "$CDN_DOMAIN" 2>/dev/null || true)
  echo "$list" | jq -r --arg d "$CDN_DOMAIN" '
    (.CertificateOrderList // [])[]
    | select((.Domain // .CommonName // "") == $d)
    | select((.Status // "") | test("^(domain_verify|process|payed|PAYED|VERIFYING|ISSUING)$"; "i"))
    | (.OrderId // empty)
  ' | head -1
}

dns_rr_for_validation() {
  local record_domain="$1"
  local domain="$2"
  local zone="$3"
  if [ "$domain" = "$zone" ]; then
    echo "$record_domain"
    return
  fi
  local sub="${domain%.$zone}"
  echo "${record_domain}.${sub}"
}

ensure_dns_txt() {
  local rr="$1"
  local value="$2"
  local zone="$CAS_DNS_ZONE"

  local records
  records=$(dns_api DescribeDomainRecords --DomainName "$zone" --RRKeyWord "$rr" --Type TXT 2>/dev/null || true)
  local existing_id existing_value
  existing_id=$(echo "$records" | jq -r --arg rr "$rr" '
    (.DomainRecords.Record // [])[] | select(.RR == $rr) | .RecordId' | head -1)
  existing_value=$(echo "$records" | jq -r --arg rr "$rr" '
    (.DomainRecords.Record // [])[] | select(.RR == $rr) | .Value' | head -1)

  if [ -n "$existing_id" ] && [ "$existing_value" = "$value" ]; then
    echo "CAS DNS TXT already present: ${rr}.${zone}"
    return 0
  fi

  if [ -n "$existing_id" ]; then
    echo "Updating CAS DNS TXT ${rr}.${zone}"
    dns_api UpdateDomainRecord --RecordId "$existing_id" --RR "$rr" --Type TXT --Value "$value" >/dev/null
    return 0
  fi

  echo "Adding CAS DNS TXT ${rr}.${zone}"
  dns_api AddDomainRecord --DomainName "$zone" --RR "$rr" --Type TXT --Value "$value" >/dev/null
}

create_cert_order() {
  echo "Ordering CAS free DV certificate for ${CDN_DOMAIN} (${CAS_PRODUCT_CODE})..."
  cas_api CreateCertificateRequest \
    --ProductCode "$CAS_PRODUCT_CODE" \
    --Username "$CAS_CONTACT_NAME" \
    --Phone "$CAS_CONTACT_PHONE" \
    --Email "$CAS_CONTACT_EMAIL" \
    --Domain "$CDN_DOMAIN" \
    --ValidateType DNS \
    | jq -r '.OrderId'
}

handle_domain_verify() {
  local order_id="$1"
  local state
  state=$(cas_api DescribeCertificateState --OrderId "$order_id")
  local type record_domain record_value record_type domain
  type=$(echo "$state" | jq -r '.Type // empty')
  record_domain=$(echo "$state" | jq -r '.RecordDomain // empty')
  record_value=$(echo "$state" | jq -r '.RecordValue // empty')
  record_type=$(echo "$state" | jq -r '.RecordType // "TXT"')
  domain=$(echo "$state" | jq -r '.Domain // empty')

  if [ "$type" != "domain_verify" ]; then
    return 0
  fi

  if [ "$record_type" != "TXT" ] || [ -z "$record_domain" ] || [ -z "$record_value" ]; then
    echo "::warning::Unexpected CAS validation payload — add DNS record manually from DescribeCertificateState"
    echo "$state" | jq .
    return 1
  fi

  local rr
  rr=$(dns_rr_for_validation "$record_domain" "${domain:-$CDN_DOMAIN}" "$CAS_DNS_ZONE")
  if ! ensure_dns_txt "$rr" "$record_value"; then
    echo "::error::Failed to add CAS validation TXT. Add manually:"
    echo "  Zone: ${CAS_DNS_ZONE}"
    echo "  RR:   ${rr}"
    echo "  Type: TXT"
    echo "  Value: ${record_value}"
    return 1
  fi
  return 0
}

wait_for_cert() {
  local order_id="$1"
  local i type cert_id
  for ((i = 1; i <= POLL_MAX; i++)); do
    local state
    state=$(cas_api DescribeCertificateState --OrderId "$order_id")
    type=$(echo "$state" | jq -r '.Type // empty')
    cert_id=$(echo "$state" | jq -r '.CertId // empty')

    case "$type" in
      certificate)
        if [ -n "$cert_id" ] && [ "$cert_id" != "null" ]; then
          echo "$cert_id"
          return 0
        fi
        ;;
      domain_verify)
        handle_domain_verify "$order_id" || true
        ;;
      verify_fail)
        echo "::error::CAS certificate verification failed for order ${order_id}"
        echo "$state" | jq .
        return 1
        ;;
      process)
        echo "CAS certificate under CA review (order ${order_id})..."
        ;;
      *)
        echo "CAS order ${order_id} status: ${type:-unknown}"
        ;;
    esac

    # Some responses include CertId before Type flips to certificate.
    if [ -n "$cert_id" ] && [ "$cert_id" != "null" ] && [ "$type" = "process" -o "$type" = "certificate" ]; then
      # Re-check issued cert list as source of truth
      local issued
      issued=$(find_issued_cert_id)
      if [ -n "$issued" ]; then
        echo "$issued"
        return 0
      fi
    fi

    sleep "$POLL_SECONDS"
  done

  echo "::warning::Timed out waiting for CAS certificate (order ${order_id}). Re-run Terraform after DNS propagates."
  return 1
}

if ! command -v aliyun >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "::warning::aliyun CLI or jq missing — skipping CAS certificate"
  exit 0
fi

if ! configure_aliyun; then
  echo "::warning::Alibaba credentials not configured — skipping CAS certificate"
  exit 0
fi

echo "Ensuring CAS certificate for CDN HTTPS on ${CDN_DOMAIN} (region ${CAS_REGION})..."

CERT_ID=$(find_issued_cert_id || true)
if [ -n "$CERT_ID" ]; then
  echo "Reusing issued CAS certificate ${CERT_ID} for ${CDN_DOMAIN}"
else
  ORDER_ID=$(find_pending_order_id || true)
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID=$(create_cert_order)
  else
    echo "Reusing pending CAS order ${ORDER_ID} for ${CDN_DOMAIN}"
  fi

  handle_domain_verify "$ORDER_ID" || true
  CERT_ID=$(wait_for_cert "$ORDER_ID" || true)
  if [ -z "$CERT_ID" ]; then
    CERT_ID=$(find_issued_cert_id || true)
  fi
fi

if [ -z "$CERT_ID" ]; then
  echo "::warning::CAS certificate not ready — Terraform will apply CDN without HTTPS this run"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "cert_id=" >>"$GITHUB_OUTPUT"
    echo "cert_ready=false" >>"$GITHUB_OUTPUT"
  fi
  exit 0
fi

echo "CAS certificate ready: cert_id=${CERT_ID}"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "cert_id=${CERT_ID}" >>"$GITHUB_OUTPUT"
  echo "cert_ready=true" >>"$GITHUB_OUTPUT"
fi
