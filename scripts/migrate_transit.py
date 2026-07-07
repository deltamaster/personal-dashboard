#!/usr/bin/env python3
"""
Migration script to migrate flight and train records from local SQLite (flights.db)
to Alibaba Cloud OTS (Tablestore) pd_flights and pd_trains tables.
"""

import os
import sys
import json
import sqlite3
import uuid
import datetime
from tablestore import OTSClient, Row

# Configuration
FLIGHTS_DB = "/home/openclaw/.openclaw/workspace/data/flights.db"
OTS_ENDPOINT = "https://pd-dashboard.cn-shanghai.ots.aliyuncs.com"
OTS_INSTANCE = "pd-dashboard"
OTS_FLIGHTS_TABLE = "pd_flights"
OTS_TRAINS_TABLE = "pd_trains"

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
    if not os.path.exists(FLIGHTS_DB):
        print(f"[-] SQLite database not found at {FLIGHTS_DB}")
        sys.exit(1)
        
    conn = sqlite3.connect(FLIGHTS_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # 3. Connect to OTS
    print(f"[*] Connecting to OTS instance '{OTS_INSTANCE}'...")
    try:
        client = OTSClient(OTS_ENDPOINT, ak_id, ak_secret, OTS_INSTANCE, sts_token=sts_token)
        # Verify tables
        client.describe_table(OTS_FLIGHTS_TABLE)
        client.describe_table(OTS_TRAINS_TABLE)
        print("[+] OTS tables verified.")
    except Exception as e:
        print(f"[-] OTS verification failed: {e}")
        conn.close()
        sys.exit(1)
        
    # 4. Migrate Flights
    try:
        cur.execute("SELECT * FROM flights")
        flight_rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query flights from SQLite: {e}")
        flight_rows = []
        
    print(f"[*] Migrating {len(flight_rows)} flight records...")
    flights_success = 0
    for row in flight_rows:
        row_dict = dict(row)
        flight_id = str(uuid.uuid4())
        primary_key = [("flight_id", flight_id)]
        
        attributes = []
        for col, val in row_dict.items():
            if col == "id" or val is None:
                continue
            if col == "created_at":
                val = format_datetime(val)
            if col == "distance_km":
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    continue
            attributes.append((col, val))
            
        try:
            client.put_row(OTS_FLIGHTS_TABLE, Row(primary_key, attributes))
            flights_success += 1
        except Exception as e:
            print(f"[-] Failed to migrate flight {row_dict.get('flight_number')}: {e}")
            
    print(f"[+] Migrated {flights_success}/{len(flight_rows)} flights.")
    
    # 5. Migrate Trains
    try:
        cur.execute("SELECT * FROM trains")
        train_rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query trains from SQLite: {e}")
        train_rows = []
        
    print(f"[*] Migrating {len(train_rows)} train records...")
    trains_success = 0
    for row in train_rows:
        row_dict = dict(row)
        train_id = str(uuid.uuid4())
        primary_key = [("train_id", train_id)]
        
        attributes = []
        for col, val in row_dict.items():
            if col == "id" or val is None:
                continue
            if col == "created_at":
                val = format_datetime(val)
            if col == "duration_minutes":
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    continue
            attributes.append((col, val))
            
        try:
            client.put_row(OTS_TRAINS_TABLE, Row(primary_key, attributes))
            trains_success += 1
        except Exception as e:
            print(f"[-] Failed to migrate train {row_dict.get('train_number')}: {e}")
            
    print(f"[+] Migrated {trains_success}/{len(train_rows)} trains.")
    conn.close()
    
    print("\n=== Transit Migration Complete ===")
    print(f"Flights: {flights_success}/{len(flight_rows)} migrated.")
    print(f"Trains:  {trains_success}/{len(train_rows)} migrated.")

if __name__ == "__main__":
    migrate()
