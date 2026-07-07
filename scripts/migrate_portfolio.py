#!/usr/bin/env python3
"""
Migration script to migrate portfolio holdings and snapshots from local SQLite (portfolio.db)
to Alibaba Cloud OTS (Tablestore) pd_holdings and pd_snapshots tables.
"""

import os
import sys
import json
import sqlite3
import uuid
import datetime
from tablestore import OTSClient, Row

# Configuration
PORTFOLIO_DB = "/home/openclaw/.openclaw/workspace/data/portfolio.db"
OTS_ENDPOINT = "https://pd-dashboard.cn-shanghai.ots.aliyuncs.com"
OTS_INSTANCE = "pd-dashboard"
OTS_HOLDINGS_TABLE = "pd_holdings"
OTS_SNAPSHOTS_TABLE = "pd_snapshots"

def get_aliyun_credentials():
    config_path = os.path.expanduser("~/.aliyun/config.json")
    if not os.path.exists(config_path):
        print(f"[-] Aliyun CLI config not found at {config_path}")
        return None, None, None

    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        
        default_prof = next((p for p in config.get("profiles", []) if p.get("name") == "default"), None)
        if not default_prof:
            print("[-] 'default' profile not found in Aliyun CLI config")
            return None, None, None
        
        ak_id = default_prof.get("access_key_id")
        ak_secret = default_prof.get("access_key_secret")
        sts_token = default_prof.get("sts_token")
        return ak_id, ak_secret, sts_token
    except Exception as e:
        print(f"[-] Error reading Aliyun CLI config: {e}")
        return None, None, None

def format_datetime(dt_str):
    if not dt_str:
        return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    dt_str = dt_str.strip()
    if " " in dt_str:
        return dt_str.replace(" ", "T") + "Z"
    if "T" in dt_str:
        if not dt_str.endswith("Z"):
            return dt_str + "Z"
        return dt_str
    if len(dt_str) == 10:  # YYYY-MM-DD
        return dt_str + "T00:00:00Z"
    return dt_str

def migrate():
    # 1. Load Credentials
    ak_id, ak_secret, sts_token = get_aliyun_credentials()
    if not ak_id:
        print("[-] Failed to retrieve credentials. Exiting.")
        sys.exit(1)
        
    # 2. Connect to SQLite
    if not os.path.exists(PORTFOLIO_DB):
        print(f"[-] SQLite database not found at {PORTFOLIO_DB}")
        sys.exit(1)
        
    conn = sqlite3.connect(PORTFOLIO_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # 3. Connect to OTS
    print(f"[*] Connecting to OTS instance '{OTS_INSTANCE}'...")
    try:
        client = OTSClient(OTS_ENDPOINT, ak_id, ak_secret, OTS_INSTANCE, sts_token=sts_token)
        client.describe_table(OTS_HOLDINGS_TABLE)
        client.describe_table(OTS_SNAPSHOTS_TABLE)
        print("[+] OTS tables verified.")
    except Exception as e:
        print(f"[-] OTS verification failed: {e}")
        conn.close()
        sys.exit(1)
        
    # 4. Wipe existing OTS tables to avoid duplication and dirty records
    print("[*] Wiping OTS tables for a clean migration...")
    from tablestore import INF_MIN, INF_MAX, Direction
    
    # Wipe pd_holdings
    start_pk = [('holding_id', INF_MIN)]
    end_pk = [('holding_id', INF_MAX)]
    holdings_deleted = 0
    while start_pk:
        consumed, next_pk, rows, response_info = client.get_range(
            OTS_HOLDINGS_TABLE, Direction.FORWARD, start_pk, end_pk, limit=1000
        )
        for r in rows:
            client.delete_row(OTS_HOLDINGS_TABLE, Row(r.primary_key))
            holdings_deleted += 1
        start_pk = next_pk
    print(f"[+] Wiped {holdings_deleted} rows from {OTS_HOLDINGS_TABLE}.")
    
    # Wipe pd_snapshots
    start_pk = [('snapshot_date', INF_MIN)]
    end_pk = [('snapshot_date', INF_MAX)]
    snapshots_deleted = 0
    while start_pk:
        consumed, next_pk, rows, response_info = client.get_range(
            OTS_SNAPSHOTS_TABLE, Direction.FORWARD, start_pk, end_pk, limit=1000
        )
        for r in rows:
            client.delete_row(OTS_SNAPSHOTS_TABLE, Row(r.primary_key))
            snapshots_deleted += 1
        start_pk = next_pk
    print(f"[+] Wiped {snapshots_deleted} rows from {OTS_SNAPSHOTS_TABLE}.")
    
    # 5. Migrate Holdings
    try:
        cur.execute("SELECT * FROM holdings")
        holding_rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query holdings from SQLite: {e}")
        holding_rows = []
        
    print(f"[*] Migrating {len(holding_rows)} portfolio holdings...")
    holdings_success = 0
    
    double_cols = [
        "quantity", "purchase_nav", "current_nav", "purchase_amount", "current_value",
        "unrealized_pnl", "unrealized_pct", "cash_dividend", "total_return", "total_return_pct",
        "coupon_rate", "knockin_level", "autocall_level", "strike_level"
    ]
    
    for row in holding_rows:
        row_dict = dict(row)
        holding_id = str(uuid.uuid4())
        primary_key = [("holding_id", holding_id)]
        
        attributes = []
        for col, val in row_dict.items():
            if col == "id" or val is None:
                continue
            if col in ("created_at", "updated_at"):
                val = format_datetime(val)
            if col == "risk_level":
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    continue
            if col in double_cols:
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    continue
            attributes.append((col, val))
            
        try:
            client.put_row(OTS_HOLDINGS_TABLE, Row(primary_key, attributes))
            holdings_success += 1
        except Exception as e:
            print(f"[-] Failed to migrate holding '{row_dict.get('name')}': {e}")
            
    print(f"[+] Migrated {holdings_success}/{len(holding_rows)} holdings.")
    
    # 6. Migrate Snapshots
    try:
        cur.execute("SELECT * FROM snapshots")
        snapshot_rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query snapshots from SQLite: {e}")
        snapshot_rows = []
        
    print(f"[*] Migrating {len(snapshot_rows)} historical snapshots...")
    snapshots_success = 0
    
    snapshot_double_cols = ["total_value", "total_pnl", "total_dividend", "total_return"]
    
    for row in snapshot_rows:
        row_dict = dict(row)
        snapshot_date = str(row_dict["snapshot_date"]).strip()
        primary_key = [("snapshot_date", snapshot_date)]
        
        attributes = []
        for col, val in row_dict.items():
            if col in ("id", "snapshot_date") or val is None:
                continue
            if col == "created_at":
                val = format_datetime(val)
            if col in snapshot_double_cols:
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    continue
            attributes.append((col, val))
            
        try:
            client.put_row(OTS_SNAPSHOTS_TABLE, Row(primary_key, attributes))
            snapshots_success += 1
        except Exception as e:
            print(f"[-] Failed to migrate snapshot for date {snapshot_date}: {e}")
            
    print(f"[+] Migrated {snapshots_success}/{len(snapshot_rows)} snapshots.")
    conn.close()
    
    print("\n=== Portfolio Migration Complete ===")
    print(f"Holdings:  {holdings_success}/{len(holding_rows)} migrated.")
    print(f"Snapshots: {snapshots_success}/{len(snapshot_rows)} migrated.")

if __name__ == "__main__":
    migrate()
