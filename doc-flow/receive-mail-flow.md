# Receive Email Flow

Yeh document wazahat karta hai ke custom email server par aane wali emails kaise wasool (receive) hoti hain, kin packages ki zaroorat hoti hai, aur mukhtalif tareeqon se email receive karne ka flow kya hai.

## 1. Lazmi Sharaait (Prerequisites)
- **Port 25 (Inbound):** Emails receive karne ke liye VPS par Port 25 ka inbound (aane wala) rasta khula hona lazmi hai. *(Aam taur par har VPS mein incoming Port 25 by default open hota hai, is par DigitalOcean pabandi nahi lagata).*
- **Packages:** 
  - `smtp-server`: Yeh package hamara apna custom email server banata hai jo Port 25 par baith kar aane wali emails ko pakarta hai.
  - `mailparser`: Aane wali email ajeeb o ghareeb buffers aur characters mein hoti hai, yeh package usay parhne ke kabil (readable) text ya HTML mein tabdeel karta hai.
- **DNS Records:**
  - **A Record:** `mail` -> `64.227.137.95` (Subdomain ko server IP se jorna)
  - **MX Record:** `@` -> `mail.llamerada.online` (Priority 10). Yeh record poori duniya ke email servers (jaise Gmail) ko batata hai ke "Agar is domain ki koi email aaye, toh usay is server par bhej dena".

---

## 2. Mukhtalif Receiving Scenarios (Flows)

### A. Local to Local
Aapka local sender script aapke local machine par chalne wale `smtp-server` ko email bhejta hai. Yeh development aur testing ke liye best hai. Yeh without internet bhi kaam kar sakta hai agar loopback IP (127.0.0.1) use kiya jaye.

### B. Live to Local / Local to Live
Live server par email aana aur usay local dashboard par fetch karke dekhna. Hamari application API ke zariye live server se emails laati hai aur UI par dikhati hai. 

### C. Live to Live
Kisi bahar ke network (jaise Gmail) se hamare VPS par email aana. Jab koi Gmail se `abc@llamerada.online` par bhejta hai, toh Gmail hamara MX record dekhta hai aur email hamare VPS ke `smtp-server` par bhej deta hai.

### D. Receive via IP (Baghair Domain Ke)
Agar koi domain DNS se connected nahi hai, toh bhejane wala sidha hamare VPS ke IP address par bhi email bhej sakta hai. 
- Misaal ke taur par: `to: "admin@[64.227.137.95]"`
- Hamara `smtp-server` is IP wali email ko bilkul wese hi aam email ki tarah receive karta hai aur parh kar console mein dikha deta hai. Iske liye kisi qisam ke DNS (A ya MX) record ki zaroorat nahi parti.
