# 🔒 Security Audit — English Learning Platform

**Audited:** April 15, 2026  
**Scope:** Full-stack (Express + MongoDB server · React + Vite frontend)

---

## Current Score: ~7/10 — Here's What You Need for 10/10

You've already built a strong foundation — most apps at this stage have far worse security. Below is everything that's **already excellent**, every gap I found organized by severity, and the exact steps to close each one.

---

## ✅ What You're Already Doing Right

| Area | Status |
|---|---|
| **Password hashing** | bcryptjs with 12 rounds — excellent |
| **JWT auth** | Bearer tokens (not cookies) — CSRF-immune |
| **NoSQL injection protection** | `express-mongo-sanitize` on body/query/params/headers |
| **XSS filtering** | Custom inline sanitizer stripping `<script>`, event handlers, dangerous URIs |
| **HTTP parameter pollution** | Custom HPP preventing duplicate-key attacks |
| **Security headers (Helmet)** | CSP, HSTS (preload), X-Content-Type-Options, Referrer-Policy |
| **Rate limiting** | 8 specialized limiters (login, API, polling, upload, email, etc.) |
| **Account lockout** | 10 failed attempts → 1hr lock, persisted in MongoDB |
| **Password complexity** | Min 8 chars, upper + lower + digit + special, common password blocklist |
| **Password history** | Prevents reuse of last 5 passwords |
| **Reset tokens** | SHA-256 hashed in DB, 1hr expiry, time-constant comparison |
| **2FA (TOTP)** | speakeasy + backup codes support |
| **Session management** | Max 5 concurrent sessions, 7-day expiry, hourly cleanup |
| **Multi-tenant isolation** | Per-center DB + JWT `centerId` guard on every auth middleware |
| **Input validation** | express-validator on all major endpoints |
| **Path traversal guards** | Regex allowlists on file download params (`/^[a-zA-Z0-9_-]{1,100}$/`) |
| **File type validation** | Multer `fileFilter` + MIME type checks on all upload endpoints |
| **Error handling** | Stack traces hidden in production, operational/unexpected error separation |
| **Audit logging** | Super admin actions logged to AuditLog collection |
| **Graceful shutdown** | Proper drain order (HTTP → Socket → DB) |
| **.env in .gitignore** | No secrets found in git history |
| **Impersonation tokens** | 30-minute expiry, audit-logged, clearly marked in JWT |

---

## 🔴 CRITICAL — Fix These First

### 1. Real API Keys & Secrets Hardcoded in `.env` Files That Are Checked Into Working Copy

**Files:** [server/.env](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/.env)

Your `server/.env` has **real production secrets** in it:
- `JWT_SECRET` — the actual 128-char hex key
- `GEMINI_API_KEY` — a working Google API key (`AIzaSy...`)
- `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` — live Agora credentials
- `EMAIL_PASSWORD` — Gmail app password
- `VAPID_PRIVATE_KEY` — Web Push signing key
- `SESSION_SECRET`

> [!CAUTION]
> Even though `.env` is in `.gitignore`, these are **OneDrive-synced files**. They're sitting in your cloud storage unencrypted. If your machine or OneDrive account is compromised, every secret leaks.

**Fix:**
1. **Rotate ALL the keys listed above immediately** — generate new ones and deploy them to your production server only
2. Use `.env.example` (you already have one) with placeholder values for development
3. On production, use a secrets manager (e.g., Doppler, HashiCorp Vault, or at minimum `systemd` environment files with `0600` permissions)
4. Never store real secrets on a developer machine — use different dev keys

---

### 2. `ENCRYPTION_KEY` Not Set — Field-Level Encryption Is a No-Op

**File:** [encryption.js](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/utils/encryption.js)

```js
function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;  // ← silently returns null
  return Buffer.from(hex, 'hex');
}

export function encryptField(text) {
  const key = getKey();
  if (!text || !key) return text; // ← returns PLAINTEXT
```

Your AES-256-GCM encryption for sensitive PII (bank details etc.) silently falls back to **storing plaintext** if `ENCRYPTION_KEY` is missing from `.env`. This env var isn't in your `.env` file, isn't in `requiredEnvVars` in `config.js`, and has no startup warning.

**Fix:**
1. Add `ENCRYPTION_KEY` to the `requiredEnvVars` array in `config.js` (or add a loud startup warning)
2. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. Add it to `server/.env` and deploy it to production

---

### 3. Super Admin Login Has No Rate Limiting

**File:** [superAdminRoutes.js:25](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/routes/superAdminRoutes.js#L25)

```js
router.post('/login', async (req, res) => {
```

Unlike teacher/student/admin login (which all use `loginLimiter`), the super admin login endpoint has **no rate limiter** and **no account lockout**. This is the most privileged account in the entire system.

**Fix:**
```diff
+import { loginLimiter } from '../middleware/rateLimiter.js';

-router.post('/login', async (req, res) => {
+router.post('/login', loginLimiter, async (req, res) => {
```

---

### 4. DB Slug Injection — No Validation on `centerSlug` in `getDb()`

**File:** [dbManager.js:13-19](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/config/dbManager.js#L13-L19)

```js
export const getDb = async (centerSlug) => {
  if (connections[centerSlug]) return connections[centerSlug];
  const uri = `${process.env.DB_BASE_URI}/${centerSlug}`;
  // ← No validation! If slug = "admin?authSource=admin", this corrupts the URI
```

The `centerSlug` is used to construct a MongoDB URI via string interpolation. If an attacker can influence the slug (e.g., via the `x-center-slug` header), they could inject MongoDB connection string parameters.

The `tenantMiddleware` validates that the slug matches an existing center in the DB, which provides *some* protection — but the slug itself is sourced from user-controlled headers and subdomains.

**Fix:**
```js
export const getDb = async (centerSlug) => {
  // Strict slug format: lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/.test(centerSlug)) {
    throw new Error(`Invalid center slug: ${centerSlug}`);
  }
  if (connections[centerSlug]) return connections[centerSlug];
  const uri = `${process.env.DB_BASE_URI}/${encodeURIComponent(centerSlug)}`;
  // ...
};
```

---

## 🟠 HIGH — Should Fix Before Production

### 5. JWT Expiry Too Long (7 Days) + No Refresh Token Rotation

**File:** [config.js:48](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/config/config.js#L48)

```js
jwtExpiry: process.env.JWT_EXPIRY || '7d',
```

A **7-day** JWT is valid for a week even if the user is deactivated, their password is changed, or their session is revoked. JWTs are stateless — once issued, they can't be revoked.

**Fix:**
- Shorten JWT expiry to **15 minutes**
- Implement a **refresh token** (opaque, stored in DB) with 7-day expiry
- On token refresh, check that the user is still active and the session is still valid
- Alternatively, add a JWT blacklist (checked on every request) — but refresh tokens are the standard approach

---

### 6. Socket.IO CORS Is Hardcoded to Single Origin

**File:** [socketServer.js:8-12](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/socketServer.js#L8-L12)

```js
cors: {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
```

While your Express CORS checks `config.corsOrigins` + verified custom domains dynamically, Socket.IO's CORS only accepts **one** origin. In a multi-tenant setup with custom domains, this will either:
- Break WebSocket connections from custom domains, or
- Force you to use `origin: '*'` (dangerous)

**Fix:** Use the same dynamic origin checker from your Express CORS:
```js
cors: {
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      const match = await Center.findOne({ customDomain: hostname, domainVerified: true });
      if (match) return callback(null, true);
    } catch (_) {}
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
},
```

---

### 7. `/uploads` Served as Static Files Without Authentication

**File:** [index.js:93](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/index.js#L93)

```js
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

Anyone can access uploaded files (logos, PDFs, recordings, homework audio) by guessing the URL. Recordings may contain private lesson content, homework submissions may contain student PII.

**Fix:**
- Remove the static file serving for sensitive directories
- Serve files through authenticated API routes (you already do this for recordings via `/recordings/:id/stream`)
- For public assets like logos/favicons, keep static serving but move them to a separate `public-uploads/` directory

---

### 8. OTP Generated with `Math.random()` — Not Cryptographically Secure

**File:** [superAdminRoutes.js:562](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/routes/superAdminRoutes.js#L562)

```js
const code = String(Math.floor(100000 + Math.random() * 900000));
```

`Math.random()` is **not cryptographically secure**. An attacker who can observe the timing of multiple OTP generations could predict future OTPs (though this is a moderate practical risk).

**Fix:**
```js
import crypto from 'crypto';
const code = String(crypto.randomInt(100000, 999999));
```

---

### 9. `2FA verify-2fa-login` Accepts `role` from Client — Potential Privilege Escalation

**File:** [authRoutes.js:170](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/routes/authRoutes.js#L170)

```js
const { tempUserId, twoFactorToken, backupCode, role } = req.body;
// ...
switch (role) {
  case "admin":   UserModel = getAdminModel(req.db);   break;
  case "teacher": UserModel = getTeacherModel(req.db); break;
  case "student": UserModel = getStudentModel(req.db); break;
```

The client tells the server which model/role to look up. If a student knows a teacher's `_id`, they could send `role: "teacher"` and `tempUserId: <teacher_id>` to get a **teacher-role JWT**. The only protection is needing the correct 2FA code — but this still elevates attack surface.

**Fix:** Instead of trusting the client's `role`, include the role in the initial 202 response or store the pending 2FA login in a server-side temporary store:
```js
// At initial login (line 90-95), store the pending session:
const pending2FA_data = { userId: user._id, role, centerId: req.center.slug };
const pending2FA_token = jwt.sign(pending2FA_data, config.jwtSecret, { expiresIn: '5m' });

// In verify-2fa-login, decode this token instead of trusting req.body.role:
const pending = jwt.verify(req.body.pendingToken, config.jwtSecret);
```

---

### 10. MongoDB Connection Without Authentication

**File:** [server/.env:3](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/.env#L3)

```
MONGO_URI=mongodb://localhost:27017/english_learning_platform
```

Your MongoDB URIs use **no username/password**. If MongoDB is exposed to any network (even a VPC), anyone can connect.

**Fix:**
1. Enable MongoDB authentication: create an admin user and per-database users
2. Use URIs like: `mongodb://user:password@localhost:27017/english_learning_platform?authSource=admin`
3. Bind MongoDB to `127.0.0.1` in `mongod.conf`

---

## 🟡 MEDIUM — Harden Before Scale

### 11. Token Stored in `sessionStorage` with `localStorage` Fallback

**File:** [src/api.js:18-19](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/src/api.js#L18-L19)

```js
const getToken = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key);
```

Good that you default to `sessionStorage` — but the `localStorage` fallback means XSS can read tokens that never expire from tab to tab. Consider removing the `localStorage` fallback once migration is complete.

---

### 12. No `Secure` / `SameSite` Attributes on Any State

The CSRF posture comment in `security.js` says cookies `MUST use SameSite=Strict + Secure + HttpOnly` — but you don't actually set any cookies. This is fine **now**, but if you ever add refresh tokens as cookies, ensure these flags are set.

---

### 13. Missing Validation on Several Route Files

The `validation.js` middleware has excellent validators, but not all routes use them:
- `superAdminRoutes.js` — no input validation middleware on any endpoint
- `centerRegistrationRoutes.js` — should validate slug format, email, center name
- Many routes validate via inline checks instead of the `express-validator` chain — inconsistent and easier to miss

**Fix:** Apply `validate*` middleware from `validation.js` to all endpoints. At minimum, validate MongoDB ObjectIDs on every `:id` param.

---

### 14. Root Endpoint Leaks API Structure

**File:** [index.js:178-201](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/index.js#L178-L201)

```js
app.get("/", (req, res) => {
  res.json({
    message: "📘 English Teaching Platform API is running!",
    endpoints: {
      teachers: { "GET /api/teachers": "Get all teachers", ... },
```

This exposes your entire API surface to anyone who hits the root URL. Helpful for dev, dangerous in production.

**Fix:** Only show this in development:
```js
app.get("/", (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.json({ message: "API is running" });
  }
  // ... full endpoint list
});
```

---

### 15. Console.log Leaks in Production

Throughout the codebase: `console.log`, `console.error` with potentially sensitive data like email addresses, IPs, user IDs. In production, use structured logging (you have `logger.js`!) and avoid `console.*`.

**Fix:** Replace all `console.log/error/warn` calls with `logger.info/error/warn` and ensure prod logs are secured.

---

### 16. Socket.IO `maxHttpBufferSize` = 10MB for PDFs

**File:** [socketServer.js:13](file:///c:/Users/speak/OneDrive/Documents/English%20learning%20platform/server/socketServer.js#L13)

```js
maxHttpBufferSize: 10e6 // 10MB for PDF uploads
```

A malicious client can send 10MB payloads via WebSocket. Combined with no per-socket rate limiting, this enables easy memory exhaustion.

**Fix:** Either reduce the limit or add per-socket throttling for large payloads.

---

### 17. No HTTPS Enforcement in Production Config

Your Helmet config has `upgradeInsecureRequests: []` (good!), but there's no explicit enforcement that the server runs behind TLS. Add to your production checklist:
- Ensure your reverse proxy (Nginx/Caddy) terminates TLS
- Set `TRUST_PROXY=true` in production `.env`
- Consider adding `Strict-Transport-Security` with `preload` (✅ already done via Helmet)

---

## 🔵 LOW — Nice-to-Have Improvements

### 18. Add `aud` (Audience) and `iss` (Issuer) Claims to JWTs

Your JWTs contain `id`, `email`, `role`, `centerId` — but no `aud` or `iss`. Adding these standard claims prevents token misuse across different services.

```js
const token = jwt.sign(
  { ...jwtPayload, iss: 'english-learning-platform', aud: 'api' },
  config.jwtSecret,
  { expiresIn: config.jwtExpiry }
);
```

---

### 19. Add Subresource Integrity (SRI) for CDN Assets

If you load any scripts/styles from CDNs (Google Fonts, etc.), add `integrity` + `crossorigin` attributes to prevent CDN compromise.

---

### 20. Add Security.txt

Create `/.well-known/security.txt` so security researchers can responsibly report vulnerabilities:
```
Contact: mailto:security@yourdomain.com
Expires: 2027-04-15T00:00:00.000Z
Preferred-Languages: en
```

---

### 21. Consider Content-Disposition on All Downloads

File download responses should include `Content-Disposition: attachment` (not `inline` for recordings) to prevent browsers from executing uploaded content in the app's origin.

---

### 22. Add CSP `report-uri` or `report-to`

Your CSP is good but doesn't report violations. Add `reportUri` to Helmet so you know when policies are triggered.

---

## 📋 Priority Checklist

| # | Severity | Item | Effort |
|---|---|---|---|
| 1 | 🔴 Critical | Rotate all leaked secrets, use secrets manager | 2hr |
| 2 | 🔴 Critical | Set `ENCRYPTION_KEY` env var | 15min |
| 3 | 🔴 Critical | Add rate limiter to super admin login | 5min |
| 4 | 🔴 Critical | Validate `centerSlug` before DB URI construction | 15min |
| 5 | 🟠 High | Shorten JWT expiry + add refresh tokens | 4hr |
| 6 | 🟠 High | Fix Socket.IO CORS for multi-tenant | 30min |
| 7 | 🟠 High | Authenticate `/uploads` static file serving | 1hr |
| 8 | 🟠 High | Use `crypto.randomInt` for OTP generation | 5min |
| 9 | 🟠 High | Fix 2FA role from client-side trust | 1hr |
| 10 | 🟠 High | Enable MongoDB authentication | 1hr |
| 11 | 🟡 Medium | Remove localStorage token fallback | 15min |
| 12 | 🟡 Medium | Validate all route inputs with express-validator | 3hr |
| 13 | 🟡 Medium | Remove API structure from root endpoint in production | 5min |
| 14 | 🟡 Medium | Replace console.* with structured logger | 2hr |
| 15 | 🟡 Medium | Reduce Socket.IO buffer / add per-socket throttling | 30min |
| 16 | 🟡 Medium | HTTPS enforcement documentation | 15min |
| 17 | 🔵 Low | Add `iss`/`aud` to JWTs | 15min |
| 18 | 🔵 Low | Add `security.txt` | 5min |
| 19 | 🔵 Low | CSP report-uri | 15min |

---

> [!IMPORTANT]
> Items 1-4 (Critical) should be fixed **before any production deployment**. Items 5-10 should be fixed within the first sprint after launch. The rest can be addressed as you scale.

Want me to implement any of these fixes? I'd suggest starting with the 4 critical items — I can do all of them in one pass.
