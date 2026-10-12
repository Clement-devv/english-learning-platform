// server/routes/centerInviteRoutes.js
// "Create center" by invite. The super admin fills in only the basics; the center's
// admin finishes the setup from a link in their email (which also proves they own it).
//
//   centerInviteAdminRoutes  (super admin, mounted at /api/v1/super-admin/center-invites)
//     GET  /slug-available?slug=   is this web address free?
//     POST /                       { centerName, slug, adminEmail, plan, maxTeachers?, maxStudents? }
//                                  → center created as 'pending' + invite email
//     POST /:id/resend             new link (the old one stops working) + email again
//
//   centerInviteRoutes  (public — no tenantMiddleware, the center isn't live yet;
//                        mounted at /api/v1/center-invite)
//     GET  /:token                 what the invite page shows
//     POST /:token                 { firstName, lastName, password, country, address?, timezone, phone? }
//                                  → center goes live (utils/centerActivation.js)
//
// Links last INVITE_DAYS. Only a SHA-256 of the token is stored (Center.invite.tokenHash).
import express from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Center from '../models/master/Center.js';
import { verifySuperAdmin } from '../middleware/superAdminMiddleware.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/config.js';
import { sendEmail, getCenterBaseUrl } from '../emails/core.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { activateCenter } from '../utils/centerActivation.js';
import { centerEmailInUse, emailInUseMessage, isEmailTakenError } from '../utils/centerEmail.js';
import { validatePasswordStrength } from '../utils/passwordUtils.js';
import passwordHash from '../utils/passwordHash.js';
import logger from '../utils/logger.js';

const INVITE_DAYS = 7;
const PLANS = ['free', 'basic', 'pro', 'enterprise'];
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Subdomains the platform itself uses (slug.clemify.com)
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'mail', 'smtp', 'ftp', 'super-admin', 'superadmin', 'static', 'assets',
  'uploads', 'cdn', 'help', 'support', 'status', 'blog', 'docs', 'dev', 'test', 'staging', 'demo', 'login', 'register']);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const fail = (res, status, message) => res.status(status).json({ success: false, message });

function newInvite(superAdminId, sentCount = 0) {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    fields: {
      'invite.tokenHash': hashToken(token),
      'invite.expiresAt': new Date(Date.now() + INVITE_DAYS * 86400000),
      'invite.sentAt': new Date(),
      'invite.sentCount': sentCount + 1,
      'invite.invitedBy': superAdminId,
      'invite.acceptedAt': null,
    },
  };
}

const inviteUrl = (token) => `${config.frontendUrl}/center-invite/${token}`;

async function sendInviteEmail(center, token) {
  const url = inviteUrl(token);
  const result = await sendEmail({
    kind: 'Center invite',
    to: center.adminEmail,
    subject: `You're invited to set up ${center.centerName} on ${config.appName}`,
    html: `
      <p>Hello,</p>
      <p>Your school <strong>${esc(center.centerName)}</strong> has been created on ${esc(config.appName)}, and you are its administrator.</p>
      <p>Finish the setup — your name, your center's location and time zone, and your password:</p>
      <p style="margin:24px 0"><a href="${esc(url)}" style="background:#be185d;color:#fff;padding:13px 24px;border-radius:10px;text-decoration:none;font-weight:700">Set up my center</a></p>
      <p style="color:#64748b;font-size:13px">This link works once and expires in ${INVITE_DAYS} days. If you weren't expecting it, you can ignore this email.</p>
      <p style="color:#64748b;font-size:12px;word-break:break-all">Link not working? Copy this into your browser:<br>${esc(url)}</p>
    `,
  });
  return !!result?.success;
}

async function slugProblem(slug) {
  if (!SLUG_RE.test(slug)) return 'Use 1–40 lowercase letters, numbers or hyphens (not at the start or end)';
  if (RESERVED.has(slug)) return 'That web address is reserved — please choose another';
  if (await Center.exists({ slug })) return 'That web address is already taken';
  return null;
}

// ── Super admin ───────────────────────────────────────────────────────────────
export const centerInviteAdminRoutes = express.Router();
centerInviteAdminRoutes.use(verifySuperAdmin);

// Live check for the "Admin email" field
centerInviteAdminRoutes.get('/email-available', async (req, res) => {
  try {
    const email = str(req.query.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return res.json({ success: true, data: { email, available: false, reason: '' } });
    const taken = await centerEmailInUse(email);
    res.json({ success: true, data: { email, available: !taken, reason: taken ? emailInUseMessage(taken) : '' } });
  } catch (err) {
    logger.error('email check failed', { error: err?.message });
    fail(res, 500, 'Something went wrong');
  }
});

centerInviteAdminRoutes.get('/slug-available', async (req, res) => {
  try {
    const slug = str(req.query.slug, 60).toLowerCase();
    const problem = await slugProblem(slug);
    res.json({ success: true, data: { slug, available: !problem, reason: problem || '' } });
  } catch (err) {
    logger.error('slug check failed', { error: err?.message });
    fail(res, 500, 'Something went wrong');
  }
});

centerInviteAdminRoutes.post('/', strictLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    const centerName = str(b.centerName, 100);
    const slug = str(b.slug, 60).toLowerCase();
    const adminEmail = str(b.adminEmail, 254).toLowerCase();
    const plan = PLANS.includes(b.plan) ? b.plan : 'basic';
    const limit = (v) => (v === '' || v === undefined || v === null ? undefined : Math.max(-1, Math.min(100000, parseInt(v, 10) || 0)));

    if (centerName.length < 2) return fail(res, 400, 'Enter the center name');
    if (!EMAIL_RE.test(adminEmail)) return fail(res, 400, 'Enter a valid admin email');
    const taken = await centerEmailInUse(adminEmail);
    if (taken) return fail(res, 409, emailInUseMessage(taken));
    const problem = await slugProblem(slug);
    if (problem) return fail(res, slug && problem.includes('taken') ? 409 : 400, problem);

    const superAdminId = req.superAdmin._id.toString();
    const { token, fields } = newInvite(superAdminId);
    const maxTeachers = limit(b.maxTeachers);
    const maxStudents = limit(b.maxStudents);
    const center = await Center.create({
      centerName, slug, adminEmail, plan,
      dbName: `db_${slug}`,
      status: 'pending',
      registeredBy: req.superAdmin.email || superAdminId,
      ...(maxTeachers !== undefined && { maxTeachers }),
      ...(maxStudents !== undefined && { maxStudents }),
    });
    await Center.updateOne({ _id: center._id }, { $set: fields });

    const emailed = await sendInviteEmail(center, token);
    await writeAuditLog({
      action: 'CENTER_INVITED', superAdmin: req.superAdmin, targetId: center._id.toString(),
      targetName: centerName, details: { adminEmail, plan, emailed }, ip: req.ip,
    });

    res.status(201).json({
      success: true,
      data: { centerId: center._id, slug, adminEmail, emailed, inviteUrl: inviteUrl(token), expiresAt: fields['invite.expiresAt'] },
      message: emailed ? `Invite sent to ${adminEmail}` : 'Center created, but the invite email could not be sent — copy the link and send it yourself',
    });
  } catch (err) {
    if (isEmailTakenError(err)) return fail(res, 409, 'This email is already the admin of another center — use a different email');
    if (err?.code === 11000) return fail(res, 409, 'That web address is already taken');
    logger.error('Center invite failed', { error: err?.message });
    fail(res, 500, 'Something went wrong');
  }
});

centerInviteAdminRoutes.post('/:id/resend', strictLimiter, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid center');
    const center = await Center.findById(req.params.id).select('centerName slug adminEmail status invite pendingPasswordHash');
    if (!center) return fail(res, 404, 'Center not found');
    if (center.status !== 'pending') return fail(res, 400, `This center is already ${center.status}`);
    if (!center.invite?.sentAt) return fail(res, 400, 'This center registered itself — approve or reject it instead');
    const taken = await centerEmailInUse(center.adminEmail, { excludeId: center._id });
    if (taken) return fail(res, 409, `${emailInUseMessage(taken)} Delete this invited center or change its email.`);

    const { token, fields } = newInvite(req.superAdmin._id.toString(), center.invite.sentCount || 0);
    await Center.updateOne({ _id: center._id }, { $set: fields });
    const emailed = await sendInviteEmail(center, token);
    await writeAuditLog({ action: 'CENTER_INVITE_RESENT', superAdmin: req.superAdmin, targetId: center._id.toString(), targetName: center.centerName, details: { emailed }, ip: req.ip });
    res.json({
      success: true,
      data: { emailed, inviteUrl: inviteUrl(token), expiresAt: fields['invite.expiresAt'] },
      message: emailed ? `New invite sent to ${center.adminEmail}` : 'New link created, but the email could not be sent — copy the link and send it yourself',
    });
  } catch (err) {
    logger.error('Resend invite failed', { error: err?.message });
    fail(res, 500, 'Something went wrong');
  }
});

// ── Public: the invite page ───────────────────────────────────────────────────
export const centerInviteRoutes = express.Router();

const findByToken = (token) => Center.findOne({ 'invite.tokenHash': hashToken(token) })
  .select('centerName slug adminEmail plan status invite country timezone');

const inviteState = (c) => {
  if (!c) return { status: 404, message: 'This invite link is not valid. Ask for a new one.' };
  if (c.status !== 'pending' || c.invite?.acceptedAt) return { status: 410, message: 'This invite has already been used. You can log in to your center.' };
  if (!c.invite?.expiresAt || c.invite.expiresAt < new Date()) return { status: 410, message: 'This invite link has expired. Ask for a new one.' };
  return null;
};

centerInviteRoutes.get('/:token', async (req, res) => {
  try {
    const c = await findByToken(req.params.token);
    const bad = inviteState(c);
    if (bad) return fail(res, bad.status, bad.message);
    res.json({
      success: true,
      data: { centerName: c.centerName, slug: c.slug, adminEmail: c.adminEmail, plan: c.plan, expiresAt: c.invite.expiresAt },
    });
  } catch (err) {
    logger.error('Invite lookup failed', { error: err?.message });
    fail(res, 500, 'Something went wrong');
  }
});

const validTimeZone = (tz) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
};

centerInviteRoutes.post('/:token', strictLimiter, async (req, res) => {
  const b = req.body || {};
  const firstName = str(b.firstName, 60);
  const lastName = str(b.lastName, 60);
  const country = str(b.country, 80);
  const address = str(b.address, 200);
  const phone = str(b.phone, 40);
  const timezone = str(b.timezone, 60);
  const password = typeof b.password === 'string' ? b.password : '';

  if (!firstName || !lastName) return fail(res, 400, 'Enter your first and last name');
  if (!country) return fail(res, 400, "Enter your center's country");
  if (!timezone || !validTimeZone(timezone)) return fail(res, 400, 'Choose a valid time zone');
  const strength = validatePasswordStrength(password);
  if (!strength.isValid) return fail(res, 400, strength.errors?.[0] || 'Choose a stronger password');

  // Invites made before the one-email-per-center check could clash with a live center
  const pending = await findByToken(req.params.token);
  if (pending) {
    const taken = await centerEmailInUse(pending.adminEmail, { excludeId: pending._id });
    if (taken && taken.reason !== 'invited' && taken.reason !== 'pending') {
      return fail(res, 409, 'This email is already the admin of another center on our platform. Please contact support so we can set this center up with a different email.');
    }
  }

  // Claim the invite atomically — a double-click or a second tab can't create the center twice
  const now = new Date();
  const center = await Center.findOneAndUpdate(
    { 'invite.tokenHash': hashToken(req.params.token), status: 'pending', 'invite.acceptedAt': null, 'invite.expiresAt': { $gt: now } },
    { $set: { 'invite.acceptedAt': now } },
    { new: true },
  );
  if (!center) {
    const bad = inviteState(await findByToken(req.params.token));
    return fail(res, bad?.status || 410, bad?.message || 'This invite has already been used.');
  }

  try {
    center.country = country;
    center.timezone = timezone;
    if (address) center.address = address;
    if (phone) center.phone = phone;
    const hash = await passwordHash.hash(password, config.bcryptRounds);
    await activateCenter(center, { passwordHash: hash, firstName, lastName, approvedBy: center.invite.invitedBy || 'invite' });

    const loginUrl = `${getCenterBaseUrl(center).baseUrl}/admin/login`;
    sendEmail({
      kind: 'Center ready',
      centerName: center.centerName,
      to: center.adminEmail,
      subject: `${center.centerName} is ready`,
      html: `
        <p>Hi ${esc(firstName)},</p>
        <p>Your center <strong>${esc(center.centerName)}</strong> is set up and ready.</p>
        <p style="margin:22px 0"><a href="${esc(loginUrl)}" style="background:#be185d;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Log in to your admin dashboard</a></p>
        <p>Sign in with <strong>${esc(center.adminEmail)}</strong> and the password you just chose.</p>
        ${center.recoveryCode ? `<p style="color:#64748b;font-size:13px">Keep your account recovery code safe: <strong>${esc(center.recoveryCode)}</strong></p>` : ''}
      `,
    }).catch(() => {});
    if (config.superAdminEmail) {
      sendEmail({
        kind: 'Center invite accepted',
        to: config.superAdminEmail,
        subject: `${center.centerName} accepted its invite`,
        html: `<p><strong>${esc(firstName)} ${esc(lastName)}</strong> (${esc(center.adminEmail)}) finished setting up <strong>${esc(center.centerName)}</strong> (${esc(country)}). The center is now active.</p>`,
      }).catch(() => {});
    }

    res.json({ success: true, data: { centerName: center.centerName, slug: center.slug, adminEmail: center.adminEmail, loginUrl }, message: 'Your center is ready' });
  } catch (err) {
    // Let them try again with the same link
    await Center.updateOne({ _id: center._id, status: 'pending' }, { $set: { 'invite.acceptedAt': null } }).catch(() => {});
    logger.error('Invite acceptance failed', { error: err?.message, center: center.slug });
    fail(res, 500, 'We could not finish setting up your center. Please try again.');
  }
});
