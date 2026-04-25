# Scalability Roadmap — 1,000+ Concurrent Users

**Current safe capacity:** ~200–400 users per instance  
**Target:** 1,000+ concurrent users  
**Last audited:** 2026-04-22  
**Last updated:** 2026-04-22 — fixes 1–12 applied in code (10, 11, 12 need manual steps)

---

## Critical Blockers

These three issues prevent horizontal scaling entirely. Fix these before anything else.

### 1. Single Node.js Process (No Clustering)
- **File:** [ecosystem.config.cjs](ecosystem.config.cjs), [server/index.js](server/index.js)
- **Status:** ✅ Code done — needs deploy + test

**What was changed:**
- `ecosystem.config.cjs` → `instances: "max"`, `exec_mode: "cluster"`
- `server/index.js` → schedulers (reminders, cleanup, sweep) now run on **worker 0 only** via `NODE_APP_INSTANCE` guard, so they don't fire N times

**Still to do:**
- [x] Updated `ecosystem.config.cjs` to cluster mode
- [x] Scheduler guard added to `server/index.js`
- [ ] Run `pm2 start ecosystem.config.cjs --env production` and confirm all workers start
- [ ] Confirm only one set of reminder emails fires per interval

---

### 2. Socket.IO Has No Redis Adapter
- **File:** [server/socketServer.js](server/socketServer.js)
- **Status:** ✅ Code done — needs `npm install` + `REDIS_URL` env var

**What was changed:**
- `initializeSocket` is now `async`
- On startup, dynamically imports `@socket.io/redis-adapter` and wires it up if `REDIS_URL` is set
- Fails gracefully with a clear warning if the package isn't installed yet
- `@socket.io/redis-adapter` added to `server/package.json`

**Still to do:**
- [x] Redis adapter code added to `server/socketServer.js`
- [x] Package added to `server/package.json`
- [ ] Run `cd server && npm install` to install the new packages
- [ ] Set `REDIS_URL` in `.env` and production environment
- [ ] Test: open classroom on two browser tabs, confirm events arrive on both

> **Note on whiteboard state:** The `whiteboardSessions` Map in socketServer.js is still per-instance memory. With Nginx sticky sessions (ip_hash), each user always hits the same worker so this works. Without sticky sessions, a reconnecting user may land on a different worker and miss whiteboard state. Add Nginx ip_hash or migrate `whiteboardSessions` to Redis to fix this fully.

---

### 3. File Uploads Saved to Local Disk
- **File:** [server/routes/recordingRoutes.js](server/routes/recordingRoutes.js)
- **Status:** ✅ Code done — needs S3 bucket + env vars + `npm install`

**What was changed:**
- Storage is now chosen at startup: S3 if `S3_BUCKET` env var is set, otherwise local disk
- `purgeRecording()` deletes from S3 or disk depending on which is active
- `@aws-sdk/client-s3` and `multer-s3` added to `server/package.json`

**Still to do:**
- [x] Conditional S3 / local-disk storage added to `recordingRoutes.js`
- [ ] Create an S3 bucket (or Cloudflare R2 — cheaper)
- [ ] Add to `.env`: `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- [ ] Run `cd server && npm install` to install the new packages
- [ ] Test upload + playback via the authenticated stream endpoint
- [ ] Migrate existing recordings from `server/uploads/recordings/` to S3
- [ ] Decide on branding/teacher photo storage (`/uploads/branding`, `/uploads/teachers`) — same S3 bucket is fine

---

## High Priority

Fix these once the critical blockers are resolved.

### 4. Database Connection Pool Too Small
- **File:** [server/index.js](server/index.js)
- **Status:** ✅ Done

**What was changed:** `maxPoolSize: 20 → 50`, `minPoolSize: 5 → 10`

**Still to do:**
- [x] Pool sizes updated
- [ ] Check MongoDB Atlas tier — M10 supports 500 connections, M2/M5 are capped lower
- [ ] Watch connection count in Atlas Metrics dashboard during first load test

---

### 5. No Query Result Caching
- **File:** [server/utils/cache.js](server/utils/cache.js) *(new)*, [server/routes/teacherRoutes.js](server/routes/teacherRoutes.js)
- **Status:** ✅ Done

**What was changed:**
- Created `cachedQuery` / `invalidateCache` helpers in `server/utils/cache.js`
- `GET /teachers/:id` now reads from Redis cache (60s TTL) and falls back to DB on miss
- Cache invalidated on `PATCH /:id/profile`, `PUT /:id`, `DELETE /:id`, photo upload/delete

**Still to do:**
- [x] Created `server/utils/cache.js`
- [x] Applied to teacher profile `GET /:id`
- [x] Invalidation added to all teacher write routes
- [ ] Apply caching to student profile `GET /:id` in `studentRoutes.js` (same pattern)
- [ ] Apply caching to analytics/earnings summaries (TTL 300s)

---

### 6. Realtime Rate Limiter Too Strict for Classrooms
- **File:** [server/middleware/rateLimiter.js](server/middleware/rateLimiter.js)
- **Status:** ✅ Done

**What was changed:** `realtimeLimiter` max: `200 → 600` req/min

- [x] Updated to 600 req/min
- [ ] Monitor in production — if classrooms still get throttled, raise to 1200

---

## Medium Priority

Fix these once the platform is stable at scale.

### 7. JWT Logout Doesn't Work Across Instances
- **Files:** [server/middleware/authMiddleware.js](server/middleware/authMiddleware.js), [server/routes/authRoutes.js](server/routes/authRoutes.js)
- **Status:** ✅ Done

**What was changed:**
- `verifyToken` now checks `bl:<jwt-signature>` key in Redis before allowing the request
- `logout-session` route writes the blacklist key with TTL = remaining token lifetime
- `logout-all-devices` route blacklists all other active session tokens

- [x] Blacklist check added to `verifyToken`
- [x] Blacklist write added to `logout-session`
- [x] Blacklist write added to `logout-all-devices`
- [ ] Test: log in on two devices, log out on device 1, confirm device 2 gets 401 within seconds

---

### 8. Session Arrays Grow Unbounded
- **File:** `server/utils/sessionManager.js`
- **Status:** ✅ Already handled — `SESSION_LIMIT = 5` in `server/config/constants.js`

No action needed. The `pruneSessionsToLimit` function already caps sessions at 5 and is called on every login.

---

### 9. Missing Compound Indexes on High-Traffic Queries
- **File:** [server/createIndexes.js](server/createIndexes.js)
- **Status:** ✅ Code done — needs to be run against production DB

**What was added:**
- `bookings`: `{ studentId, scheduledTime }` and `{ teacherId, scheduledTime }`
- `groupchats`: `{ assignmentId, createdAt }`
- `recordings`: `{ studentId, createdAt }` and `{ teacherId, createdAt }`

**Still to do:**
- [x] Indexes added to `createIndexes.js`
- [ ] Run `node server/createIndexes.js` against production DB (off-peak hours — safe, non-blocking build)

---

### 10. Chat History Has No Message Limit
- **Files:** [server/routes/groupChatRoutes.js](server/routes/groupChatRoutes.js), [server/routes/superAdminRoutes.js](server/routes/superAdminRoutes.js)
- **Status:** ✅ Done

**What was changed:**
- `GET /group-chats` now uses `.skip()/.limit(50)` and excludes the `messages` array from the list view (clients fetch messages separately)
- `GET /group-chats/:chatId/messages` now uses MongoDB `$slice` projection — returns last 50 messages by default, never loads the full array into memory
- Load older messages: `?offset=50` (next 50), `?limit=100` (bigger page), response includes `hasMore` flag
- `GET /super-admin/centers`, `/centers/pending`, `/centers/deleted` all paginated with `?limit=50&skip=0` and return `total` + `hasMore`

- [x] Chat list paginated, messages excluded from list view
- [x] Message history uses `$slice` (max 200 per request)
- [x] Center list endpoints paginated with total counts
- [ ] Frontend: wire up "load more" button using `?offset=N` on the messages endpoint

---

## Low Priority

Nice-to-have improvements once everything else is stable.

### 11. Add Nginx Reverse Proxy
- **Status:** ⬜ Todo

```nginx
upstream app {
  ip_hash;  # sticky sessions — ensures same user hits same worker (needed for whiteboard state)
  server 127.0.0.1:5000;
}

server {
  listen 443 ssl;
  location / {
    proxy_pass http://app;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";  # required for Socket.IO
  }
  location ~* \.(js|css|png|jpg|woff2)$ { expires 1y; }
}
```

- [ ] Install and configure Nginx on the server
- [ ] Add `ip_hash` for sticky sessions (needed until `whiteboardSessions` is moved to Redis)
- [ ] Move TLS/SSL termination to Nginx
- [ ] Set long-lived cache headers for hashed static assets

---

### 12. Add Application Performance Monitoring (APM)
- **Status:** ⬜ Todo

```bash
cd server && npm install @sentry/node
```

```js
// server/index.js — add near the top
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}
```

- [ ] Sign up at sentry.io (free tier is enough to start)
- [ ] Add `SENTRY_DSN` to `.env`
- [ ] Add Sentry init to `server/index.js`
- [ ] Confirm errors appear in the Sentry dashboard

---

## Progress Tracker

| # | Fix | Priority | Status |
|---|-----|----------|--------|
| 1 | PM2 cluster mode + scheduler guard | Critical | ✅ Code done |
| 2 | Socket.IO Redis adapter | Critical | ✅ Code done — run `npm install` |
| 3 | S3 conditional recording storage | Critical | ✅ Code done — needs bucket setup |
| 4 | Increase DB connection pool | High | ✅ Done |
| 5 | Redis query cache utility | High | ✅ Done (teacher profile cached) |
| 6 | Raise realtime rate limit | High | ✅ Done |
| 7 | JWT blacklist for logout | Medium | ✅ Done |
| 8 | Cap session arrays | Medium | ✅ Already done (SESSION_LIMIT=5) |
| 9 | Add compound DB indexes | Medium | ✅ Code done — run createIndexes.js |
| 10 | Paginate chat history + center list | Medium | ✅ Done |
| 11 | Add Nginx reverse proxy | Low | ⬜ Todo |
| 12 | Add APM / Sentry | Low | ⬜ Todo |

---

## One-time setup commands (run after deploying)

```bash
# 1. Install new packages
cd server && npm install

# 2. Create new DB indexes (safe, non-blocking — run off-peak)
node server/createIndexes.js

# 3. Start the cluster
pm2 start ecosystem.config.cjs --env production
pm2 save
```
