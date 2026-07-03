#!/usr/bin/env python3
"""
Copy production OTS rows and OSS user media from Singapore to Shanghai.

Source (SG):
  OTS  pd-dash-sg @ ap-southeast-1
  OSS  pd-web-sg (movies/, travel/), pd-vault-sg (skipped — only fc/api.zip deploy artifact)

Target (CN):
  OTS  pd-dashboard @ cn-shanghai
  OSS  huhansen-web (movies/, travel/)

Rewrites CDN URLs stored in OTS:
  https://pd.huhansen.com/... → https://pd.huhansen.cn/...

Usage:
  python scripts/migrate_sg_to_cn.py --dry-run
  python scripts/migrate_sg_to_cn.py --yes
  python scripts/migrate_sg_to_cn.py --yes --ots-only
  python scripts/migrate_sg_to_cn.py --yes --oss-only
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import oss2
from poster_oss_lib import load_dotenv_local, ots_client, resolve_credentials
from tablestore import Condition, Direction, INF_MAX, INF_MIN, OTSClient, Row, RowExistenceExpectation

SG_OTS_ENDPOINT = "https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com"
SG_OTS_INSTANCE = "pd-dash-sg"
SG_OSS_WEB_BUCKET = "pd-web-sg"
SG_OSS_ENDPOINT = "oss-ap-southeast-1.aliyuncs.com"

CN_OTS_ENDPOINT = "https://pd-dashboard.cn-shanghai.ots.aliyuncs.com"
CN_OTS_INSTANCE = "pd-dashboard"
CN_OSS_WEB_BUCKET = "huhansen-web"
CN_OSS_ENDPOINT = "oss-cn-shanghai.aliyuncs.com"

SG_PUBLIC_BASE = "https://pd.huhansen.com"
CN_PUBLIC_BASE = "https://pd.huhansen.cn"

TABLES: dict[str, str] = {
    "pd_holdings": "holding_id",
    "pd_snapshots": "snapshot_date",
    "pd_visits": "visit_id",
    "pd_visit_images": "image_id",
    "pd_flights": "flight_id",
    "pd_trains": "train_id",
    "pd_movies": "douban_subject_id",
}

URL_FIELDS = ("poster_url", "oss_url")
OSS_DATA_PREFIXES = ("movies/", "travel/")


def rewrite_url(value: Any) -> Any:
    if not isinstance(value, str) or not value:
        return value
    if value.startswith(SG_PUBLIC_BASE):
        return CN_PUBLIC_BASE + value[len(SG_PUBLIC_BASE) :]
    return value


def row_to_dict(row: Row) -> dict[str, Any]:
    data = {name: value for name, value in row.primary_key}
    for item in row.attribute_columns:
        if len(item) >= 2:
            data[item[0]] = item[1]
    return data


def scan_table(client: OTSClient, table: str, pk: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start_key = [(pk, INF_MIN)]
    end_key = [(pk, INF_MAX)]
    while True:
        _c, next_start, row_list, _t = client.get_range(
            table,
            Direction.FORWARD,
            start_key,
            end_key,
            limit=100,
        )
        for row in row_list:
            rows.append(row_to_dict(row))
        if next_start is None:
            break
        start_key = next_start
    return rows


def put_row(client: OTSClient, table: str, pk: str, row: dict[str, Any], *, dry_run: bool) -> None:
    primary_key = [(pk, str(row[pk]))]
    attribute_columns: list[tuple[str, Any]] = []
    for name, value in row.items():
        if name == pk:
            continue
        if value is None:
            continue
        if name in URL_FIELDS:
            value = rewrite_url(value)
        attribute_columns.append((name, value))
    if dry_run:
        return
    client.put_row(
        table,
        Row(primary_key, attribute_columns),
        Condition(RowExistenceExpectation.IGNORE, None),
    )


def migrate_ots(*, dry_run: bool) -> dict[str, int]:
    src = ots_client(endpoint=SG_OTS_ENDPOINT, instance=SG_OTS_INSTANCE)
    dst = ots_client(endpoint=CN_OTS_ENDPOINT, instance=CN_OTS_INSTANCE)
    stats: dict[str, int] = {}

    for table, pk in TABLES.items():
        rows = scan_table(src, table, pk)
        print(f"[*] OTS {table}: {len(rows)} rows from SG")
        written = 0
        for row in rows:
            put_row(dst, table, pk, row, dry_run=dry_run)
            written += 1
            if written % 100 == 0:
                print(f"    ... {written}/{len(rows)}")
        stats[table] = written
        action = "would write" if dry_run else "wrote"
        print(f"[+] OTS {table}: {action} {written} rows to CN")
    return stats


def oss_bucket(ak: str, sk: str, token: str | None, endpoint: str, bucket: str) -> oss2.Bucket:
    auth = oss2.StsAuth(ak, sk, token) if token else oss2.Auth(ak, sk)
    return oss2.Bucket(auth, f"https://{endpoint}", bucket)


def copy_object(
    src_bucket: oss2.Bucket,
    dst_bucket: oss2.Bucket,
    key: str,
    *,
    dry_run: bool,
) -> None:
    if dry_run:
        return
    result = src_bucket.get_object(key)
    data = result.read()
    headers: dict[str, str] = {}
    content_type = result.headers.get("Content-Type")
    if content_type:
        headers["Content-Type"] = content_type
    dst_bucket.put_object(key, data, headers=headers)


def migrate_oss(*, dry_run: bool) -> dict[str, int]:
    ak, sk, token = resolve_credentials()
    src = oss_bucket(ak, sk, token, SG_OSS_ENDPOINT, SG_OSS_WEB_BUCKET)
    dst = oss_bucket(ak, sk, token, CN_OSS_ENDPOINT, CN_OSS_WEB_BUCKET)
    stats: dict[str, int] = {}

    for prefix in OSS_DATA_PREFIXES:
        keys = [o.key for o in oss2.ObjectIteratorV2(src, prefix=prefix)]
        print(f"[*] OSS {SG_OSS_WEB_BUCKET}/{prefix}: {len(keys)} objects")
        copied = 0
        for key in keys:
            copy_object(src, dst, key, dry_run=dry_run)
            copied += 1
            if copied % 50 == 0:
                print(f"    ... {copied}/{len(keys)}")
        stats[prefix] = copied
        action = "would copy" if dry_run else "copied"
        print(f"[+] OSS {prefix}: {action} {copied} objects to {CN_OSS_WEB_BUCKET}")
    return stats


def main() -> int:
    load_dotenv_local()

    parser = argparse.ArgumentParser(
        description="Migrate production OTS + OSS user media from Singapore to Shanghai"
    )
    parser.add_argument("--dry-run", action="store_true", help="Print counts only; no writes")
    parser.add_argument("--yes", action="store_true", help="Required to perform writes (skip prompt)")
    parser.add_argument("--ots-only", action="store_true")
    parser.add_argument("--oss-only", action="store_true")
    args = parser.parse_args()

    if args.ots_only and args.oss_only:
        print("[-] Use at most one of --ots-only / --oss-only", file=sys.stderr)
        return 1

    if not args.dry_run and not args.yes:
        print(
            "[-] Refusing to write without --yes (or use --dry-run first).\n"
            f"    Source: OTS {SG_OTS_INSTANCE}, OSS {SG_OSS_WEB_BUCKET}\n"
            f"    Target: OTS {CN_OTS_INSTANCE}, OSS {CN_OSS_WEB_BUCKET}",
            file=sys.stderr,
        )
        return 1

    mode = "DRY-RUN" if args.dry_run else "LIVE"
    print(f"=== SG → CN production migration ({mode}) ===")
    print(f"OTS: {SG_OTS_INSTANCE} → {CN_OTS_INSTANCE}")
    print(f"OSS: {SG_OSS_WEB_BUCKET} → {CN_OSS_WEB_BUCKET} ({', '.join(OSS_DATA_PREFIXES)})")
    print(f"URL rewrite: {SG_PUBLIC_BASE} → {CN_PUBLIC_BASE}\n")

    ots_stats: dict[str, int] = {}
    oss_stats: dict[str, int] = {}

    if not args.oss_only:
        ots_stats = migrate_ots(dry_run=args.dry_run)
    if not args.ots_only:
        oss_stats = migrate_oss(dry_run=args.dry_run)

    print("\n=== Summary ===")
    if ots_stats:
        total_ots = sum(ots_stats.values())
        print(f"OTS rows: {total_ots} across {len(ots_stats)} tables")
        for table, count in ots_stats.items():
            print(f"  {table}: {count}")
    if oss_stats:
        total_oss = sum(oss_stats.values())
        print(f"OSS objects: {total_oss}")
        for prefix, count in oss_stats.items():
            print(f"  {prefix}: {count}")
    if args.dry_run:
        print("(dry-run — no changes made)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
