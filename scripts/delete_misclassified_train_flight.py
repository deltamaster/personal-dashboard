#!/usr/bin/env python3
"""Remove train D3926 wrongly stored in pd_flights."""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poster_oss_lib import apply_stack_preset, load_dotenv_local, ots_client
from tablestore import Condition, Direction, INF_MAX, INF_MIN, RowExistenceExpectation


def scan_flights(client, table: str):
    rows = []
    start = [("flight_id", INF_MIN)]
    while True:
        _, nxt, rlist, _ = client.get_range(
            table, Direction.FORWARD, start, [("flight_id", INF_MAX)], limit=100
        )
        for row in rlist:
            d = {n: v for n, v in row.primary_key}
            for item in row.attribute_columns:
                if len(item) >= 2:
                    d[item[0]] = item[1]
            rows.append(d)
        if nxt is None:
            break
        start = nxt
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stack", default="cn-shanghai")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_dotenv_local()
    endpoint, instance, _, _ = apply_stack_preset(args.stack)
    client = ots_client(endpoint=endpoint, instance=instance)

    table = "pd_flights"
    matches = [
        f
        for f in scan_flights(client, table)
        if str(f.get("flight_number", "")).upper() == "D3926"
    ]

    if not matches:
        print("No pd_flights row with flight_number D3926")
        return 0

    for row in matches:
        flight_id = row["flight_id"]
        print(
            f"{'would delete' if args.dry_run else 'deleting'} "
            f"{flight_id}: {row.get('departure_city')} -> {row.get('arrival_city')} "
            f"({row.get('airline')})"
        )
        if args.dry_run:
            continue
        client.delete_row(
            table,
            [("flight_id", flight_id)],
            Condition(RowExistenceExpectation.EXPECT_EXIST),
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
