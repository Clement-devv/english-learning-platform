# Deployment Guide

## Infrastructure Overview

```
DigitalOcean Droplet
├── Docker
│   ├── elp-app      (Node.js backend, port 5000)
│   ├── elp-redis    (Redis for rate limiting)
│   └── elp-caddy    (reverse proxy, auto HTTPS)
└── /opt/elp/        (project directory on host)
    ├── server/.env  (environment variables — never commit)
    └── server/logs/ (app logs — persisted via volume mount)
```

## First-Time Server Setup

```bash
# 1. SSH into your server
ssh root@YOUR_DROPLET_IP

# 2. Clone the repo
mkdir -p /opt/elp
cd /opt/elp
git clone https://github.com/YOUR_USERNAME/english-learning-platform.git .

# 3. Create the env file
cp server/.env.example server/.env
nano server/.env   # fill in all values (see Environment Variables section below)

# 4. Create upload and log directories
mkdir -p server/uploads server/logs

# 5. Start all containers
docker compose up -d

# 6. Check everything is running
docker compose ps
docker compose logs app --tail=50
```

## Environment Variables

Fill in `server/.env` on the server. Never commit this file.

```env
NODE_ENV=production
PORT=5000

# MongoDB — all three must point to the same Atlas cluster
MONGO_URI=#####
MASTER_DB_URI=#####
DB_BASE_URI=#####

# Security — generate with the commands below
JWT_SECRET=#####
ENCRYPTION_KEY=#####

# Email (Gmail app password — not your real password)
EMAIL_USER=#####
EMAIL_PASSWORD=#####
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

# App URLs
FRONTEND_URL=https://clemify.com
PLATFORM_DOMAIN=clemify.com
CORS_ORIGINS=https://clemify.com,https://www.clemify.com
TRUST_PROXY=true

# Optional — video calls
AGORA_APP_ID=#####
AGORA_APP_CERTIFICATE=#####

# Optional — push notifications
VAPID_PUBLIC_KEY=#####
VAPID_PRIVATE_KEY=#####

# Optional — AI features
ANTHROPIC_API_KEY=#####

# Optional — Redis (already set via docker-compose environment block)
# REDIS_URL=redis://redis:6379
```

**Generate secrets:**
```bash
# JWT_SECRET (64 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactly 64 hex chars / 32 bytes for AES-256)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# VAPID keys
npx web-push generate-vapid-keys
```

## Redeploying After Code Changes

```bash
# On your local machine
git add .
git commit -m "your message"
git push origin main

# On the server
cd /opt/elp
git pull origin main
docker compose up -d --force-recreate --build app
```

## Common Commands

```bash
# Check container status
docker compose ps

# Watch live logs
docker compose logs -f app

# Restart just the app (no rebuild)
docker compose restart app

# Full restart
docker compose down && docker compose up -d

# Check API health
curl http://localhost:5000/api/health/ready
```

## Caddy (HTTPS / Reverse Proxy)

Caddy handles SSL automatically. No certbot needed.

DNS records required at your domain registrar:
```
A record:   clemify.com        →  YOUR_DROPLET_IP
A record:   *.clemify.com      →  YOUR_DROPLET_IP   (wildcard for center subdomains)
```

Caddy config lives in `Caddyfile` at the project root.

## Troubleshooting

**App container exits immediately**
```bash
docker compose logs app
```
Most likely cause: missing or incorrect env var in `server/.env`. Check that all required vars are set and `ENCRYPTION_KEY` is exactly 64 hex characters.

**Redis connection errors**
Redis is optional — the app falls back to in-memory rate limiting if Redis is unavailable.
Check Redis container: `docker compose logs redis`

**SSL cert not provisioning for custom domain**
- Verify the domain has an A record pointing to your droplet IP
- Check Caddy logs: `docker compose logs caddy`
- Custom domain must be verified in super admin dashboard first

**Uploads not persisting across deploys**
Uploads are stored in the `uploads_data` Docker named volume.
To check: `docker volume inspect elp_uploads_data`
