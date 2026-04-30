# Deploy — Docker + CI/CD + Domain Management

Full production deployment for the English Learning Platform.
Covers: Docker build, Caddy reverse proxy with auto-HTTPS, GitHub Actions CI/CD, and center domain management.

Run this skill with an argument to target a specific task:
- `/deploy` — full setup check + guided deploy
- `/deploy push` — build image and push to server (day-to-day deploy)
- `/deploy domain add <center-slug> <domain>` — wire up a new custom domain for a center
- `/deploy domain list` — show all centers and their domain status
- `/deploy domain remove <center-slug>` — unlink a custom domain from a center
- `/deploy logs` — tail live server logs
- `/deploy status` — health check all running services

---

## Step 0 — Understand the stack before acting

Read these files to understand current state before making any changes:
- `ecosystem.config.cjs` — PM2 config (workers, health check endpoint)
- `server/index.js` — port, graceful shutdown, health route
- `vite.config.js` — build output directory (`dist/`)
- `server/package.json` — start script (`node index.js`)
- Check if `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.github/workflows/deploy.yml` already exist

---

## Phase 1 — Docker Setup (create files if missing)

### 1A. Create `Dockerfile` at project root

This is a **multi-stage build**: stage 1 builds the React frontend, stage 2 runs the Node backend and serves the built frontend as static files.

```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# dist/ is now at /app/dist

# Stage 2: Production Node backend
FROM node:20-alpine AS production
WORKDIR /app

# Install server dependencies only
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source
COPY server/ ./server/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

# Create uploads dir (overridden by volume in production)
RUN mkdir -p server/uploads/recordings server/uploads/branding server/uploads/homework server/uploads/teachers

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health/ready || exit 1

EXPOSE 5000
CMD ["node", "server/index.js"]
```

**Why this approach**: The frontend build happens in a throwaway stage — your final image only contains compiled JS files, not the React dev tools, Vite, or 400MB of node_modules. Final image ≈ 200MB instead of 1.5GB.

---

### 1B. Create `.dockerignore` at project root

```dockerignore
# Dependencies — reinstalled in container
node_modules/
server/node_modules/

# Frontend build output — rebuilt in container
dist/

# Environment files — injected at runtime via docker-compose
.env
server/.env
*.env

# Logs
server/logs/
*.log

# Uploads — mounted as volumes in production
server/uploads/

# Development tools
.git/
.github/
*.md
.vscode/
.claude/

# OS noise
.DS_Store
Thumbs.db
```

---

### 1C. Create `docker-compose.yml` at project root

```yaml
version: "3.9"

services:
  app:
    image: ghcr.io/YOUR_GITHUB_USERNAME/english-learning-platform:latest
    container_name: elp-app
    restart: unless-stopped
    env_file: ./server/.env.production  # server env vars (MONGO_URI, JWT_SECRET, etc.)
    environment:
      NODE_ENV: production
      PORT: 5000
      TRUST_PROXY: "true"  # Behind Caddy reverse proxy
    volumes:
      # Persist uploads across deployments
      - uploads_data:/app/server/uploads
      # Persist logs
      - ./server/logs:/app/server/logs
    depends_on:
      - redis
    networks:
      - elp-network
    # Do NOT expose port 5000 publicly — Caddy proxies to this internally
    expose:
      - "5000"

  redis:
    image: redis:7-alpine
    container_name: elp-redis
    restart: unless-stopped
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data
    networks:
      - elp-network

  caddy:
    image: caddy:2-alpine
    container_name: elp-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"  # HTTP/3
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data           # SSL certs — persisted across restarts
      - caddy_config:/config
    networks:
      - elp-network

volumes:
  uploads_data:
  redis_data:
  caddy_data:
  caddy_config:

networks:
  elp-network:
    driver: bridge
```

**Instruction for user**: Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username (lowercase).

---

### 1D. Create `Caddyfile` at project root

This handles:
- `*.clemify.com` → wildcard subdomain (each center gets `{slug}.clemify.com`)
- Any verified custom domain → same backend (Caddy's on-demand TLS provisions SSL automatically)
- HTTP → HTTPS redirect (automatic with Caddy)

```caddyfile
# Replace clemify.com with your actual domain
# Replace YOUR_EMAIL with your email for Let's Encrypt notifications

{
  # Global options
  email speak2clem@gmail.com
  
  # On-demand TLS — automatically provisions SSL for any custom domain
  # that hits this server. Only approve domains that are in your DB.
  on_demand_tls {
    ask http://localhost:5000/api/v1/center/verify-caddy?domain={labels.0}
    interval 2m
    burst 5
  }
}

# Wildcard subdomain: slug.clemify.com
*.clemify.com, clemify.com {
  tls {
    dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    # OR if not using Cloudflare:
    # Use certbot separately for wildcard: certbot certonly --manual --preferred-challenges dns
  }
  
  reverse_proxy app:5000
  
  header {
    X-Forwarded-Proto https
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    -Server
  }
  
  # Serve frontend static files directly for faster loading (optional)
  # @static path_regexp \.(js|css|png|jpg|ico|svg|woff2?)$
  # handle @static {
  #   root * /app/dist
  #   file_server
  # }
}

# Custom domains — centers with their own domain (e.g., sunshine.com)
# on_demand_tls handles SSL cert provisioning automatically
:443 {
  tls {
    on_demand
  }
  reverse_proxy app:5000
}
```

**Important**: Caddy calls `GET /api/v1/center/verify-caddy?domain=<domain>` before issuing a cert for any unknown domain. Your backend must return `200` if the domain is in your database with `domainVerified: true`, and `404` otherwise. This prevents cert spam.

**Add this endpoint to `server/routes/centerRoutes.js`** (or create a small dedicated file):

```javascript
// GET /api/v1/center/verify-caddy?domain=somesite.com
// Called by Caddy before issuing an on-demand TLS cert
// Returns 200 if domain is a verified custom domain in DB, 404 otherwise
router.get('/domain/verify-caddy', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).end();
  
  const center = await Center.findOne({
    customDomain: domain.toLowerCase(),
    domainVerified: true,
    status: 'active',
  }).lean();
  
  if (center) return res.status(200).end();
  return res.status(404).end();
});
```

---

## Phase 2 — CI/CD Pipeline (GitHub Actions)

### Create `.github/workflows/deploy.yml`

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}  # e.g. your-username/english-learning-platform

jobs:
  # ── Job 1: Test ──────────────────────────────────────────────────────────────
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      
      - name: Install frontend deps
        run: npm ci
      
      - name: Install server deps
        run: cd server && npm ci
      
      - name: Run server tests
        run: cd server && npm test
        env:
          NODE_ENV: test
          JWT_SECRET: test-secret-min-32-chars-xxxxxxxxxx
          ENCRYPTION_KEY: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
          SESSION_SECRET: test-session-secret-32chars-xxxxxx

  # ── Job 2: Build & Push Docker Image ────────────────────────────────────────
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'   # Only build on main branch push, not PRs
    permissions:
      contents: read
      packages: write  # Needed to push to GitHub Container Registry
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx (multi-platform + cache)
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}  # Automatically provided by GitHub
      
      - name: Extract image metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=sha-          # e.g. sha-a1b2c3d
            type=raw,value=latest         # Always tag latest on main
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha   # GitHub Actions cache — speeds up builds
          cache-to: type=gha,mode=max

  # ── Job 3: Deploy to VPS ────────────────────────────────────────────────────
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production   # GitHub environment — shows on deploy history
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            set -e  # Exit on any error
            
            # Pull latest image
            echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            docker pull ghcr.io/${{ github.repository }}:latest
            
            # Move to app directory
            cd ~/english-learning-platform
            
            # Pull latest docker-compose.yml and Caddyfile from repo
            git pull origin main
            
            # Rolling restart: new container comes up before old one stops
            docker compose up -d --no-build app
            
            # Wait for health check to pass (max 60s)
            echo "Waiting for app to be healthy..."
            for i in $(seq 1 12); do
              if curl -sf http://localhost:5000/api/health/ready > /dev/null; then
                echo "✅ App is healthy"
                break
              fi
              if [ $i -eq 12 ]; then
                echo "❌ Health check failed — rolling back"
                docker compose up -d --no-build app  # Re-pull previous
                exit 1
              fi
              sleep 5
            done
            
            # Clean up old images to save disk space
            docker image prune -f
            
            echo "🚀 Deployment complete"
      
      - name: Notify on success
        if: success()
        run: echo "Deployed commit ${{ github.sha }} to production"
```

**GitHub Secrets to add** (Settings → Secrets and variables → Actions):
- `SERVER_HOST` — your VPS IP address
- `SERVER_USER` — SSH user (e.g. `ubuntu` or `root`)
- `SSH_PRIVATE_KEY` — output of `cat ~/.ssh/id_rsa` on your local machine

---

## Phase 3 — First-Time VPS Setup

Run these commands once on your server (Ubuntu 22.04 recommended):

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone your repo
git clone https://github.com/YOUR_USERNAME/english-learning-platform.git ~/english-learning-platform
cd ~/english-learning-platform

# 3. Create production env file
cp server/.env.example server/.env.production
nano server/.env.production
# Fill in: MONGO_URI, JWT_SECRET, ENCRYPTION_KEY, EMAIL_USER, etc.
# Set: REDIS_URL=redis://redis:6379  (uses Docker service name)
# Set: TRUST_PROXY=true
# Set: SERVER_IP=<your VPS public IP>
# Set: CORS_ORIGINS=https://clemify.com,https://*.clemify.com

# 4. Point your domain's DNS to this server
# At your domain registrar (Namecheap, GoDaddy, Cloudflare):
# Add A record: *.clemify.com → <VPS IP>
# Add A record: clemify.com → <VPS IP>

# 5. Start everything
docker compose up -d

# 6. Verify all services are running
docker compose ps
docker compose logs app --tail=50
```

---

## Phase 4 — Domain Management

### How domain routing works in this app

```
User visits sunshine.clemify.com
  → Caddy matches *.clemify.com wildcard cert
  → Forwards to app:5000
  → tenantMiddleware extracts slug from subdomain: "sunshine"
  → Loads Center with slug="sunshine" from master DB
  → Attaches center DB to req.db

User visits myownschool.com (custom domain)
  → Caddy on-demand TLS provisions cert automatically
  → Calls GET /api/v1/center/verify-caddy?domain=myownschool.com
  → Backend checks: Center.findOne({ customDomain: 'myownschool.com', domainVerified: true })
  → Returns 200 → Caddy issues cert
  → Forwards to app:5000
  → tenantMiddleware extracts center from customDomain header/Host
```

### `/deploy domain add <slug> <domain>`

When a center admin wants to use their own domain (e.g., `sunshine-school.com`):

**Step 1: Center admin enters domain in BrandingTab**
- They type `sunshine-school.com` in the custom domain field
- Backend saves `customDomain: 'sunshine-school.com', domainVerified: false`
- Backend returns the DNS instructions to show the admin:
  ```
  Add this DNS record at your domain registrar:
  Type:  A
  Name:  @
  Value: <YOUR_SERVER_IP>
  TTL:   3600
  ```

**Step 2: DNS verification (already implemented in `domainVerifier.js`)**
- Super admin clicks "Verify Domain" in `SuperAdminDashboard.jsx` DomainsTab
- Backend calls `verifyDomainDns(domain, config.serverIp)`
- If DNS A record points to server IP → set `domainVerified: true`
- Caddy will now auto-provision SSL cert on next request to that domain

**Step 3: No Caddy config changes needed**
- Because of on-demand TLS, Caddy handles it automatically
- The `verify-caddy` endpoint you added guards against rogue cert requests

### `/deploy domain list`

Query all centers and their domain status:

```javascript
// Run in server REPL or as a one-off script:
const centers = await Center.find({ status: { $ne: 'deleted' } })
  .select('centerName slug customDomain domainVerified status')
  .lean();

centers.forEach(c => {
  const domain = c.customDomain
    ? `${c.customDomain} (${c.domainVerified ? '✅ verified' : '⏳ pending'})`
    : `${c.slug}.clemify.com (wildcard)`;
  console.log(`${c.centerName} → ${domain}`);
});
```

Or check from the SuperAdminDashboard → Domains tab which already lists all centers with domain status.

### `/deploy domain remove <slug>`

```javascript
await Center.findOneAndUpdate(
  { slug },
  { customDomain: null, domainVerified: false, domainRequestedAt: null, domainVerifiedAt: null }
);
// Caddy will stop issuing certs for that domain automatically (verify-caddy returns 404)
```

---

## Phase 5 — Day-to-Day Deploy (`/deploy push`)

After the initial setup, every deploy is just:

```bash
# This happens automatically via GitHub Actions on every push to main:
git add -A && git commit -m "your message" && git push origin main

# GitHub Actions will:
# 1. Run tests
# 2. Build Docker image
# 3. Push to ghcr.io
# 4. SSH into server and do rolling restart
# 5. Health check — auto-rollback if it fails
```

To deploy manually without Actions:

```bash
ssh ubuntu@YOUR_SERVER_IP "cd ~/english-learning-platform && git pull && docker compose pull app && docker compose up -d app"
```

---

## Phase 6 — Monitoring & Logs (`/deploy logs`, `/deploy status`)

```bash
# All service logs
docker compose logs --tail=100 -f

# App logs only
docker compose logs app --tail=100 -f

# Check all running containers + health
docker compose ps

# Server resource usage
docker stats

# Health check endpoints
curl https://clemify.com/api/health          # Full status
curl https://clemify.com/api/health/ready    # Readiness (used by CI)
curl https://clemify.com/api/health/live     # Liveness
```

---

## Full Architecture Diagram

```
Internet
    │
    ▼
Caddy (port 80/443)
    │  Auto-HTTPS for all domains
    │  *.clemify.com → wildcard cert
    │  custom-domain.com → on-demand TLS
    │
    ▼
app container (port 5000)
    │  Node.js + Express
    │  Serves: React static files (dist/)
    │         API routes (/api/v1/*)
    │         Socket.IO (/socket.io)
    │
    ├──▶ Redis container
    │       Socket.IO adapter (cluster sync)
    │       Rate limiter backend
    │
    ├──▶ MongoDB Atlas (recommended)
    │       master DB: Centers, SuperAdmins, AuditLogs
    │       per-center DBs: Teachers, Students, Bookings...
    │
    └──▶ S3 / R2 (optional)
            Recordings, large uploads
```

---

## Environment Variables Needed for Production

Add these to `server/.env.production` on your server (never commit this file):

```env
NODE_ENV=production
PORT=5000
TRUST_PROXY=true
SERVER_IP=<your VPS public IP>

# MongoDB — use Atlas (free M0 cluster works for small centers)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/master?retryWrites=true
MASTER_DB_URI=mongodb+srv://user:pass@cluster.mongodb.net/master?retryWrites=true
DB_BASE_URI=mongodb+srv://user:pass@cluster.mongodb.net

# Auth — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<64+ hex chars>
SESSION_SECRET=<32+ hex chars>
ENCRYPTION_KEY=<exactly 64 hex chars>

# Redis — use Upstash free tier: upstash.com
REDIS_URL=rediss://default:password@host.upstash.io:6380

# Email — use Gmail app password
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# Frontend
FRONTEND_URL=https://clemify.com
CORS_ORIGINS=https://clemify.com,https://app.clemify.com

# Agora (video calls)
AGORA_APP_ID=<from console.agora.io>
AGORA_APP_CERTIFICATE=<from console.agora.io>

# S3 for recordings (optional — Cloudflare R2 is cheapest)
S3_BUCKET=your-bucket-name
AWS_REGION=auto
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_ENDPOINT_URL=https://account.r2.cloudflarestorage.com  # If using R2

# AI (optional)
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Domain Registrar Recommendations

When a new center is created and wants their own domain:

| Registrar | Cost/year | Why |
|-----------|-----------|-----|
| **Cloudflare** | ~$10 | Best — free DNS management, DDoS protection, fast nameservers |
| **Namecheap** | ~$10 | Good interface, cheap renewals |
| **Porkbun** | ~$8 | Cheapest, free WHOIS privacy |

**Best flow for new center custom domain:**
1. Center buys domain on Cloudflare (or transfers existing domain to Cloudflare)
2. In Cloudflare DNS, add: `A record | @ | YOUR_SERVER_IP | Proxied: OFF` (turn off orange cloud — SSL should terminate at your Caddy, not Cloudflare, to avoid double-encryption issues)
3. Center enters domain in their BrandingTab
4. Super admin or automated job calls `verifyDomainDns(domain, serverIp)`
5. On success: `domainVerified: true` → Caddy auto-provisions SSL → domain works

---

## When Claude executes this skill

Depending on the argument:

**No argument or `setup`**: Check which files exist, create any that are missing (Dockerfile, docker-compose.yml, Caddyfile, .dockerignore, GitHub Actions workflow), show the user what was created and what manual steps they need to take.

**`push`**: Run `git status` to confirm there are committed changes, show the last 3 commits, remind the user that pushing to `main` triggers the CI/CD pipeline automatically.

**`domain add <slug> <domain>`**: Look up the center in the database structure, show the exact DNS record the center admin needs to add, confirm `SERVER_IP` is set in config.

**`domain list`**: Read Center model, explain how to query all centers and their domain status from the SuperAdminDashboard Domains tab.

**`domain remove <slug>`**: Show the exact MongoDB update to clear `customDomain` and `domainVerified`.

**`logs`**: Show the docker compose logs command and what to look for.

**`status`**: Show docker compose ps and health check URLs.

Always read the current state of the codebase before making any changes. Check if the Caddy `verify-caddy` endpoint already exists in `server/routes/centerRoutes.js` or similar before adding it. Check if `.github/workflows/` already exists.
