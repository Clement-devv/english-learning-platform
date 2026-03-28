# CUSTOM DOMAIN SKILL
# English Learning Platform — Per-Center Custom Domains
# This skill is SEPARATE from all other skills.
# It covers ONLY custom domain support:
# backend verification, Nginx config generation,
# SSL automation, and the center admin UI flow.
#
# READ THESE SKILLS FIRST if working on related systems:
# - MULTI_TENANT_SKILL.md   (Center model, tenantMiddleware)
# - SECURITY_SKILL.md       (CORS, SSL rules)
# - FRONTEND_BRANDING_SKILL.md (center config endpoint)
#
# DO NOT implement this until the app is live in production
# with at least one real center onboard.

---

## WHAT THIS FEATURE DOES

Allows each center to use their own domain instead of a subdomain:

```
WITHOUT this feature:   greenfield.yourapp.com
WITH this feature:      www.greenfieldacademy.com
                        app.sunriseschool.com
                        portal.downtownlanguages.com
```

The center buys their domain, points DNS to your server,
submits it in their admin panel, you verify and activate.
Zero code changes per center — fully configuration-driven.

---

## CODEBASE CONTEXT — READ FIRST

### Existing Infrastructure
- Backend: Node.js + Express, `server/index.js`
- Config: `server/config/config.js` (dotenv, validates on startup)
- Multi-tenant: `tenantMiddleware` already resolves centers by
  subdomain OR customDomain field on Center doc (already built)
- Center model: `server/models/master/Center.js` already has:
  `customDomain: { type: String, default: null }`
  `domainVerified` needs to be ADDED (see schema update below)
- CORS: configured in index.js from `config.corsOrigins`
- Email: `server/utils/emailService.js` (nodemailer)

### What Already Works
The `tenantMiddleware` already handles custom domains:
```javascript
// This code already exists in tenantMiddleware.js:
const byCustomDomain = await Center.findOne({
  customDomain: host,
  status: 'active',
});
if (byCustomDomain) {
  req.center = byCustomDomain;
  req.db = await getDb(byCustomDomain.slug);
  return next();
}
```
So once a custom domain is saved and verified in the DB,
the routing ALREADY works. This skill covers the
verification, SSL, CORS, and admin UI around it.

---

## PHASE 1 — BACKEND (Database + API)

### 1.1 Update Center Schema

Add `domainVerified` to `server/models/master/Center.js`:
```javascript
// ADD these fields to the existing centerSchema:
customDomain:     { type: String, default: null, lowercase: true, trim: true },
domainVerified:   { type: Boolean, default: false },
domainRequestedAt: Date,
domainVerifiedAt:  Date,
domainVerifiedBy:  String, // superAdminId
domainInstructions: {      // DNS instructions sent to center
  type: { type: String, default: 'A' },
  name: { type: String, default: '@' },
  value: String,           // your server IP
},
```

---

### 1.2 DNS Verification Utility

Create `server/utils/domainVerifier.js` (NEW FILE):

```javascript
// server/utils/domainVerifier.js
import dns from 'dns/promises';

/**
 * Check if a domain's A record points to our server IP.
 * Returns true if verified, false if not yet propagated.
 */
export const verifyDomainDns = async (domain, expectedIp) => {
  try {
    // Strip www. prefix for lookup — works for both www and apex
    const lookupDomain = domain.replace(/^www\./, '');

    // Try A record first
    const addresses = await dns.resolve4(lookupDomain);
    if (addresses.includes(expectedIp)) return { verified: true };

    // Try with www prefix as well
    try {
      const wwwAddresses = await dns.resolve4(`www.${lookupDomain}`);
      if (wwwAddresses.includes(expectedIp)) return { verified: true };
    } catch { /* ignore */ }

    return {
      verified: false,
      message: `Domain points to ${addresses[0]} but expected ${expectedIp}`,
    };
  } catch (err) {
    return {
      verified: false,
      message: `DNS lookup failed: ${err.message}. DNS may not have propagated yet.`,
    };
  }
};

/**
 * Validate domain format before saving.
 * Prevents path traversal and invalid domain submission.
 */
export const isValidDomain = (domain) => {
  // Only allow valid domain characters — no paths, no ports
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  const clean = domain.replace(/^www\./, '').toLowerCase().trim();
  return domainRegex.test(clean);
};

/**
 * Normalize domain — strip protocol, trailing slash, path
 */
export const normalizeDomain = (input) => {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')  // strip protocol
    .replace(/\/.*$/, '')          // strip path
    .replace(/:\d+$/, '')          // strip port
    .trim();
};
```

---

### 1.3 Add Domain Routes to Super Admin

Add these routes to `server/routes/superAdminRoutes.js`:

```javascript
import { verifyDomainDns, isValidDomain, normalizeDomain } from '../utils/domainVerifier.js';

/**
 * PATCH /api/super-admin/centers/:id/verify-domain
 * Checks DNS and marks domain as verified if pointing to server
 */
router.patch('/centers/:id/verify-domain', verifySuperAdmin, async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }
    if (!center.customDomain) {
      return res.status(400).json({ success: false, message: 'No custom domain submitted' });
    }

    const serverIp = process.env.SERVER_IP;
    if (!serverIp) {
      return res.status(500).json({ success: false, message: 'SERVER_IP not configured' });
    }

    const result = await verifyDomainDns(center.customDomain, serverIp);

    if (!result.verified) {
      return res.status(400).json({
        success: false,
        message: result.message,
        hint: 'DNS changes can take up to 48 hours to propagate',
      });
    }

    // Mark as verified
    center.domainVerified  = true;
    center.domainVerifiedAt = new Date();
    center.domainVerifiedBy = req.superAdmin._id.toString();
    await center.save();

    // Update CORS to include new domain
    // NOTE: Requires server restart or dynamic CORS update (see section 2.2)
    console.log(`✅ Domain verified: ${center.customDomain} for ${center.centerName}`);

    res.json({
      success: true,
      message: `Domain ${center.customDomain} verified successfully`,
      nextStep: `Add Nginx config and run Certbot for SSL`,
    });
  } catch (err) {
    console.error('❌ Domain verification error:', err);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

/**
 * PATCH /api/super-admin/centers/:id/remove-domain
 * Removes custom domain from center (revert to subdomain)
 */
router.patch('/centers/:id/remove-domain', verifySuperAdmin, async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    const removedDomain = center.customDomain;
    center.customDomain    = null;
    center.domainVerified  = false;
    center.domainVerifiedAt = null;
    await center.save();

    res.json({
      success: true,
      message: `Domain ${removedDomain} removed. Center reverts to subdomain.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove domain' });
  }
});

/**
 * GET /api/super-admin/centers/domains
 * List all centers with custom domain status
 */
router.get('/centers/domains', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ customDomain: { $ne: null } })
      .select('centerName slug customDomain domainVerified domainRequestedAt domainVerifiedAt plan status');
    res.json({ success: true, centers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch domains' });
  }
});
```

---

### 1.4 Add Domain Route for Center Admin

Add to `server/routes/centerConfigRoutes.js`:

```javascript
import { isValidDomain, normalizeDomain } from '../utils/domainVerifier.js';
import { sendDomainInstructionsEmail } from '../utils/emailService.js';

/**
 * POST /api/center/domain
 * Center admin submits their custom domain request
 * Requires Pro plan
 */
router.post('/domain', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain?.trim()) {
      return res.status(400).json({ success: false, message: 'Domain is required' });
    }

    // Only Pro and Enterprise centers can have custom domains
    if (!['pro', 'enterprise'].includes(req.center.plan)) {
      return res.status(403).json({
        success: false,
        message: 'Custom domains require a Pro or Enterprise plan',
      });
    }

    const normalized = normalizeDomain(domain);

    if (!isValidDomain(normalized)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid domain format. Use: yourdomain.com or www.yourdomain.com',
      });
    }

    // Check domain not already taken by another center
    const existing = await Center.findOne({
      customDomain: normalized,
      _id: { $ne: req.center._id },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'This domain is already in use by another center',
      });
    }

    const serverIp = process.env.SERVER_IP;

    // Save domain as pending verification
    await Center.findByIdAndUpdate(req.center._id, {
      customDomain:      normalized,
      domainVerified:    false,
      domainRequestedAt: new Date(),
      domainInstructions: {
        type:  'A',
        name:  '@',
        value: serverIp,
      },
    });

    // Send DNS instructions to center admin
    try {
      await sendDomainInstructionsEmail(
        { email: req.center.adminEmail, centerName: req.center.centerName },
        normalized,
        serverIp
      );
    } catch (emailErr) {
      console.error('Domain instructions email failed:', emailErr.message);
    }

    res.json({
      success: true,
      message: 'Domain submitted. Add the DNS record below then notify support.',
      instructions: {
        type:  'A',
        name:  '@',
        value: serverIp,
        note:  'Also add a CNAME record: name=www, value=yourdomain.com',
        propagation: 'DNS changes can take up to 48 hours to propagate',
      },
    });
  } catch (err) {
    console.error('❌ Domain submission error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit domain' });
  }
});

/**
 * GET /api/center/domain/status
 * Center admin checks their domain verification status
 */
router.get('/domain/status', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { customDomain, domainVerified, domainRequestedAt, domainInstructions } = req.center;
    res.json({
      success: true,
      customDomain,
      domainVerified,
      domainRequestedAt,
      instructions: domainInstructions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch domain status' });
  }
});
```

---

### 1.5 Add Email Function for DNS Instructions

Add to `server/utils/emailService.js`:

```javascript
/**
 * Send DNS setup instructions to center admin after domain submission
 */
export const sendDomainInstructionsEmail = async (center, domain, serverIp) => {
  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: center.email,
    subject: `Custom Domain Setup Instructions — ${domain}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Custom Domain Setup Instructions</h2>
        <p>Hi ${center.centerName},</p>
        <p>To activate your custom domain <strong>${domain}</strong>, 
           add the following DNS record to your domain provider:</p>
        
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <tr style="background: #f5f5f5;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Type</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Value</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">A</td>
            <td style="padding: 10px; border: 1px solid #ddd;">@</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>${serverIp}</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">CNAME</td>
            <td style="padding: 10px; border: 1px solid #ddd;">www</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>${domain}</strong></td>
          </tr>
        </table>

        <p>⏱️ DNS changes can take up to 48 hours to propagate.</p>
        <p>Once done, reply to this email or contact support — 
           we will verify and activate your domain within 24 hours.</p>
        
        <p>After activation, your portal will be accessible at:<br/>
           <strong>https://${domain}</strong></p>
      </div>
    `,
  };
  return sendEmail(mailOptions);
};
```

---

## PHASE 2 — SERVER CONFIGURATION

### 2.1 New Environment Variable

Add to `.env`:
```env
SERVER_IP=123.456.789.000
# Your VPS/hosting public IP address
# Find this in your hosting dashboard (Render, DigitalOcean, etc.)
```

Add to `server/config/config.js`:
```javascript
serverIp: process.env.SERVER_IP || null,
```

---

### 2.2 Dynamic CORS for Custom Domains

When a new custom domain is verified, it must be added to CORS.
Update the CORS config in `server/index.js`:

```javascript
// REPLACE existing CORS config with dynamic version:
app.use(cors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true);

    // Always allow configured origins
    if (config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check if origin matches a verified custom domain in DB
    try {
      const domain = origin
        .replace(/^https?:\/\//, '')
        .replace(/:\d+$/, '');

      const center = await Center.findOne({
        customDomain: domain,
        domainVerified: true,
        status: 'active',
      });

      if (center) return callback(null, true);
    } catch (err) {
      console.error('CORS domain check error:', err.message);
    }

    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-center-slug'],
  maxAge: 86400,
}));
```

Note: This does one DB lookup per request from a custom domain.
The Center doc will be cached by MongoDB driver connection pooling.
At scale, add Redis caching here.

---

### 2.3 Nginx Config Template

When you verify a center's domain, generate this Nginx config.
Save as `/etc/nginx/sites-available/{centerSlug}` on your server:

```nginx
# /etc/nginx/sites-available/greenfield
# Generated for: Greenfield Academy
# Domain: www.greenfieldacademy.com
# Created: 2025-01-01

server {
    listen 80;
    server_name greenfieldacademy.com www.greenfieldacademy.com;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name greenfieldacademy.com www.greenfieldacademy.com;

    # SSL — managed by Certbot
    ssl_certificate     /etc/letsencrypt/live/greenfieldacademy.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/greenfieldacademy.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy to Node.js backend
    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO
    location /socket.io/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
    }

    # React frontend (static files)
    location / {
        root   /var/www/yourapp/dist;
        index  index.html;
        try_files $uri $uri/ /index.html;  # SPA fallback
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

---

### 2.4 SSL Certificate Command

Run this command on your server for each verified domain:

```bash
# Replace with actual domain
certbot --nginx -d greenfieldacademy.com -d www.greenfieldacademy.com

# Certbot auto-renews — verify renewal is set up:
certbot renew --dry-run
```

---

### 2.5 Nginx Config Generation Script

Create `server/scripts/generateNginxConfig.js` to automate config creation:

```javascript
// server/scripts/generateNginxConfig.js
// Run: node server/scripts/generateNginxConfig.js <centerSlug>
// Outputs Nginx config to stdout — pipe to file or copy manually

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Center from '../models/master/Center.js';

const [,, centerSlug] = process.argv;

if (!centerSlug) {
  console.error('Usage: node generateNginxConfig.js <centerSlug>');
  process.exit(1);
}

async function generate() {
  await mongoose.connect(process.env.MASTER_DB_URI);
  const center = await Center.findOne({ slug: centerSlug });

  if (!center) {
    console.error(`Center not found: ${centerSlug}`);
    process.exit(1);
  }
  if (!center.customDomain || !center.domainVerified) {
    console.error(`Domain not verified for: ${centerSlug}`);
    process.exit(1);
  }

  const domain    = center.customDomain.replace(/^www\./, '');
  const wwwDomain = `www.${domain}`;

  console.log(`
# /etc/nginx/sites-available/${center.slug}
# ${center.centerName} — ${domain}

server {
    listen 80;
    server_name ${domain} ${wwwDomain};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain} ${wwwDomain};

    ssl_certificate     /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        root /var/www/yourapp/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
`);

  console.error(`\n# Next steps:`);
  console.error(`# 1. Save above to: /etc/nginx/sites-available/${center.slug}`);
  console.error(`# 2. Run: ln -s /etc/nginx/sites-available/${center.slug} /etc/nginx/sites-enabled/`);
  console.error(`# 3. Run: nginx -t`);
  console.error(`# 4. Run: certbot --nginx -d ${domain} -d ${wwwDomain}`);
  console.error(`# 5. Run: systemctl reload nginx`);

  await mongoose.disconnect();
}

generate().catch(e => { console.error(e); process.exit(1); });
```

---

## PHASE 3 — FRONTEND (Center Admin UI)

### 3.1 Domain Settings Component

Create `src/pages/admin/tabs/DomainTab.jsx` (NEW FILE):

```javascript
// src/pages/admin/tabs/DomainTab.jsx
import { useState, useEffect } from 'react';
import { Globe, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function DomainTab({ isDarkMode, centerPlan }) {
  const token = localStorage.getItem('adminToken');

  const [status,  setStatus]  = useState(null);
  const [domain,  setDomain]  = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const isPro = ['pro', 'enterprise'].includes(centerPlan);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE}/center/domain/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setStatus(data);
    } catch (err) {
      console.error('Domain status fetch failed:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async () => {
    if (!domain.trim()) {
      setError('Please enter a domain');
      return;
    }

    // Basic frontend validation
    const clean = domain.toLowerCase().trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

    if (!clean.includes('.') || clean.length < 4) {
      setError('Please enter a valid domain e.g. yourdomain.com');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const res = await fetch(`${API_BASE}/center/domain`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain: clean }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to submit domain');
        return;
      }

      setSuccess('Domain submitted! Check your email for DNS setup instructions.');
      fetchStatus(); // Refresh status
    } catch (err) {
      setError('Failed to submit domain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const base = isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900';
  const input = isDarkMode
    ? 'bg-gray-700 border-gray-600 text-white'
    : 'bg-white border-gray-300 text-gray-900';

  if (!isPro) {
    return (
      <div className={`${base} rounded-2xl p-6 max-w-2xl`}>
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl font-bold">Custom Domain</h2>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-800 font-medium">Pro Plan Required</p>
          <p className="text-yellow-700 text-sm mt-1">
            Custom domains are available on Pro and Enterprise plans.
            Upgrade to use your own domain like www.yourschool.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${base} rounded-2xl p-6 max-w-2xl`}>
      <div className="flex items-center gap-3 mb-6">
        <Globe className="w-6 h-6 text-purple-500" />
        <h2 className="text-xl font-bold">Custom Domain</h2>
      </div>

      {/* Current Status */}
      {!fetching && status?.customDomain && (
        <div className={`rounded-xl p-4 mb-6 ${
          status.domainVerified
            ? 'bg-green-50 border border-green-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {status.domainVerified
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : <Clock className="w-5 h-5 text-yellow-600" />
            }
            <span className="font-semibold">
              {status.domainVerified ? 'Domain Active' : 'Pending Verification'}
            </span>
          </div>
          <p className="text-sm mt-1 font-mono">
            {status.customDomain}
          </p>
          {status.domainVerified && (
            <a
              href={`https://${status.customDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-green-700 text-sm mt-2 hover:underline"
            >
              Visit portal <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {!status.domainVerified && status.instructions && (
            <div className="mt-3 bg-white rounded-lg p-3 text-sm">
              <p className="font-medium mb-2">Add this DNS record:</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left py-1">Type</th>
                    <th className="text-left py-1">Name</th>
                    <th className="text-left py-1">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono">
                    <td className="py-1">A</td>
                    <td className="py-1">@</td>
                    <td className="py-1">{status.instructions.value}</td>
                  </tr>
                  <tr className="font-mono">
                    <td className="py-1">CNAME</td>
                    <td className="py-1">www</td>
                    <td className="py-1">{status.customDomain}</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-gray-500 mt-2">
                ⏱ DNS propagation can take up to 48 hours.
                Contact support once done — we will verify and activate.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Submit New Domain */}
      {(!status?.customDomain || !status?.domainVerified) && (
        <div>
          <label className="block text-sm font-medium mb-2">
            {status?.customDomain ? 'Update Domain' : 'Enter Your Domain'}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="www.yourschool.com"
              maxLength={100}
              className={`flex-1 border rounded-lg px-3 py-2 ${input}`}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-purple-700"
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter your domain without https:// e.g. yourschool.com
          </p>
        </div>
      )}

      {error   && (
        <div className="flex items-center gap-2 text-red-600 text-sm mt-3">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && <p className="text-green-600 text-sm mt-3">{success}</p>}
    </div>
  );
}
```

---

### 3.2 Add Domain Tab to Admin Dashboard

In `src/pages/admin/AdminDashboard.jsx`:

```javascript
// Add import:
import DomainTab from './tabs/DomainTab';

// Add to nav items:
{ id: 'domain', label: 'Custom Domain', icon: Globe }

// Add Globe to lucide imports:
import { ..., Globe } from 'lucide-react';

// Add to tab render:
{activeTab === 'domain' && (
  <DomainTab
    isDarkMode={isDarkMode}
    centerPlan={centerData?.plan || 'free'}
  />
)}
```

---

## FULL ACTIVATION WORKFLOW (Step by Step)

This is the exact process every time a center wants a custom domain:

```
1. Center goes to Settings → Custom Domain
2. They enter: www.greenfieldacademy.com
3. They receive email with DNS instructions
4. They add A record pointing to your server IP
5. They notify you (email/support ticket)

6. YOU run in terminal:
   node server/scripts/generateNginxConfig.js greenfield

7. Copy output to server:
   /etc/nginx/sites-available/greenfield

8. Enable and get SSL:
   ln -s /etc/nginx/sites-available/greenfield /etc/nginx/sites-enabled/
   nginx -t
   certbot --nginx -d greenfieldacademy.com -d www.greenfieldacademy.com
   systemctl reload nginx

9. Verify in Super Admin dashboard:
   PATCH /api/super-admin/centers/:id/verify-domain

10. Center gets confirmation — domain is live with HTTPS ✅
```

Total time on your end: about 5 minutes per center.

---

## FILE STRUCTURE — ALL NEW FILES

```
server/
├── utils/
│   └── domainVerifier.js              ← NEW: DNS check + validation
├── scripts/
│   └── generateNginxConfig.js         ← NEW: outputs Nginx config
└── models/master/
    └── Center.js                      ← UPDATE: add domainVerified fields

src/pages/admin/tabs/
└── DomainTab.jsx                      ← NEW: center admin domain UI
```

Files to UPDATE:
```
server/routes/superAdminRoutes.js      ← Add verify/remove domain routes
server/routes/centerConfigRoutes.js    ← Add domain submit + status routes
server/utils/emailService.js           ← Add sendDomainInstructionsEmail
server/config/config.js                ← Add serverIp field
server/index.js                        ← Update CORS to check custom domains
.env                                   ← Add SERVER_IP
src/pages/admin/AdminDashboard.jsx     ← Add DomainTab
```

---

## ABSOLUTE RULES — NEVER VIOLATE

1. NEVER activate a domain without DNS verification first
2. NEVER skip SSL — every custom domain MUST have HTTPS via Certbot
3. NEVER allow free or basic plan centers to submit custom domains
4. NEVER use a domain string directly as a file path or shell argument
   without sanitization — use normalizeDomain() first
5. NEVER remove the www CNAME record instruction — both apex and www
   must point to the server
6. NEVER hardcode SERVER_IP — always read from process.env.SERVER_IP
7. ALWAYS run `nginx -t` before `systemctl reload nginx`
   to catch config errors before they take the server down
8. NEVER store SMTP passwords for centers in plain text —
   encrypt before saving (relevant for Phase 4: custom email domains)
9. domainVerified must be false by default on submission —
   only set true after explicit Super Admin verification
10. ALWAYS keep the subdomain working as fallback even after
    custom domain is activated — center.slug.yourapp.com must
    still work in case custom domain expires or DNS breaks

---

## DEPLOYMENT CHECKLIST

- [ ] `SERVER_IP` env var set to correct server IP
- [ ] `domainVerifier.js` created and tested
- [ ] `generateNginxConfig.js` script tested locally
- [ ] Center schema updated with domain fields
- [ ] Super Admin routes added (verify, remove, list)
- [ ] Center config routes added (submit, status)
- [ ] `sendDomainInstructionsEmail` added to emailService.js
- [ ] Dynamic CORS updated in index.js
- [ ] DomainTab added to AdminDashboard
- [ ] Plan check enforced (Pro/Enterprise only)
- [ ] Certbot auto-renewal verified on server (`certbot renew --dry-run`)
- [ ] Both apex and www DNS records documented in instructions email
- [ ] Subdomain still works after custom domain activation

---

## HOW TO USE IN CLAUDE CODE TERMINAL

### Build the full feature:
```
Read CUSTOM_DOMAIN_SKILL.md completely then implement
Phase 1 backend first — start with domainVerifier.js,
then update the Center schema, then add the routes.
Show me each file before moving to the next.
```

### Add just the frontend:
```
Read CUSTOM_DOMAIN_SKILL.md then build DomainTab.jsx
and add it to AdminDashboard following the existing
tab pattern in that file
```

### Generate Nginx config for a center:
```
Read CUSTOM_DOMAIN_SKILL.md then create the
generateNginxConfig.js script exactly as defined
in section 2.5
```

### Debug domain not resolving:
```
Read CUSTOM_DOMAIN_SKILL.md then check why
www.greenfieldacademy.com is not resolving —
verify domainVerified is true in DB, check Nginx
config is enabled, check SSL certificate exists,
check CORS includes the domain
```

---

*This skill is for PRODUCTION use only.*
*Do not implement before the app is live with real centers.*
*Always test Nginx config with nginx -t before reloading.*
*If unsure about DNS propagation, use dnschecker.org to verify.*