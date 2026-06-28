#!/usr/bin/env bash
# Adopt OTS resources created outside Terraform state (e.g. partial CI applies).
set -euo pipefail

OTS_INSTANCE="${OTS_INSTANCE:-pd-dashboard}"
SEARCH_INDEX_TYPE="${SEARCH_INDEX_TYPE:-Search}"

import_if_missing() {
  local addr="$1"
  local id="$2"
  if terraform state show "$addr" >/dev/null 2>&1; then
    echo "Already in state: $addr"
    return 0
  fi
  echo "Importing $addr ($id)..."
  if terraform import -input=false "$addr" "$id"; then
    echo "Imported: $addr"
  else
    echo "Import skipped: $addr ($id)"
  fi
}

import_if_missing alicloud_ots_instance.main "$OTS_INSTANCE"

OTS_TABLES=(
  pd_holdings
  pd_snapshots
  pd_visits
  pd_visit_images
  pd_flights
  pd_trains
  pd_movies
)

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
