import express from 'express';
import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';
import { fileURLToPath } from 'url';
import Center from '../models/master/Center.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { isValidDomain, normalizeDomain } from '../utils/domainVerifier.js';
import { sendDomainInstructionsEmail } from '../utils/emailService.js';
import { config } from '../config/config.js';
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BRANDING_DIR = path.join(__dirname, '..', 'uploads', 'branding');
if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });

// SVG is deliberately excluded — it can embed <script> tags and cause stored XSS.
const ALLOWED_BRANDING_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_BRANDING_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const brandingStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(BRANDING_DIR, req.center.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  },
});

const brandingUpload = multer({
  storage: brandingStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_BRANDING_MIMES.has(file.mimetype) && ALLOWED_BRANDING_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, WebP, or GIF images are allowed'));
    }
  },
});

const router = express.Router();

// GET /api/center/config — public, no auth required
router.get('/config', tenantMiddleware, async (req, res) => {
  try {
    const { centerName, slug, branding, certificateTemplate, plan, features, customDomain, domainVerified } = req.center;
    res.json({
      success: true,
      center:  { centerName, slug, plan, features, certificateTemplate, customDomain, domainVerified },
      branding,
    });
  } catch (err) {
    logger.error('❌ Center config error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// PATCH /api/center/branding — center admin updates their own branding
router.patch('/branding', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { primaryColor, secondaryColor, fontFamily, logo, favicon, borderRadius, shadowStyle, spacing, theme, loginBgOverlay } = req.body;

    await Center.findByIdAndUpdate(req.center._id, {
      'branding.primaryColor':   primaryColor   !== undefined ? primaryColor   : req.center.branding.primaryColor,
      'branding.secondaryColor': secondaryColor !== undefined ? secondaryColor : req.center.branding.secondaryColor,
      'branding.fontFamily':     fontFamily     !== undefined ? fontFamily     : req.center.branding.fontFamily,
      'branding.logo':           logo           !== undefined ? logo           : req.center.branding.logo,
      'branding.favicon':        favicon        !== undefined ? favicon        : req.center.branding.favicon,
      'branding.borderRadius':    borderRadius    !== undefined ? borderRadius    : req.center.branding.borderRadius,
      'branding.shadowStyle':     shadowStyle     !== undefined ? shadowStyle     : req.center.branding.shadowStyle,
      'branding.spacing':         spacing         !== undefined ? spacing         : req.center.branding.spacing,
      'branding.theme':           theme           !== undefined ? theme           : req.center.branding.theme,
      'branding.loginBgOverlay':  loginBgOverlay  !== undefined ? loginBgOverlay  : req.center.branding.loginBgOverlay,
    });

    res.json({ success: true, message: 'Branding updated' });
  } catch (err) {
    logger.error('❌ Branding update error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// POST /api/center/domain — center admin submits custom domain request
router.post('/domain', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain?.trim()) return badRequest(res, 'Domain is required');

    if (!['pro', 'enterprise'].includes(req.center.plan)) {
      return forbidden(res, 'Custom domains require a Pro or Enterprise plan');
    }

    const normalized = normalizeDomain(domain);
    if (!isValidDomain(normalized)) {
      return badRequest(res, 'Invalid domain format. Use: yourdomain.com or www.yourdomain.com');
    }

    const existing = await Center.findOne({ customDomain: normalized, _id: { $ne: req.center._id } });
    if (existing) return conflict(res, 'This domain is already in use by another center');

    const serverIp = config.serverIp;
    await Center.findByIdAndUpdate(req.center._id, {
      customDomain:      normalized,
      domainVerified:    false,
      domainRequestedAt: new Date(),
      domainInstructions: { type: 'A', name: '@', value: serverIp },
    });

    try {
      await sendDomainInstructionsEmail(
        { email: req.center.adminEmail, centerName: req.center.centerName },
        normalized,
        serverIp
      );
    } catch (e) { logger.error('Domain instructions email failed:', { error: e?.message }); }

    res.json({
      success: true,
      message: 'Domain submitted. Check your email for DNS setup instructions.',
      instructions: {
        type: 'A', name: '@', value: serverIp,
        note: 'Also add: CNAME www → ' + normalized,
        propagation: 'DNS changes can take up to 48 hours to propagate',
      },
    });
  } catch (err) {
    logger.error('❌ Domain submission error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Failed to submit domain' });
  }
});

// GET /api/center/domain/status — center admin checks their domain status
router.get('/domain/status', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { customDomain, domainVerified, domainRequestedAt, domainInstructions } = req.center;
    res.json({ success: true, customDomain, domainVerified, domainRequestedAt, instructions: domainInstructions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch domain status' });
  }
});

// POST /api/center/branding/upload — upload logo or favicon image
router.post(
  '/branding/upload',
  tenantMiddleware,
  verifyToken,
  verifyAdmin,
  (req, res, next) => {
    brandingUpload.single(req.query.type === 'favicon' ? 'favicon' : req.query.type === 'loginBackground' ? 'loginBackground' : 'logo')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return badRequest(res, 'No file uploaded');

      const field = req.query.type === 'favicon' ? 'favicon' : req.query.type === 'loginBackground' ? 'loginBackground' : 'logo';
      const fileUrl  = `/uploads/branding/${req.center.slug}/${req.file.filename}`;

      // Delete old file if it exists and is a local upload
      const oldValue = req.center.branding?.[field];
      if (oldValue?.startsWith('/uploads/')) {
        const oldPath = path.join(__dirname, '..', oldValue);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      await Center.findByIdAndUpdate(req.center._id, {
        [`branding.${field}`]: fileUrl,
      });

      res.json({ success: true, url: fileUrl });
    } catch (err) {
      logger.error('❌ Branding upload error:', { error: err?.message });
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  }
);

// PATCH /api/center/certificate-template — admin configures their own center's certificate template
router.patch('/certificate-template', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { certificateTemplate } = req.body;
    if (!certificateTemplate || typeof certificateTemplate !== 'object') {
      return badRequest(res, 'certificateTemplate object is required');
    }

    const { organizationName, primaryColor, secondaryColor, accentColor,
            signatureName, signatureTitle, footerText, completionMilestones } = certificateTemplate;

    const update = {};
    if (organizationName  !== undefined) update['certificateTemplate.organizationName']  = String(organizationName).slice(0, 200);
    if (primaryColor      !== undefined) update['certificateTemplate.primaryColor']      = String(primaryColor).slice(0, 20);
    if (secondaryColor    !== undefined) update['certificateTemplate.secondaryColor']    = String(secondaryColor).slice(0, 20);
    if (accentColor       !== undefined) update['certificateTemplate.accentColor']       = String(accentColor).slice(0, 20);
    if (signatureName     !== undefined) update['certificateTemplate.signatureName']     = String(signatureName).slice(0, 200);
    if (signatureTitle    !== undefined) update['certificateTemplate.signatureTitle']    = String(signatureTitle).slice(0, 200);
    if (footerText        !== undefined) update['certificateTemplate.footerText']        = String(footerText).slice(0, 500);
    if (Array.isArray(completionMilestones)) {
      const cleaned = completionMilestones
        .filter(m => m && typeof m.count === 'number' && m.count > 0 && m.title)
        .map(m => ({ count: m.count, title: String(m.title).slice(0, 200), description: String(m.description || '').slice(0, 500) }))
        .sort((a, b) => a.count - b.count);
      update['certificateTemplate.completionMilestones'] = cleaned;
    }

    await Center.findByIdAndUpdate(req.center._id, { $set: update });
    res.json({ success: true, message: 'Certificate template updated' });
  } catch (err) {
    logger.error('❌ Certificate template update error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// GET /api/v1/center/verify-caddy?domain=somesite.com
// Called by Caddy's on_demand_tls before issuing a certificate for an unknown domain.
// Returns 200 if the domain is an active verified custom domain, 404 otherwise.
// This is a public endpoint (no auth) — Caddy calls it, not end users.
router.get('/verify-caddy', async (req, res) => {
  const domain = (req.query.domain || '').toLowerCase().trim();
  if (!domain) return res.status(400).end();

  try {
    // Allow any active center subdomain under clemify.com
    if (domain.endsWith('.clemify.com')) {
      const slug = domain.replace(/\.clemify\.com$/, '');
      const sub = await Center.findOne({ slug, status: 'active' }).lean();
      return res.status(sub ? 200 : 404).end();
    }

    // Allow verified custom domains
    const center = await Center.findOne({
      customDomain:  domain,
      domainVerified: true,
      status: 'active',
    }).lean();

    return res.status(center ? 200 : 404).end();
  } catch {
    return res.status(500).end();
  }
});

export default router;
