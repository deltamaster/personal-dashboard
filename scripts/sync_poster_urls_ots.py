#!/usr/bin/env python3
"""
Sync OTS poster_url to self-hosted CDN paths when the file already exists on OSS.

Use after poster_to_oss.py uploaded to OSS but OTS write failed (e.g. missing OTS
permission locally). Does not call Douban.

Examples:
  python scripts/sync_poster_urls_ots.py --stack sg --dry-run
  python scripts/sync_poster_urls_ots.py --stack sg --douban-id 10463953
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poster_oss_lib import (
    DEFAULT_PUBLIC_BASE,
    OTS_TABLE,
    apply_stack_preset,
    is_self_hosted_poster_url,
    load_dotenv_local,
    oss_poster_exists,
    ots_client,
    poster_public_url,
    put_movie_row,
    resolve_credentials,
    utc_now_iso,
)
from tablestore import Direction, INF_MAX, INF_MIN, Row


def row_to_dict(row: Row) -> dict:
    data = {name: value for name, value in row.primary_key}
    for item in row.attribute_columns:
        if len(item) >= 2:
            data[item[0]] = item[1]
    return data


def list_all_movies(client):
    movies = []
    start_key = [("douban_subject_id", INF_MIN)]
    while True:
        _c, next_start, row_list, _t = client.get_range(
            OTS_TABLE,
            Direction.FORWARD,
            start_key,
            [("douban_subject_id", INF_MAX)],
            limit=100,
        )
        for row in row_list:
            movies.append(row_to_dict(row))
        if next_start is None:
            break
        start_key = next_start
    return movies


def main() -> int:
    load_dotenv_local()

    parser = argparse.ArgumentParser(description="Sync OTS poster_url from existing OSS objects")
    parser.add_argument("--stack", choices=("sg", "cn-shanghai"), default="sg")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--douban-id", help="Only sync one movie")
    parser.add_argument(
        "--public-base",
        default=DEFAULT_PUBLIC_BASE,
        help=f"CDN base (default: {DEFAULT_PUBLIC_BASE})",
    )
    args = parser.parse_args()

    ots_endpoint, ots_instance, oss_bucket, oss_endpoint = apply_stack_preset(args.stack)
    public_base = args.public_base
    if args.stack == "cn-shanghai" and args.public_base == DEFAULT_PUBLIC_BASE:
        public_base = "https://huhansen.com"

    ak, sk, token = resolve_credentials()
    if not ak or not sk:
        print("[-] Missing Alibaba credentials", file=sys.stderr)
        return 1

    client = ots_client(endpoint=ots_endpoint, instance=ots_instance)
    movies = list_all_movies(client)
    if args.douban_id:
        movies = [m for m in movies if str(m.get("douban_subject_id")) == str(args.douban_id)]

    updated = 0
    skipped = 0
    failed = 0

    for row in movies:
        douban_id = str(row.get("douban_subject_id", "")).strip()
        title = row.get("title_primary") or douban_id
        current = str(row.get("poster_url") or "").strip()

        exists, _key, content_type = oss_poster_exists(
            bucket_name=oss_bucket,
            endpoint=oss_endpoint,
            douban_subject_id=douban_id,
            ak=ak,
            sk=sk,
            token=token,
        )
        if not exists:
            skipped += 1
            continue

        public_url = poster_public_url(public_base, douban_id, content_type)
        if is_self_hosted_poster_url(current, public_base) and current == public_url:
            skipped += 1
            continue

        print(f"[*] {title} [{douban_id}]")
        print(f"    was: {current or '(empty)'}")
        print(f"    now: {public_url}")

        if args.dry_run:
            updated += 1
            continue

        row["poster_url"] = public_url
        row["updated_at"] = utc_now_iso()
        try:
            put_movie_row(client, row)
            updated += 1
        except Exception as e:
            print(f"    [-] OTS write failed: {e}")
            failed += 1

    print(f"\n=== Summary ===\nUpdated: {updated}\nSkipped: {skipped}\nFailed: {failed}")
    if args.dry_run:
        print("(dry-run)")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
