#!/usr/bin/env python3
"""
Migration script to migrate movie records from local SQLite to Alibaba Cloud OTS (Tablestore).
This script dynamically reads the refreshed STS credentials from the local Aliyun CLI configuration
to avoid any hardcoded secrets.
"""

import os
import sys
import json
import sqlite3
import datetime
from tablestore import OTSClient, Row

# Configuration
LOCAL_DB = "/home/openclaw/.openclaw/workspace/data/movies.db"
OTS_ENDPOINT = "https://pd-dashboard.cn-shanghai.ots.aliyuncs.com"
OTS_INSTANCE = "pd-dashboard"
OTS_TABLE = "pd_movies"

def get_aliyun_credentials():
    """
    Dynamically loads the refreshed STS credentials from the Aliyun CLI configuration.
    """
    config_path = os.path.expanduser("~/.aliyun/config.json")
    if not os.path.exists(config_path):
        print(f"[-] Aliyun CLI config not found at {config_path}")
        return None, None, None

    try:
        with open(config_path, "r") as f:
            config = json.load(f)
        
        # Find the 'default' profile which is used for the root account with STS
        default_prof = next((p for p in config.get("profiles", []) if p.get("name") == "default"), None)
        if not default_prof:
            print("[-] 'default' profile not found in Aliyun CLI config")
            return None, None, None
        
        ak_id = default_prof.get("access_key_id")
        ak_secret = default_prof.get("access_key_secret")
        sts_token = default_prof.get("sts_token")
        
        if not ak_id or not ak_secret:
            print("[-] Access Key ID or Secret missing in 'default' profile")
            return None, None, None
            
        return ak_id, ak_secret, sts_token
    except Exception as e:
        print(f"[-] Error reading Aliyun CLI config: {e}")
        return None, None, None

def format_datetime(dt_str):
    """
    Converts SQLite YYYY-MM-DD HH:MM:SS format to ISO 8601 (YYYY-MM-DDTHH:MM:SSZ).
    """
    if not dt_str:
        return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    
    dt_str = dt_str.strip()
    if " " in dt_str:
        return dt_str.replace(" ", "T") + "Z"
    if "T" in dt_str:
        if not dt_str.endswith("Z"):
            return dt_str + "Z"
        return dt_str
    if len(dt_str) == 10:  # Just date YYYY-MM-DD
        return dt_str + "T00:00:00Z"
    return dt_str

def migrate():
    # 1. Load Aliyun Credentials
    print("[*] Retrieving credentials from Aliyun CLI config...")
    ak_id, ak_secret, sts_token = get_aliyun_credentials()
    if not ak_id:
        print("[-] Failed to retrieve credentials. Exiting.")
        sys.exit(1)
    
    print("[+] Credentials successfully loaded from Aliyun CLI.")
    
    # 2. Connect to SQLite
    if not os.path.exists(LOCAL_DB):
        print(f"[-] SQLite database not found at {LOCAL_DB}")
        sys.exit(1)
        
    print(f"[*] Connecting to SQLite database at {LOCAL_DB}...")
    conn = sqlite3.connect(LOCAL_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    try:
        cur.execute("SELECT * FROM movies")
        rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query SQLite database: {e}")
        conn.close()
        sys.exit(1)
        
    print(f"[+] Found {len(rows)} movie records in SQLite.")
    
    # 3. Connect to OTS
    print(f"[*] Connecting to OTS instance '{OTS_INSTANCE}' at {OTS_ENDPOINT}...")
    try:
        client = OTSClient(OTS_ENDPOINT, ak_id, ak_secret, OTS_INSTANCE, sts_token=sts_token)
        # Verify connection by describing the table
        desc = client.describe_table(OTS_TABLE)
        print(f"[+] Successfully connected to OTS. Table '{OTS_TABLE}' verified.")
    except Exception as e:
        print(f"[-] Failed to connect to OTS or verify table '{OTS_TABLE}': {e}")
        conn.close()
        sys.exit(1)
        
    # 4. Migrate rows
    print(f"[*] Beginning migration of {len(rows)} records...")
    success_count = 0
    fail_count = 0
    
    for i, row in enumerate(rows, 1):
        row_dict = dict(row)
        douban_id = row_dict.get("douban_subject_id")
        
        if not douban_id:
            print(f"[-] Row {i} has no douban_subject_id. Skipping.")
            fail_count += 1
            continue
            
        # Primary Key
        primary_key = [("douban_subject_id", str(douban_id))]
        
        # Attribute Columns
        attribute_columns = []
        for col_name, value in row_dict.items():
            if col_name in ["id", "douban_subject_id"]:
                continue
            if value is None:
                continue
                
            # Date format parsing
            if col_name in ["created_at", "updated_at"]:
                value = format_datetime(value)
                
            # Numerical parsing
            if col_name in ["user_rating", "release_year", "duration_minutes"]:
                try:
                    value = int(value)
                except (ValueError, TypeError):
                    print(f"[!] Warning: Row {douban_id} has invalid integer for {col_name}: {value}. Skipping field.")
                    continue
            
            attribute_columns.append((col_name, value))
            
        # Put row in OTS
        try:
            ots_row = Row(primary_key, attribute_columns)
            client.put_row(OTS_TABLE, ots_row)
            success_count += 1
            if success_count % 50 == 0 or success_count == len(rows):
                print(f"[+] Migrated {success_count}/{len(rows)} records...")
        except Exception as e:
            print(f"[-] Failed to migrate movie '{row_dict.get('title_primary', 'Unknown')}' (Douban ID: {douban_id}): {e}")
            fail_count += 1
            
    conn.close()
    print("\n=== Migration Summary ===")
    print(f"Total processed: {len(rows)}")
    print(f"Successfully migrated: {success_count}")
    print(f"Failed: {fail_count}")
    print("=========================")

if __name__ == "__main__":
    migrate()
