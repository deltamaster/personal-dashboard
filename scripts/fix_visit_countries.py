#!/usr/bin/env python3
"""
Fix pd_visits rows where the destination country was stored in province with country=中国.

Moves non-Chinese province values into country and clears province.

Examples:
  python scripts/fix_visit_countries.py --stack cn-shanghai --dry-run
  python scripts/fix_visit_countries.py --stack cn-shanghai
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from poster_oss_lib import apply_stack_preset, load_dotenv_local, resolve_credentials
from tablestore import Direction, INF_MAX, INF_MIN, OTSClient, Row

VISITS_TABLE = "pd_visits"

CHINA_PROVINCES = {
    "安徽",
    "北京",
    "重庆",
    "福建",
    "甘肃",
    "广东",
    "广西",
    "贵州",
    "海南",
    "河北",
    "黑龙江",
    "河南",
    "香港",
    "湖北",
    "湖南",
    "江苏",
    "江西",
    "吉林",
    "辽宁",
    "澳门",
    "内蒙古",
    "宁夏",
    "青海",
    "陕西",
    "山东",
    "上海",
    "山西",
    "四川",
    "天津",
    "新疆",
    "西藏",
    "云南",
    "浙江",
    "台湾",
}

PROVINCE_ALIASES = {
    "内蒙古自治区": "内蒙古",
    "广西壮族自治区": "广西",
    "西藏自治区": "西藏",
    "宁夏回族自治区": "宁夏",
    "新疆维吾尔自治区": "新疆",
    "香港特别行政区": "香港",
    "澳门特别行政区": "澳门",
    "台湾省": "台湾",
    "台湾地区": "台湾",
    "台湾": "台湾",
    "北京市": "北京",
    "天津市": "天津",
    "上海市": "上海",
    "重庆市": "重庆",
}

CHINA_COUNTRY_ALIASES = {
    "中国",
    "China",
    "CN",
    "PRC",
    "中华人民共和国",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_province(name: str) -> str:
    trimmed = name.strip()
    if trimmed in PROVINCE_ALIASES:
        return PROVINCE_ALIASES[trimmed]
    return (
        trimmed.replace("壮族自治区", "")
        .replace("回族自治区", "")
        .replace("维吾尔自治区", "")
        .replace("自治区", "")
        .replace("特别行政区", "")
        .replace("省", "")
        .replace("市", "")
        .strip()
    )


def is_china_country(country: str | None) -> bool:
    if not country or not str(country).strip():
        return True
    return str(country).strip() in CHINA_COUNTRY_ALIASES


def row_to_dict(row: Row) -> dict:
    data = {name: value for name, value in row.primary_key}
    for item in row.attribute_columns:
        if len(item) >= 2:
            data[item[0]] = item[1]
    return data


def list_visits(client: OTSClient) -> list[dict]:
    visits: list[dict] = []
    start_key = [("visit_id", INF_MIN)]
    while True:
        _consumed, next_start, row_list, _total = client.get_range(
            VISITS_TABLE,
            Direction.FORWARD,
            start_key,
            [("visit_id", INF_MAX)],
            limit=100,
        )
        for row in row_list:
            visits.append(row_to_dict(row))
        if next_start is None:
            break
        start_key = next_start
    return visits


def fix_visit(row: dict) -> tuple[dict, bool]:
    country = str(row.get("country") or "").strip()
    province_raw = str(row.get("province") or "").strip()
    normalized_province = normalize_province(province_raw) if province_raw else ""

    updated = dict(row)
    changed = False

    if normalized_province and normalized_province in CHINA_PROVINCES:
        if not country or country in CHINA_COUNTRY_ALIASES:
            if country != "中国":
                updated["country"] = "中国"
                changed = True
        return updated, changed

    if normalized_province and is_china_country(country):
        if country != normalized_province:
            updated["country"] = normalized_province
            changed = True
        if province_raw:
            updated["province"] = ""
            changed = True
        return updated, changed

    if not country:
        updated["country"] = "中国"
        changed = True

    return updated, changed


def put_visit(client: OTSClient, row: dict) -> None:
    visit_id = str(row["visit_id"])
    primary_key = [("visit_id", visit_id)]
    attribute_columns: list[tuple[str, object]] = []
    for name, value in row.items():
        if name == "visit_id":
            continue
        if value is None:
            continue
        attribute_columns.append((name, value))
    client.put_row(VISITS_TABLE, Row(primary_key, attribute_columns))


def main() -> int:
    load_dotenv_local()

    parser = argparse.ArgumentParser(description="Fix visit country values in OTS")
    parser.add_argument("--stack", choices=("cn-shanghai", "qa"), default="cn-shanghai")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    ots_endpoint, ots_instance, _oss_bucket, _oss_endpoint = apply_stack_preset(args.stack)
    ak, sk, token = resolve_credentials()
    if not ak or not sk:
        print("[-] Missing Alibaba credentials", file=sys.stderr)
        return 1

    client = OTSClient(ots_endpoint, ak, sk, ots_instance, sts_token=token)
    print(f"[*] Scanning {VISITS_TABLE} on {ots_instance}...")

    visits = list_visits(client)
    print(f"[+] Loaded {len(visits)} visits")

    to_fix: list[tuple[dict, dict]] = []
    for visit in visits:
        fixed, changed = fix_visit(visit)
        if changed:
            to_fix.append((visit, fixed))

    if not to_fix:
        print("[+] No rows need updating")
        return 0

    print(f"[*] {len(to_fix)} rows to update")
    for before, after in to_fix[:20]:
        print(
            f"  {before.get('visit_id')}: "
            f"country {before.get('country')!r} -> {after.get('country')!r}, "
            f"province {before.get('province')!r} -> {after.get('province')!r} "
            f"({before.get('city')} · {before.get('attraction')})"
        )
    if len(to_fix) > 20:
        print(f"  ... and {len(to_fix) - 20} more")

    if args.dry_run:
        print("[dry-run] No OTS writes")
        return 0

    updated = 0
    for _before, after in to_fix:
        after["updated_at"] = utc_now_iso()
        try:
            put_visit(client, after)
            updated += 1
        except Exception as e:
            print(f"[-] Failed {after.get('visit_id')}: {e}", file=sys.stderr)

    print(f"[+] Updated {updated}/{len(to_fix)} visits")
    return 0 if updated == len(to_fix) else 1


if __name__ == "__main__":
    raise SystemExit(main())
