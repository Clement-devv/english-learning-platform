import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import SuperAdmin from '../models/master/SuperAdmin.js';
import Center from '../models/master/Center.js';
import AgoraUsage from '../models/master/AgoraUsage.js';
import { verifySuperAdmin } from '../middleware/superAdminMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { getDb } from '../config/dbManager.js';
import { config, JWT_STANDARD_CLAIMS } from '../config/config.js';
import { sendEmail, sendCenterDeletionWarningEmail } from '../utils/emailService.js';
import { verifyDomainDns, isValidDomain, normalizeDomain } from '../utils/domainVerifier.js';
import { pruneSessionsToLimit } from '../utils/sessionManager.js';
import {
  validate,
  validateSuperAdminLogin,
  validateParamMongoId,
  validateSlugParam,
  validateCenterPlan,
  validateCenterLimits,
  validateBroadcast,
  validateOtpSend,
  validateOtpVerify,
  validateChatCredits,
  validateCenterAction,
} from '../middleware/validation.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { studentSchema }  from '../schemas/studentSchema.js';
import { bookingSchema }  from '../schemas/bookingSchema.js';
import logger from "../utils/logger.js";

// In-memory OTP store: key = adminEmail, value = { code, expiresAt }
const emailOtpStore = new Map();

const router = express.Router();

// POST /api/super-admin/login
router.post('/login', loginLimiter, validateSuperAdminLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const superAdmin = await SuperAdmin.findOne({ email });
    if (!superAdmin || !superAdmin.active) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, superAdmin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { ...JWT_STANDARD_CLAIMS, id: superAdmin._id, role: 'superadmin', email: superAdmin.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    superAdmin.sessions.push({ token, isActive: true, loginTime: new Date() });
    superAdmin.sessions = pruneSessionsToLimit(superAdmin.sessions);
    superAdmin.lastLogin = new Date();
    await superAdmin.save();

    await writeAuditLog({ action: 'SUPERADMIN_LOGIN', superAdmin, ip: req.ip });

    res.json({
      success: true,
      token,
      superAdmin: {
        id: superAdmin._id,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        email: superAdmin.email,
        role: 'superadmin',
      },
    });
  } catch (err) {
    logger.error('❌ Super admin login error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/centers — all centers with optional status filter
router.get('/centers', verifySuperAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const centers = await Center.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, centers });
  } catch (err) {
    logger.error('❌ Get centers error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/centers/pending — pending registrations only
router.get('/centers/pending', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, centers });
  } catch (err) {
    logger.error('❌ Get pending centers error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/approve
router.patch('/centers/:id/approve', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id).select('+pendingPasswordHash');
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }
    if (center.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Center is already ${center.status}` });
    }
    if (!center.pendingPasswordHash) {
      return res.status(400).json({ success: false, message: 'No pending password hash found for this center' });
    }

    // Create the center's database and admin account
    const db = await getDb(center.slug);

    // Import admin schema to register on center DB
    const { default: adminSchemaModule } = await import('../models/Admin.js');
    const adminSchema = adminSchemaModule.schema;
    const Admin = db.models.Admin || db.model('Admin', adminSchema);

    await Admin.create({
      username: center.adminEmail.split('@')[0],
      email:    center.adminEmail,
      password: center.pendingPasswordHash,
      role:     'admin',
      active:   true,
    });

    // Clear the pending password hash and mark active
    center.pendingPasswordHash = null;
    center.status     = 'active';
    center.approvedAt = new Date();
    center.approvedBy = req.superAdmin._id.toString();
    await center.save();

    await writeAuditLog({
      action: 'CENTER_APPROVED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName, ip: req.ip,
    });

    // Welcome email to center admin
    try {
      await sendEmail({
        to: center.adminEmail,
        subject: `Your ${config.appName} center is approved!`,
        html: `
          <p>Congratulations! Your center <strong>${center.centerName}</strong> has been approved.</p>
          <p>You can now log in to your admin dashboard at: <strong>${config.frontendUrl}</strong></p>
          <p>Use your registered email address and the password you set during registration.</p>
          <p>— The ${config.appName} Team</p>
        `,
      });
    } catch (e) {
      logger.error('Approval welcome email failed:', { error: e?.message });
    }

    res.json({ success: true, message: 'Center approved and admin account created', center });
  } catch (err) {
    logger.error('❌ Approve center error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/reject
router.patch('/centers/:id/reject', verifySuperAdmin, validateCenterAction, async (req, res) => {
  try {
    const { rejectReason } = req.body;
    const center = await Center.findById(req.params.id).select('+pendingPasswordHash');
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    center.status       = 'rejected';
    center.rejectedAt   = new Date();
    center.rejectReason = rejectReason || '';
    center.pendingPasswordHash = null;
    await center.save();

    await writeAuditLog({
      action: 'CENTER_REJECTED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { rejectReason }, ip: req.ip,
    });

    try {
      await sendEmail({
        to: center.adminEmail,
        subject: `Update on your ${config.appName} registration`,
        html: `
          <p>Hi,</p>
          <p>Unfortunately, we were unable to approve the registration for <strong>${center.centerName}</strong>.</p>
          ${rejectReason ? `<p><strong>Reason:</strong> ${rejectReason}</p>` : ''}
          <p>If you believe this is a mistake, please contact us.</p>
          <p>— The ${config.appName} Team</p>
        `,
      });
    } catch (e) {
      logger.error('Rejection email failed:', { error: e?.message });
    }

    res.json({ success: true, message: 'Center rejected', center });
  } catch (err) {
    logger.error('❌ Reject center error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/suspend
router.patch('/centers/:id/suspend', verifySuperAdmin, validateCenterAction, async (req, res) => {
  try {
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { status: 'suspended' },
      { new: true }
    );
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await writeAuditLog({
      action: 'CENTER_SUSPENDED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName, ip: req.ip,
    });

    res.json({ success: true, message: 'Center suspended', center });
  } catch (err) {
    logger.error('❌ Suspend center error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/activate
router.patch('/centers/:id/activate', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const center = await Center.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    );
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await writeAuditLog({
      action: 'CENTER_ACTIVATED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName, ip: req.ip,
    });

    res.json({ success: true, message: 'Center activated', center });
  } catch (err) {
    logger.error('❌ Activate center error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/stats — platform-wide counts
router.get('/stats', verifySuperAdmin, async (req, res) => {
  try {
    const [total, active, pending, suspended, rejected] = await Promise.all([
      Center.countDocuments(),
      Center.countDocuments({ status: 'active' }),
      Center.countDocuments({ status: 'pending' }),
      Center.countDocuments({ status: 'suspended' }),
      Center.countDocuments({ status: 'rejected' }),
    ]);

    res.json({
      success: true,
      stats: { total, active, pending, suspended, rejected },
    });
  } catch (err) {
    logger.error('❌ Stats error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/centers/health — per-center teacher/student/booking counts
router.get('/centers/health', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: 'active' })
      .select('_id centerName slug maxTeachers maxStudents')
      .lean();

    const health = await Promise.all(centers.map(async (center) => {
      try {
        const db      = await getDb(center.slug);
        const Teacher = db.models.Teacher || db.model('Teacher', teacherSchema);
        const Student = db.models.Student || db.model('Student', studentSchema);
        const Booking = db.models.Booking || db.model('Booking', bookingSchema);

        const now          = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [teachers, students, bookingsThisMonth, lastBooking] = await Promise.all([
          Teacher.countDocuments(),
          Student.countDocuments({ status: { $ne: 'disabled' } }),
          Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
          Booking.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
        ]);

        return {
          _id:              center._id,
          slug:             center.slug,
          teachers,
          students,
          maxTeachers:      center.maxTeachers,
          maxStudents:      center.maxStudents,
          bookingsThisMonth,
          lastActivity:     lastBooking?.createdAt || null,
        };
      } catch {
        return { _id: center._id, slug: center.slug, error: true, teachers: 0, students: 0, bookingsThisMonth: 0, lastActivity: null };
      }
    }));

    res.json({ success: true, health });
  } catch (err) {
    logger.error('❌ Health error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/super-admin/impersonate/:slug — returns temp 1hr admin token
router.post('/impersonate/:slug', verifySuperAdmin, validateSlugParam, async (req, res) => {
  try {
    const center = await Center.findOne({ slug: req.params.slug, status: 'active' });
    if (!center) {
      return res.status(404).json({ success: false, message: 'Center not found or inactive' });
    }

    const token = jwt.sign(
      {
        ...JWT_STANDARD_CLAIMS,
        id: 'superadmin-impersonation',
        role: 'admin',
        centerId: center.slug,
        isImpersonation: true,
        impersonatedBy: req.superAdmin._id.toString(),
      },
      config.jwtSecret,
      { expiresIn: '30m' }
    );

    await writeAuditLog({
      action: 'CENTER_IMPERSONATED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName, ip: req.ip,
    });

    res.json({ success: true, token, center: { centerName: center.centerName, slug: center.slug } });
  } catch (err) {
    logger.error('❌ Impersonate error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/plan
router.patch('/centers/:id/plan', verifySuperAdmin, validateCenterPlan, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['free', 'basic', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan value' });
    }
    const center = await Center.findByIdAndUpdate(req.params.id, { plan }, { new: true });
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await writeAuditLog({
      action: 'CENTER_PLAN_UPDATED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { plan }, ip: req.ip,
    });

    res.json({ success: true, message: 'Plan updated', center });
  } catch (err) {
    logger.error('❌ Update plan error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/features — toggle features on/off for a center
router.patch('/centers/:id/features', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const { agora, googleMeet, recording, pronunciation } = req.body;
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    const update = {};
    if (agora         !== undefined) update['features.agora']         = !!agora;
    if (googleMeet    !== undefined) update['features.googleMeet']    = !!googleMeet;
    if (recording     !== undefined) update['features.recording']     = !!recording;
    if (pronunciation !== undefined) update['features.pronunciation'] = !!pronunciation;

    const updated = await Center.findByIdAndUpdate(req.params.id, update, { new: true });

    await writeAuditLog({
      action: 'CENTER_FEATURES_UPDATED', superAdmin: req.superAdmin,
      targetId: req.params.id, targetName: updated.centerName,
      details: update, ip: req.ip,
    });

    res.json({ success: true, message: 'Features updated', features: updated.features });
  } catch (err) {
    logger.error('❌ Update features error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/theme — apply a full theme preset to a center
router.patch('/centers/:id/theme', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const { primaryColor, secondaryColor, fontFamily, borderRadius, shadowStyle, spacing, theme } = req.body;
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await Center.findByIdAndUpdate(req.params.id, {
      'branding.primaryColor':   primaryColor,
      'branding.secondaryColor': secondaryColor,
      'branding.fontFamily':     fontFamily,
      'branding.borderRadius':   borderRadius,
      'branding.shadowStyle':    shadowStyle,
      'branding.spacing':        spacing,
      'branding.theme':          theme,
    });

    res.json({ success: true, message: `Theme "${theme}" applied to ${center.centerName}` });
  } catch (err) {
    logger.error('❌ Apply theme error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/branding
router.patch('/centers/:id/branding', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const { primaryColor, secondaryColor, fontFamily, logo, favicon } = req.body;
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await Center.findByIdAndUpdate(req.params.id, {
      'branding.primaryColor':   primaryColor   !== undefined ? primaryColor   : center.branding.primaryColor,
      'branding.secondaryColor': secondaryColor !== undefined ? secondaryColor : center.branding.secondaryColor,
      'branding.fontFamily':     fontFamily     !== undefined ? fontFamily     : center.branding.fontFamily,
      'branding.logo':           logo           !== undefined ? logo           : center.branding.logo,
      'branding.favicon':        favicon        !== undefined ? favicon        : center.branding.favicon,
    });

    res.json({ success: true, message: 'Branding updated' });
  } catch (err) {
    logger.error('❌ Update branding error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET  /api/super-admin/dashboard-themes — list all dashboard theme assignments
router.get('/dashboard-themes', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: { $ne: 'deleted' } })
      .select('centerName slug branding.dashboardTheme').lean();
    const assignments = {};
    centers.forEach(c => {
      if (c.branding?.dashboardTheme) {
        assignments[c.branding.dashboardTheme] = { id: c._id, name: c.centerName, slug: c.slug };
      }
    });
    res.json({ success: true, assignments });
  } catch (err) {
    logger.error('❌ Dashboard themes error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/dashboard-theme — exclusively assign a dashboard theme
router.patch('/centers/:id/dashboard-theme', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const { dashboardTheme } = req.body;
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    if (dashboardTheme) {
      const conflict = await Center.findOne({
        'branding.dashboardTheme': dashboardTheme,
        _id: { $ne: req.params.id },
        status: { $ne: 'deleted' },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Dashboard theme "${dashboardTheme}" is already assigned to ${conflict.centerName}`,
        });
      }
    }

    await Center.findByIdAndUpdate(req.params.id, { 'branding.dashboardTheme': dashboardTheme || null });

    await writeAuditLog({
      action: 'DASHBOARD_THEME_ASSIGNED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { dashboardTheme: dashboardTheme || null }, ip: req.ip,
    });

    res.json({ success: true, message: dashboardTheme ? `Dashboard theme "${dashboardTheme}" assigned to ${center.centerName}` : 'Dashboard theme unassigned' });
  } catch (err) {
    logger.error('❌ Dashboard theme assign error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET  /api/super-admin/login-themes — list all login theme assignments
router.get('/login-themes', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: { $ne: 'deleted' } })
      .select('centerName slug branding.loginTheme').lean();
    const assignments = {};
    centers.forEach(c => {
      if (c.branding?.loginTheme) {
        assignments[c.branding.loginTheme] = { id: c._id, name: c.centerName, slug: c.slug };
      }
    });
    res.json({ success: true, assignments });
  } catch (err) {
    logger.error('❌ Login themes error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/login-theme — exclusively assign a login theme
router.patch('/centers/:id/login-theme', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const { loginTheme } = req.body;   // null to unassign
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    if (loginTheme) {
      const conflict = await Center.findOne({
        'branding.loginTheme': loginTheme,
        _id: { $ne: req.params.id },
        status: { $ne: 'deleted' },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: `Theme "${loginTheme}" is already assigned to ${conflict.centerName}`,
        });
      }
    }

    await Center.findByIdAndUpdate(req.params.id, { 'branding.loginTheme': loginTheme || null });

    await writeAuditLog({
      action: 'LOGIN_THEME_ASSIGNED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { loginTheme: loginTheme || null }, ip: req.ip,
    });

    res.json({ success: true, message: loginTheme ? `Login theme "${loginTheme}" assigned to ${center.centerName}` : 'Login theme unassigned' });
  } catch (err) {
    logger.error('❌ Login theme assign error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/super-admin/send-otp — email OTP to verify admin email before center creation
router.post('/send-otp', verifySuperAdmin, validateOtpSend, async (req, res) => {
  try {
    const { adminEmail } = req.body;
    if (!adminEmail?.trim()) {
      return res.status(400).json({ success: false, message: 'adminEmail is required' });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    emailOtpStore.set(adminEmail.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });

    await sendEmail({
      to: adminEmail,
      subject: `${config.appName} — Email Verification Code`,
      html: `
        <p>Hello,</p>
        <p>Your verification code for center registration is:</p>
        <h2 style="letter-spacing:4px;color:#d97706;">${code}</h2>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>— The ${config.appName} Team</p>
      `,
    });

    res.json({ success: true, message: 'OTP sent to ' + adminEmail });
  } catch (err) {
    logger.error('❌ Send OTP error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

// POST /api/super-admin/verify-otp — confirm OTP code
router.post('/verify-otp', verifySuperAdmin, validateOtpVerify, async (req, res) => {
  try {
    const { adminEmail, code } = req.body;
    if (!adminEmail || !code) {
      return res.status(400).json({ success: false, message: 'adminEmail and code are required' });
    }

    const entry = emailOtpStore.get(adminEmail.toLowerCase());
    if (!entry) {
      return res.status(400).json({ success: false, message: 'No OTP found for this email. Please request a new code.' });
    }
    if (Date.now() > entry.expiresAt) {
      emailOtpStore.delete(adminEmail.toLowerCase());
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' });
    }
    if (entry.code !== String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
    }

    emailOtpStore.delete(adminEmail.toLowerCase());
    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    logger.error('❌ Verify OTP error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/centers/domains — all centers with custom domain info
router.get('/centers/domains', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find(
      { customDomain: { $exists: true, $ne: null } },
      'centerName slug customDomain domainVerified domainRequestedAt domainVerifiedAt plan status'
    ).sort({ domainRequestedAt: -1 });
    res.json({ success: true, centers });
  } catch (err) {
    logger.error('❌ Get domains error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/verify-domain — run DNS check and mark verified
router.patch('/centers/:id/verify-domain', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
    if (!center.customDomain) {
      return res.status(400).json({ success: false, message: 'No custom domain set for this center' });
    }
    if (!config.serverIp) {
      return res.status(500).json({ success: false, message: 'SERVER_IP not configured on this server' });
    }

    const dnsOk = await verifyDomainDns(center.customDomain, config.serverIp);
    if (!dnsOk) {
      return res.status(422).json({
        success: false,
        message: `DNS A record for ${center.customDomain} does not point to ${config.serverIp}. DNS may still be propagating.`,
      });
    }

    await Center.findByIdAndUpdate(req.params.id, {
      domainVerified:  true,
      domainVerifiedAt: new Date(),
      domainVerifiedBy: req.superAdmin._id.toString(),
    });

    await writeAuditLog({
      action: 'DOMAIN_VERIFIED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { domain: center.customDomain }, ip: req.ip,
    });

    res.json({ success: true, message: `Domain ${center.customDomain} verified successfully` });
  } catch (err) {
    logger.error('❌ Verify domain error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/remove-domain — remove custom domain
router.patch('/centers/:id/remove-domain', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await Center.findByIdAndUpdate(req.params.id, {
      $unset: {
        customDomain:       '',
        domainVerified:     '',
        domainRequestedAt:  '',
        domainVerifiedAt:   '',
        domainVerifiedBy:   '',
        domainInstructions: '',
      },
    });

    await writeAuditLog({
      action: 'DOMAIN_REMOVED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { domain: center.customDomain }, ip: req.ip,
    });

    res.json({ success: true, message: 'Custom domain removed' });
  } catch (err) {
    logger.error('❌ Remove domain error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/centers/deleted — centers in soft-delete waiting period
router.get('/centers/deleted', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: 'deleted' }).sort({ deletedAt: -1 });
    res.json({ success: true, centers });
  } catch (err) {
    logger.error('❌ Get deleted centers error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/soft-delete — mark for deletion in 7 days + email admin
router.patch('/centers/:id/soft-delete', verifySuperAdmin, validateCenterAction, async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
    if (center.status === 'deleted') {
      return res.status(400).json({ success: false, message: 'Center is already scheduled for deletion' });
    }

    const deletedAt           = new Date();
    const scheduledDeletionAt = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

    await Center.findByIdAndUpdate(req.params.id, {
      status:              'deleted',
      deletedAt,
      scheduledDeletionAt,
      deletedBy:           req.superAdmin._id.toString(),
    });

    // Send warning email to center admin — non-blocking
    try {
      await sendCenterDeletionWarningEmail(center, scheduledDeletionAt, config.emailFrom);
    } catch (e) {
      logger.error('Deletion warning email failed:', { error: e?.message });
    }

    await writeAuditLog({
      action: 'CENTER_SOFT_DELETED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { scheduledDeletionAt }, ip: req.ip,
    });

    res.json({ success: true, message: 'Center scheduled for deletion in 7 days. Warning email sent.', scheduledDeletionAt });
  } catch (err) {
    logger.error('❌ Soft delete error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/restore — bring a soft-deleted center back to active
router.patch('/centers/:id/restore', verifySuperAdmin, validateParamMongoId('id'), async (req, res) => {
  try {
    const center = await Center.findById(req.params.id);
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });
    if (center.status !== 'deleted') {
      return res.status(400).json({ success: false, message: 'Center is not in deleted state' });
    }

    await Center.findByIdAndUpdate(req.params.id, {
      status:              'active',
      $unset: { deletedAt: '', scheduledDeletionAt: '', deletedBy: '' },
    });

    // Notify center admin that their account has been restored
    try {
      await sendEmail({
        to:      center.adminEmail,
        subject: `✅ Your ${config.appName} center has been restored`,
        html: `
          <p>Hi,</p>
          <p>Great news! Your center <strong>${center.centerName}</strong> has been restored and is now active again.</p>
          <p>You can log in to your admin dashboard immediately.</p>
          <p>— The ${config.appName} Team</p>
        `,
      });
    } catch (e) {
      logger.error('Restore email failed:', { error: e?.message });
    }

    await writeAuditLog({
      action: 'CENTER_RESTORED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName, ip: req.ip,
    });

    res.json({ success: true, message: 'Center restored to active' });
  } catch (err) {
    logger.error('❌ Restore center error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/usage — per-center Agora minutes summary
// Returns thisMonth, lastMonth, and allTime totals for each center that has usage.
router.get('/usage', verifySuperAdmin, async (req, res) => {
  try {
    const now       = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

    // All-time totals grouped by center
    const allTime = await AgoraUsage.aggregate([
      { $group: {
        _id:          '$centerId',
        centerName:   { $last: '$centerName' },
        totalMinutes: { $sum: '$durationMinutes' },
        sessions:     { $sum: 1 },
      }},
      { $sort: { totalMinutes: -1 } },
    ]);

    // This month totals
    const thisMonthData = await AgoraUsage.aggregate([
      { $match: { month: thisMonth } },
      { $group: { _id: '$centerId', minutes: { $sum: '$durationMinutes' } } },
    ]);

    // Last month totals
    const lastMonthData = await AgoraUsage.aggregate([
      { $match: { month: lastMonth } },
      { $group: { _id: '$centerId', minutes: { $sum: '$durationMinutes' } } },
    ]);

    // Build lookup maps
    const thisMonthMap = Object.fromEntries(thisMonthData.map(r => [r._id, r.minutes]));
    const lastMonthMap = Object.fromEntries(lastMonthData.map(r => [r._id, r.minutes]));

    const summary = allTime.map(c => ({
      centerId:         c._id,
      centerName:       c.centerName,
      totalMinutes:     c.totalMinutes,
      sessions:         c.sessions,
      thisMonthMinutes: thisMonthMap[c._id] || 0,
      lastMonthMinutes: lastMonthMap[c._id] || 0,
    }));

    res.json({ success: true, summary, thisMonth, lastMonth });
  } catch (err) {
    logger.error('❌ Usage summary error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/super-admin/usage/:centerId — session-level detail for one center
// Query params: ?month=2026-03 (optional, defaults to current month)
router.get('/usage/:centerId', verifySuperAdmin, async (req, res) => {
  try {
    const { centerId } = req.params;
    const now          = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month        = req.query.month || defaultMonth;

    const sessions = await AgoraUsage.find({ centerId, month })
      .sort({ sessionDate: -1 })
      .limit(200);

    const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);

    res.json({ success: true, sessions, totalMinutes, month, centerId });
  } catch (err) {
    logger.error('❌ Center usage detail error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/super-admin/centers/:id/limits — update seat limits (-1 = unlimited)
router.patch('/centers/:id/limits', verifySuperAdmin, validateCenterLimits, async (req, res) => {
  try {
    const { maxTeachers, maxStudents } = req.body;
    const update = {};

    if (maxTeachers !== undefined) {
      const v = Number(maxTeachers);
      if (isNaN(v) || (v !== -1 && v < 1))
        return res.status(400).json({ success: false, message: 'maxTeachers must be -1 (unlimited) or ≥ 1' });
      update.maxTeachers = v;
    }
    if (maxStudents !== undefined) {
      const v = Number(maxStudents);
      if (isNaN(v) || (v !== -1 && v < 1))
        return res.status(400).json({ success: false, message: 'maxStudents must be -1 (unlimited) or ≥ 1' });
      update.maxStudents = v;
    }

    const center = await Center.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!center) return res.status(404).json({ success: false, message: 'Center not found' });

    await writeAuditLog({
      action: 'CENTER_LIMITS_UPDATED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: update, ip: req.ip,
    });

    res.json({ success: true, maxTeachers: center.maxTeachers, maxStudents: center.maxStudents });
  } catch (err) {
    logger.error('❌ Update limits error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/super-admin/broadcast — email all active center admins
router.post('/broadcast', verifySuperAdmin, validateBroadcast, async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject?.trim() || !message?.trim())
      return res.status(400).json({ success: false, message: 'Subject and message are required' });

    const centers = await Center.find({ status: 'active' }).select('centerName adminEmail').lean();
    let sent = 0, failed = 0;

    await Promise.all(centers.map(async (center) => {
      try {
        await sendEmail({
          to:      center.adminEmail,
          subject: subject.trim(),
          html: `
            <p>Dear <strong>${center.centerName}</strong> Admin,</p>
            <div style="white-space:pre-line">${message.trim()}</div>
            <br/>
            <p>— The ${config.appName} Team</p>
          `,
        });
        sent++;
      } catch { failed++; }
    }));

    await writeAuditLog({
      action: 'BROADCAST_SENT', superAdmin: req.superAdmin,
      details: { subject: subject.trim(), sent, failed, total: centers.length }, ip: req.ip,
    });

    res.json({ success: true, sent, failed, total: centers.length });
  } catch (err) {
    logger.error('❌ Broadcast error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/super-admin/chat-credits  — all centers' credit balances ─────────
router.get('/chat-credits', verifySuperAdmin, async (req, res) => {
  try {
    const centers = await Center.find({ status: 'active' })
      .select('centerName slug adminEmail plan chatCredits')
      .lean();

    const data = centers.map(c => ({
      _id:            c._id,
      centerName:     c.centerName,
      slug:           c.slug,
      adminEmail:     c.adminEmail,
      plan:           c.plan,
      balance:        c.chatCredits?.balance        ?? 0,
      totalAllocated: c.chatCredits?.totalAllocated ?? 0,
      used:           (c.chatCredits?.totalAllocated ?? 0) - (c.chatCredits?.balance ?? 0),
      log:            (c.chatCredits?.log || []).slice(-10).reverse(), // last 10, newest first
    }));

    // Summary totals
    const totalBalance   = data.reduce((n, c) => n + c.balance, 0);
    const totalAllocated = data.reduce((n, c) => n + c.totalAllocated, 0);
    const totalUsed      = data.reduce((n, c) => n + c.used, 0);

    res.json({ success: true, centers: data, totals: { totalBalance, totalAllocated, totalUsed } });
  } catch (err) {
    logger.error('Chat credits list error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/super-admin/chat-credits/:centerId  — allocate credits ──────────
router.post('/chat-credits/:centerId', verifySuperAdmin, validateChatCredits, async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1 || amount > 100000) {
      return res.status(400).json({ message: 'amount must be a number between 1 and 100,000' });
    }

    const center = await Center.findById(req.params.centerId);
    if (!center || center.status !== 'active') {
      return res.status(404).json({ message: 'Center not found or inactive' });
    }

    const logEntry = {
      amount,
      note:      note || 'Allocated by super admin',
      by:        req.user?.username || 'superadmin',
      createdAt: new Date(),
    };

    // Cap log at 50 entries
    const currentLog = center.chatCredits?.log || [];
    const trimmedLog = currentLog.length >= 50
      ? currentLog.slice(-49)
      : currentLog;

    await Center.findByIdAndUpdate(center._id, {
      $inc: {
        'chatCredits.balance':        amount,
        'chatCredits.totalAllocated': amount,
      },
      $set: {
        'chatCredits.log': [...trimmedLog, logEntry],
      },
    });

    const updated = await Center.findById(center._id).select('chatCredits centerName').lean();

    await writeAuditLog({
      action: 'CHAT_CREDITS_ALLOCATED', superAdmin: req.superAdmin,
      targetId: center._id.toString(), targetName: center.centerName,
      details: { amount, note }, ip: req.ip,
    });

    res.json({
      success:  true,
      message:  `${amount} credits allocated to ${center.centerName}`,
      balance:  updated.chatCredits.balance,
      totalAllocated: updated.chatCredits.totalAllocated,
    });
  } catch (err) {
    logger.error('Allocate chat credits error:', { error: err?.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
