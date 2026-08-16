import sqlite3
import os
import glob
import subprocess

def clean_and_sync_local():
    local_db = os.path.join(os.getcwd(), "backend", "storage", "email_logs.sqlite")
    if os.path.exists(local_db):
        conn = sqlite3.connect(local_db)
        cur = conn.cursor()
        print(f"Cleaning local database at {local_db}...")
        
        # Clean logs
        cur.execute("DELETE FROM system_logs")
        cur.execute("DELETE FROM project_api_logs")
        
        # Ensure attached domains
        cur.execute("DELETE FROM attached_domains")
        cur.execute("""
            INSERT INTO attached_domains (id, domain, status, plan, catch_all, is_primary, primary_prefix, created_at)
            VALUES (1, 'micorna.biz', 'active', 'free', 1, 1, 'admin', datetime('now'))
        """)
        cur.execute("""
            INSERT INTO attached_domains (id, domain, status, plan, catch_all, is_primary, primary_prefix, created_at)
            VALUES (2, 'visakara.org', 'active', 'free', 1, 0, 'my', datetime('now'))
        """)
        
        # Clean temporary generated emails older than current
        cur.execute("DELETE FROM generated_emails")
        cur.execute("DELETE FROM received_emails")
        
        conn.commit()
        conn.close()
        print("✅ Local database cleaned and domains synced!")

if __name__ == "__main__":
    clean_and_sync_local()
