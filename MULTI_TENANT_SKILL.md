# MULTI-TENANT INTEGRATION SKILL
# English Learning Platform — Separate Database Architecture
# Claude must read this ENTIRE file before writing any code related to
# multi-tenancy, centers, super admin, tenant routing, or database connections.

---

## CODEBASE CONTEXT — READ FIRST

This is an existing production English Learning Platform.
Stack: Node.js + Express + MongoDB (Mongoose 8.x) + React (Vite) + Socket.IO
Entry point: `server/index.js`
Config: `server/config/config.js` (uses dotenv, validates required env vars on startup)
Auth: JWT tokens, `server/middleware/authMiddleware.js`
Email: `server/utils/emailService.js` (nodemailer, config-driven)

### Current Single-Tenant State
- One MongoDB connection via `MONGO_URI` in `.env`
- `mongoose.connect(process.env.MONGO_URI, {...})` in `server/index.js`
- Models live in `server/models/`:
  Admin, Teacher, Student, SubAdmin, Booking, Payment,
  PaymentTransaction, Lesson, GroupChat, DirectMessage,
  RecurringPattern, Assignment etc.
- Auth middleware exports from `server/middleware/authMiddleware.js`:
  verifyToken, verifyAdmin, verifyTeacher, verifyStudent,
  verifyAdminOrTeacher, verifySubAdmin, verifyOwnership

### What Multi-Tenancy Adds
- A MASTER database (db_master) that tracks all centers
- One CENTER database per organization (db_{slug})
- A Super Admin role above all existing roles
- Tenant resolution middleware before all center routes
- The existing Admin becomes "Center Admin" scoped to one center

---

## DATABASE ARCHITECTURE

### Master Database
```
env var: MASTER_DB_URI
db name: db_master
collections:
  - centers      (all registered centers, status, branding, plan)
  - superadmins  (platform owner accounts — only you)
```

### Center Databases
```
env var base: DB_BASE_URI  (MongoDB URI without db name at the end)
naming:       db_{centerSlug}  e.g. db_greenfield, db_sunrise
collections:  admins, teachers, students, bookings, payments,
              paymenttransactions, lessons, assignments, groupchats,
              directmessages, recurringpatterns, subadmins
              (same collections as current single-tenant app)
```

### Connection Manager — THE ONLY WAY TO ACCESS CENTER DBS
```javascript
// server/config/dbManager.js  (NEW FILE — create this)
import mongoose from 'mongoose';

const connections = {};

const mongooseOptions = {
  maxPoolSize: 5,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
};

export const getDb = async (centerSlug) => {
  if (connections[centerSlug]) return connections[centerSlug];
  const uri = `${process.env.DB_BASE_URI}/${centerSlug}`;
  const conn = await mongoose.createConnection(uri, mongooseOptions);
  connections[centerSlug] = conn;
  console.log(`✅ DB connected: db_${centerSlug}`);
  return conn;
};

export const getMasterDb = () => {
  // Master DB uses the default mongoose connection (index.js still connects it)
  return mongoose.connection;
};
```

RULE: Every route that touches center data MUST use `getDb(req.center.slug)`.
NEVER import models directly in center routes — register them on the connection.

---

## MODEL REGISTRATION PATTERN

Each center has its own mongoose connection so models must be registered
on that connection, not globally. Pattern:

```javascript
// In any center route file
import { getDb } from '../config/dbManager.js';
import { teacherSchema } from '../schemas/teacherSchema.js'; // raw schema export

const getTeacherModel = async (centerSlug) => {
  const db = await getDb(centerSlug);
  return db.models.Teacher || db.model('Teacher', teacherSchema);
};

// In route handler:
router.get('/teachers', tenantMiddleware, verifyToken, async (req, res) => {
  const Teacher = await getTeacherModel(req.center.slug);
  const teachers = await Teacher.find();
  res.json(teachers);
});
```

IMPORTANT: Split existing model files into two exports:
- `server/schemas/teacherSchema.js`  — exports raw mongoose.Schema instance
- `server/models/Teacher.js`         — keeps existing default export (untouched)
This way existing single-tenant code stays untouched during migration.

---

## MASTER DB SCHEMAS (New Files)

### Center Schema — `server/models/master/Center.js`
```javascript
import mongoose from 'mongoose';

const centerSchema = new mongoose.Schema({
  centerName:   { type: String, required: true, trim: true },
  slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  customDomain: { type: String, default: null },
  adminEmail:   { type: String, required: true, lowercase: true },
  dbName:       { type: String, required: true }, // e.g. "db_greenfield"

  plan: {
    type:    String,
    enum:    ['free', 'basic', 'pro', 'enterprise'],
    default: 'free',
  },

  // GATED REGISTRATION — default is always pending, never active on creation
  status: {
    type:    String,
    enum:    ['pending', 'active', 'suspended', 'rejected'],
    default: 'pending',
  },

  // Temporary storage during pending state — cleared after center DB admin is created
  pendingPasswordHash: { type: String, default: null, select: false },

  branding: {
    logo:           { type: String, default: null },
    primaryColor:   { type: String, default: '#4F46E5' },
    secondaryColor: { type: String, default: '#E0E7FF' },
    fontFamily:     { type: String, default: 'Inter' },
    favicon:        { type: String, default: null },
  },

  phone:         String,
  country:       String,
  registeredBy:  String,

  approvedAt:   Date,
  approvedBy:   String,
  rejectedAt:   Date,
  rejectReason: String,

  maxTeachers: { type: Number, default: 5 },
  maxStudents: { type: Number, default: 50 },

}, { timestamps: true });

export default mongoose.model('Center', centerSchema);
```

### Super Admin Schema — `server/models/master/SuperAdmin.js`
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const sessionSchema = new mongoose.Schema({
  token:      { type: String, required: true },
  loginTime:  { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
});

const superAdminSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'superadmin' },
  active:    { type: Boolean, default: true },
  sessions:  [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret:  String,
}, { timestamps: true });

export default mongoose.model('SuperAdmin', superAdminSchema);
```

---

## ENV VARIABLES TO ADD

```env
# .env additions — DO NOT remove or change existing MONGO_URI
# MONGO_URI stays — index.js still uses it for master DB

MASTER_DB_URI=mongodb+srv://user:pass@cluster/db_master
DB_BASE_URI=mongodb+srv://user:pass@cluster
# DB_BASE_URI is the URI WITHOUT a database name at the end
# Center DBs are formed as: DB_BASE_URI + "/" + centerSlug

SUPER_ADMIN_EMAIL=you@youremail.com
CDN_BASE_URL=https://cdn.yourapp.com
```

Update `server/config/config.js` — ADD these fields inside the config object:
```javascript
masterDbUri:     process.env.MASTER_DB_URI,
dbBaseUri:       process.env.DB_BASE_URI,
superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
cdnBaseUrl:      process.env.CDN_BASE_URL || '',
```

Update `requiredEnvVars` array in config.js to include:
`'MASTER_DB_URI'` and `'DB_BASE_URI'`

---

## TENANT MIDDLEWARE — `server/middleware/tenantMiddleware.js` (NEW FILE)

```javascript
import Center from '../models/master/Center.js';
import { getDb } from '../config/dbManager.js';

/**
 * Resolves the center from subdomain or custom domain.
 * Attaches req.center (Center doc) and req.db (mongoose connection).
 *
 * Apply to ALL center-specific routes.
 * Do NOT apply to:
 *   /api/register-center
 *   /api/super-admin/*
 */
export const tenantMiddleware = async (req, res, next) => {
  try {
    const host = req.headers.host || '';

    // 1. Try custom domain first (e.g. app.greenfieldacademy.com)
    const byCustomDomain = await Center.findOne({
      customDomain: host,
      status: 'active',
    });

    if (byCustomDomain) {
      req.center = byCustomDomain;
      req.db = await getDb(byCustomDomain.slug);
      return next();
    }

    // 2. Try subdomain: greenfield.yourapp.com → slug = "greenfield"
    let slug = null;
    const parts = host.split('.');
    if (parts.length >= 3) {
      slug = parts[0];
    }

    // 3. Fallback: read from header (useful for mobile apps / API clients)
    if (!slug) {
      slug = req.headers['x-center-slug'];
    }

    if (!slug) {
      return res.status(400).json({ success: false, message: 'Center not identified' });
    }

    const center = await Center.findOne({ slug, status: 'active' });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found or inactive' });
    }

    req.center = center;
    req.db = await getDb(center.slug);
    next();
  } catch (err) {
    console.error('Tenant middleware error:', err);
    res.status(500).json({ success: false, message: 'Tenant resolution failed' });
  }
};
```

---

## SUPER ADMIN MIDDLEWARE — `server/middleware/superAdminMiddleware.js` (NEW FILE)

```javascript
import jwt from 'jsonwebtoken';
import SuperAdmin from '../models/master/SuperAdmin.js';
import { config } from '../config/config.js';

export const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');
    if (!superAdmin || !superAdmin.active) {
      return res.status(403).json({ success: false, message: 'Super admin account inactive' });
    }

    req.superAdmin = superAdmin;
    req.user = decoded; // consistent with existing verifyToken pattern
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
```

---

## JWT TOKEN STRUCTURE

Super Admin:
```javascript
jwt.sign(
  { id: superAdmin._id, role: 'superadmin', email: superAdmin.email },
  config.jwtSecret,
  { expiresIn: config.jwtExpiry }
)
```

Center Admin (existing Admin model, now center-scoped):
```javascript
jwt.sign(
  { id: admin._id, role: 'admin', email: admin.email, centerId: center.slug },
  config.jwtSecret,
  { expiresIn: config.jwtExpiry }
)
```

Teacher and Student (same addition of centerId):
```javascript
jwt.sign(
  { id: user._id, role: 'teacher'|'student', email: user.email, centerId: center.slug },
  config.jwtSecret,
  { expiresIn: config.jwtExpiry }
)
```

RULE: Every non-superadmin token MUST include `centerId`.
The existing `verifyToken` in `authMiddleware.js` does NOT need to change —
it decodes and attaches req.user. centerId is then at `req.user.centerId`.

---

## UPDATING EXISTING AUTH LOGIN ROUTES

The existing login routes in `server/routes/authRoutes.js` need:
1. `tenantMiddleware` added as first middleware
2. Use `req.db` to find users instead of the global model
3. Include `centerId: req.center.slug` in the JWT payload

Pattern (apply to admin, teacher, and student login routes):
```javascript
// BEFORE (single tenant):
router.post('/admin/login', loginLimiter, async (req, res) => {
  const admin = await Admin.findOne({ email });
  // ...
  const token = jwt.sign({ id: admin._id, role: 'admin' }, config.jwtSecret, ...);
});

// AFTER (multi-tenant):
router.post('/admin/login', tenantMiddleware, loginLimiter, async (req, res) => {
  const Admin = req.db.models.Admin || req.db.model('Admin', adminSchema);
  const admin = await Admin.findOne({ email });
  // ... rest of logic unchanged ...
  const token = jwt.sign(
    { id: admin._id, role: 'admin', email: admin.email, centerId: req.center.slug },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );
});
```

Super Admin has its OWN separate login endpoint at `/api/super-admin/login`.
Super Admin NEVER goes through tenantMiddleware.

---

## GATED REGISTRATION FLOW

```
1. POST /api/register-center  (public, no auth, no tenantMiddleware)
   Body: { centerName, slug, adminEmail, password, phone, country }

2. Backend:
   a. Validate slug is unique in Center master collection
   b. Validate slug format: lowercase, alphanumeric + hyphens only
   c. Hash the password with bcrypt
   d. Create Center doc in MASTER DB:
      { status: "pending", pendingPasswordHash: hashedPw, ... }
   e. Send email to adminEmail: "Registration received, pending approval"
   f. Send notification email to process.env.SUPER_ADMIN_EMAIL
   g. Respond: { message: "Registration received. Pending approval." }

3. Super Admin reviews in dashboard
   GET /api/super-admin/centers?status=pending

4. Super Admin approves:
   PATCH /api/super-admin/centers/:id/approve

5. On approve backend:
   a. center.status → "active"
   b. db = await getDb(center.slug)  (creates the database)
   c. Register Admin model on db
   d. Create admin account in CENTER DB using center.pendingPasswordHash
   e. center.pendingPasswordHash = null  (security: clear it)
   f. center.approvedAt = new Date()
   g. center.approvedBy = req.superAdmin._id
   h. Save center
   i. Send welcome email to adminEmail with login URL:
      `${config.frontendUrl}/${center.slug}/login` or subdomain URL
```

---

## SUPER ADMIN ROUTES — `server/routes/superAdminRoutes.js` (NEW FILE)

All routes prefixed: `/api/super-admin/`
All routes protected by: `verifySuperAdmin` middleware
None of these routes use `tenantMiddleware`.

```
POST   /api/super-admin/login
GET    /api/super-admin/centers              — all centers with filters
GET    /api/super-admin/centers/pending      — pending only
PATCH  /api/super-admin/centers/:id/approve
PATCH  /api/super-admin/centers/:id/reject   Body: { rejectReason }
PATCH  /api/super-admin/centers/:id/suspend
PATCH  /api/super-admin/centers/:id/activate
GET    /api/super-admin/stats                — platform-wide counts
POST   /api/super-admin/impersonate/:slug    — returns temp 1hr admin token
PATCH  /api/super-admin/centers/:id/plan    Body: { plan }
PATCH  /api/super-admin/centers/:id/branding
```

Impersonation token shape:
```javascript
jwt.sign({
  id: 'superadmin-impersonation',
  role: 'admin',
  centerId: center.slug,
  isImpersonation: true,
  impersonatedBy: req.superAdmin._id.toString(),
}, config.jwtSecret, { expiresIn: '1h' })
```

---

## BRANDING / CENTER CONFIG ENDPOINT

```javascript
// GET /api/center/config  — public, no auth, needs tenantMiddleware
router.get('/config', tenantMiddleware, async (req, res) => {
  const { centerName, slug, branding, plan } = req.center;
  res.json({
    success: true,
    center: { centerName, slug, plan },
    branding, // logo, primaryColor, secondaryColor, fontFamily, favicon
  });
});

// PATCH /api/center/branding — center admin updates their own branding
router.patch('/branding', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  const { primaryColor, secondaryColor, fontFamily, logo, favicon } = req.body;
  // Update the Center doc in MASTER DB (not center DB)
  await Center.findByIdAndUpdate(req.center._id, {
    'branding.primaryColor':   primaryColor   || req.center.branding.primaryColor,
    'branding.secondaryColor': secondaryColor || req.center.branding.secondaryColor,
    'branding.fontFamily':     fontFamily     || req.center.branding.fontFamily,
    'branding.logo':           logo           !== undefined ? logo   : req.center.branding.logo,
    'branding.favicon':        favicon        !== undefined ? favicon : req.center.branding.favicon,
  });
  res.json({ success: true, message: 'Branding updated' });
});
```

---

## FILE STRUCTURE — ALL NEW FILES

```
server/
├── config/
│   └── dbManager.js                      ← NEW: connection pool manager
├── middleware/
│   ├── tenantMiddleware.js               ← NEW: resolves center per request
│   └── superAdminMiddleware.js           ← NEW: super admin auth
├── models/
│   └── master/
│       ├── Center.js                     ← NEW: center registry
│       └── SuperAdmin.js                 ← NEW: platform owner accounts
├── schemas/                              ← NEW FOLDER
│   ├── teacherSchema.js                  ← Extracted raw schema from Teacher.js
│   ├── studentSchema.js                  ← Extracted raw schema from Student.js
│   ├── adminSchema.js                    ← Extracted raw schema from Admin.js
│   ├── bookingSchema.js
│   ├── paymentSchema.js
│   ├── paymentTransactionSchema.js
│   ├── lessonSchema.js
│   ├── assignmentSchema.js
│   ├── groupChatSchema.js
│   ├── directMessageSchema.js
│   ├── recurringPatternSchema.js
│   └── subAdminSchema.js
├── routes/
│   ├── centerRegistrationRoutes.js       ← NEW: POST /api/register-center
│   ├── centerConfigRoutes.js             ← NEW: GET /api/center/config + branding PATCH
│   └── superAdminRoutes.js              ← NEW: all /api/super-admin/* routes
└── scripts/
    └── createSuperAdmin.js              ← NEW: one-time script, run once in terminal
```

---

## ADDING TO `server/index.js`

```javascript
// Add these imports at the top:
import Center from './models/master/Center.js';
import SuperAdmin from './models/master/SuperAdmin.js';
import centerRegistrationRoutes from './routes/centerRegistrationRoutes.js';
import centerConfigRoutes from './routes/centerConfigRoutes.js';
import superAdminRoutes from './routes/superAdminRoutes.js';

// Add these routes (before the error handler):
app.use('/api/register-center', centerRegistrationRoutes);
app.use('/api/center', centerConfigRoutes);
app.use('/api/super-admin', superAdminRoutes);

// The existing mongoose.connect() in index.js now serves as the MASTER DB connection.
// Change MONGO_URI in .env to point to db_master:
// MONGO_URI=mongodb+srv://user:pass@cluster/db_master
// (this is the same value as MASTER_DB_URI — they can be the same string)
```

---

## SCRIPTS — `server/scripts/createSuperAdmin.js`

Run once to create your super admin account:
```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import SuperAdmin from '../models/master/SuperAdmin.js';

async function createSuperAdmin() {
  await mongoose.connect(process.env.MASTER_DB_URI);
  const existing = await SuperAdmin.findOne({ email: process.env.SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log('⚠️  Super admin already exists');
    process.exit(0);
  }
  const password = await bcrypt.hash('changeme123!', 12);
  await SuperAdmin.create({
    firstName: 'Super',
    lastName: 'Admin',
    email: process.env.SUPER_ADMIN_EMAIL,
    password,
    role: 'superadmin',
  });
  console.log('✅ Super admin created. Email:', process.env.SUPER_ADMIN_EMAIL);
  console.log('⚠️  Password: changeme123! — change this immediately on first login!');
  process.exit(0);
}

createSuperAdmin().catch(e => { console.error(e); process.exit(1); });
```

Run with: `node server/scripts/createSuperAdmin.js`

---

## MIGRATION STRATEGY — DO NOT BREAK EXISTING APP

### Phase 1 — Infrastructure Only (app behavior unchanged)
1. Create `server/config/dbManager.js`
2. Create `server/models/master/Center.js` and `SuperAdmin.js`
3. Add `MASTER_DB_URI`, `DB_BASE_URI`, `SUPER_ADMIN_EMAIL` to `.env`
4. Update `server/config/config.js` with new fields
5. Change `MONGO_URI` in `.env` to point to `db_master`
6. Create `server/middleware/tenantMiddleware.js` and `superAdminMiddleware.js`
7. Create new route files (register-center, center-config, super-admin)
8. Register new routes in `server/index.js`
9. Run `createSuperAdmin.js` once
10. ✅ Test: existing app still works fully, new endpoints exist

### Phase 2 — First Center Setup
1. Register first center via `POST /api/register-center`
2. Approve it as super admin via `PATCH /api/super-admin/centers/:id/approve`
3. Verify center DB is created and center admin can log in
4. Add `tenantMiddleware` to ONE route group (e.g. `/api/teachers`)
5. Extract `teacherSchema.js` and update that route group
6. ✅ Test that route group using center subdomain header

### Phase 3 — Full Migration (one route group at a time)
1. Extract all schemas to `server/schemas/`
2. Add `tenantMiddleware` to each route group
3. Update all route handlers to use `req.db` instead of global models
4. Update JWT signing in all login routes to include `centerId`
5. ✅ Full regression test per route group before moving to next

---

## ABSOLUTE RULES — NEVER VIOLATE

1. NEVER access a center DB with a hardcoded connection string
2. ALWAYS use `getDb(req.center.slug)` — never derive DB from `req.user.centerId`
3. ALWAYS apply `tenantMiddleware` BEFORE `verifyToken` on center routes
4. NEVER apply `tenantMiddleware` to `/api/super-admin/*`
5. NEVER apply `tenantMiddleware` to `/api/register-center`
6. Registration ALWAYS creates `status: "pending"` — NEVER "active" directly
7. Center DB is ONLY created on Super Admin approval — never on registration
8. `pendingPasswordHash` on Center doc is cleared immediately after
   center DB admin account is created — never leave it populated on active centers
9. Money values stay as integers (cents) — existing project rule, unchanged
10. Super Admin JWT always has `role: "superadmin"`, never `role: "admin"`
11. Before writing any route handler, ask:
    "Am I using `req.db` or a global model import?"
    If it touches center data, it MUST be `req.db`.
12. Do NOT change the existing `verifyToken` function in `authMiddleware.js` —
    it works as-is. Just make sure JWT signing now includes `centerId`.

---

## CHECKLIST — BEFORE SUBMITTING ANY MULTI-TENANT CODE

- [ ] Does this route need tenantMiddleware? Is it the FIRST middleware applied?
- [ ] Am I using `req.db` to register/get models, not importing them globally?
- [ ] Does the JWT I'm signing include `centerId`? (unless it's superadmin)
- [ ] Is `status: "pending"` the default for new center registration?
- [ ] Could this route accidentally expose cross-center data? (check all queries)
- [ ] Have I updated `config.js` if a new env var is needed?
- [ ] Do emails reference `config.appName` and `config.frontendUrl`, not hardcoded values?
- [ ] Is `pendingPasswordHash` being cleared after center DB admin is created?

---

## EXISTING PATTERNS TO FOLLOW

When writing new code, match these patterns from the existing codebase:

Error responses:
```javascript
res.status(400).json({ success: false, message: "..." });
```

Success responses:
```javascript
res.json({ success: true, data: ..., message: "..." });
```

Async route handlers:
```javascript
router.get('/', middleware, async (req, res) => {
  try {
    // logic
  } catch (err) {
    console.error('❌ Error description:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});
```

Email sending (always non-blocking in routes):
```javascript
try {
  await sendWelcomeEmail(user);
} catch (e) {
  console.error('Welcome email failed:', e.message);
}
// do not let email failure block the response
```

---

*Read this entire file before writing any multi-tenant related code.*
*If anything contradicts the existing codebase, flag it and ask before assuming.*
*The existing code in server/routes/ and server/models/ is the source of truth
 for patterns — match the same style: async/await, error handling, response shape.*