# 📬 Complete Dovecot IMAP Setup & Operation Guide (PostgreSQL Edition)

Yeh guide aapke **Linux VPS (Production)** par **PostgreSQL Database** ke sath **Dovecot IMAP Server (Ports 993 & 143)** setup karne aur chalane ka mukammal, step-by-step tareeqa faraham karti hai.

---

## 📑 Table of Contents (Fehrist)
1. [Architecture Overview (PostgreSQL + IMAP Flow)](#1-architecture-overview)
2. [Method 1: 1-Click Automated Setup (Fastest & Recommended)](#2-method-1-1-click-automated-setup)
3. [Method 2: Manual Step-by-Step VPS Configuration](#3-method-2-manual-step-by-step-vps-configuration)
4. [PostgreSQL Table & Query Details](#4-postgresql-table--query-details)
5. [SSL / TLS Certificate Setup (Port 993 Security)](#5-ssl--tls-certificate-setup)
6. [Client Connection Details (Client Ko Kya Dena Hai)](#6-client-connection-details)
7. [Testing & Verification (Test Kaise Karein)](#7-testing--verification)
8. [Useful Management Commands (Service Control & Logs)](#8-useful-management-commands)

---

## 1. Architecture Overview

Hamara email server SMTP se emails receive karta hai aur direct **PostgreSQL** table (`mailbox_users`) se authenticate karwata hai:

```
[ Sender Email ]
       │
       ▼ (SMTP Port 25)
[ Bun / Node Server (receive-mail.js) ]
       │
       ├──► 1. User & Mail Records ──► [ PostgreSQL Database ]
       └──► 2. Save Raw .eml        ──► [ Maildir Storage (/backend/storage/maildir/) ]
                                              │
                                              ▼
                                 [ Dovecot IMAP Server ] ◄── (Auth via PostgreSQL)
                                              │
                                              ▼ (Port 993 SSL / 143 Plain)
                                 [ Client: Outlook / Thunderbird / Mobile / Scripts ]
```

* **Zero Duplication:** Har email hard disk par sirf 1 martaba `.eml` format me save hoti hai.
* **Direct PostgreSQL Auth:** Dovecot native `dovecot-pgsql` driver se PostgreSQL se query karta hai.

---

## 2. Method 1: 1-Click Automated Setup

VPS par root/sudo user se ye command run karein:

```bash
# Agar PostgreSQL default (localhost / postgres user) hai:
sudo bash backend/imap-setup/setup-dovecot.sh
```

### Agar Custom PostgreSQL Credentials Hain:
Aap environment variables pass kar sakte hain:
```bash
sudo PGDATABASE=email_server PGUSER=postgres PGPASSWORD=your_password bash backend/imap-setup/setup-dovecot.sh
```

### Script Kya Karti Hai:
1. `dovecot-imapd` aur `dovecot-pgsql` install karti hai.
2. `backend/storage/maildir` folder permissions set karti hai.
3. `/etc/dovecot/dovecot.conf` generate karti hai.
4. `/etc/dovecot/dovecot-sql.conf.ext` me PostgreSQL queries set karti hai.
5. UFW Firewall me Ports `143` aur `993` open karti hai.
6. Dovecot service restart aur auto-start enable karti hai.

---

## 3. Method 2: Manual Step-by-Step VPS Configuration

Agar aap VPS par manually setup karna chahte hain:

### Step 3.1: Packages Install Karein
```bash
sudo apt update
sudo apt install dovecot-imapd dovecot-pgsql -y
```

### Step 3.2: Maildir Storage Permissions Set Karein
```bash
sudo mkdir -p /var/www/email-server-for-vps/backend/storage/maildir
sudo chmod -R 777 /var/www/email-server-for-vps/backend/storage/maildir
```

### Step 3.3: Main Config File (`/etc/dovecot/dovecot.conf`)
File banayein / edit karein: `sudo nano /etc/dovecot/dovecot.conf`

```ini
protocols = imap
listen = *, ::
base_dir = /var/run/dovecot/
auth_mechanisms = plain login
disable_plaintext_auth = no
auth_verbose = yes

# Maildir storage path mapping
mail_location = maildir:/var/www/email-server-for-vps/backend/storage/maildir/%d/%n:LAYOUT=fs:DIRNAME=.

namespace inbox {
  inbox = yes
  separator = /
}

# IMAP Ports
service imap-login {
  inet_listener imap {
    port = 143
  }
  inet_listener imaps {
    port = 993
    ssl = yes
  }
}

# PostgreSQL Authentication
passdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}

userdb {
  driver = sql
  args = /etc/dovecot/dovecot-sql.conf.ext
}
```

### Step 3.4: PostgreSQL Auth Config (`/etc/dovecot/dovecot-sql.conf.ext`)
`sudo nano /etc/dovecot/dovecot-sql.conf.ext`:

```ini
driver = pgsql
connect = host=127.0.0.1 port=5432 dbname=email_server user=postgres password=YOUR_PG_PASSWORD
default_pass_scheme = PLAIN

# Password Check Query
password_query = \
  SELECT email AS user, \
         COALESCE(plain_password, password_hash) AS password \
  FROM mailbox_users \
  WHERE LOWER(email) = LOWER('%u')

# User Mailbox Directory Query
user_query = \
  SELECT 5000 AS uid, \
         5000 AS gid, \
         '/var/www/email-server-for-vps/backend/storage/maildir/%d/%n' AS home, \
         'maildir:/var/www/email-server-for-vps/backend/storage/maildir/%d/%n:LAYOUT=fs:DIRNAME=.' AS mail \
  FROM mailbox_users \
  WHERE LOWER(email) = LOWER('%u')

iterate_query = SELECT email AS user FROM mailbox_users
```

Permission secure karein:
```bash
sudo chmod 600 /etc/dovecot/dovecot-sql.conf.ext
```

---

## 4. PostgreSQL Table & Query Details

Dovecot direct aapke PostgreSQL database ke `mailbox_users` table se login check karta hai:

```sql
-- PostgreSQL Table Schema
CREATE TABLE IF NOT EXISTS mailbox_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    plain_password VARCHAR(255),
    project_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. SSL / TLS Certificate Setup (Port 993 Security)

Production VPS par client ko encrypted IMAP (Port 993) dene ke liye Let's Encrypt SSL bind karein:

1. SSL Generate Karein:
   ```bash
   sudo certbot certonly --standalone -d mail.aapkidomain.com
   ```

2. `/etc/dovecot/dovecot.conf` me SSL lines add karein:
   ```ini
   ssl = yes
   ssl_cert = </etc/letsencrypt/live/mail.aapkidomain.com/fullchain.pem
   ssl_key = </etc/letsencrypt/live/mail.aapkidomain.com/privkey.pem
   ssl_min_protocol = TLSv1.2
   ```

3. Restart:
   ```bash
   sudo systemctl restart dovecot
   ```

---

## 6. Client Connection Details

Client ko dene ke liye IMAP connection details:

| Parameter | Value |
| :--- | :--- |
| **Incoming Server (IMAP)** | `mail.aapkidomain.com` *(ya VPS IP)* |
| **IMAP Port (SSL/TLS)** | **`993`** *(Recommended)* |
| **IMAP Port (STARTTLS/Plain)** | **`143`** |
| **Username** | `client@aapkidomain.com` |
| **Password** | Account Password (jo PostgreSQL me save hai) |
| **Security** | SSL / TLS |

> **Admin Panel:** Admin Panel ke **Mailbox Tab** me har account ke samne **"IMAP Details"** par click karke ye details 1-click me copy ki ja sakti hain.

---

## 7. Testing & Verification

### Tareeqa 1: Built-in IMAP Tester
```bash
# Local Port 143 test
bun backend/imap-setup/test-imap.js 127.0.0.1 143 user@domain.com password

# Production Port 993 SSL test
bun backend/imap-setup/test-imap.js mail.domain.com 993 user@domain.com password
```

### Tareeqa 2: Dovecot CLI Authentication Check
```bash
sudo doveadm auth test user@domain.com password
```
*Output: `passdb: user@domain.com auth succeeded`*

---

## 8. Useful Management Commands

```bash
# Dovecot Status check karna
sudo systemctl status dovecot

# Dovecot Restart karna
sudo systemctl restart dovecot

# Live Logs dekhna
sudo journalctl -u dovecot -f

# Verify Ports 143 & 993 are listening
sudo ss -tulpn | grep -E '143|993'
```
