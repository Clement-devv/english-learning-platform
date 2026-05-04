# Multi-Tenant Architecture

## Database Design

```
MongoDB Atlas Cluster
├── db_master              ← master DB (MONGO_URI / MASTER_DB_URI)
│   ├── centers            ← all registered centers
│   └── superadmins        ← platform owner accounts
├── db_greenfield          ← per-center DB (created on approval)
│   ├── admins, teachers, students, bookings, payments ...
├── db_sunrise
│   └── (same collections)
└── db_...
```

The master DB and per-center DBs all live on the same Atlas cluster. The `DB_BASE_URI` env var is the connection string without a database name — the app appends `/{slug}` to form each center's URI.

## Tenant Resolution

Every center request is resolved by `tenantMiddleware` before any auth runs:

1. **Custom domain** — checks `Center.customDomain` field in master DB
2. **Subdomain** — `greenfield.clemify.com` → slug = `greenfield`
3. **Header fallback** — `x-center-slug` header (for mobile apps / API clients)

After resolution, `req.center` (Center document) and `req.db` (mongoose connection) are available to all subsequent middleware and route handlers.

## Connection Pool

`server/config/dbManager.js` manages per-center connections. Connections are cached in memory — a center's connection is created once and reused for subsequent requests.

```js
import { getDb } from '../config/dbManager.js';

// In any center route:
const db = await getDb(req.center.slug);
const Teacher = db.models.Teacher || db.model('Teacher', teacherSchema);
```

Never use global model imports for center data. Always go through `req.db` or `getDb()`.

## Center Lifecycle

```
1. POST /api/register-center
   → status: "pending", password hashed and stored temporarily

2. Super admin reviews in dashboard
   → GET /api/super-admin/centers?status=pending

3. Super admin approves
   → PATCH /api/super-admin/centers/:id/approve
   → center DB is created
   → admin account created in center DB
   → pendingPasswordHash cleared
   → status: "active"
   → welcome email sent to center admin

4. Center admin can now log in at their subdomain
```

## JWT Structure

All tokens from the same `JWT_SECRET`. Role field controls access level.

| Role | centerId field | Middleware |
|---|---|---|
| `superadmin` | absent | `verifySuperAdmin` |
| `admin` | required | `tenantMiddleware` + `verifyToken` + `verifyAdmin` |
| `teacher` | required | `tenantMiddleware` + `verifyToken` + `verifyTeacher` |
| `student` | required | `tenantMiddleware` + `verifyToken` + `verifyStudent` |

## Route Categories

| Route prefix | tenantMiddleware | Auth |
|---|---|---|
| `/api/super-admin/*` | No | `verifySuperAdmin` |
| `/api/register-center` | No | None (public) |
| `/api/v1/public/*` | Internal | None (public) |
| `/api/health/*` | No | None |
| `/api/v1/*` (everything else) | Yes | `verifyToken` + role |

## Key Files

| File | Purpose |
|---|---|
| `server/config/dbManager.js` | `getDb(slug)` — connection pool manager |
| `server/middleware/tenantMiddleware.js` | Resolves center, attaches `req.center` + `req.db` |
| `server/middleware/superAdminMiddleware.js` | JWT verification for super admin routes |
| `server/models/master/Center.js` | Center registry in master DB |
| `server/models/master/SuperAdmin.js` | Super admin accounts in master DB |
| `server/schemas/` | Raw mongoose Schema exports (used per-connection in center routes) |
| `server/routes/superAdminRoutes.js` | All `/api/super-admin/*` endpoints |
| `server/routes/publicRoutes.js` | Public landing page endpoint |

## Landing Pages

Each center can have a public-facing landing page controlled exclusively by the super admin. The landing page data is stored in the `landingPage` field of the Center document (master DB).

- Public endpoint: `GET /api/v1/public/landing-page` (resolved via tenant middleware)
- Super admin manages via: `GET/PATCH /api/super-admin/centers/:id/landing-page`
- Frontend templates: `src/pages/landing-page/templates/` (Classic, Modern, Minimal)
- Super admin editor UI: Websites tab in `src/pages/super-admin/tabs/LandingPagesTab.jsx`
