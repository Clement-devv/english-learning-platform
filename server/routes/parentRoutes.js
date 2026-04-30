import express          from 'express';
import bcrypt           from 'bcryptjs';
import jwt              from 'jsonwebtoken';
import crypto           from 'crypto';

import { parentSchema }      from '../schemas/parentSchema.js';
import { studentSchema }     from '../schemas/studentSchema.js';
import { bookingSchema }     from '../schemas/bookingSchema.js';
import { homeworkSchema }    from '../schemas/homeworkSchema.js';
import { certificateSchema } from '../schemas/certificateSchema.js';

import { tenantMiddleware }              from '../middleware/tenantMiddleware.js';
import { verifyToken, verifyAdmin }      from '../middleware/authMiddleware.js';
import { loginLimiter, passwordResetLimiter } from '../middleware/rateLimiter.js';
import { config, JWT_STANDARD_CLAIMS }  from '../config/config.js';
import { createSession, cleanExpiredSessions, pruneSessionsToLimit } from '../utils/sessionManager.js';
import { validatePasswordStrength }     from '../utils/passwordUtils.js';
import { sendParentInviteEmail }        from '../utils/emailService.js';
import logger from '../utils/logger.js';
import { badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();

// ── Model helpers ─────────────────────────────────────────────────────────────
const getParent      = (db) => db.models.Parent      || db.model('Parent',      parentSchema);
const getStudent     = (db) => db.models.Student     || db.model('Student',     studentSchema);
const getBooking     = (db) => db.models.Booking     || db.model('Booking',     bookingSchema);
const getHomework    = (db) => db.models.Homework    || db.model('Homework',    homeworkSchema);
const getCertificate = (db) => db.models.Certificate || db.model('Certificate', certificateSchema);

// ── verifyParent middleware ────────────────────────────────────────────────────
const verifyParent = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return unauthorized(res, 'No token provided');
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== 'parent') return forbidden(res, 'Parent access required');
    if (decoded.centerId !== req.center.slug) return forbidden(res, 'Token not valid for this center');
    const Parent = getParent(req.db);
    const parent = await Parent.findById(decoded.id).select('-password');
    if (!parent || !parent.active) return unauthorized(res, 'Invalid token or inactive account');
    req.parent = parent;
    next();
  } catch {
    return unauthorized(res, 'Invalid token');
  }
};

// ────────────────────────────────────────────────────────────────────────────
// PUBLIC AUTH ROUTES
// ────────────────────────────────────────────────────────────────────────────

// POST /parents/login
router.post('/login', tenantMiddleware, loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return badRequest(res, 'Email and password are required');

    const Parent = getParent(req.db);
    const parent = await Parent.findOne({ email: email.trim().toLowerCase() });

    if (!parent || !parent.active) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, parent.password);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign(
      { ...JWT_STANDARD_CLAIMS, id: parent._id, email: parent.email, role: 'parent', centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    parent.sessions = cleanExpiredSessions(parent.sessions || []);
    parent.sessions.push(session);
    parent.sessions = pruneSessionsToLimit(parent.sessions);
    parent.lastLogin = new Date();
    await parent.save();

    res.json({
      success: true, token, sessionToken: session.token,
      parent: {
        id: parent._id, email: parent.email,
        firstName: parent.firstName, lastName: parent.lastName,
      },
    });
  } catch (err) {
    logger.error('Parent login error:', { error: err?.message });
    serverError(res, 'Server error during login');
  }
});

// GET /parents/verify
router.get('/verify', tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return unauthorized(res, 'No token provided');
    const decoded = jwt.verify(token, config.jwtSecret);
    const Parent  = getParent(req.db);
    const parent  = await Parent.findById(decoded.id).select('-password');
    if (!parent || !parent.active) return unauthorized(res, 'Invalid token or inactive account');
    res.json({ success: true, parent });
  } catch {
    unauthorized(res, 'Invalid token');
  }
});

// POST /parents/setup/:token — parent sets password from invite
router.post('/setup/:token', tenantMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return badRequest(res, 'Password is required');

    const { isValid, errors } = validatePasswordStrength(password);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const Parent = getParent(req.db);
    const parent = await Parent.findOne({
      inviteToken:   hashed,
      inviteExpires: { $gt: Date.now() },
    });

    if (!parent) return badRequest(res, 'Invalid or expired invite link. Please ask admin to resend.');

    parent.password       = await bcrypt.hash(password, config.bcryptRounds);
    parent.inviteToken    = undefined;
    parent.inviteExpires  = undefined;
    parent.active         = true;
    parent.status         = 'active';
    parent.lastPasswordChange = new Date();
    await parent.save();

    res.json({ success: true, message: 'Account set up successfully. You can now log in.' });
  } catch (err) {
    logger.error('Parent setup error:', { error: err?.message });
    serverError(res, 'Server error during account setup');
  }
});

// POST /parents/forgot-password
router.post('/forgot-password', tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return badRequest(res, 'Email is required');

    const Parent = getParent(req.db);
    const parent = await Parent.findOne({ email: email.trim().toLowerCase() });

    if (!parent || !parent.active) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent' });
    }

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    parent.resetPasswordToken   = hashedToken;
    parent.resetPasswordExpires = Date.now() + 3600000;
    await parent.save();

    const baseUrl  = req.center.customDomain && req.center.domainVerified ? `https://${req.center.customDomain}` : config.frontendUrl;
    const resetUrl = `${baseUrl}/parent/reset-password/${rawToken}`;

    // Fire-and-forget email (reuse student forgot-password email style)
    try {
      const { sendEmail } = await import('../emails/core.js');
      await sendEmail({
        centerName: req.center.centerName,
        to: parent.email,
        subject: `Reset your password — ${req.center.centerName || config.appName}`,
        html: `<p>Hi ${parent.firstName},</p><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p><p>If you did not request this, ignore this email.</p>`,
      });
    } catch (e) { logger.error('Parent forgot-password email failed:', { error: e?.message }); }

    res.json({ success: true, message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    logger.error('Parent forgot password error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// POST /parents/reset-password/:token
router.post('/reset-password/:token', tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return badRequest(res, 'New password is required');

    const { isValid, errors } = validatePasswordStrength(password);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const Parent = getParent(req.db);
    const parent = await Parent.findOne({
      resetPasswordToken:   hashed,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!parent) return badRequest(res, 'Invalid or expired reset link. Please request a new one.');

    parent.password             = await bcrypt.hash(password, config.bcryptRounds);
    parent.lastPasswordChange   = new Date();
    parent.resetPasswordToken   = undefined;
    parent.resetPasswordExpires = undefined;
    await parent.save();

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    logger.error('Parent reset password error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PARENT DASHBOARD ROUTES (own profile + children data)
// ────────────────────────────────────────────────────────────────────────────

// GET /parents/me — profile + children list with quick stats
router.get('/me', tenantMiddleware, verifyParent, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const children = await Student.find({ _id: { $in: req.parent.children } })
      .select('firstName lastName email classCredits status active')
      .lean();

    res.json({
      success: true,
      parent: {
        id: req.parent._id,
        firstName: req.parent.firstName,
        lastName: req.parent.lastName,
        email: req.parent.email,
        phone: req.parent.phone,
      },
      children,
    });
  } catch (err) {
    logger.error('Parent /me error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// GET /parents/me/child/:studentId/classes
router.get('/me/child/:studentId/classes', tenantMiddleware, verifyParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!req.parent.children.map(String).includes(studentId)) {
      return forbidden(res, 'Access denied to this student');
    }

    const Booking = getBooking(req.db);
    const bookings = await Booking.find({ studentId })
      .populate('teacherId', 'firstName lastName')
      .sort({ scheduledTime: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, bookings });
  } catch (err) {
    logger.error('Parent child classes error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// GET /parents/me/child/:studentId/homework
router.get('/me/child/:studentId/homework', tenantMiddleware, verifyParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!req.parent.children.map(String).includes(studentId)) {
      return forbidden(res, 'Access denied to this student');
    }

    const Homework = getHomework(req.db);
    const homework = await Homework.find({ studentId })
      .populate('teacherId', 'firstName lastName')
      .sort({ dueDate: -1, createdAt: -1 })
      .limit(60)
      .lean();

    res.json({ success: true, homework });
  } catch (err) {
    logger.error('Parent child homework error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// GET /parents/me/child/:studentId/certificates
router.get('/me/child/:studentId/certificates', tenantMiddleware, verifyParent, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!req.parent.children.map(String).includes(studentId)) {
      return forbidden(res, 'Access denied to this student');
    }

    const Certificate = getCertificate(req.db);
    const certificates = await Certificate.find({ studentId, revokedAt: null })
      .sort({ issuedAt: -1 })
      .lean();

    res.json({ success: true, certificates });
  } catch (err) {
    logger.error('Parent child certificates error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// ADMIN CRUD ROUTES
// ────────────────────────────────────────────────────────────────────────────

// GET /parents — list all parents
router.get('/', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Parent  = getParent(req.db);
    const Student = getStudent(req.db);

    // ensure Student is registered so populate works
    if (!req.db.models.Student) req.db.model('Student', studentSchema);

    const parents = await Parent.find()
      .populate('children', 'firstName lastName email classCredits status')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, parents });
  } catch (err) {
    logger.error('List parents error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// POST /parents — admin creates parent + sends invite
router.post('/', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, children, notes } = req.body;
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return badRequest(res, 'First name, last name, and email are required');
    }

    const Parent = getParent(req.db);
    const exists = await Parent.findOne({ email: email.trim().toLowerCase() });
    if (exists) return conflict(res, 'A parent with this email already exists');

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const parent = await Parent.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim().toLowerCase(),
      phone:     phone?.trim() || '',
      notes:     notes?.trim() || '',
      children:  Array.isArray(children) ? children : [],
      active:    false,
      status:    'pending',
      inviteToken:   hashedToken,
      inviteExpires: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
    });

    const baseUrl  = req.center.customDomain && req.center.domainVerified ? `https://${req.center.customDomain}` : config.frontendUrl;
    const setupUrl = `${baseUrl}/parent/setup/${rawToken}`;

    sendParentInviteEmail(parent, setupUrl, req.center?.centerName || '').catch(e =>
      logger.error('Parent invite email failed:', { error: e?.message })
    );

    const populated = await Parent.findById(parent._id)
      .populate('children', 'firstName lastName email classCredits status')
      .lean();

    res.status(201).json({ success: true, parent: populated, message: 'Parent created and invite sent' });
  } catch (err) {
    logger.error('Create parent error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// GET /parents/:id
router.get('/:id', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!req.db.models.Student) req.db.model('Student', studentSchema);
    const Parent = getParent(req.db);
    const parent = await Parent.findById(req.params.id)
      .populate('children', 'firstName lastName email classCredits status active')
      .lean();
    if (!parent) return notFound(res, 'Parent not found');
    res.json({ success: true, parent });
  } catch (err) {
    serverError(res, 'Server error');
  }
});

// PATCH /parents/:id — update parent (name, email, phone, children, notes)
router.patch('/:id', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, phone, children, notes } = req.body;
    const Parent = getParent(req.db);
    const parent = await Parent.findById(req.params.id);
    if (!parent) return notFound(res, 'Parent not found');

    if (firstName !== undefined) parent.firstName = firstName.trim();
    if (lastName  !== undefined) parent.lastName  = lastName.trim();
    if (phone     !== undefined) parent.phone     = phone.trim();
    if (notes     !== undefined) parent.notes     = notes.trim();
    if (Array.isArray(children)) parent.children  = children;
    if (email !== undefined) {
      const emailLow = email.trim().toLowerCase();
      if (emailLow !== parent.email) {
        const clash = await Parent.findOne({ email: emailLow, _id: { $ne: parent._id } });
        if (clash) return conflict(res, 'Email already in use');
        parent.email = emailLow;
      }
    }

    await parent.save();

    if (!req.db.models.Student) req.db.model('Student', studentSchema);
    const updated = await Parent.findById(parent._id)
      .populate('children', 'firstName lastName email classCredits status')
      .lean();

    res.json({ success: true, parent: updated, message: 'Parent updated' });
  } catch (err) {
    logger.error('Update parent error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

// DELETE /parents/:id — deactivate
router.delete('/:id', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Parent = getParent(req.db);
    const parent = await Parent.findById(req.params.id);
    if (!parent) return notFound(res, 'Parent not found');
    parent.active = false;
    parent.status = 'pending';
    await parent.save();
    res.json({ success: true, message: 'Parent deactivated' });
  } catch (err) {
    serverError(res, 'Server error');
  }
});

// POST /parents/:id/resend-invite
router.post('/:id/resend-invite', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Parent = getParent(req.db);
    const parent = await Parent.findById(req.params.id);
    if (!parent) return notFound(res, 'Parent not found');
    if (parent.active) return badRequest(res, 'Parent has already set up their account');

    const rawToken    = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    parent.inviteToken   = hashedToken;
    parent.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await parent.save();

    const baseUrl  = req.center.customDomain && req.center.domainVerified ? `https://${req.center.customDomain}` : config.frontendUrl;
    const setupUrl = `${baseUrl}/parent/setup/${rawToken}`;

    await sendParentInviteEmail(parent, setupUrl, req.center?.centerName || '').catch(e =>
      logger.error('Parent resend invite email failed:', { error: e?.message })
    );

    res.json({ success: true, message: 'Invite resent' });
  } catch (err) {
    logger.error('Resend parent invite error:', { error: err?.message });
    serverError(res, 'Server error');
  }
});

export default router;
