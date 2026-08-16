# 📬 Complete Dovecot IMAP Setup & Operation Guide (SQLite Edition)

Yeh guide aapke **Linux VPS (Production)** par **SQLite Database** ke sath **Dovecot IMAP Server (Ports 993 & 143)** setup karne aur chalane ka mukammal tareeqa faraham karti hai.

---

## 📑 Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [1-Command Automated Installation](#2-1-command-automated-installation)
3. [Configuration Files Overview](#3-configuration-files-overview)
4. [Client Setup (Thunderbird, Outlook, Apple Mail)](#4-client-setup)

---

## 1. Architecture Overview

Hamara email server SMTP se emails receive karta hai aur direct **SQLite** table (`mailbox_users`) se authenticate karwata hai:

```
[ Incoming Email (SMTP :25) ] 
       │
       ▼
 [ receive-mail.js ]
       ├──► 1. Save record in SQLite (backend/storage/email_logs.sqlite)
       └──► 2. Save raw .eml to Maildir (backend/storage/maildir/<domain>/<user>/new/)
                                 ▲
                                 │ (Reads directly)
                       [ Dovecot IMAP Server ] ◄── (Auth via SQLite)
                                 ▲
                                 │
                   [ Email Client: Outlook / Thunderbird ]
```

* **Zero Duplication:** Ek hi email Maildir me save hoti hai, aur Web UI + Dovecot IMAP dono usi ko use karte hain.
* **Direct SQLite Auth:** Dovecot native `dovecot-sqlite` driver se SQLite file se query karta hai.

---

## 2. 1-Command Automated Installation

VPS par root user se run karein:

```bash
sudo bash backend/imap-setup/setup-dovecot.sh
```

Yeh script automatically:
1. `dovecot-imapd` aur `dovecot-sqlite` packages install karti hai.
2. `vmail` user/group (uid 5000) banati hai.
3. Maildir directory permissions (`chmod 777`) set karti hai.
4. `/etc/dovecot/dovecot.conf` aur `/etc/dovecot/dovecot-sql.conf.ext` SQLite ke liye configure karti hai.
5. UFW firewall me ports `143` aur `993` open karti hai.
6. Dovecot service restart aur enable karti hai.

---

## 3. Configuration Files Overview

### Dovecot SQL Config (`/etc/dovecot/dovecot-sql.conf.ext`)
```ini
driver = sqlite
connect = /root/tempmail/backend/storage/email_logs.sqlite
default_pass_scheme = PLAIN

password_query = \
  SELECT email AS user, \
         COALESCE(plain_password, password_hash) AS password \
  FROM mailbox_users \
  WHERE LOWER(email) = LOWER('%u')

user_query = \
  SELECT 5000 AS uid, \
         5000 AS gid, \
         '/root/tempmail/backend/storage/maildir/%d/%n' AS home, \
         'maildir:/root/tempmail/backend/storage/maildir/%d/%n:LAYOUT=fs:DIRNAME=.' AS mail \
  FROM mailbox_users \
  WHERE LOWER(email) = LOWER('%u')

iterate_query = SELECT email AS user FROM mailbox_users
```

---

## 4. Client Setup

| Setting | Value |
|---|---|
| **Protocol** | IMAP |
| **Server** | `mailserver10.com` ya VPS IP |
| **Port** | `143` (STARTTLS) ya `993` (SSL/TLS) |
| **Username** | Poora Email (e.g. `support@yourdomain.com`) |
| **Password** | Mailbox password (jo SQLite me save hai) |
