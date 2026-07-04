# Ports Guide (Konsi Port Kis Kaam Aati Hai?)

Email server aur web applications ko sahi tarah se chalane ke liye mukhtalif **Ports** ka istemal hota hai. Yeh document is project mein use hone wali tamam ports ki tafseel (details) faraham karta hai taake developer ko asani se samajh aa sake ke konsi port kahan aur kyun use karni hai.

---

## 📧 Email (SMTP) Ports

### 1. Port 25 (Server-to-Server Communication)
* **Kahan use hoti hai?** Live VPS par.
* **Maqsad:** Yeh duniya ka standard email port hai. Jab Gmail ya Yahoo aapke server ko email bhejte hain (Inbound), toh wo **sirf Port 25** par hi aati hai. Isi tarah jab aapka VPS aagay kisi ko email bhejta hai (Outbound), toh wo bhi Port 25 use karta hai.
* **Authentication:** Is port par aam taur par password nahi manga jata, kyunke public servers ko ek doosre se baat karni hoti hai.
* **Limitations:** Bohat se local internet providers (PTCL, Nayatel) aur VPS providers (jaise DigitalOcean) spam rokne ke liye Port 25 ko outbound block kar dete hain.

### 2. Port 587 / 2525 (Client-to-Server / Message Submission)
* **Kahan use hoti hai?** Local Machine, Client App, ya 3rd Party Projects (e.g., Laravel, Node.js) se VPS tak connect karne ke liye.
* **Maqsad:** Agar aapne apni kisi external app se email bhejni ho, toh aap apne server se Port 587 ya 2525 par connect karte hain. Yeh port emails ko *submit* (hand-over) karne ke liye banayi gayi hai.
* **Authentication:** Is port par hamesha **Username aur Password** manga jata hai. (Jaise hamara `send-mail-by-smtp` server).
* **Fayeda (Benefit):** Is port ko local internet providers block nahi karte, isliye local machine se asani se email bheji ja sakti hai.

---

## 🌐 Web Application (UI) Ports

### 3. Port 80 / 8080 (Live Server Web UI)
* **Kahan use hoti hai?** Live VPS par (`npm run mail:start`).
* **Maqsad:** Jab aap is project ko VPS par live karte hain, toh iska Dashboard aur Web UI (jahan aap emails parhte hain) Port 80 par chalta hai. Agar Port 80 available na ho toh 8080 use ho sakti hai.
* **Access:** Browser mein direct `http://your-vps-ip/` ya `http://mail.llamerada.online/` likh kar isay access kiya jata hai.

### 4. Port 8081 (Local Development Web UI)
* **Kahan use hoti hai?** Local Machine (Mac/Windows) par (`npm run mail:local`).
* **Maqsad:** Jab aap VPS ke bajaye apne local computer par development kar rahe hote hain, toh UI Port 8081 par chalta hai taake live server (80) se koi takrao (conflict) na aaye.
* **Access:** Browser mein `http://localhost:8081/local` likh kar access kiya jata hai.

---

## 📋 Khulasa (Summary for Developers)

| Port | Environment | Purpose | Auth Required? |
|------|-------------|---------|----------------|
| **25** | Live VPS | Emails bahar se receive karna aur bahar bhejna. | ❌ No |
| **2525** | Local/Client App | Kisi project se hamare server ko email pass karna. | ✅ Yes |
| **80** | Live VPS | Live Dashboard (UI) dekhna. | - |
| **8081**| Local Machine| Local Development Dashboard (UI) dekhna. | - |
