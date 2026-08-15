# 📬 IMAP Setup & Integration Guide (Dovecot + Maildir)

This directory contains the automated configuration and testing tools for running **IMAP / IMAPS (Ports 143 & 993)** on your Linux VPS and localhost alongside the existing Bun + SQLite / PostgreSQL email server.

---

## ⚡ Quick 1-Command Setup on VPS

Run the automated installer script as root on your VPS:

```bash
sudo bash backend/imap-setup/setup-dovecot.sh
```

### What this script does automatically:
1. Installs `dovecot-imapd`, `dovecot-sqlite`, and `dovecot-pgsql`.
2. Creates the `vmail` service user.
3. Automatically maps your project's `backend/storage/maildir` folder.
4. Connects Dovecot SQL authentication directly to `mailbox_users` table in `backend/storage/email_logs.sqlite` (or PostgreSQL).
5. Opens Firewall (UFW) ports `143` and `993`.
6. Starts and enables the `dovecot` daemon.

---

## 🔑 Client Connection Details

Provide these settings to your client for Outlook, Apple Mail, Thunderbird, Android/iOS, or custom code:

| Setting | Value |
| :--- | :--- |
| **Incoming Mail Server (IMAP)** | `mail.yourdomain.com` *(or Server IP)* |
| **IMAP Port (SSL/TLS)** | `993` *(Recommended)* |
| **IMAP Port (STARTTLS/Plain)** | `143` |
| **Username** | `user@yourdomain.com` *(Created in Admin Panel)* |
| **Password** | Account password set in Admin Panel |
| **Security** | SSL / TLS |

---

## 🧪 Testing IMAP Connection

Test authentication and inbox retrieval from the CLI:

```bash
# Test local IMAP port 143
bun backend/imap-setup/test-imap.js 127.0.0.1 143 test@mailserver10.com 123456

# Test live IMAPS SSL port 993
bun backend/imap-setup/test-imap.js mail.yourdomain.com 993 test@mailserver10.com 123456
```

---

## 📁 Storage & Duplication Policy

* All incoming emails are saved once into standard **RFC822 `.eml` format**:
  `backend/storage/maildir/<domain>/<username>/new/<id>.eml`
* **Zero Duplication:** Admin Master Inbox (`_all_mails_`) uses Linux hardlinks (`fs.linkSync`), consuming **0 extra bytes of disk storage**.
* REST APIs and Webhook delivery continue to operate concurrently with 100% backward compatibility.
