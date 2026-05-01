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

Everything runs in Docker on one VPS. GitHub handles automatic deployments every
time you push to `main`.

---

## What you need before starting

- [x] Domain name: **clemify.com** (already bought)
- [ ] A GitHub account with your code pushed to a **private** repository
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
   - If you don't have an SSH key, click "New SSH Key" and follow their guide
   - Or choose "Password" for now — just make it very strong
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
> You can check if it's working at: https://dnschecker.org — type `clemify.com`

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
MONGO_URI    = ...mongodb.net/master?retryWrites=true&w=majority
MASTER_DB_URI = ...mongodb.net/master?retryWrites=true&w=majority
DB_BASE_URI  = ...mongodb.net  (no database name at the end)
```

---

## STEP 4 — Push Your Code to GitHub

### 4.1 Create a GitHub repository
Go to: https://github.com/new  
- Name: `english-learning-platform`
- Visibility: **Private**
- Click **Create repository**

### 4.2 Push your code
Open a terminal in your project folder and run:

```bash
git init
git add -A
git commit -m "Initial production commit"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/english-learning-platform.git
git push -u origin main
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

### 4.3 Update docker-compose.yml with your GitHub username
Open `docker-compose.yml` and change line 11:
```yaml
image: ghcr.io/YOUR_GITHUB_USERNAME/english-learning-platform:latest
```
to:
```yaml
image: ghcr.io/your-actual-github-username/english-learning-platform:latest
```
Commit and push that change.

---

## STEP 5 — Add GitHub Secrets

GitHub Actions needs credentials to deploy to your server. These are stored as
encrypted secrets — they are never visible to anyone.

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add these one by one:

| Secret Name | Value | Where to get it |
|---|---|---|
| `SERVER_HOST` | `157.230.123.45` | Your VPS IP from Step 1 |
| `SERVER_USER` | `root` | Default for DigitalOcean (or `ubuntu` on AWS) |
| `SSH_PRIVATE_KEY` | Your SSH private key | See note below |

**How to get your SSH private key:**
On your laptop, run:
```bash
cat ~/.ssh/id_rsa
```
Copy everything including `-----BEGIN OPENSEC KEY-----` and `-----END OPENSEC KEY-----`.
Paste it as the `SSH_PRIVATE_KEY` secret.

If that file doesn't exist, generate one:
```bash
ssh-keygen -t ed25519 -C "clemify-deploy"
cat ~/.ssh/id_ed25519
```
Then add the **public** key to your server:
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@YOUR_SERVER_IP
```

---

## STEP 6 — Set Up the Server

SSH into your server:
```bash
ssh root@YOUR_SERVER_IP
```

Run these commands one by one:

### 6.1 Update the server
```bash
apt update && apt upgrade -y
```

### 6.2 Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 6.3 Install Docker Compose (plugin)
```bash
apt install -y docker-compose-plugin
docker compose version   # should print: Docker Compose version v2.x.x
```

### 6.4 Clone your repository on the server
```bash
cd ~
git clone https://github.com/YOUR_GITHUB_USERNAME/english-learning-platform.git
cd english-learning-platform
```

---

## STEP 7 — Create the Production Environment File

Still on your server, create the production config file:

```bash
nano ~/english-learning-platform/server/.env.production
```

Paste this entire block, filling in every `CHANGE_ME` value:

```env
NODE_ENV=production
PORT=5000
TRUST_PROXY=true

# ── Database (from Step 3) ────────────────────────────────────────────────────
MONGO_URI=mongodb+srv://clemify-app:YOUR_DB_PASSWORD@cluster0.abc123.mongodb.net/master?retryWrites=true&w=majority
MASTER_DB_URI=mongodb+srv://clemify-app:YOUR_DB_PASSWORD@cluster0.abc123.mongodb.net/master?retryWrites=true&w=majority
DB_BASE_URI=mongodb+srv://clemify-app:YOUR_DB_PASSWORD@cluster0.abc123.mongodb.net

# ── Security — generate each one (commands below) ────────────────────────────
JWT_SECRET=CHANGE_ME
SESSION_SECRET=CHANGE_ME
ENCRYPTION_KEY=CHANGE_ME

# ── Domain ───────────────────────────────────────────────────────────────────
FRONTEND_URL=https://clemify.com
PLATFORM_DOMAIN=clemify.com
CORS_ORIGINS=https://clemify.com,https://www.clemify.com
SERVER_IP=YOUR_SERVER_IP

# ── Email (Gmail) ─────────────────────────────────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=clement.devv01@gmail.com
EMAIL_PASSWORD=qzjstdvsgmymwxjh

# ── Redis (Docker internal) ───────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Agora (video calls) ───────────────────────────────────────────────────────
AGORA_APP_ID=37597ab6d0fb4d1ca8eceb87785010e7
AGORA_APP_CERTIFICATE=b966244581dc4cc5ae5b2a4cae166959

# ── Web Push ──────────────────────────────────────────────────────────────────
VAPID_PUBLIC_KEY=BMvWg6nJZwP6FK0Zd-u2K-u-97M9G9vjUTreYknmQnAN9xggns8wudS7pb0KTH2cPv9QDsHb9_4bsr1SJX8phdg
VAPID_PRIVATE_KEY=ijK7SNTazfds_QJOZDU9E7RbhpdeMdsF--XCnmiY-uc
VAPID_EMAIL=mailto:speak2clem@gmail.com

# ── AI ────────────────────────────────────────────────────────────────────────
GEMINI_API_KEY=AIzaSyBvQz3YWjrGFVbJnOWehjmtRmEN9HsBxZI
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# ── Super Admin ───────────────────────────────────────────────────────────────
SUPER_ADMIN_EMAIL=clem.emmy01@gmail.com

BCRYPT_ROUNDS=12
```

**Generate the three security secrets** — run each command separately and paste the output:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (must be exactly 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save the file: press `Ctrl+X`, then `Y`, then `Enter`.

> **Important:** This file contains passwords. Never commit it to GitHub.
> The `.gitignore` already excludes `.env.production`.

---

## STEP 8 — First Deploy

### 8.1 Trigger the build from your laptop
Push any small change to GitHub:

```bash
# On your laptop
git add -A
git commit -m "Trigger first production deploy"
git push origin main
```

This starts GitHub Actions automatically. Watch it at:
`https://github.com/YOUR_GITHUB_USERNAME/english-learning-platform/actions`

The pipeline runs 3 jobs:
1. **Test** (~2 min) — runs your tests
2. **Build Docker Image** (~5 min) — builds and pushes to GitHub registry
3. **Deploy to Production** (~2 min) — SSHes into your server and restarts the container

### 8.2 If GitHub Actions hasn't finished yet — do it manually first
On your server:

```bash
cd ~/english-learning-platform

# Log in to GitHub's container registry
echo "YOUR_GITHUB_PERSONAL_ACCESS_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Start everything
docker compose up -d

# Watch the startup logs
docker compose logs -f app
```

> To create a GitHub Personal Access Token:  
> GitHub → Settings → Developer settings → Personal access tokens → Generate new token  
> Scopes needed: `read:packages`, `write:packages`

---

## STEP 9 — Verify It's Live

On your server, check all services are running:
```bash
docker compose ps
```

You should see 3 containers all with status `Up` or `healthy`:
- `elp-app` — your Node.js server
- `elp-redis` — Redis cache
- `elp-caddy` — the web server / HTTPS handler

Check the app is responding:
```bash
curl http://localhost:5000/api/health
```
Should return: `{"status":"ok"}`

Check HTTPS is working (wait a few minutes for Caddy to get the SSL certificate):
```bash
curl https://clemify.com/api/health
```

Open your browser and visit **https://clemify.com** — your app should be live.

---

## STEP 10 — Create Your Super Admin Account

Your app needs a super admin to create schools (centers). Run this on your server:

```bash
cd ~/english-learning-platform
docker compose exec app node server/scripts/createAdmin.js
```

If that script doesn't exist, connect to the app and create it manually:
```bash
docker compose exec app node -e "
  import('./server/index.js').then(async () => {
    console.log('Use the /super-admin/setup route or check your scripts folder');
  });
"
```

Then log in at: `https://clemify.com/super-admin/login`  
Email: `clem.emmy01@gmail.com`

---

## STEP 11 — Every Future Deploy

From now on, deploying is just:

```bash
git add -A
git commit -m "describe your change"
git push origin main
```

GitHub Actions automatically:
1. Tests the code
2. Builds a new Docker image
3. SSHes into your server and does a rolling restart (zero downtime)
4. Runs a health check — rolls back if it fails

---

## Common Problems & Fixes

### "Site can't be reached" after going live
- Check DNS has propagated: https://dnschecker.org → type `clemify.com`
- Check Caddy logs: `docker compose logs caddy`
- Check app logs: `docker compose logs app`
- Make sure port 80 and 443 are open: `ufw allow 80 && ufw allow 443`

### App starts then crashes
```bash
docker compose logs app --tail=50
```
Usually means a missing or wrong environment variable in `.env.production`.

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
- Double-check the connection string in `.env.production` — password has no special characters?
- Try: `docker compose exec app node -e "import('./server/config/config.js').then(c => console.log(c.default.mongoUri.slice(0,40)))"`

### Emails not sending
- Gmail requires an **App Password**, not your real Gmail password
- Go to: https://myaccount.google.com/apppasswords
- Generate one and update `EMAIL_PASSWORD` in `.env.production`
- Then restart: `docker compose restart app`

---

## Useful Commands (keep these handy)

```bash
# View live logs
docker compose logs -f app

# Restart just the app (after editing .env.production)
docker compose restart app

# Full restart of everything
docker compose down && docker compose up -d

# Check disk space
df -h

# Check RAM and CPU
docker stats

# Update to latest code manually (normally done by GitHub Actions)
git pull origin main && docker compose pull app && docker compose up -d app

# Open a shell inside the app container
docker compose exec app sh

# Health check
curl https://clemify.com/api/health
```

---

## Security Checklist (before going public)

- [ ] `server/.env.production` has unique, randomly generated JWT_SECRET, SESSION_SECRET, ENCRYPTION_KEY
- [ ] MongoDB Atlas IP whitelist only contains your server IP (remove `0.0.0.0/0`)
- [ ] GitHub repository is set to **Private**
- [ ] `server/.env.production` is NOT committed to git (check: `git status` should not show it)
- [ ] Super admin password is strong and stored in a password manager
- [ ] DigitalOcean firewall: only ports 22 (SSH), 80 (HTTP), 443 (HTTPS) are open

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---|---|---|
| DigitalOcean VPS | Basic 2GB | ~$12 |
| MongoDB Atlas | M0 Free | $0 |
| clemify.com domain | (already paid) | ~$12/year |
| GitHub | Free private repos | $0 |
| Caddy SSL certs | Free (Let's Encrypt) | $0 |
| **Total** | | **~$12/month** |

---

*Questions? Check the logs first (`docker compose logs app`), then Google the exact error message.*
