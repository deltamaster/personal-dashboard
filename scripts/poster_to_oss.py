#!/usr/bin/env python3
"""
Download one Douban poster and upload to OSS, then update OTS poster_url.

Uses Referer so Douban CDN returns 200 (not 418). Public URL is served via CDN:
  https://pd.huhansen.com/movies/posters/{douban_subject_id}.jpg

Examples:
  python scripts/poster_to_oss.py --douban-id 25750969 --save-local poster.jpg
  python scripts/poster_to_oss.py --douban-id 25750969 --dry-run
  python scripts/poster_to_oss.py --douban-id 25750969
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poster_oss_lib import (
    DEFAULT_OSS_BUCKET,
    DEFAULT_OSS_ENDPOINT,
    DEFAULT_PUBLIC_BASE,
    apply_stack_preset,
    download_poster_bytes,
    extract_poster_url,
    fetch_douban_movie,
    get_movie_row,
    load_dotenv_local,
    ots_client,
    poster_oss_key,
    poster_public_url,
    put_movie_row,
    resolve_credentials,
    upload_to_oss,
    utc_now_iso,
)


def main() -> int:
    load_dotenv_local()

    parser = argparse.ArgumentParser(description="Download Douban poster → OSS → OTS")
    parser.add_argument(
        "--douban-id",
        required=True,
        help="Douban subject id, e.g. 25750969",
    )
    parser.add_argument(
        "--stack",
        choices=("sg", "cn-shanghai"),
        default="sg",
        help="Target stack (default: sg = pd-dash-sg + pd-web-sg)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and show URLs only; no OSS/OTS writes",
    )
    parser.add_argument(
        "--no-ots",
        action="store_true",
        help="Upload to OSS but skip OTS update",
    )
    parser.add_argument(
        "--save-local",
        metavar="PATH",
        help="Also save downloaded bytes to a local file",
    )
    parser.add_argument(
        "--public-base",
        default=DEFAULT_PUBLIC_BASE,
        help=f"CDN origin for poster URLs (default: {DEFAULT_PUBLIC_BASE})",
    )
    parser.add_argument(
        "--oss-bucket",
        default=DEFAULT_OSS_BUCKET,
        help=f"OSS web bucket (default: {DEFAULT_OSS_BUCKET})",
    )
    parser.add_argument(
        "--oss-endpoint",
        default=DEFAULT_OSS_ENDPOINT,
        help=f"OSS endpoint host (default: {DEFAULT_OSS_ENDPOINT})",
    )
    args = parser.parse_args()

    ots_endpoint = DEFAULT_OTS_ENDPOINT
    ots_instance = DEFAULT_OTS_INSTANCE
    oss_bucket = args.oss_bucket
    oss_endpoint = args.oss_endpoint
    public_base = args.public_base

    if args.stack:
        preset = apply_stack_preset(args.stack)
        ots_endpoint, ots_instance, stack_bucket, stack_endpoint = preset
        if args.oss_bucket == DEFAULT_OSS_BUCKET:
            oss_bucket = stack_bucket
        if args.oss_endpoint == DEFAULT_OSS_ENDPOINT:
            oss_endpoint = stack_endpoint
        if args.stack == "cn-shanghai" and args.public_base == DEFAULT_PUBLIC_BASE:
            public_base = "https://huhansen.com"

    douban_id = str(args.douban_id).strip()
    print(f"[*] Douban subject {douban_id}")

    try:
        data = fetch_douban_movie(douban_id)
    except Exception as e:
        print(f"[-] Douban API failed: {e}", file=sys.stderr)
        return 1

    title = data.get("title") or douban_id
    poster_url = extract_poster_url(data)
    if not poster_url:
        print("[-] No poster URL in Douban response", file=sys.stderr)
        return 1

    print(f"[+] {title}")
    print(f"    source: {poster_url}")

    try:
        image_bytes, content_type = download_poster_bytes(douban_id, poster_url)
    except Exception as e:
        print(f"[-] Poster download failed: {e}", file=sys.stderr)
        return 1

    print(f"[+] Downloaded {len(image_bytes)} bytes ({content_type})")

    if args.save_local:
        with open(args.save_local, "wb") as f:
            f.write(image_bytes)
        print(f"[+] Saved locally: {args.save_local}")

    oss_key = poster_oss_key(douban_id, content_type)
    public_url = poster_public_url(public_base, douban_id, content_type)
    print(f"    oss://{oss_bucket}/{oss_key}")
    print(f"    public: {public_url}")
    print(f"    stack: {args.stack} ({ots_instance})")

    if args.dry_run:
        print("[dry-run] No OSS/OTS writes")
        return 0

    ak, sk, token = resolve_credentials()
    if not ak or not sk:
        print("[-] Missing Alibaba credentials for OSS upload", file=sys.stderr)
        return 1

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
        print(f"[-] OSS upload failed: {e}", file=sys.stderr)
        return 1

    print(f"[+] Uploaded to OSS")

    if args.no_ots:
        print("[*] Skipping OTS update (--no-ots)")
        return 0

    try:
        client = ots_client(endpoint=ots_endpoint, instance=ots_instance)
        row = get_movie_row(client, douban_id)
    except Exception as e:
        print(f"[-] OTS read failed: {e}", file=sys.stderr)
        return 1

    if row is None:
        print(f"[-] No OTS row for douban_subject_id={douban_id}", file=sys.stderr)
        return 1

    old_url = row.get("poster_url")
    row["poster_url"] = public_url
    row["updated_at"] = utc_now_iso()

    try:
        put_movie_row(client, row)
    except Exception as e:
        print(f"[-] OTS write failed: {e}", file=sys.stderr)
        return 1

    print(f"[+] OTS poster_url updated")
    if old_url and old_url != public_url:
        print(f"    was: {old_url}")
    print(f"    now: {public_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
