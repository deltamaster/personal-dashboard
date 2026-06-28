#!/usr/bin/env python3
"""
Migration script to migrate travel visits and visit images from local SQLite (travel.db)
to Alibaba Cloud OTS (Tablestore) pd_visits and pd_visit_images tables,
and upload physical images to the private OSS vault bucket (pd-vault-sg).
"""

import os
import sys
import json
import sqlite3
import uuid
import datetime
import boto3
from botocore.client import Config
from tablestore import OTSClient, Row

# Configuration
TRAVEL_DB = "/home/openclaw/.openclaw/workspace/data/travel.db"
OTS_ENDPOINT = "https://pd-dash-sg.ap-southeast-1.ots.aliyuncs.com"
OTS_INSTANCE = "pd-dash-sg"
OTS_VISITS_TABLE = "pd_visits"
OTS_IMAGES_TABLE = "pd_visit_images"
OSS_VAULT_BUCKET = "pd-web-sg"

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

def get_content_type(ext):
    ext = ext.lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".png":
        return "image/png"
    if ext == ".webp":
        return "image/webp"
    return "application/octet-stream"

def migrate():
    # 1. Load Credentials
    ak_id, ak_secret, sts_token = get_aliyun_credentials()
    if not ak_id:
        print("[-] Failed to retrieve credentials. Exiting.")
        sys.exit(1)
        
    # 2. Connect to SQLite
    if not os.path.exists(TRAVEL_DB):
        print(f"[-] SQLite database not found at {TRAVEL_DB}")
        sys.exit(1)
        
    conn = sqlite3.connect(TRAVEL_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # 3. Connect to OTS and OSS
    print(f"[*] Connecting to OTS instance '{OTS_INSTANCE}'...")
    try:
        client = OTSClient(OTS_ENDPOINT, ak_id, ak_secret, OTS_INSTANCE, sts_token=sts_token)
        client.describe_table(OTS_VISITS_TABLE)
        client.describe_table(OTS_IMAGES_TABLE)
        print("[+] OTS tables verified.")
    except Exception as e:
        print(f"[-] OTS verification failed: {e}")
        conn.close()
        sys.exit(1)
        
    print(f"[*] Connecting to OSS vault bucket '{OSS_VAULT_BUCKET}'...")
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=ak_id,
            aws_secret_access_key=ak_secret,
            aws_session_token=sts_token,
            endpoint_url="https://oss-ap-southeast-1.aliyuncs.com",
            config=Config(s3={"addressing_style": "virtual"})
        )
        print("[+] OSS client connected.")
    except Exception as e:
        print(f"[-] OSS connection failed: {e}")
        conn.close()
        sys.exit(1)
        
    # 4. Migrate Visits
    try:
        cur.execute("SELECT * FROM visits")
        visit_rows = cur.fetchall()
    except Exception as e:
        print(f"[-] Failed to query visits from SQLite: {e}")
        conn.close()
        sys.exit(1)
        
    print(f"[*] Migrating {len(visit_rows)} travel visits...")
    visits_success = 0
    id_to_uuid = {} # To map SQLite integer id to OTS UUID string visit_id
    
    for row in visit_rows:
        row_dict = dict(row)
        sqlite_id = row_dict["id"]
        visit_id = str(uuid.uuid4())
        id_to_uuid[sqlite_id] = visit_id
        
        primary_key = [("visit_id", visit_id)]
        
        attributes = []
        for col, val in row_dict.items():
            if col == "id" or val is None:
                continue
            if col in ("created_at", "updated_at"):
                val = format_datetime(val)
            if col in ("rating", "revisit"):
                try:
                    val = int(val)
                except (ValueError, TypeError):
                    continue
            if col == "cost":
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    continue
            attributes.append((col, val))
            
        try:
            client.put_row(OTS_VISITS_TABLE, Row(primary_key, attributes))
            visits_success += 1
        except Exception as e:
            print(f"[-] Failed to migrate visit {row_dict.get('city')} {row_dict.get('attraction')}: {e}")
            
    print(f"[+] Migrated {visits_success}/{len(visit_rows)} travel visits.")
    
    # 5. Migrate Visit Images
    try:
        cur.execute("SELECT * FROM visit_images")
        image_rows = cur.fetchall()
    except Exception as e:
        print(f"[*] No visit_images table or failed to query: {e}")
        image_rows = []
        
    print(f"[*] Migrating {len(image_rows)} visit images and uploading to OSS vault...")
    images_success = 0
    images_failed = 0
    
    for i, row in enumerate(image_rows, 1):
        row_dict = dict(row)
        sqlite_visit_id = row_dict.get("visit_id")
        
        # Check mapping
        ots_visit_id = id_to_uuid.get(sqlite_visit_id)
        if not ots_visit_id:
            print(f"[-] Warning: Image {row_dict.get('file_path')} visit_id {sqlite_visit_id} has no mapped OTS visit_id. Skipping.")
            images_failed += 1
            continue
            
        local_path = row_dict.get("file_path")
        if not local_path or not os.path.exists(local_path):
            print(f"[-] Warning: Image file not found locally: {local_path}. Skipping.")
            images_failed += 1
            continue
            
        image_id = str(uuid.uuid4())
        _, ext = os.path.splitext(local_path)
        oss_key = f"travel/images/{image_id}{ext}"
        oss_url = f"https://pd.huhansen.com/{oss_key}"
        
        # Upload physical file to OSS
        try:
            with open(local_path, "rb") as f:
                img_data = f.read()
                
            s3.put_object(
                Bucket=OSS_VAULT_BUCKET,
                Key=oss_key,
                Body=img_data,
                ContentType=get_content_type(ext)
            )
        except Exception as e:
            print(f"[-] Failed to upload physical image {local_path} to OSS: {e}")
            images_failed += 1
            continue
            
        # Put metadata row in OTS
        primary_key = [("image_id", image_id)]
        attributes = [
            ("visit_id", ots_visit_id),
            ("oss_url", oss_url),
            ("description", row_dict.get("description") or ""),
            ("created_at", format_datetime(row_dict.get("created_at")))
        ]
        
        # Add dimensions if present
        for col in ("width", "height"):
            if row_dict.get(col) is not None:
                try:
                    attributes.append((col, int(row_dict[col])))
                except (ValueError, TypeError):
                    pass
                    
        try:
            client.put_row(OTS_IMAGES_TABLE, Row(primary_key, attributes))
            images_success += 1
            if images_success % 20 == 0 or images_success == len(image_rows):
                print(f"[+] Migrated {images_success}/{len(image_rows)} visit images and uploaded to OSS...")
        except Exception as e:
            print(f"[-] Failed to save image metadata in OTS for {oss_key}: {e}")
            images_failed += 1
            
    conn.close()
    
    print("\n=== Travel Migration Complete ===")
    print(f"Visits: {visits_success}/{len(visit_rows)} migrated.")
    print(f"Images: {images_success}/{len(image_rows)} migrated and uploaded (Failed/Skipped: {images_failed}).")

if __name__ == "__main__":
    migrate()
