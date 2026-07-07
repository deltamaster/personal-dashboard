#!/usr/bin/env python3
"""
Backfill movie posters: Douban → download → OSS → OTS poster_url (CDN path).

Also optionally fills missing actors from Douban.

Examples:
  python scripts/backfill_movie_posters.py --stack cn-shanghai --dry-run --limit 5
  python scripts/backfill_movie_posters.py --stack cn-shanghai --migrate-douban
  python scripts/backfill_movie_posters.py --stack cn-shanghai --all
"""

from __future__ import annotations

import argparse
import os
import sys
import time
import urllib.error
import urllib.request
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poster_oss_lib import (
    DEFAULT_PUBLIC_BASE,
    OTS_TABLE,
    USER_AGENT,
    apply_stack_preset,
    download_poster_bytes,
    extract_poster_url,
    fetch_douban_movie,
    is_douban_poster_url,
    is_self_hosted_poster_url,
    load_dotenv_local,
    ots_client,
    poster_oss_key,
    poster_public_url,
    put_movie_row,
    resolve_credentials,
    upload_to_oss,
    utc_now_iso,
)
from tablestore import Direction, INF_MAX, INF_MIN, OTSClient, Row


def row_to_dict(row: Row) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for name, value in row.primary_key:
        data[name] = value
    for item in row.attribute_columns:
        if len(item) >= 2:
            data[item[0]] = item[1]
    return data


def list_all_movies(client: OTSClient) -> list[dict[str, Any]]:
    movies: list[dict[str, Any]] = []
    start_key = [("douban_subject_id", INF_MIN)]

    while True:
        _consumed, next_start, row_list, _token = client.get_range(
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


def extract_actors(data: dict[str, Any]) -> str | None:
    actors = data.get("actors") or []
    names = [a.get("name") for a in actors if isinstance(a, dict) and a.get("name")]
    return " / ".join(names) if names else None


def poster_url_ok(url: str) -> bool:
    req = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 400
    except urllib.error.HTTPError as e:
        return 200 <= e.code < 400
    except Exception:
        return False


def existing_douban_poster_url(row: dict[str, Any]) -> str | None:
    url = str(row.get("poster_url") or "").strip()
    if is_douban_poster_url(url):
        return url
    return None


def upgrade_poster_url(url: str) -> str:
    """Prefer a larger Douban CDN variant when the stored URL is thumbnail-sized."""
    return (
        url.replace("/s_ratio_poster/", "/m_ratio_poster/")
        .replace("/square/", "/m_ratio_poster/")
    )


def should_update_poster(
    row: dict[str, Any],
    *,
    force_all: bool,
    refresh_broken: bool,
    migrate_douban: bool,
    public_base: str,
) -> bool:
    if force_all:
        return True
    url = str(row.get("poster_url") or "").strip()
    if not url:
        return True
    if migrate_douban and is_douban_poster_url(url):
        return True
    if migrate_douban and not is_self_hosted_poster_url(url, public_base):
        return True
    if refresh_broken and not poster_url_ok(url):
        return True
    return False


def main() -> int:
    load_dotenv_local()

    parser = argparse.ArgumentParser(
        description="Backfill Douban posters → OSS → OTS CDN URLs"
    )
    parser.add_argument("--dry-run", action="store_true", help="Do not write OSS/OTS")
    parser.add_argument(
        "--stack",
        choices=("cn-shanghai", "qa"),
        default="cn-shanghai",
        help="Target stack (default: cn-shanghai = pd-dashboard + huhansen-web)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Re-upload every poster from Douban",
    )
    parser.add_argument(
        "--refresh-broken",
        action="store_true",
        help="Re-fetch when poster_url HEAD fails",
    )
    parser.add_argument(
        "--migrate-douban",
        action="store_true",
        default=True,
        help="Re-upload when poster_url is still a Douban CDN link (default: on)",
    )
    parser.add_argument(
        "--no-migrate-douban",
        action="store_false",
        dest="migrate_douban",
        help="Skip rows that still point at doubanio.com",
    )
    parser.add_argument(
        "--with-actors",
        action="store_true",
        help="Also fill missing actors from Douban",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max movies (0=all)")
    parser.add_argument(
        "--from-ots-url",
        action="store_true",
        default=True,
        help="When poster_url is already a Douban CDN link, download it directly (skip rexxar API)",
    )
    parser.add_argument(
        "--no-from-ots-url",
        action="store_false",
        dest="from_ots_url",
        help="Always fetch poster URL from Douban rexxar API",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.2,
        help="Seconds between Douban requests (default 1.2)",
    )
    parser.add_argument(
        "--public-base",
        default=DEFAULT_PUBLIC_BASE,
        help=f"Public CDN base URL (default: {DEFAULT_PUBLIC_BASE})",
    )
    args = parser.parse_args()

    ots_endpoint, ots_instance, oss_bucket, oss_endpoint = apply_stack_preset(args.stack)
    public_base = args.public_base
    if args.stack == "cn-shanghai" and args.public_base == DEFAULT_PUBLIC_BASE:
        public_base = "https://huhansen.com"

    ak, sk, token = resolve_credentials()
    if not ak or not sk:
        print("[-] Missing Alibaba credentials (env or ~/.aliyun/config.json)", file=sys.stderr)
        return 1

    client = ots_client(endpoint=ots_endpoint, instance=ots_instance)
    print(f"[*] Loading movies from {OTS_TABLE} @ {ots_instance}...")
    movies = list_all_movies(client)
    print(f"[+] Found {len(movies)} movies")
    print(f"[*] OSS: oss://{oss_bucket}/movies/posters/{{id}}.jpg")
    print(f"[*] CDN: {public_base}/movies/posters/{{id}}.jpg")

    updated = 0
    skipped = 0
    failed = 0
    processed = 0

    for row in movies:
        if args.limit and processed >= args.limit:
            break

        douban_id = str(row.get("douban_subject_id", "")).strip()
        title = row.get("title_primary") or douban_id
        if not douban_id:
            skipped += 1
            continue

        need_poster = should_update_poster(
            row,
            force_all=args.all,
            refresh_broken=args.refresh_broken,
            migrate_douban=args.migrate_douban,
            public_base=public_base,
        )
        need_actors = args.with_actors and not (row.get("actors") or "").strip()

        if not need_poster and not need_actors:
            skipped += 1
            continue

        processed += 1
        print(f"[*] ({processed}) {title} [{douban_id}]")

        data: dict[str, Any] | None = None
        need_api = need_actors or (
            need_poster
            and (not args.from_ots_url or not existing_douban_poster_url(row) or args.all)
        )

        if need_api:
            try:
                data = fetch_douban_movie(douban_id)
            except Exception as e:
                if need_poster and args.from_ots_url and existing_douban_poster_url(row):
                    print(f"    [!] Douban API failed ({e}), using OTS poster URL")
                elif need_poster:
                    print(f"    [-] Douban fetch failed: {e}")
                    failed += 1
                    time.sleep(args.delay)
                    continue
                else:
                    print(f"    [-] Douban fetch failed: {e}")
                    failed += 1
                    time.sleep(args.delay)
                    continue

        changes: list[str] = []
        if need_poster:
            douban_poster: str | None = None
            stored = existing_douban_poster_url(row)
            if args.from_ots_url and stored and not args.all:
                douban_poster = upgrade_poster_url(stored)
                print(f"    from OTS: {douban_poster}")
            else:
                assert data is not None
                douban_poster = extract_poster_url(data)

            if not douban_poster:
                print("    [!] No poster URL available")
                failed += 1
                time.sleep(args.delay)
                continue

            try:
                image_bytes, content_type = download_poster_bytes(douban_id, douban_poster)
            except Exception as e:
                print(f"    [-] Poster download failed: {e}")
                failed += 1
                time.sleep(args.delay)
                continue

            oss_key = poster_oss_key(douban_id, content_type)
            public_url = poster_public_url(public_base, douban_id, content_type)

            if args.dry_run:
                changes.append(f"oss={oss_key}")
                changes.append(f"poster={public_url}")
            else:
                try:
                    upload_to_oss(
                        bucket_name=oss_bucket,
                        endpoint=oss_endpoint,
                        object_key=oss_key,
                        data=image_bytes,
                        content_type=content_type,
                        ak=ak,
                        sk=sk,
                        token=token,
                    )
                except Exception as e:
                    print(f"    [-] OSS upload failed: {e}")
                    failed += 1
                    time.sleep(args.delay)
                    continue

                row["poster_url"] = public_url
                changes.append(f"poster={public_url}")

        if need_actors:
            if data is None:
                try:
                    data = fetch_douban_movie(douban_id)
                except Exception as e:
                    print(f"    [-] Douban fetch failed (actors): {e}")
                    if not changes:
                        failed += 1
                        time.sleep(args.delay)
                        continue
            if data is not None:
                actors = extract_actors(data)
                if actors:
                    row["actors"] = actors
                    changes.append(f"actors ({len(actors.split(' / '))} names)")

        if not changes:
            skipped += 1
            time.sleep(args.delay)
            continue

        row["updated_at"] = utc_now_iso()

        if args.dry_run:
            print(f"    [dry-run] Would update: {', '.join(changes)}")
        else:
            try:
                put_movie_row(client, row)
            except Exception as e:
                print(f"    [-] OTS write failed: {e}")
                failed += 1
                time.sleep(args.delay)
                continue
            print(f"    [+] Updated: {', '.join(changes)}")
            updated += 1

        time.sleep(args.delay)

    print("\n=== Summary ===")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Failed:  {failed}")
    print(f"Processed (attempted): {processed}")
    if args.dry_run:
        print("(dry-run — no OSS/OTS writes)")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
