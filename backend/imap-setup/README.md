# 📬 IMAP Setup Guide (Dovecot + SQLite + Maildir)

This directory contains the automated configuration and testing tools for running **IMAP / IMAPS (Ports 143 & 993)** on your Linux VPS using **SQLite** database authentication.

---

## ⚡ Quick 1-Command Automated Setup

Run on your VPS as root:

```bash
sudo bash backend/imap-setup/setup-dovecot.sh
```

This will automatically:
1. Install `dovecot-imapd` and `dovecot-sqlite`
2. Create `vmail` system user (`uid/gid 5000`)
3. Create Maildir storage directory (`backend/storage/maildir`)
4. Configure `/etc/dovecot/dovecot.conf` and `/etc/dovecot/dovecot-sql.conf.ext` to point to `backend/storage/email_logs.sqlite`
5. Open Firewall ports `143` and `993`
6. Start and enable `dovecot` service

---

## 🧪 Test IMAP Connection

```bash
bun backend/imap-setup/test-imap.js
```

---

## ⚙️ Client Connection Details

| Setting | Value |
|---|---|
| **Incoming Server (IMAP)** | Your VPS IP or Domain (e.g. `mailserver10.com`) |
| **Port** | `143` (STARTTLS/Plain) or `993` (SSL/TLS) |
| **Username** | Full Email (e.g. `support@yourdomain.com`) |
| **Password** | Account password in SQLite `mailbox` table |
| **Mail Storage** | Maildir format (`backend/storage/maildir/<domain>/<user>`) |
