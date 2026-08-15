# 📬 IMAP Setup Guide (Dovecot + PostgreSQL + Maildir)

This directory contains the automated configuration and testing tools for running **IMAP / IMAPS (Ports 143 & 993)** on your Linux VPS using **PostgreSQL** database authentication.

---

## ⚡ Quick 1-Command Setup on VPS

Run the automated installer script as root on your VPS:

```bash
sudo bash backend/imap-setup/setup-dovecot.sh
```

Or with custom PostgreSQL credentials:

```bash
sudo PGDATABASE=email_server PGUSER=postgres PGPASSWORD=your_password bash backend/imap-setup/setup-dovecot.sh
```

---

## 🔑 Client Connection Details

| Setting | Value |
| :--- | :--- |
| **Incoming Mail Server (IMAP)** | `mail.yourdomain.com` *(or Server IP)* |
| **IMAP Port (SSL/TLS)** | `993` *(Recommended)* |
| **IMAP Port (STARTTLS/Plain)** | `143` |
| **Username** | `user@yourdomain.com` |
| **Password** | Account password in PostgreSQL `mailbox_users` table |
| **Security** | SSL / TLS |

---

## 🧪 Testing IMAP Connection

```bash
# Test plain IMAP on port 143
bun backend/imap-setup/test-imap.js 127.0.0.1 143 user@domain.com password

# Test SSL IMAP on port 993
bun backend/imap-setup/test-imap.js mail.yourdomain.com 993 user@domain.com password
```
