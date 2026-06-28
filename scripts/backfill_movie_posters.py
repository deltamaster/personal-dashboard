#!/usr/bin/env python3
"""
Backfill movie poster_url (and optionally actors) from Douban into OTS pd_movies.

Uses Douban mobile rexxar API (no API key). Requires tablestore:
  pip install tablestore

Credentials (first match wins):
  - ALIBABA_CLOUD_ACCESS_KEY_ID + ALIBABA_CLOUD_ACCESS_KEY_SECRET (+ optional STS token)
  - Aliyun CLI ~/.aliyun/config.json default profile (same as migrate_movies.py)

Examples:
  python scripts/backfill_movie_posters.py --dry-run --limit 5
  python scripts/backfill_movie_posters.py --refresh-broken --with-actors
  python scripts/backfill_movie_posters.py --all
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from tablestore import Direction, INF_MAX, INF_MIN, OTSClient, Row

OTS_ENDPOINT = os.environ.get(
    "OTS_ENDPOINT", "https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com"
)
OTS_INSTANCE = os.environ.get("OTS_INSTANCE_NAME", "pd-dash-sg")
OTS_TABLE = "pd_movies"

DOUBAN_API = "https://m.douban.com/rexxar/api/v2/movie/{subject_id}?for_mobile=1"
USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_aliyun_credentials() -> tuple[str | None, str | None, str | None]:
    ak = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_ID")
    sk = os.environ.get("ALIBABA_CLOUD_ACCESS_KEY_SECRET")
    token = os.environ.get("ALIBABA_CLOUD_SECURITY_TOKEN")
    if ak and sk:
        return ak, sk, token

    config_path = os.path.expanduser("~/.aliyun/config.json")
    if not os.path.exists(config_path):
        return None, None, None

    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    profile = next(
        (p for p in config.get("profiles", []) if p.get("name") == "default"),
        None,
    )
    if not profile:
        return None, None, None

    return (
        profile.get("access_key_id"),
        profile.get("access_key_secret"),
        profile.get("sts_token"),
    )


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


def put_movie_row(client: OTSClient, row_dict: dict[str, Any]) -> None:
    douban_id = str(row_dict["douban_subject_id"])
    primary_key = [("douban_subject_id", douban_id)]
    attribute_columns: list[tuple[str, Any]] = []

    for name, value in row_dict.items():
        if name in ("douban_subject_id", "id"):
            continue
        if value is None:
            continue
        attribute_columns.append((name, value))

    client.put_row(OTS_TABLE, Row(primary_key, attribute_columns))


def fetch_douban_movie(subject_id: str) -> dict[str, Any]:
    url = DOUBAN_API.format(subject_id=subject_id)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": f"https://m.douban.com/movie/subject/{subject_id}/",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def extract_poster_url(data: dict[str, Any]) -> str | None:
    pic = data.get("pic") or {}
    for key in ("large", "normal"):
        url = pic.get(key)
        if isinstance(url, str) and url.startswith("http"):
            return url
    cover = data.get("cover_url")
    if isinstance(cover, str) and cover.startswith("http"):
        return cover
    return None


def extract_actors(data: dict[str, Any]) -> str | None:
    actors = data.get("actors") or []
    names = [a.get("name") for a in actors if isinstance(a, dict) and a.get("name")]
    return " / ".join(names) if names else None


def poster_url_ok(url: str) -> bool:
    req = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": USER_AGENT, "Referer": "https://movie.douban.com/"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return 200 <= resp.status < 400
    except urllib.error.HTTPError as e:
        return 200 <= e.code < 400
    except Exception:
        return False


def should_update_poster(
    row: dict[str, Any], *, force_all: bool, refresh_broken: bool
) -> bool:
    if force_all:
        return True
    url = row.get("poster_url")
    if not url or not str(url).strip():
        return True
    if refresh_broken and not poster_url_ok(str(url)):
        return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill Douban posters into OTS")
    parser.add_argument("--dry-run", action="store_true", help="Do not write to OTS")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Refresh poster_url for every movie from Douban",
    )
    parser.add_argument(
        "--refresh-broken",
        action="store_true",
        help="Re-fetch when poster_url exists but image HEAD fails",
    )
    parser.add_argument(
        "--with-actors",
        action="store_true",
        help="Also fill missing actors from Douban",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max movies to process (0=all)")
    parser.add_argument(
        "--delay",
        type=float,
        default=1.2,
        help="Seconds between Douban requests (default 1.2)",
    )
    args = parser.parse_args()

    ak, sk, token = get_aliyun_credentials()
    if not ak or not sk:
        print("[-] Missing Alibaba credentials (env or ~/.aliyun/config.json)", file=sys.stderr)
        return 1

    client = OTSClient(OTS_ENDPOINT, ak, sk, OTS_INSTANCE, sts_token=token)
    print(f"[*] Loading movies from {OTS_TABLE} @ {OTS_INSTANCE}...")
    movies = list_all_movies(client)
    print(f"[+] Found {len(movies)} movies in OTS")

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
            row, force_all=args.all, refresh_broken=args.refresh_broken
        )
        need_actors = args.with_actors and not (row.get("actors") or "").strip()

        if not need_poster and not need_actors:
            skipped += 1
            continue

        processed += 1
        print(f"[*] ({processed}) {title} [{douban_id}]")

        try:
            data = fetch_douban_movie(douban_id)
        except Exception as e:
            print(f"    [-] Douban fetch failed: {e}")
            failed += 1
            time.sleep(args.delay)
            continue

        changes: list[str] = []
        if need_poster:
            poster = extract_poster_url(data)
            if poster:
                row["poster_url"] = poster
                changes.append(f"poster={poster}")
            else:
                print("    [!] No poster in Douban response")
                failed += 1
                time.sleep(args.delay)
                continue

        if need_actors:
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
            put_movie_row(client, row)
            print(f"    [+] Updated: {', '.join(changes)}")
            updated += 1

        time.sleep(args.delay)

    print("\n=== Summary ===")
    print(f"Updated: {updated}")
    print(f"Skipped: {skipped}")
    print(f"Failed:  {failed}")
    print(f"Processed (attempted): {processed}")
    if args.dry_run:
        print("(dry-run — no OTS writes)")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
