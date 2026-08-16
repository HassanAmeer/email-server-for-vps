# Laravel Web App & VPS Email Server (IMAP Integration Guide)

Yeh document wazahat karta hai ke hamara **VPS Email Server** aur **Laravel Temporary Email Website** aapas mein **pure IMAP protocol** ke zariye kis tarah connect aur filter hoti hain. 

Isme dono hissay shamil hain:
1. **VPS Side:** SMTP receiver, Catch-All Maildir routing, aur Dovecot IMAP configuration.
2. **Laravel Side:** IMAP connection, `SEARCH TO` filteration, email viewing, aur deletion mechanism.

---

## 🏗️ Overall Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│ 1. External Sender (Gmail, Outlook, Yahoo, etc.)       │
└──────────────────────────┬─────────────────────────────┘
                           │ Sends email to: user789@micorna.biz
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. VPS SMTP Server (Port 25) - receive-mail.js         │
├────────────────────────────────────────────────────────┤
│ • Wasool karta hai raw RFC822 email buffer             │
│ • Original 'To: user789@micorna.biz' header preserve   │
│ • Save to Maildir: /maildir/micorna.biz/user789/new/   │
│ • Hardlink (0 bytes) to: /maildir/micorna.biz/admin/   │
└──────────────────────────┬─────────────────────────────┘
                           │ Maildir storage synced
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Dovecot IMAP Server (Port 993 / 143)                │
├────────────────────────────────────────────────────────┤
│ • Master Account: admin@micorna.biz                    │
│ • Maildir folder scan karta hai aur index banata hai   │
│ • IMAP Commands support: SEARCH TO, FETCH, EXPUNGE     │
└──────────────────────────▲─────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       │ IMAP Protocol Query:                  │
       │ UID SEARCH TO "user789@micorna.biz"   │
       │                                       │
┌──────┴───────────────────────────────────────┴─────────┐
│ 4. Laravel Application (app/Services/TrashMailService)  │
├────────────────────────────────────────────────────────┤
│ • Webklex\PHPIMAP ClientManager se connect hota hai    │
│ • Visitor ko random email deta hai                     │
│ • Dovecot se sirf us visitor ki emails filter karta hai│
│ • HTML body, sender, date aur attachments parse karta  │
└──────────────────────────┬─────────────────────────────┘
                           │ JSON Response
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. Visitor Browser (Frontend Inbox)                    │
│ Visitor ko sirf uski generated email ke msgs dikhte    │
└────────────────────────────────────────────────────────┘
```

---

# 🖥️ SECTION 1: VPS Side Setup & Implementation

VPS side ka maqsad yeh hai ke kisi bhi generated ya random email address par aane wali mail ko wasool kare aur usay master mailbox (`admin@micorna.biz`) mein available karwaye taake Dovecot IMAP usay search kar sake.

### 1. Inbound SMTP Receiver (`backend/receive-mail/receive-mail.js`)
VPS par hamara custom Node.js/Bun SMTP server Port 25 par listen karta hai.

#### Raw Maildir Storage & Zero-Byte Hardlink Logic:
```javascript
// backend/receive-mail/receive-mail.js
function saveToMaildir(rawBuffer, recipientEmail) {
  const cleanEmail = extractEmail(recipientEmail);
  const [user, domain] = cleanEmail.split("@");

  // 1. Specific User Maildir: <domain>/<user>/{tmp, new, cur}
  const userMaildir = path.join(maildirBase, domain, user);
  const userNewDir = path.join(userMaildir, "new");
  const fileName = `${Date.now()}.${process.pid}_${Math.random().toString(36).substr(2, 6)}.${domain}.eml`;
  
  // Save original raw .eml buffer
  fs.writeFileSync(path.join(userMaildir, "tmp", fileName), rawBuffer);
  fs.renameSync(path.join(userMaildir, "tmp", fileName), path.join(userNewDir, fileName));

  // 2. Hardlink to Primary Admin Maildir (Catch-All for IMAP)
  // Hardlink ki wajah se 0 duplicate disk space use hoti hai!
  const primaryPrefix = "admin";
  if (user.toLowerCase() !== primaryPrefix) {
    const adminNewDir = path.join(maildirBase, domain, primaryPrefix, "new");
    if (!fs.existsSync(adminNewDir)) fs.mkdirSync(adminNewDir, { recursive: true });

    const adminFilePath = path.join(adminNewDir, fileName);
    fs.linkSync(path.join(userNewDir, fileName), adminFilePath);
  }

  return path.join(userNewDir, fileName);
}
```

> **Ahem Nuqta (Key Detail):**
> Jab email save hoti hai, to uska raw header `To: user789@micorna.biz` bilkul original rehta hai. Jab `admin` ke inbox mein hardlink banayi jaati hai, to Dovecot IMAP ke liye yeh file `admin` ke inbox ka hissa ban jaati hai lekin iska `To:` header `user789@micorna.biz` hi rehta hai.

---

### 2. Dovecot IMAP Server Configuration
Dovecot IMAP protocol ke zariye Maildir ko serve karta hai.

* **IMAP Ports:**
  * `Port 143`: Standard IMAP (STARTTLS ya Plaintext)
  * `Port 993`: Secure IMAP over SSL/TLS
* **Maildir Location in Dovecot (`/etc/dovecot/conf.d/10-mail.conf`):**
  ```
  mail_location = maildir:/home/vpsmail/%d/%n:LAYOUT=fs
  ```
  *(Jahan `%d` = domain name e.g. `micorna.biz`, aur `%n` = username e.g. `admin`)*
* **Authentication (`/etc/dovecot/users`):**
  ```
  admin@micorna.biz:{PLAIN}YourStrongPassword::::/home/vpsmail/micorna.biz/admin::
  ```

---

### 3. DNS Records Requirement
1. **A Record:** `mail.micorna.biz` ➔ `VPS_IP` (e.g. `64.227.137.95`)
2. **MX Record:** `@` (micorna.biz) ➔ `mail.micorna.biz` (Priority: `10`)
3. **SPF (TXT Record):** `v=spf1 mx ip4:VPS_IP ~all`
4. **DKIM (TXT Record):** `mail._domainkey.micorna.biz` ➔ `v=DKIM1; k=rsa; p=PUBLIC_KEY`

---

# 🌐 SECTION 2: Laravel Web App Handling

Laravel project (`/opt/lampp/htdocs/laravel-web`) mein kisi external API ki zaroorat nahi parti; yeh **Webklex PHP-IMAP** package ke zariye direct Dovecot IMAP server se baat karta hai.

### 1. Database & Settings (`App\Models\Imap`)
Laravel ke database mein `imaps` table mein master connection save hota hai:

| Column | Value Example | Description |
| :--- | :--- | :--- |
| `tag` | `main` | Default connection identifier |
| `host` | `mail.micorna.biz` (ya `VPS_IP`) | VPS IMAP Hostname |
| `port` | `993` (SSL) ya `143` | IMAP Port |
| `username` | `admin@micorna.biz` | Master Mailbox Username |
| `password` | `YourMasterPassword` | Master Mailbox Password |
| `encryption` | `ssl` ya `tls` ya `false` | Security Type |
| `validate_certificates` | `0` ya `1` | SSL Verification flag |

---

### 2. IMAP Connection Setup (`app/Services/TrashMailService.php`)

Laravel backend `Webklex\PHPIMAP\ClientManager` ke zariye connection initialize karta hai:

```php
// app/Services/TrashMailService.php (Line 64)
public function connection($mask = false, $imap)
{
    $client = $this->clientManager->make([
        'protocol'      => 'imap',
        'host'          => $imap->host,
        'port'          => $imap->port,
        'encryption'    => $imap->encryption,
        'validate_cert' => (bool)$imap->validate_certificates,
        'username'      => $imap->username,
        'password'      => $imap->password,
        'authentication'=> null,
        'timeout'       => 60
    ]);

    $client->connect();

    if ($mask) {
        $client->setDefaultMessageMask(\Webklex\PHPIMAP\Support\Masks\MessageMask::class);
    }

    return $client;
}
```

---

### 3. Filteration & Search Logic (`TrashMailService::allMessages`)

Jab visitor website kholta hai, controller `/get_messages` endpoint call karta hai. Laravel backend yeh steps follow karta hai:

1. **Email Parse:**
   ```php
   $extractEmail = $this->extractEmail($email);
   // Returns: ['prefix' => 'user789', 'domain' => 'micorna.biz', 'tag' => 'main']
   ```
2. **Master IMAP Fetch:**
   ```php
   $imap = Imap::where('tag', 'main')->first();
   $client = $this->connection(true, $imap);
   $folder = $client->getFolderByName('INBOX');
   ```
3. **IMAP Search Query (`SEARCH TO`):**
   ```php
   // Line 261-263
   $messages = $time == 0
       ? $folder->query()->to($email)->get()
       : $folder->query()->to($email)->since(Carbon::now()->subDays($time)->format('d-M-Y'))->get();
   ```
   > **How it works:**
   > Laravel Dovecot ko standard IMAP command bhejta hai:
   > `a001 UID SEARCH TO "user789@micorna.biz"`
   > 
   > Dovecot `admin@micorna.biz` ke Maildir mein mojood tamam `.eml` files ke `To:` headers scan karta hai aur sirf wahi message IDs return karta hai jinka recipient `user789@micorna.biz` ho!

4. **Response Formatting (`formatResponse`):**
   * Message ka Unique ID (`$message->getAttributes()["uid"]`)
   * Subject (`$this->decodeSubject(...)`)
   * Sender Personal Name & Email (`from`, `from_email`)
   * Date & Time (`receivedAt`)
   * Body preview (`text_content`)
   * Attachments list

---

### 4. Single Email View (`TrashMailService::getMessage`)

Jab visitor kisi specific email par click karta hai (`/view/{hash_id}` ya `/msg/{hash_id}`):
```php
// app/Services/TrashMailService.php (Line 110)
public function getMessage($hash_id)
{
    $id = decode_hash(substr($hash_id, 0, 45), 'mail');
    $imap_id = substr($hash_id, 45);
    $imap = Imap::where('id', $imap_id)->first();

    $client = $this->connection(true, $imap);
    $folder = $client->getFolderByName('INBOX');
    
    // Fetch specific email by UID
    $message = $folder->query()->getMessageByUid($id);
    
    // Mark as Seen on IMAP server
    $message->setFlag('Seen');

    // Extract HTML / Plain Text & Attachments
    return $this->extractMessageData($message, $hash_id, ...);
}
```

---

### 5. Email Deletion (`TrashMailService::deleteMessage`)

Jab visitor delete button dabata hai (`/delete/message/{hash_id}`):
```php
// app/Services/TrashMailService.php (Line 418)
public function deleteMessage($hash_id)
{
    $id = decode_hash(substr($hash_id, 0, 45), 'mail');
    $imap_id = substr($hash_id, 45);
    $imap = Imap::where('id', $imap_id)->first();

    $client = $this->connection(false, $imap);
    $folder = $client->getFolderByName('INBOX');
    $message = $folder->query()->getMessageByUid($id);

    // Dovecot IMAP par EXPUNGE command chalata hai
    $message->delete($expunge = true);
    $client->disconnect();

    return true;
}
```
> **Result:** Dovecot Maildir file ko filesystem se physically remove kar deta hai.

---

# 📊 Comparison: Pure IMAP vs API Integration

| Feature | Pure IMAP Integration (Current) | Custom API Integration |
| :--- | :--- | :--- |
| **Industry Standard** | 100% RFC IMAP Protocol compliant (cPanel, Postfix, Dovecot standard). | Custom proprietary HTTP endpoints. |
| **Compatibility** | Har Laravel / WordPress / PHP script out-of-the-box support karta hai. | Script ke code mein custom modifications karni parti hain. |
| **Maildir Efficiency** | Zero-byte Hardlinking ke sath master inbox se instant search. | Webhook ya polling ke zariye DB record insertion. |
| **Client Support** | Webmail, Outlook, Thunderbird, Gmail sab IMAP ke sath chalte hain. | Sirf custom web dashboard chal sakta hai. |

---

# ✅ Summary Checklist

1. **VPS SMTP Port 25:** Aane wali emails ko Maildir format mein save karta hai aur `admin@domain` ko hardlink deta hai.
2. **Dovecot IMAP:** Port 143/993 par `admin@domain` ke mailbox ko serve karta hai.
3. **Laravel Web App:** Admin settings mein `host`, `port`, `username: admin@domain`, `password` save karta hai.
4. **IMAP Search:** Laravel `$folder->query()->to($visitor_email)->get()` chala kar exact recipient ki emails filter kar leta hai.
