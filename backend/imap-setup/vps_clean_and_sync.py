import sqlite3
import os
import shutil

VPS_DB = "/root/tempmail/backend/storage/email_logs.sqlite"
LIVE_STORAGE = "/root/tempmail/backend/storage/live"
LOCAL_STORAGE = "/root/tempmail/backend/storage/local"

print("--- VPS CLEANUP & OPTIMIZATION ---")

# 1. Clean Database
if os.path.exists(VPS_DB):
    conn = sqlite3.connect(VPS_DB)
    cur = conn.cursor()
    
    print("Clearing system logs & old API logs...")
    cur.execute("DELETE FROM system_logs")
    cur.execute("DELETE FROM project_api_logs")
    cur.execute("DELETE FROM generated_emails")
    cur.execute("DELETE FROM received_emails")
    
    print("Syncing attached domains...")
    cur.execute("DELETE FROM attached_domains")
    cur.execute("""
        INSERT INTO attached_domains (id, domain, status, plan, catch_all, is_primary, primary_prefix, created_at)
        VALUES (1, 'micorna.biz', 'active', 'free', 1, 1, 'admin', datetime('now'))
    """)
    cur.execute("""
        INSERT INTO attached_domains (id, domain, status, plan, catch_all, is_primary, primary_prefix, created_at)
        VALUES (2, 'visakara.org', 'active', 'free', 1, 0, 'my', datetime('now'))
    """)
    
    conn.commit()
    print("Optimizing SQLite database (VACUUM & WAL checkpoint)...")
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    cur.execute("VACUUM;")
    conn.close()
    print("✅ Database cleaned and optimized!")

# 2. Clean Storage JSON files
for st_dir in [LIVE_STORAGE, LOCAL_STORAGE]:
    if os.path.exists(st_dir):
        files = [os.path.join(st_dir, f) for f in os.listdir(st_dir) if f.endswith(".json")]
        count = len(files)
        print(f"Removing {count} old files in {st_dir}...")
        for f in files:
            try:
                os.remove(f)
            except Exception:
                pass
        print(f"✅ Cleared {st_dir}!")

print("--- VPS CLEANUP COMPLETE ---")
