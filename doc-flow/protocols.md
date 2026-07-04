# Email Server Protocols & DNS Records Guide

Yeh document is email server ko chalane ke liye zaroori tamam Protocols aur DNS Records ki tafseel faraham karta hai. Isme shuru mein ek Quick Setup (Shortcut) diya gaya hai aur neechay har record ki wazahat, pros, aur cons bayan kiye gaye hain.

---

## ⚡ Quick Reference (Shortcut)
Agar aap naya server ya domain setup kar rahe hain, toh apne DNS Provider (e.g. DigitalOcean, GoDaddy, Cloudflare) mein yeh records add karein:

| Type | Name / Host | Value / Target | Purpose |
|------|-------------|----------------|---------|
| **A** | `@` | `64.227.137.95` (Your VPS IP) | Domain ko VPS se jorta hai. |
| **A** | `mail` | `64.227.137.95` (Your VPS IP) | Mail server subdomain banata hai. |
| **MX** | `@` | `mail.llamerada.online` (Priority: 10) | Bata hai ke emails kahan receive hongi. |
| **TXT** | `@` | `v=spf1 a mx ip4:64.227.137.95 ~all` | **SPF**: Fake emails block karta hai. |
| **TXT** | `_dmarc` | `v=DMARC1; p=none;` | **DMARC**: Spam handling policy. |
| **TXT** | `default._domainkey` | `v=DKIM1; k=rsa; p=MIIB... (Public Key)` | **DKIM**: Email ko digitally sign karta hai. |

---

## 📖 Detailed Explanation (Wazahat)

Neechay har Protocol aur Record ki tafseel, wajah, aur pros/cons diye gaye hain.

### 1. SMTP (Simple Mail Transfer Protocol)
* **Kya hai?** Yeh internet par email bhejne aur receive karne ka bunyadi protocol (zabaan) hai. Yeh **Port 25** par kaam karta hai.
* **Kyun Zaroori hai?** Duniya ka har email server (Gmail, Yahoo) aapas mein baat karne ke liye SMTP use karta hai. Iske baghair email bhejna ya receive karna namumkin hai.
* **Pros:** Standard protocol hai, har jagah support hota hai.
* **Cons:** Purana protocol hai isliye default taur par encryption (security) nahi hoti, isay secure karne ke liye SSL/TLS lagana parta hai.

### 2. A Record (`@` aur `mail`)
* **Kya hai?** "Address" record. Yeh aapki domain naam (`llamerada.online`) ko aapke VPS ke IP address (`64.227.137.95`) ke sath jorta (link) karta hai.
* **Kyun Zaroori hai?** Jab koi browser mein aapki domain likhta hai, toh A record batata hai ke usay kis IP par jana hai. Humne `mail` ka A record bhi banaya taake `mail.llamerada.online` hamare VPS par point kare.
* **Kaise Implement Karein?** DNS panel mein ja kar `A` select karein, Name mein `@` ya `mail` likhein aur Value mein VPS ka IP dalein.
* **Pros:** Asaan aur fast.
* **Cons:** Agar VPS ka IP change ho jaye, toh record manually update karna parta hai.

### 3. MX Record (Mail Exchanger)
* **Kya hai?** Yeh record baqi dunya (jaise Google/Yahoo) ko batata hai ke is domain ki emails kis server par bheji jayengi.
* **Kyun Zaroori hai?** Agar MX record na ho, toh kisi ko nahi pata chalega ke aapki aane wali emails kahan bhejni hain, aur emails raste mein hi drop ho jayengi.
* **Kaise Implement Karein?** DNS mein Type `MX`, Name `@`, Value `mail.llamerada.online`, aur Priority `10` set karein.
* **Pros:** Email routing ko handle karta hai. Aap ek domain par multiple MX records laga kar backup servers bhi bana sakte hain.
* **Cons:** Sirf domains ko point kar sakta hai, direct IP address ko nahi.

### 4. SPF (Sender Policy Framework)
* **Kya hai?** Yeh ek TXT record hai jiski value `v=spf1...` hoti hai. Yeh un IP addresses ki ek list hai jinhein aapki domain se email bhejne ki ijazat hai.
* **Kyun Zaroori hai?** Spam se bachne ke liye. Agar koi hacker kisi aur IP se aapki domain ka naam use kar ke email bhejega, toh SPF fail ho jayega aur Gmail usay block kar dega.
* **Kaise Generate / Implement Karein?** Isay khud likha jata hai: `v=spf1 a mx ip4:<vps-ip> ~all`. DNS mein Type `TXT`, Name `@` mein save karein.
* **Pros:** Email spoofing (dhoka dahi) se bachata hai. Inbox delivery barhata hai.
* **Cons:** Agar aap kisi naye server se email bhejna shuru karein aur SPF mein IP update na karein, toh aapki apni emails bhi block ho jayengi.

### 5. DMARC (Domain-based Message Authentication)
* **Kya hai?** Yeh receiving server ko batata hai ke agar koi email SPF ya DKIM test fail kar de toh us email ka kya karna hai (Accept, Spam, ya Reject).
* **Kyun Zaroori hai?** Gmail ab DMARC ke baghair custom domains se aane wali emails ko qabool nahi karta. Yeh security ki akhri layer hai.
* **Kaise Implement Karein?** Type `TXT`, Name `_dmarc`, Value `v=DMARC1; p=none;`.
* **Pros:** Aapko control deta hai ke fake emails ke sath kaisa salook kiya jaye. Aap reports bhi receive kar sakte hain.
* **Cons:** Ghalat policy (`p=reject`) lagane se aapki sahi emails bhi permanently delete ya reject ho sakti hain agar SPF/DKIM theek se set na hon.

### 6. DKIM (DomainKeys Identified Mail)
* **Kya hai?** Yeh ek digital signature hai. Har outgoing email ko ek khufiya chabi (Private Key) se lock kiya jata hai, aur public chabi (Public Key) ko DNS mein TXT record ke taur par rakha jata hai.
* **Kyun Zaroori hai?** Yeh sabit karta hai ke email waqayi aapke server se nikli hai aur raste mein kisi ne isay tabdeel (modify) nahi kiya. 
  > **🚨 Nayi Policy (2024 Updates):** Google aur Yahoo ne apne rules bohot strict kar diye hain. Ab agar aapki domain par sirf SPF laga ho, tab bhi email Spam mein ja sakti hai ya reject ho sakti hai. Inki nayi policies ke mutabiq, 100% Inbox delivery ke liye ab **DKIM lazmi (mandatory)** ho gaya hai.
* **Kaise Generate / Implement Karein?** Iske liye VPS par `crypto` (ya openssl) se keys generate karni parti hain. (Humne iske liye `generate-dkim.js` banaya hai).
  * Keys generate karne ke liye terminal mein yeh command chalayen: `npm run mail:generate-dkim`
  ```js
    npm run mail:generate-dkim
  ```
  * Generate hone ke baad, Public key ko DNS mein Type `TXT`, Name `default._domainkey` aur Value `v=DKIM1; k=rsa; p=<public-key>` rakh kar save kiya jata hai.
* **Pros:** Sab se strong email security. Sender reputation bohot achi ho jati hai.
* **Cons:** Implement karna thora mushkil hai. Agar private key leak ho jaye toh koi bhi aapki signature use kar sakta hai. Isay periodic (salana) change karna parta hai.

> **💡 Important Note For Multiple Domains:**
> Aapko har nayi domain ke liye nayi DKIM key generate karne ki zaroorat **nahi** hai. VPS ke andar majood ek hi "Private Key" hazaron domains ko sign kar sakti hai. Jab bhi koi nayi domain is server ke sath attach karni ho, toh bas yahi same DKIM TXT (Public Key) record us nayi domain ke DNS mein copy-paste kar dein. Hamara code automatically us domain ko sign kar dega!
> 
> **⚠️ WARNING (Dobara Generate Karne ka Nuqsan):**
> Agar aap `generate-dkim.js` ko dobara chalayenge toh purani Private Key delete ho jayegi. Is se purani Public Key kaam karna chor degi aur aapki emails fail hone lagengi (Spam mein jayengi). Jab tak intehai zaroori na ho, DKIM keys dobara generate na karein. Agar karein toh sab domains ke DNS records lazmi update karein!
