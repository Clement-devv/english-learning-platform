# Going Live — Step-by-Step Guide
# clemify.com

This guide takes you from where you are right now (code on your laptop) to a live
production website at clemify.com. Follow every step in order.

---

## What you will end up with

```
User visits clemify.com  →  Caddy (HTTPS)  →  Your Node.js app  →  MongoDB
User visits school1.clemify.com  →  same app, different school data
User visits school1.com (custom domain)  →  also works automatically
```

Everything runs in Docker on one VPS. You redeploy by pushing to `main` and running
a few commands on the server.

---

## What you need before starting

- [x] Domain name: **clemify.com** (already bought)
- [x] Code pushed to a GitHub repository
- [ ] A VPS server (see Step 1)
- [ ] A MongoDB database (see Step 3)
- [ ] About 2–3 hours of your time

---

## STEP 1 — Buy a VPS Server

You need a server that runs 24/7. **DigitalOcean** is the easiest option.

### 1.1 Create a DigitalOcean account
Go to: https://digitalocean.com
Sign up → verify email → add a payment method (card or PayPal).

### 1.2 Create a Droplet (their word for a server)
1. Click **Create → Droplets**
2. Choose **Ubuntu 22.04 LTS** (x64)
3. Choose plan: **Basic → Regular → $12/month** (2 GB RAM, 1 CPU, 50 GB SSD)
   - This is enough to start. You can upgrade later.
4. Choose a region: **pick the one closest to your students** (e.g., London, Singapore, New York)
5. Authentication: choose **SSH Key** (more secure than password)
6. Hostname: `clemify-production`
7. Click **Create Droplet**

**Write down your server's IP address** — you'll see it in the DigitalOcean dashboard.
It looks like: `157.230.123.45`

---

## STEP 2 — Point Your Domain to the Server

Go to wherever you bought clemify.com (Namecheap, GoDaddy, Cloudflare, etc.)
and add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `YOUR_SERVER_IP` | 3600 |
| A | `www` | `YOUR_SERVER_IP` | 3600 |
| A | `*` | `YOUR_SERVER_IP` | 3600 |

The `*` (wildcard) record is what makes `school1.clemify.com`, `school2.clemify.com`
etc. all point to your server automatically.

> DNS changes can take 10 minutes to 24 hours to propagate worldwide.
> You can check if it's working at: https://dnschecker.org

---

## STEP 3 — Set Up MongoDB

Your app needs a database. Use **MongoDB Atlas** (free to start, no server needed).

### 3.1 Create a free Atlas account
Go to: https://cloud.mongodb.com
Sign up → choose the **FREE M0** cluster → pick the same region as your VPS.

### 3.2 Create a database user
1. Left sidebar → **Database Access**
2. Click **Add New Database User**
3. Username: `clemify-app`
4. Password: generate a strong one — **save it somewhere safe**
5. Role: **Atlas admin** → Add User

### 3.3 Allow your server's IP
1. Left sidebar → **Network Access**
2. Click **Add IP Address**
3. Enter your server's IP address (from Step 1)
4. Also add `0.0.0.0/0` temporarily while setting up (remove later for security)

### 3.4 Get your connection string
1. Left sidebar → **Database → Connect**
2. Choose **Connect your application**
3. Driver: Node.js → copy the string

It looks like:
```
mongodb+srv://clemify-app:YOUR_PASSWORD@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
```

You will need **three** connection strings (all the same cluster, different database names):
```
MONGO_URI     = ...mongodb.net/master?retryWrites=true&w=majority
MASTER_DB_URI = ...mongodb.net/master?retryWrites=true&w=majority
DB_BASE_URI   = ...mongodb.net  (no database name at the end)
```

---

## STEP 4 — Set Up the Server

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Run these commands one by one:

### 4.1 Update the server
```bash
apt update && apt upgrade -y
```

### 4.2 Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 4.3 Install Docker Compose (plugin)
```bash
apt install -y docker-compose-plugin
docker compose version   # should print: Docker Compose version v2.x.x
```

### 4.4 Clone your repository on the server
```bash
mkdir -p /opt/elp
cd /opt/elp
git clone https://github.com/YOUR_GITHUB_USERNAME/english-learning-platform.git .
```

### 4.5 Create upload and log directories
```bash
mkdir -p server/uploads server/logs
```

---

## STEP 5 — Create the Production Environment File

Still on your server, create the production config file:

```bash
nano /opt/elp/server/.env
```

Paste this entire block, filling in every `#####` value:

```env
NODE_ENV=production
PORT=5000
TRUST_PROXY=true

# ── Database (from Step 3) ────────────────────────────────────────────────────
MONGO_URI=#####
MASTER_DB_URI=#####
DB_BASE_URI=#####

# ── Security — generate each one (commands below) ────────────────────────────
JWT_SECRET=#####
SESSION_SECRET=#####
ENCRYPTION_KEY=#####

# ── Domain ───────────────────────────────────────────────────────────────────
FRONTEND_URL=https://clemify.com
PLATFORM_DOMAIN=clemify.com
CORS_ORIGINS=https://clemify.com,https://www.clemify.com
SERVER_IP=#####

# ── Email (Gmail app password — NOT your real password) ───────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=#####
EMAIL_PASSWORD=#####

# ── Redis (Docker internal — do not change) ───────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Agora (video calls) ───────────────────────────────────────────────────────
AGORA_APP_ID=#####
AGORA_APP_CERTIFICATE=#####

# ── Web Push ──────────────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=#####
VAPID_PRIVATE_KEY=#####
VAPID_EMAIL=mailto:#####

# ── AI ────────────────────────────────────────────────────────────────────────
GEMINI_API_KEY=#####
ANTHROPIC_API_KEY=#####

# ── Super Admin ───────────────────────────────────────────────────────────────
SUPER_ADMIN_EMAIL=#####

BCRYPT_ROUNDS=12
```

**Generate the security secrets** — run each command and paste the output:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (must be exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID keys
npx web-push generate-vapid-keys
```

Save the file: press `Ctrl+X`, then `Y`, then `Enter`.

> **Important:** This file contains passwords. Never commit it to GitHub.
> The `.gitignore` already excludes `.env` from being committed.

---

## STEP 6 — First Deploy

```bash
cd /opt/elp
docker compose up -d --build

# Watch the startup logs
docker compose logs -f app
```

You should see the server start up and connect to MongoDB.

---

## STEP 7 — Verify It's Live

Check all services are running:
```bash
docker compose ps
```

You should see 3 containers all with status `Up` or `healthy`:
- `elp-app` — your Node.js server
- `elp-redis` — Redis cache
- `elp-caddy` — the web server / HTTPS handler

Check the app is responding:
```bash
curl http://localhost:5000/api/health/ready
```

Check HTTPS is working (wait a few minutes for Caddy to get the SSL certificate):
```bash
curl https://clemify.com/api/health/ready
```

Open your browser and visit **https://clemify.com** — your app should be live.

---

## STEP 8 — Every Future Deploy

From now on, deploying is:

```bash
# On your local machine
git add .
git commit -m "describe your change"
git push origin main

# On the server
cd /opt/elp
git pull origin main
docker compose up -d --force-recreate --build app
```

---

## Common Problems & Fixes

### "Site can't be reached" after going live
- Check DNS has propagated: https://dnschecker.org → type `clemify.com`
- Check Caddy logs: `docker compose logs caddy`
- Check app logs: `docker compose logs app`
- Make sure port 80 and 443 are open: `ufw allow 80 && ufw allow 443 && ufw enable`

### App starts then crashes
```bash
docker compose logs app --tail=50
```
Usually means a missing or wrong environment variable in `server/.env`.

### "certificate error" in browser
Caddy gets SSL certificates automatically, but it needs ports 80 and 443 open.
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # for HTTP/3
ufw enable
```

### Database connection fails
- Check your MongoDB Atlas IP whitelist includes your server IP
- Double-check the connection string in `server/.env`

### Emails not sending
- Gmail requires an **App Password**, not your real Gmail password
- Go to: https://myaccount.google.com/apppasswords
- Generate one and update `EMAIL_PASSWORD` in `server/.env`
- Then restart: `docker compose restart app`

---

## Useful Commands (keep these handy)

```bash
# View live logs
docker compose logs -f app

# Restart just the app (after editing server/.env)
docker compose restart app

# Full restart of everything
docker compose down && docker compose up -d

# Check disk space
df -h

# Check RAM and CPU
docker stats

# Open a shell inside the app container
docker compose exec app sh

# Health check
curl http://localhost:5000/api/health/ready
```

---

## Security Checklist (before going public)

- [ ] `server/.env` has unique, randomly generated `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`
- [ ] MongoDB Atlas IP whitelist only contains your server IP (remove `0.0.0.0/0`)
- [ ] GitHub repository is set to **Private**
- [ ] `server/.env` is NOT committed to git
- [ ] Super admin password is strong and stored in a password manager
- [ ] DigitalOcean firewall: only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) are open

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---|---|---|
| DigitalOcean VPS | Basic 2GB | ~$12 |
| MongoDB Atlas | M0 Free | $0 |
| clemify.com domain | (already paid) | ~$12/year |
| Caddy SSL certs | Free (Let's Encrypt) | $0 |
| **Total** | | **~$12/month** |

---

*Questions? Check the logs first (`docker compose logs app`), then Google the exact error message.*
