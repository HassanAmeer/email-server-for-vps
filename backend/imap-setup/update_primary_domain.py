import sqlite3

db_paths = [
    "/root/tempmail/backend/storage/email_logs.sqlite",
    "/root/email-server-for-vps/database/mail.db",
    "backend/storage/email_logs.sqlite",
    "database/mail.db"
]

for p in db_paths:
    try:
        conn = sqlite3.connect(p)
        # Update attached_domains
        conn.execute("UPDATE attached_domains SET is_primary = 0")
        conn.execute("""
            INSERT INTO attached_domains (id, domain, status, plan, is_primary, primary_prefix, catch_all)
            VALUES (4, 'micorna.biz', 'active', 'premium', 1, 'admin', 1)
            ON CONFLICT(id) DO UPDATE SET
                domain = 'micorna.biz',
                is_primary = 1,
                primary_prefix = 'admin',
                catch_all = 1
        """)
        # Update or Insert mailbox_table
        conn.execute("""
            INSERT INTO mailbox_table (id, email, plain_password, password_hash)
            VALUES (3, 'admin@micorna.biz', '12345678', '$2b$10$8z12h46vWvax./FqLynmkOZuYaabQ7AF0DbJ0O/C7JxDzmprPpwn6')
            ON CONFLICT(id) DO UPDATE SET
                email = 'admin@micorna.biz',
                plain_password = '12345678'
        """)
        conn.commit()
        print(f"Updated DB at {p}")
    except Exception as e:
        print(f"Skipped {p}: {e}")
