# Send Email Flow

Yeh document wazahat karta hai ke email send karne ke piche mukammal flow kya hai, iske liye kin cheezon ki zaroorat hoti hai, aur mukhtalif scenarios mein email kaise bheji jati hai. Taake naye developers ko samajhne mein asani ho.

## 1. Lazmi Sharaait (Prerequisites)
- **Port 25 (Outbound):** Email kisi doosre public server (jaise Gmail) par bhejne ke liye Port 25 ka open hona lazmi hai. *(Note: DigitalOcean by default Port 25 ko block rakhta hai, isliye unse open karwana parta hai ya phir kisi aur company ka VPS use karna parta hai).*
- **Packages:** 
  - `nodemailer`: Email bhejne ka asaan aur powerful package.
  - `dns`: MX records (mail server ka pata) dhoondne ke liye.
- **DNS Records:**
  - **SPF Record:** `v=spf1 a mx ip4:<vps-ip> ~all` (Bhejne wale ki pehchan / Spam se bachne ke liye)
  - **DMARC Record:** `v=DMARC1; p=none;` (Emails ko reject hone se bachane ke liye)

---

## 2. Mukhtalif Sending Scenarios (Flows)

### A. Local to Local
Local machine se usi local machine par mojud kisi custom domain par email bhejna. Isme internet ki zaroorat nahi hoti, bas Nodemailer direct local SMTP server se connect hota hai.

### B. Local to Live (Gmail/Yahoo)
Apne local computer se public domains par email bhejna. Aksar local internet providers (PTCL waghaira) Port 25 block nahi karte, isliye yeh asani se send ho jati hai (Lakin SPF/DMARC ki wajah se Spam mein ja sakti hai).

### C. Live to Live
VPS (Live Server) se Gmail ya Yahoo par bhejna. Iske liye VPS par **Port 25 ka khula hona 100% lazmi hai**, warna `Connection Timeout` error aayega. Agar Port 25 khula hai aur SPF/DMARC theek set hain, toh email seedha Inbox mein jayegi.

### D. Live to Local (Custom Generated)
VPS se apni hi kisi generated email par bhejna. Kyunke custom domain (llamerada.online) aapke apne hi VPS ko point kar rahi hai, isliye yeh connection VPS ke andar hi rehta hai aur DigitalOcean isay block nahi karta. Yeh theek kaam karta hai.

### E. Sending via IP (Baghair Domain Ke)
Agar aapke paas domain nahi hai, toh aap direct IP address use kar ke bhi email bhej sakte hain. Is flow mein hum DNS ki MX lookup ko bypass karte hain aur Nodemailer ke andar `host: '64.227.137.95'` (yani target IP) de kar direct us server se connect kar lete hain.
