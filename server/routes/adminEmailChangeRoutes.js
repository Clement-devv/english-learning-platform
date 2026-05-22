// server/routes/adminEmailChangeRoutes.js
// Three endpoints for admin self-service email change + cancel.
// verify/cancel are token-based (no JWT) so email prefetchers cannot trigger them.

import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Center from '../models/master/Center.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken, verifyAdmin } from '../middleware/authMiddleware.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { getDb } from '../config/dbManager.js';
import { adminSchema } from '../schemas/adminSchema.js';
import { writeAuditLog } from '../utils/auditLog.js';
import {
  sendOldEmailAlert,
  sendNewEmailVerification,
  sendCancelNotification,
} from '../emails/adminEmailChangeEmails.js';
import { config } from '../config/config.js';
import { sendEmail } from '../emails/core.js';
import logger from '../utils/logger.js';
import { ok, badRequest, notFound, serverError } from '../utils/apiResponse.js';

const router = express.Router();

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
const getAdmin  = (db) => db.models.Admin || db.model('Admin', adminSchema);

// Clears the sessions array so the token-based refresh mechanism stops working.
// Existing JWTs remain valid until their natural expiry (~1 h) — acceptable
// given the 48 h cancel window as the primary protection.
async function clearAdminSessions(admin) {
  admin.sessions = [];
  await admin.save();
}

// ── POST /request ─────────────────────────────────────────────────────────────
router.post('/request', tenantMiddleware, strictLimiter, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return badRequest(res, 'currentPassword is required');
    }
    if (!newEmail || typeof newEmail !== 'string') {
      return badRequest(res, 'newEmail is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return badRequest(res, 'Invalid email address');
    }

    const normalizedNew = newEmail.toLowerCase().trim();

    const center = await Center.findById(req.center._id)
      .select('+pendingEmailChange.token +pendingEmailChange.cancelToken');
    if (!center) return notFound(res, 'Center not found');

    if (normalizedNew === center.adminEmail.toLowerCase()) {
      return badRequest(res, 'New email must be different from your current email');
    }

    // Re-authenticate — JWT alone is not enough to authorise an email change
    const Admin = getAdmin(req.db);
    const admin = await Admin.findById(req.user.id).select('+password');
    if (!admin) return notFound(res, 'Admin account not found');

    const pwOk = await bcrypt.compare(currentPassword, admin.password);
    if (!pwOk) {
      return res.status(401).json({ success: false, message: 'Incorrect current password' });
    }

    // Block if new email is already in use by another center
    const conflict = await Center.findOne({ adminEmail: normalizedNew, _id: { $ne: center._id } });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'This email address is already in use' });
    }

    const rawVerifyToken = crypto.randomBytes(32).toString('hex');
    const rawCancelToken = crypto.randomBytes(32).toString('hex');

    center.pendingEmailChange = {
      previousEmail:   center.adminEmail,
      newEmail:        normalizedNew,
      token:           hashToken(rawVerifyToken),
      expiresAt:       new Date(Date.now() + 60 * 60 * 1000),       // 1 h to verify
      requestedAt:     new Date(),
      requestIp:       req.ip || null,
      cancelToken:     hashToken(rawCancelToken),
      cancelExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),  // 48 h cancel window
    };
    await center.save();

    sendOldEmailAlert(center, normalizedNew, rawCancelToken)
      .catch(e => logger.warn('Old-email alert failed:', { error: e?.message }));
    sendNewEmailVerification(center, normalizedNew, rawVerifyToken)
      .catch(e => logger.warn('New-email verify send failed:', { error: e?.message }));

    return ok(res, { message: 'Verification email sent to the new address' });
  } catch (err) {
    logger.error('Email change request error:', { error: err?.message });
    return serverError(res, 'Failed to process request', err);
  }
});

// ── POST /verify ──────────────────────────────────────────────────────────────
// Token sent as JSON body — NOT a GET — so email clients that pre-fetch links
// cannot accidentally complete the change before the admin clicks.
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return badRequest(res, 'Token is required');

    const hashed = hashToken(token);
    const center = await Center.findOne({ 'pendingEmailChange.token': hashed })
      .select('+pendingEmailChange.token +pendingEmailChange.cancelToken');

    if (!center || !center.pendingEmailChange?.token) {
      return res.status(410).json({ success: false, message: 'This link is invalid or has already been used' });
    }

    if (new Date() > center.pendingEmailChange.expiresAt) {
      center.pendingEmailChange = {};
      await center.save();
      return res.status(410).json({
        success: false,
        expired: true,
        message: 'This verification link has expired. Please request a new email change.',
      });
    }

    const { previousEmail, newEmail, cancelToken, cancelExpiresAt } = center.pendingEmailChange;

    // Apply the email change
    center.adminEmail = newEmail;
    // Clear verify token; keep cancelToken so the original cancel link still works
    center.pendingEmailChange = {
      previousEmail,
      newEmail:       null,       // null signals to cancel endpoint: change was completed
      token:          null,
      expiresAt:      null,
      requestedAt:    center.pendingEmailChange.requestedAt,
      requestIp:      center.pendingEmailChange.requestIp,
      cancelToken,                // kept — raw cancel link already in the old-email alert
      cancelExpiresAt,
    };
    await center.save();

    // Update Admin doc in the center's tenant DB + clear all sessions
    const db    = await getDb(center.slug);
    const Admin = getAdmin(db);
    const admin = await Admin.findOne({ role: 'admin' });
    if (admin) {
      admin.email    = newEmail;
      admin.username = newEmail.split('@')[0];
      await clearAdminSessions(admin);
    }

    // Notify previous email — the cancel link in the original alert is still valid
    sendEmail({
      centerName: center.centerName,
      to: previousEmail,
      subject: `Confirmation: Admin login email for ${center.centerName} changed`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:24px;border-radius:10px 10px 0 0;text-align:center">
          <h2 style="margin:0">&#10003; Email Change Completed</h2>
        </div>
        <div style="background:#f9f9f9;padding:24px;border-radius:0 0 10px 10px">
          <p>The admin login email for <strong>${center.centerName}</strong> has been changed to <strong>${newEmail}</strong>.</p>
          <p>If you did not authorise this, use the <strong>Cancel This Change</strong> link in the security alert email we sent earlier. That link is still valid.</p>
          <p style="color:#666;font-size:13px">Need help? Contact support at ${process.env.SUPER_ADMIN_EMAIL || config.emailFrom || 'support'}.</p>
        </div>
      </div>`,
    }).catch(e => logger.warn('Completion confirmation email failed:', { error: e?.message }));

    // Silent notification to super admin
    sendEmail({
      to: process.env.SUPER_ADMIN_EMAIL || config.emailFrom || config.emailUser,
      subject: `[${config.appName || 'ELP'}] Admin email changed — ${center.centerName}`,
      html: `<p>Admin email for <strong>${center.centerName}</strong> changed from <em>${previousEmail}</em> to <em>${newEmail}</em>.</p>`,
    }).catch(e => logger.warn('SA change notification failed:', { error: e?.message }));

    await writeAuditLog({
      action:     'ADMIN_EMAIL_CHANGED',
      superAdmin: null,
      targetId:   center._id.toString(),
      targetName: center.centerName,
      details:    { previousEmail, newEmail },
      ip:         req.ip,
    });

    return ok(res, { message: 'Email changed successfully. All sessions have been signed out.' });
  } catch (err) {
    logger.error('Email change verify error:', { error: err?.message });
    return serverError(res, 'Failed to verify email change', err);
  }
});

// ── POST /cancel ──────────────────────────────────────────────────────────────
// Works both before and after verification (within 48 h of the original request).
router.post('/cancel', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return badRequest(res, 'Token is required');

    const hashed = hashToken(token);
    const center = await Center.findOne({ 'pendingEmailChange.cancelToken': hashed })
      .select('+pendingEmailChange.token +pendingEmailChange.cancelToken');

    if (!center || !center.pendingEmailChange?.cancelToken) {
      return res.status(410).json({ success: false, message: 'This cancel link is invalid or has already been used' });
    }

    if (new Date() > center.pendingEmailChange.cancelExpiresAt) {
      return res.status(410).json({ success: false, message: 'This cancel link has expired' });
    }

    const { previousEmail, newEmail: pendingNewEmail } = center.pendingEmailChange;
    // pendingNewEmail is null when verify was already completed
    const changeWasCompleted = !pendingNewEmail;

    if (changeWasCompleted) {
      // Reverse: restore the previous email
      const cancelledEmail = center.adminEmail;
      center.adminEmail = previousEmail;
      center.pendingEmailChange = {};
      await center.save();

      const db    = await getDb(center.slug);
      const Admin = getAdmin(db);
      // The admin doc now has the new email — find by it
      const admin = await Admin.findOne({ email: cancelledEmail });
      if (admin) {
        admin.email    = previousEmail;
        admin.username = previousEmail.split('@')[0];
        await clearAdminSessions(admin);
      }

      sendCancelNotification(center, previousEmail, cancelledEmail)
        .catch(e => logger.warn('Cancel notification failed:', { error: e?.message }));

      await writeAuditLog({
        action:     'ADMIN_EMAIL_CHANGE_CANCELLED',
        superAdmin: null,
        targetId:   center._id.toString(),
        targetName: center.centerName,
        details:    { restoredEmail: previousEmail, cancelledEmail, reversed: true },
        ip:         req.ip,
      });

      return ok(res, { message: 'Email change reversed. Your original email has been restored.' });
    } else {
      // Still pending — just clear
      center.pendingEmailChange = {};
      await center.save();

      sendEmail({
        centerName: center.centerName,
        to: center.adminEmail,
        subject: `Email change request cancelled — ${center.centerName}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:24px;border-radius:10px 10px 0 0;text-align:center">
            <h2 style="margin:0">&#10003; Email Change Cancelled</h2>
          </div>
          <div style="background:#f9f9f9;padding:24px;border-radius:0 0 10px 10px">
            <p>Your pending request to change the admin login email for <strong>${center.centerName}</strong> to <em>${pendingNewEmail}</em> has been cancelled.</p>
            <p>Your email address remains <strong>${center.adminEmail}</strong>. No changes have been made.</p>
            <p style="color:#666;font-size:13px">If you did not request this cancellation, contact support at ${process.env.SUPER_ADMIN_EMAIL || config.emailFrom || 'support'}.</p>
          </div>
        </div>`,
      }).catch(e => logger.warn('Pending-cancel confirmation email failed:', { error: e?.message }));

      await writeAuditLog({
        action:     'ADMIN_EMAIL_CHANGE_CANCELLED',
        superAdmin: null,
        targetId:   center._id.toString(),
        targetName: center.centerName,
        details:    { cancelledPending: true, cancelledNewEmail: pendingNewEmail },
        ip:         req.ip,
      });

      return ok(res, { message: 'Email change cancelled. Your email remains unchanged.' });
    }
  } catch (err) {
    logger.error('Email change cancel error:', { error: err?.message });
    return serverError(res, 'Failed to cancel email change', err);
  }
});

export default router;
