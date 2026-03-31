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

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const BRANDING_DIR = path.join(__dirname, '..', 'uploads', 'branding');
if (!fs.existsSync(BRANDING_DIR)) fs.mkdirSync(BRANDING_DIR, { recursive: true });

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB (backgrounds can be larger)
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = express.Router();

// GET /api/center/config — public, no auth required
router.get('/config', tenantMiddleware, async (req, res) => {
  try {
    const { centerName, slug, branding, plan, features } = req.center;
    res.json({
      success: true,
      center:  { centerName, slug, plan, features },
      branding,
    });
  } catch (err) {
    console.error('❌ Center config error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
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
    console.error('❌ Branding update error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/center/domain — center admin submits custom domain request
router.post('/domain', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain?.trim()) return res.status(400).json({ success: false, message: 'Domain is required' });

    if (!['pro', 'enterprise'].includes(req.center.plan)) {
      return res.status(403).json({ success: false, message: 'Custom domains require a Pro or Enterprise plan' });
    }

    const normalized = normalizeDomain(domain);
    if (!isValidDomain(normalized)) {
      return res.status(400).json({ success: false, message: 'Invalid domain format. Use: yourdomain.com or www.yourdomain.com' });
    }

    const existing = await Center.findOne({ customDomain: normalized, _id: { $ne: req.center._id } });
    if (existing) return res.status(409).json({ success: false, message: 'This domain is already in use by another center' });

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
    } catch (e) { console.error('Domain instructions email failed:', e.message); }

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
    console.error('❌ Domain submission error:', err);
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
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

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
      console.error('❌ Branding upload error:', err);
      res.status(500).json({ success: false, message: 'Upload failed' });
    }
  }
);

export default router;
