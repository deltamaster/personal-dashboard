#!/usr/bin/env bash
# Tear down retired Singapore prod stack (pd.huhansen.com / pd-dash-sg).
# Does NOT touch Shanghai prod or SG QA (pd-qa.*, api-qa).
#
# Usage (requires ALIBABA_CLOUD_* env vars + AssumeRole on resourceadmin):
#   bash scripts/destroy-sg-prod.sh
#
# Idempotent: safe to re-run; skips resources already deleted.
set -euo pipefail

REGION="ap-southeast-1"
OTS_INSTANCE="pd-dash-sg"
OSS_WEB="pd-web-sg"
OSS_VAULT="pd-vault-sg"
CDN_DOMAIN="pd.huhansen.com"
FC_FUNCTION="api"
FC_CUSTOM_DOMAIN="api.pd.huhansen.com"
FC_TRIGGER="http"

OTS_TABLES=(
  pd_holdings pd_snapshots pd_visits pd_visit_images
  pd_flights pd_trains pd_movies
)

: "${ALIBABA_CLOUD_ACCESS_KEY_ID:?}"
: "${ALIBABA_CLOUD_ACCESS_KEY_SECRET:?}"
: "${ALIBABA_CLOUD_ROLE_ARN:?}"

export ALICLOUD_ACCESS_KEY="$ALIBABA_CLOUD_ACCESS_KEY_ID"
export ALICLOUD_SECRET_KEY="$ALIBABA_CLOUD_ACCESS_KEY_SECRET"
export ALICLOUD_REGION="$REGION"

aliyun configure set --profile base --mode AK \
  --access-key-id "$ALICLOUD_ACCESS_KEY" \
  --access-key-secret "$ALICLOUD_SECRET_KEY" \
  --region "$REGION" >/dev/null

CREDS=$(aliyun sts AssumeRole \
  --RoleArn "$ALIBABA_CLOUD_ROLE_ARN" \
  --RoleSessionName "destroy-sg-prod" \
  --DurationSeconds 3600 \
  --profile base)
AK=$(echo "$CREDS" | jq -r '.Credentials.AccessKeyId')
SK=$(echo "$CREDS" | jq -r '.Credentials.AccessKeySecret')
ST=$(echo "$CREDS" | jq -r '.Credentials.SecurityToken')

aliyun configure set --profile sts --mode StsToken \
  --access-key-id "$AK" \
  --access-key-secret "$SK" \
  --sts-token "$ST" \
  --region "$REGION" >/dev/null

fc() { aliyun fc "$@" --profile sts --region "$REGION"; }

delete_cdn() {
  if ! aliyun cdn DescribeCdnDomainDetail --DomainName "$CDN_DOMAIN" --profile sts >/dev/null 2>&1; then
    echo "CDN ${CDN_DOMAIN} already gone"
    return 0
  fi
  echo "==> CDN: delete ${CDN_DOMAIN}"
  fc DELETE "/2023-03-30/custom-domains/${FC_CUSTOM_DOMAIN}" >/dev/null 2>&1 || true
  aliyun cdn StopCdnDomain --DomainName "$CDN_DOMAIN" --profile sts >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    if aliyun cdn DeleteCdnDomain --DomainName "$CDN_DOMAIN" --profile sts >/dev/null 2>&1; then
      echo "CDN deleted"
      return 0
    fi
    echo "CDN busy — retry in 15s"
    sleep 15
  done
  echo "WARN: CDN delete still pending; finish manually in console if needed"
}

delete_fc() {
  echo "==> FC: delete ${FC_FUNCTION} (${REGION})"
  fc DELETE "/2023-03-30/custom-domains/${FC_CUSTOM_DOMAIN}" >/dev/null 2>&1 || true
  fc DELETE "/2023-03-30/functions/${FC_FUNCTION}/triggers/${FC_TRIGGER}" >/dev/null 2>&1 || true
  if fc GET "/2023-03-30/functions/${FC_FUNCTION}" >/dev/null 2>&1; then
    fc DELETE "/2023-03-30/functions/${FC_FUNCTION}"
    echo "FC function deleted"
  else
    echo "FC function already gone"
  fi
}

delete_oss_bucket() {
  local bucket="$1"
  echo "==> OSS: delete ${bucket}"
  ossutil config -e "oss-${REGION}.aliyuncs.com" -i "$AK" -k "$SK" -t "$ST" -L CH >/dev/null
  if ossutil ls "oss://${bucket}/" >/dev/null 2>&1; then
    ossutil rm "oss://${bucket}/" -r -f
  fi
  if ossutil ls "oss://${bucket}/" >/dev/null 2>&1 || ossutil stat "oss://${bucket}" >/dev/null 2>&1; then
    ossutil rm "oss://${bucket}" -b -f
  else
    echo "OSS bucket ${bucket} already gone"
  fi
}

delete_ots() {
  echo "==> OTS: delete tables + instance ${OTS_INSTANCE}"
  export AK SK ST OTS_INSTANCE REGION
  python3 - <<'PY'
import os
from tablestore import OTSClient

client = OTSClient(
    f"https://{os.environ['OTS_INSTANCE']}.{os.environ['REGION']}.ots.aliyuncs.com",
    os.environ["AK"], os.environ["SK"], os.environ["OTS_INSTANCE"], sts_token=os.environ["ST"],
)
for table in [
    "pd_holdings", "pd_snapshots", "pd_visits", "pd_visit_images",
    "pd_flights", "pd_trains", "pd_movies",
]:
    try:
        client.delete_table(table)
        print(f"  deleted table {table}")
    except Exception as e:
        print(f"  table {table}: {e}")
for meta in client.list_timeseries_table():
    name = meta.timeseries_table_name
    client.delete_timeseries_table(name)
    print(f"  deleted timeseries table {name}")
PY

  if aliyun tablestore get-instance --instance-name "$OTS_INSTANCE" --profile sts --region "$REGION" 2>/dev/null \
    | jq -e '.InstanceStatus == "deleting"' >/dev/null; then
    echo "OTS instance already deleting"
    return 0
  fi
  if aliyun tablestore list-instances --instance-name "$OTS_INSTANCE" --profile sts --region "$REGION" 2>/dev/null \
    | jq -e '.TotalCount == 0' >/dev/null; then
    echo "OTS instance already gone"
    return 0
  fi
  aliyun tablestore delete-instance --instance-name "$OTS_INSTANCE" --profile sts --region "$REGION"
  echo "OTS instance delete initiated (async)"
}

delete_cdn
delete_fc
delete_oss_bucket "$OSS_WEB"
delete_oss_bucket "$OSS_VAULT"
delete_ots

echo "Done. SG prod teardown complete (OTS instance may take a few minutes to finish deleting)."
