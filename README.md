# Temp Email System (Custom Email Server)

Yeh ek custom email server application hai jo aapko apni custom domain (jaise `llamerada.online`) par emails bhejney aur wasool (receive) karne ki poori saholat deti hai. Yeh system **Local development** aur **Live VPS** dono environments mein theek tarah se kaam karne ke liye design kiya gaya hai.

## 🚀 Features (Khusoosiyat)

- **Send Emails:** Aap kisi bhi public email address (Gmail, Yahoo) ya custom domain par email bhej sakte hain.
- **Receive Emails:** Apni custom domain par aane wali tamam emails ko live receive aur read kar sakte hain.
- **4-Way Email Flow:**
  - `Local to Local`
  - `Local to Live`
  - `Live to Local`
  - `Live to Live`
- **Direct IP Sending/Receiving:** Baghair domain ke direct IP address (e.g. `user@[64.227.137.95]`) use kar ke bhi email send ya receive ki ja sakti hai.
- **Spam Prevention:** SPF aur DMARC records ke zariye emails ko spam mein jane se bachane ka mukammal intezam.

---

## 📸 Console Screenshots (Dashboard Preview)

Aap neechay diye gaye screenshots se is custom email dashboard aur console interface ka preview dekh sakte hain:

### 1. Main Home Dashboard
![Main Home Dashboard](./demo/1.png)

### 2. Local Console Dashboard
![Local Console Dashboard](./demo/2.png)

### 3. Inbound / Outbound SMTP Logs
![Inbound / Outbound SMTP Logs](./demo/3.png)

### 4. Outbound SMTP Credentials / Relay Logs
![Outbound SMTP Credentials / Relay Logs](./demo/4.png)

### 5. Email Rich Text / Raw JSON Viewer
![Email Rich Text / Raw JSON Viewer](./demo/5.png)

---

## 🏗️ Architecture Flow (Kaam Kaise Karta Hai?)

```mermaid
graph LR
    A[Laravel/Node App<br>Local ya Live] -- "Port 2525 (Auth)" --> B(Our VPS Server<br>send-mail-by-smtp module)
    B -- "Adds DKIM Signature" --> B
    B -- "Port 25 (Outbound)" --> C[Gmail / Yahoo Inbox]
    
    D[Gmail / Yahoo] -- "Port 25 (Inbound)" --> B
    B -- "Parses & Saves" --> E[(Local JSON Storage)]
```

---

## 📊 Current Port Usage (Kaunsi Port Kahan Use Hoti Hai?)

### 🔴 Live Environment (`live=true`)
| Service | Port | Description |
|---------|------|-------------|
| **Web Dashboard (UI)** | `80` (or `8080`) | Live browser interface chalane ke liye. |
| **Receive Email (Inbound)** | `25` | Gmail/Yahoo se standard emails receive karne ke liye. |
| **Send Email (Outbound)** | `25` | Hamare code se internet par emails bhejne ke liye. |
| **External App Relay (Auth)** | `2525` | `send-mail-by-smtp` server ke zariye 3rd party apps (Node/PHP) ko connect karne ke liye. |

### 🔵 Local Environment (`live=false`)
| Service | Port | Description |
|---------|------|-------------|
| **Web Dashboard (UI)** | `8081` | Local development interface (taake port 80 se conflict na ho). |
| **Receive Email (Inbound)** | `2525` | Local machines aam taur par port 25 block karti hain, isliye local par 2525 use hoti hai. |
| **Send Email (Outbound)** | `25` | Local testing ke doran bhi hamara code port 25 par hi send karne ki koshish karta hai. |
| **External App Relay (Auth)** | `2525` | `send-mail-by-smtp` server ke zariye external apps connect karne ke liye. |

---

## 📚 Documentation & Guides
Is project ke har hisse ko tafseel se samajhne ke liye alag alag guides banayi gayi hain taake naye developers ko asani ho. Aap neechay diye gaye links par click kar ke unhe parh sakte hain:

1. 📖 **[VPS Setup Guide](./doc-flow/vps-setup.md)**
   - Naye VPS par Node.js, PM2 install karne aur is project ko live karne ka poora tariqa.
2. 🛡️ **[Spam Prevention Guide](./doc-flow/spam-prevention-guide.md)**
   - Emails ko reject ya spam hone se bachane ke liye SPF aur DMARC records lagane ka tariqa.
3. 📤 **[Send Email Flow](./doc-flow/send-mail-flow.md)**
   - Email bhejne ka mukammal flow, zaroori packages, port requirements, aur mukhtalif scenarios.
4. 📥 **[Receive Email Flow](./doc-flow/receive-mail-flow.md)**
   - Email receive karne ka flow, DNS (A aur MX) records, aur zaroori packages ki tafseel.
5. 🌐 **[Protocols & DNS Records Guide](./doc-flow/protocols.md)**
   - Tamam zaroori protocols (A, MX, TXT, SPF, DMARC, DKIM, SMTP) ki mukammal tafseel aur unhe implement karne ka tariqa.
6. 🔌 **[Outbound SMTP Server Guide (send-mail-by-smtp)](./doc-flow/send-mail-by-smtp-flow.md)**
   - Kisi bhi naye project (e.g., PHP, Node.js) mein is mail server ko attach karne ka tariqa, credentials, aur Port 2525 connection flow.
7. 🚪 **[Ports Guide](./doc-flow/ports.md)**
   - Kaunsi port (25, 2525, 80, 8081) kis maqsad ke liye (Live VPS, Local Machine, Client App) istemal hoti hai, uski mukammal tafseel.

---

## 📊 Flow Diagrams (System Kaise Kaam Karta Hai)

Neechay diye gaye diagrams mein Email Send aur Receive karne ke tamam flows wazeh kiye gaye hain.

### 📤 1. Email Sending Flow Diagram
```mermaid
graph TD
    subgraph "Email Send Flow"
        LocalApp("Local Machine (CLI / Local UI)")
        LiveApp("Live VPS (Live UI)")
        
        LocalApp -- "1. Local to Local" --> LocalMailServer("Local SMTP Server")
        LocalApp -- "2. Local to Live" --> ExternalServer("Gmail / Yahoo Server")
        
        LiveApp -- "3. Live to Local (Custom Domain)" --> VPSMailServer("VPS SMTP Server")
        LiveApp -- "4. Live to Live" --> ExternalServer
    end
```

### 📥 2. Email Receiving Flow Diagram
```mermaid
graph TD
    subgraph "Email Receive Flow"
        LocalScript("Local Machine Script")
        VPSScript("VPS Live Script")
        ExternalUser("External User (Gmail/Yahoo)")
        
        LocalScript -- "1. Local to Local" --> LocalSMTPServer("Local Custom Server")
        VPSScript -- "2. Live to Local" --> LocalSMTPServer
        
        LocalScript -- "3. Local to Live" --> VPSSMTPServer("Live VPS Custom Server")
        ExternalUser -- "4. Live to Live" --> VPSSMTPServer
    end
```

---

## 🛠️ Quick Start (Run Kaise Karein?)

Agar aap is project ko apne paas run karna chahte hain toh yeh commands chalayen:

```bash
# 1. Packages install karein
bun install

# 2. Frontend Astro app ko build karein
bun run build

# 3. Email Server aur Backend API start karein
bun run mail:start
```






















