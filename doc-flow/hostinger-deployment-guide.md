# Hostinger VPS Deployment Guide

Ye guide aapke naye Hostinger VPS (jaise `187.52.117.2`) par **TempMail** ko shuru se end tak setup karne ke liye hai. In steps ko tarteeb se follow karen.

## Step 1: Hostinger Firewall Ports Open Karna
Terminal me kaam shuru karne se pehle, apne Hostinger Dashboard me **Firewall / Security Groups** me jayen aur in **TCP** ports ko lazmi Allow / Inbound kar den:
- **Port 22** (SSH ke liye - Sab se pehle add karen)
- **Port 80 & 443** (Website ke liye)
- **Port 8080** (Frontend port)
- **Port 8081** (Backend port)
- **Port 2525** (SMTP Email port)

> [!IMPORTANT]
> Jab tak aap panel se ports on nahi karenge, aapki website bahar kisi ko show nahi hogi, bhale hi server ke andajr app bilkul theek chal rahi ho!

---

## Step 2: Server Setup & App Run (Ikathi Commands)

Aapne naye VPS par SSH login kar liya hai (`ssh root@187.52.117.2`). Ab aap neeche diye gaye box ki **saari commands ko ek sath copy karen** aur apne terminal me ja kar **paste** kar den aur Enter daba den. Ye khud ba khud sab kuch install kar ke app ko chala dega.

login is root@187.52.117.2
password is: Hasanameer386@gmail.com

```bash
# 1. Update aur zaroori tools install karna
apt-get update -y
apt-get install -y git curl unzip nodejs npm ufw

# 2. UFW Firewall rules server ke andar se bhi open karna
ufw allow 22
ufw allow 80
ufw allow 443
ufw allow 8080
ufw allow 8081
ufw allow 2525

# 3. Bun aur PM2 install karna
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
npm install -g pm2 serve

# 4. Folder banana aur Github se code lana
cd ~
rm -rf tempmail
git clone https://github.com/HassanAmeer/email-server-for-vps.git tempmail
cd tempmail

# 5. Environment Variables (.env) files banana
cat << 'EOF' > .env
live="false"
DOMAIN="llamerada.online"
ADMIN_PASSWORD="1234"
NEXT_PUBLIC_PROJECT_NAME="TempMail VPS"
NEXT_PUBLIC_CONTACT_US_EMAIL="admin@tempemail.vps"
NEXT_PUBLIC_SUPPORT_EMAIL="admin@tempemail.vps"
EOF
cp .env .env.local

# 6. Dependencies Install aur Build karna
bun install
bun run build

# 7. PM2 ke zariye Frontend aur Backend ko chalu karna
pm2 stop all || true
pm2 delete all || true
pm2 start bun --name "mail-backend" -- backend/receive-mail/receive-mail.js
pm2 start npx --name "mail-frontend" -- serve out -l 8080
pm2 save

echo "🎉 DEPLOYMENT COMPLETE! Aap apni app http://YOUR-VPS-IP:8080 par check kar sakte hain!"
```

---

## Step 3: Verify Karna

Jab commands mukammal chal jayen aur terminal wapis free ho jaye, to aap `pm2 list` likh kar check karen. Aapko do apps (`mail-backend` aur `mail-frontend`) **online** nazar aayengi. 

Uske baad apne browser me apnay naye server ki IP aur port likh kar website kholen:
`http://187.52.117.2:8080`
