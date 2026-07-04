# VPS Server Setup & Deployment Guide

This document records the exact steps and commands used to set up the **TempEmail** SMTP and Web API server on a clean DigitalOcean Ubuntu Droplet (VPS).

---

## Phase 1: Logging into your VPS (Droplet) via SSH

Open the Terminal on your local machine (Mac) and connect to the VPS.

### 1. Connection (Incorrect Parked IP) — *Failed*
When trying to connect to Hostinger's default parked domain IP, the connection times out because Hostinger does not allow SSH root access on their parked domain servers.
```bash
# This will TIMEOUT because 162.159.140.98 is Hostinger's parking IP, not your VPS IP
ssh root@162.159.140.98
```

### 2. Connection (Correct VPS IP) — *Succeeded*
Log in using your actual DigitalOcean Droplet IP address (`64.227.137.95`) as the `root` user:
```bash
# Connect to your actual Droplet IP
ssh root@64.227.137.95
```
* **Host IP**: `64.227.137.95`
* **Username**: `root`
* **Password**: HasanAmeer386@gmail.com 
--> `[Put your VPS root password here]`
* **Fingerprint Warning**: The first time you connect, type `yes` to add the VPS IP to your machine's known hosts.
* **Password**: Enter the root password you created during the Droplet setup.

--- 

## Phase 2: Installing Bun on Ubuntu

Once logged in, you need to install Bun because it is extremely fast and space-efficient compared to Node.js/NPM.

```bash
# 1. Update the local package list to ensure you get the latest security updates
apt update

# 2. Install curl and unzip (required for Bun installation)
apt install -y curl unzip

# 3. Download and install Bun JavaScript runtime
curl -fsSL https://bun.sh/install | bash

# 4. Source your bash configuration to make bun command available immediately
source ~/.bashrc

# 5. Verify the installation by checking Bun version
bun --version
```

---

## Phase 3: Cloning code & Installing Project Dependencies

Clone the project repository from GitHub and prepare the package files.

```bash
# 1. Clone the project repository from GitHub to the VPS
git clone https://github.com/HassanAmeer/temp-email-vps.git

# 2. Navigate into the cloned repository folder (ZAROORI: Always enter the directory before running bun commands)
cd temp-email-vps

# 3. Install all packages and dependencies defined in package.json using Bun
bun install
```

---

## Phase 4: Setting up VPS Firewall (UFW)

Open the incoming network ports on the VPS firewall so that the browser can load the website and external SMTP servers can deliver emails.

```bash
# 1. Open HTTP Port 80 (Standard web traffic port)
sudo ufw allow 80/tcp

# 2. Open HTTP Port 8081 (Alternative web dashboard/API traffic port)
sudo ufw allow 8081/tcp

# 3. Open SMTP Port 25 (Universal standard mail server receipt port)
sudo ufw allow 25/tcp

# 4. Open SMTP Port 2525 (Alternative SMTP port used for local trapping & bypassing residential blocks)
sudo ufw allow 2525/tcp
```

---

## Phase 5: Building and Starting the Mail Platform

Build the Astro static assets and run the background server.

```bash
# 1. Compile the Astro frontend pages into static assets (saved inside /dist folder)
bun run build

# 2. Run the SMTP Server and Web Dashboard on default development ports (SMTP: 2525, Web: 8081)
bun run mail:start
```
*At this point, you can access the dashboard at: `http://64.227.137.95:8081/live`*

---

## Phase 6: Production Setup (Running on Standard Ports 80 & 25)

To make it fully ready to receive emails from public senders like Gmail, Outlook, or Yahoo, you must run the server on standard ports (Web: 80, SMTP: 25). Since the code automatically defaults to these ports in production (when `live` is not set to `false`), you can run it simply with:

```bash
# 1. Stop the current process by pressing Ctrl + C in the terminal

# 2. Run the start command as root to bind to ports 80 and 25
sudo bun run mail:start
```
*Now you can access the dashboard directly without port numbers: `http://64.227.137.95/live`*

---

## Phase 7: Persistent Execution (Keeping server alive with PM2)

If you log out of the SSH terminal, your script will stop running. To keep it active 24/7 in the background, configure PM2:

```bash
# 1. Install PM2 (Process Manager) globally on the system using Bun
bun install -g pm2

# 2. Start the mail receiver script in the background as root using Bun interpreter
sudo pm2 start backend/receive-mail/receive-mail.js --interpreter bun --name "temp-email"

# 3. Save the running process list so it automatically restarts if the VPS rebooted
pm2 save

# 4. Enable PM2 to start on system boot
pm2 startup
```
