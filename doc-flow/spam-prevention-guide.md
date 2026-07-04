# Email Spam Prevention Guide

### Quick Setup (Spam se bachne ka tariqa)
Apne DNS provider mein yeh 2 naye **TXT Records** lazmi add karein:

**1. SPF Record:**
* **Type:** `TXT`
* **Name:** `@` 
* **Value:** `v=spf1 a mx ip4:64.227.137.95 ~all`

**2. DMARC Record:**
* **Type:** `TXT`
* **Name:** `_dmarc`
* **Value:** `v=DMARC1; p=none;`

**3. DKIM Record (100% Inbox ke liye sab se lazmi):**
* **Type:** `TXT`
* **Name:** `default._domainkey`
* **Value:** `v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArLCOwggt227i+gqvmtJFi0EVzq5w9VjWBnicvM4yEuSJYlY7LiPMwy3XeYaUw6bwdBILSlvUU8JFW04Ig2wq+EQe+zZsIjVWRkRZLl1mbFBvrGL9D63BRRrDfIq7BP/T5v+t0jCHDtx8Csv6FF17zY97fcB/PPs3ve4IaJcWoVNFBfnYT5UNAwY3gXPjxyJ8Yohbms1bD/wP+gQnI78Lx71m0Y8bApucYjYotfYC81UOMRw6ZDp6WQyM0V9h2A4hPfTei5ukZGnup9Ld3DNAzeyh0kulonHRn7lN0mVH2JSWLBYTffOMZlk3XZe8xdVKNcvIqDQIO0KisYfRQmVXgQIDAQAB`

*(Note: Inhe save karne ke baad update hone mein 10 se 15 minute lag sakte hain. Uske baad test karein!)*

---
---

### Detailed Explanation (Wazahat)

Agar aap in records ki details samajhna chahte hain:

**1. SPF (Sender Policy Framework)**
SPF ek aisi list hai jisme un IP addresses ke naam hote hain jinhein aapki domain se email bhejne ki ijazat hoti hai. Agar IP is list mein na ho toh email Spam mein chali jati hai ya block ho jati hai.

**2. DMARC (Domain-based Message Authentication, Reporting, and Conformance)**
DMARC receiving server (jaise Gmail) ko batata hai ke agar koi email SPF test fail kar de toh us email ke sath kya karna hai. `p=none` ka matlab hai ke abhi block na karo, jabke `p=reject` ka matlab hai ke block kar do.

**3. DKIM (DomainKeys Identified Mail)**
DKIM ek digital signature hai jo aapke server se nikalne wali har email ke sath attach hoti hai. Yeh signature aapke DNS mein majood public key se match ki jati hai. Agar dono match kar jayen toh Google ko yaqeen ho jata hai ke email dar-asal aap hi ne bheji hai aur raste mein kisi hacker ne tabdeel nahi ki. Isse 100% inbox delivery milti hai.
