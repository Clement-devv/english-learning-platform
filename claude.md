# Claude Code — Project Context

## What This Is

A multi-tenant English learning platform. Multiple centers (schools) share one codebase but each has its own MongoDB database. A super admin manages all centers.

## Critical Architecture Rules

### 1. Database Access
- **Master DB** — accessed via the default `mongoose` connection. Holds `Center` and `SuperAdmin` models only.
- **Center DBs** — accessed via `getDb(centerSlug)` from `server/config/dbManager.js`. Each center has its own MongoDB database named after its slug.
- **NEVER** import center models globally. Always register them on the connection returned by `getDb`.

```js
// Correct
const db = await getDb(req.center.slug);
const Teacher = db.models.Teacher || db.model('Teacher', teacherSchema);

// Wrong — never do this
import Teacher from '../models/Teacher.js';
const teacher = await Teacher.find();
```

### 2. Middleware Order (Center Routes)
`tenantMiddleware` MUST come before `verifyToken` on all center routes.
```js
router.get('/teachers', tenantMiddleware, verifyToken, verifyAdmin, handler);
```

### 3. Routes That Must NOT Use tenantMiddleware
- `/api/super-admin/*` — super admin operates across all centers
- `/api/register-center` — no center exists yet
- `/api/v1/public/*` — public endpoints resolved internally
- `/api/health/*` — health checks

### 4. JWT Tokens
- Every non-superadmin token MUST include `centerId: req.center.slug`
- Super admin tokens use `role: 'superadmin'` — never `role: 'admin'`

### 5. Center Registration
- New centers always start with `status: 'pending'`
- Center DB is ONLY created when super admin approves — never on registration
- `pendingPasswordHash` on Center doc is cleared immediately after approval

## Response Conventions

```js
// Error
res.status(400).json({ success: false, message: '...' });

// Success
res.json({ success: true, data: ..., message: '...' });
```

## File Structure Reference

```
server/
├── config/
│   ├── config.js           — env validation, exports config object
│   ├── dbManager.js        — getDb(slug) connection pool
│   └── redis.js            — optional Redis client (null if REDIS_URL not set)
├── middleware/
│   ├── tenantMiddleware.js      — resolves center from subdomain/custom domain/header
│   ├── superAdminMiddleware.js  — JWT verification for super admin routes
│   └── authMiddleware.js        — verifyToken, verifyAdmin, verifyTeacher, verifyStudent
├── models/master/
│   ├── Center.js           — center registry (master DB)
│   └── SuperAdmin.js       — platform owner accounts (master DB)
├── schemas/                — raw mongoose Schema exports (used by center routes via req.db)
├── routes/
│   ├── superAdminRoutes.js — all /api/super-admin/* routes
│   ├── publicRoutes.js     — public landing page endpoint
│   └── v1.js               — main router, mounts all center routes
└── index.js                — app entry, connects master DB, starts server

src/
└── pages/
    ├── landing-page/       — public center landing pages (3 templates)
    └── super-admin/        — super admin dashboard (centers, websites tabs)
```

## Docs

- Architecture deep-dive: [docs/multi-tenant.md](docs/multi-tenant.md)
- Deployment guide: [docs/deployment.md](docs/deployment.md)
- Going live step-by-step: [docs/going-live.md](docs/going-live.md)
- Scalability roadmap: [docs/scalability.md](docs/scalability.md)
- Security audit: [docs/security.md](docs/security.md)
- Code quality audit: [docs/code-quality.md](docs/code-quality.md)
- Frontend design guide: [docs/frontend-guide.md](docs/frontend-guide.md)
- Frontend design system (CSS): [docs/design-system.md](docs/design-system.md)
