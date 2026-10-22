// server/routes/superAdminTeamRoutes.js — mounted at /super-admin/team (no tenantMiddleware)
//
// Several people can run the platform together. Every super admin sees and manages the
// SAME centers and settings — an account only separates the login (password + emailed
// sign-in codes), devices, and who-did-what in the audit log.
//
// Super admins (verifySuperAdmin)
//   GET    /                — the team: accounts + pending invites
//   POST   /invite          { firstName, lastName, email } — email an invite link (7 days)
//   POST   /:id/resend      — new invite link for a pending invite
//   PATCH  /:id             { active } — switch an account off (signed out everywhere) / on
//   DELETE /:id             — remove an account or cancel an invite
//   POST   /:id/reset-password — email them a link to set a new password (1 hour)
//   POST   /me/password     { currentPassword, newPassword } — change your own password
//   Nobody can switch off or remove themselves, so there is always one active account.
//   The main super admin (made on the server, not invited) can't be reset from here —
//   they use scripts/resetSuperAdminPassword.js on the droplet.
//   Every change is emailed to the other super admins and written to the audit log.
//   A password change / reset signs that account out everywhere (passwordChangedAt).
// Public (the invited person / the person being reset)
//   GET    /invite/:token   — who the invite is for
//   POST   /invite/:token   { password } — set the password; then sign in as usual
//   GET    /reset/:token    — whose password is being reset
//   POST   /reset/:token    { password } — set the new password
import express from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "../utils/passwordHash.js";
import SuperAdmin from "../models/master/SuperAdmin.js";
import { verifySuperAdmin } from "../middleware/superAdminMiddleware.js";
import { apiLimiter, loginLimiter, emailLimiter, clearFailedAttempts } from "../middleware/rateLimiter.js";
import { addToLocalBlacklist } from "../middleware/authMiddleware.js";
import redisClient from "../config/redis.js";
import { config } from "../config/config.js";
import { validatePasswordStrength } from "../utils/passwordUtils.js";
import { sendEmail } from "../utils/emailService.js";
import { writeAuditLog } from "../utils/auditLog.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(apiLimiter);

const INVITE_DAYS = 7;
const RESET_MINUTES = 60;
const MIN_PASSWORD = 12; // same rule as scripts/createSuperAdmin.js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const isToken = (t) => typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fullName = (a) => `${a?.firstName || ""} ${a?.lastName || ""}`.trim();
const inviteUrl = (token) => `${config.frontendUrl.replace(/\/$/, "")}/super-admin/accept-invite/${token}`;
const resetUrl = (token) => `${config.frontendUrl.replace(/\/$/, "")}/super-admin/reset-password/${token}`;
/** Made on the server (scripts/createSuperAdmin.js), not invited — resets only on the droplet. */
const isMain = (a) => !a?.invitedBy;
const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Account as shown on the Team page. */
const view = (a, meId) => ({
  id: a._id,
  firstName: a.firstName, lastName: a.lastName, email: a.email,
  status: a.invite?.tokenHash ? "invited" : a.active === false ? "off" : "active",
  inviteExpiresAt: a.invite?.expiresAt || null,
  invitedBy: a.invitedBy || "",
  isMain: isMain(a),
  resetPending: !!(a.passwordReset?.tokenHash && new Date(a.passwordReset.expiresAt) > new Date()),
  lastLogin: a.lastLogin || null,
  activeSessions: (a.sessions || []).filter((s) => s.isActive).length,
  createdAt: a.createdAt,
  isYou: String(a._id) === String(meId),
});

async function teamView(meId) {
  const all = await SuperAdmin.find().select("+invite +passwordReset firstName lastName email active lastLogin sessions invitedBy createdAt").sort({ createdAt: 1 }).lean();
  return all.map((a) => view(a, meId));
}

/** Tell the other active super admins (security: nobody is added or removed quietly). */
async function notifyTeam(actor, subject, html) {
  const others = await SuperAdmin.find({ _id: { $ne: actor._id }, active: { $ne: false } }).select("email firstName").lean();
  await Promise.allSettled(others.map((o) => sendEmail({ to: o.email, subject: `${config.appName} — ${subject}`, html })));
}

/** Sign an account out of every device (sessions off + JWTs on the blacklist). */
async function signOutEverywhere(account) {
  const live = (account.sessions || []).filter((s) => s.isActive && s.jwtToken);
  for (const s of live) {
    addToLocalBlacklist(s.jwtToken);
    if (redisClient) {
      try {
        const exp = jwt.decode(s.jwtToken)?.exp;
        const ttl = exp ? exp - Math.floor(Date.now() / 1000) : 900;
        if (ttl > 0) await redisClient.setex(`bl:${s.jwtToken.split(".")[2]}`, ttl, "1");
      } catch { /* in-memory blacklist still covers this worker */ }
    }
  }
  account.sessions = (account.sessions || []).map((s) => { s.isActive = false; return s; });
}

/** New invite link on an account doc (returns the raw token — it is only ever emailed). */
function newInvite(account) {
  const token = crypto.randomBytes(32).toString("base64url");
  account.invite = { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 86400000), sentAt: new Date() };
  return token;
}

const sendInvite = (account, inviter, token) => sendEmail({
  to: account.email,
  subject: `${config.appName} — you're invited to manage the platform`,
  html: `
    <p>Hello ${esc(account.firstName)},</p>
    <p><strong>${esc(fullName(inviter))}</strong> (${esc(inviter.email)}) invited you to be a <strong>super admin</strong> of ${esc(config.appName)}.
    You'll see and manage the same centers and settings as the rest of the team, with your own login.</p>
    <p><a href="${inviteUrl(token)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#d97706;color:#fff;font-weight:700;text-decoration:none;">Set your password</a></p>
    <p>The link works for ${INVITE_DAYS} days. After that, each time you sign in we'll email you a 6-digit code.</p>
    <p>If you weren't expecting this, you can ignore this email.</p>`,
});

/** First problem with a new password, or "" if it's fine. */
function passwordProblem(password) {
  const strength = validatePasswordStrength(password);
  const problems = [...(password.length < MIN_PASSWORD ? [`Password must be at least ${MIN_PASSWORD} characters long`] : []), ...(strength.errors || [])];
  return problems[0] || "";
}

// ── Super admins ─────────────────────────────────────────────────────────────

router.get("/", verifySuperAdmin, async (req, res) => {
  try {
    ok(res, { data: await teamView(req.superAdmin._id) });
  } catch (err) {
    logger.error("Super admin team list error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/invite", verifySuperAdmin, emailLimiter, async (req, res) => {
  try {
    const firstName = text(req.body?.firstName, 60), lastName = text(req.body?.lastName, 60);
    const email = text(req.body?.email, 200).toLowerCase();
    if (!firstName || !lastName) return badRequest(res, "Enter their first and last name");
    if (!EMAIL_RE.test(email)) return badRequest(res, "Enter a valid email address");

    const existing = await SuperAdmin.findOne({ email }).select("+invite");
    if (existing && !existing.invite?.tokenHash) return conflict(res, "There is already a super admin with this email");

    // A pending invite to the same address is simply sent again with a fresh link
    const account = existing || new SuperAdmin({
      firstName, lastName, email, active: false, invitedBy: req.superAdmin.email,
      // Unusable until the invite sets a real password
      password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
    });
    if (existing) { account.firstName = firstName; account.lastName = lastName; }
    const token = newInvite(account);
    await account.save();

    const mail = await sendInvite(account, req.superAdmin, token);
    if (mail && mail.success === false) {
      logger.error("Super admin invite email failed", { error: mail.error });
      return serverError(res, "The invite was saved but the email could not be sent — try “Resend”.");
    }
    await writeAuditLog({ action: "SUPERADMIN_INVITED", superAdmin: req.superAdmin, targetId: String(account._id), targetName: email, ip: req.ip });
    notifyTeam(req.superAdmin, "a super admin was invited", `
      <p><strong>${esc(fullName(req.superAdmin))}</strong> invited <strong>${esc(fullName(account))}</strong> (${esc(email)}) to be a super admin.</p>
      <p>If you don't know about this, sign in and remove the invite from Team.</p>`).catch(() => {});
    created(res, { data: await teamView(req.superAdmin._id), message: `Invite sent to ${email}` });
  } catch (err) {
    if (err?.code === 11000) return conflict(res, "There is already a super admin with this email");
    logger.error("Super admin invite error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/me/password", verifySuperAdmin, loginLimiter, async (req, res) => {
  try {
    const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const password = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
    const me = await SuperAdmin.findById(req.superAdmin._id);
    if (!current || !(await bcrypt.compare(current, me.password))) return badRequest(res, "Your current password is not right");
    const problem = passwordProblem(password);
    if (problem) return badRequest(res, problem);
    if (await bcrypt.compare(password, me.password)) return badRequest(res, "Choose a password different from your current one");

    me.password = await bcrypt.hash(password, 12);
    me.passwordChangedAt = new Date();
    await signOutEverywhere(me);
    await me.save();
    await writeAuditLog({ action: "SUPERADMIN_PASSWORD_CHANGED", superAdmin: me, ip: req.ip });
    sendEmail({ to: me.email, subject: `${config.appName} — your super admin password was changed`, html: `
      <p>Hello ${esc(me.firstName)},</p>
      <p>Your super admin password was just changed and every device was signed out.</p>
      <p>If this wasn't you, ask another super admin to reset your password right away.</p>` }).catch(() => {});
    ok(res, { message: "Password changed. Please sign in again with your new password." });
  } catch (err) {
    logger.error("Super admin password change error:", { error: err?.message });
    serverError(res);
  }
});

/** A team member other than yourself. */
async function other(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { badRequest(res, "Invalid account"); return null; }
  if (String(req.params.id) === String(req.superAdmin._id)) { forbidden(res, "You can't change your own access here"); return null; }
  const account = await SuperAdmin.findById(req.params.id).select("+invite");
  if (!account) { notFound(res, "Account not found"); return null; }
  return account;
}

router.post("/:id/resend", verifySuperAdmin, emailLimiter, async (req, res) => {
  try {
    const account = await other(req, res);
    if (!account) return;
    if (!account.invite?.tokenHash) return badRequest(res, "This person has already accepted the invite");
    const token = newInvite(account);
    await account.save();
    const mail = await sendInvite(account, req.superAdmin, token);
    if (mail && mail.success === false) return serverError(res, "The email could not be sent — please try again shortly.");
    await writeAuditLog({ action: "SUPERADMIN_INVITE_RESENT", superAdmin: req.superAdmin, targetId: String(account._id), targetName: account.email, ip: req.ip });
    ok(res, { data: await teamView(req.superAdmin._id), message: `Invite sent again to ${account.email}` });
  } catch (err) {
    logger.error("Super admin invite resend error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/:id/reset-password", verifySuperAdmin, emailLimiter, async (req, res) => {
  try {
    const account = await other(req, res);
    if (!account) return;
    if (account.invite?.tokenHash) return badRequest(res, "They haven't accepted the invite yet — use “Resend” instead");
    if (isMain(account)) return forbidden(res, "The main super admin resets their password on the server");

    const token = crypto.randomBytes(32).toString("base64url");
    account.passwordReset = { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60000), sentAt: new Date(), by: req.superAdmin.email };
    // The old password stops working now, and every device is signed out
    account.password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    account.passwordChangedAt = new Date();
    await signOutEverywhere(account);
    await account.save();

    const mail = await sendEmail({
      to: account.email,
      subject: `${config.appName} — set a new super admin password`,
      html: `
        <p>Hello ${esc(account.firstName)},</p>
        <p><strong>${esc(fullName(req.superAdmin))}</strong> (${esc(req.superAdmin.email)}) reset your super admin password. Your old password no longer works.</p>
        <p><a href="${resetUrl(token)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#d97706;color:#fff;font-weight:700;text-decoration:none;">Set a new password</a></p>
        <p>The link works for ${RESET_MINUTES} minutes. If it runs out, ask them to send it again.</p>`,
    });
    if (mail && mail.success === false) {
      logger.error("Super admin reset email failed", { error: mail.error });
      return serverError(res, "Their password was reset but the email could not be sent — try again shortly.");
    }
    await writeAuditLog({ action: "SUPERADMIN_PASSWORD_RESET_SENT", superAdmin: req.superAdmin, targetId: String(account._id), targetName: account.email, ip: req.ip });
    notifyTeam(req.superAdmin, "a super admin password was reset", `
      <p><strong>${esc(fullName(req.superAdmin))}</strong> reset the password of <strong>${esc(fullName(account))}</strong> (${esc(account.email)}) and emailed them a link to set a new one.</p>`).catch(() => {});
    ok(res, { data: await teamView(req.superAdmin._id), message: `Reset link sent to ${account.email}` });
  } catch (err) {
    logger.error("Super admin password reset error:", { error: err?.message });
    serverError(res);
  }
});

router.patch("/:id", verifySuperAdmin, async (req, res) => {
  try {
    const account = await other(req, res);
    if (!account) return;
    if (typeof req.body?.active !== "boolean") return badRequest(res, "active must be true or false");
    if (account.invite?.tokenHash) return badRequest(res, "This invite hasn't been accepted yet — cancel it instead");
    account.active = req.body.active;
    if (!account.active) await signOutEverywhere(account);
    await account.save();
    await writeAuditLog({
      action: account.active ? "SUPERADMIN_ENABLED" : "SUPERADMIN_DISABLED",
      superAdmin: req.superAdmin, targetId: String(account._id), targetName: account.email, ip: req.ip,
    });
    notifyTeam(req.superAdmin, account.active ? "a super admin was switched back on" : "a super admin was switched off", `
      <p><strong>${esc(fullName(req.superAdmin))}</strong> switched ${account.active ? "on" : "off"} the super admin account of
      <strong>${esc(fullName(account))}</strong> (${esc(account.email)}).</p>`).catch(() => {});
    ok(res, { data: await teamView(req.superAdmin._id), message: account.active ? "Account switched on" : "Account switched off and signed out everywhere" });
  } catch (err) {
    logger.error("Super admin enable/disable error:", { error: err?.message });
    serverError(res);
  }
});

router.delete("/:id", verifySuperAdmin, async (req, res) => {
  try {
    const account = await other(req, res);
    if (!account) return;
    const wasInvite = !!account.invite?.tokenHash;
    await signOutEverywhere(account);
    await SuperAdmin.deleteOne({ _id: account._id });
    await writeAuditLog({
      action: wasInvite ? "SUPERADMIN_INVITE_CANCELLED" : "SUPERADMIN_REMOVED",
      superAdmin: req.superAdmin, targetId: String(account._id), targetName: account.email, ip: req.ip,
    });
    notifyTeam(req.superAdmin, wasInvite ? "a super admin invite was cancelled" : "a super admin was removed", `
      <p><strong>${esc(fullName(req.superAdmin))}</strong> ${wasInvite ? "cancelled the invite for" : "removed the super admin account of"}
      <strong>${esc(fullName(account))}</strong> (${esc(account.email)}).</p>`).catch(() => {});
    ok(res, { data: await teamView(req.superAdmin._id), message: wasInvite ? "Invite cancelled" : "Account removed" });
  } catch (err) {
    logger.error("Super admin remove error:", { error: err?.message });
    serverError(res);
  }
});

// ── Public: the invited person sets their password ───────────────────────────

async function findInvite(token) {
  if (!isToken(token)) return { status: 404 };
  const account = await SuperAdmin.findOne({ "invite.tokenHash": hashToken(token) }).select("+invite");
  if (!account) return { status: 404 };
  if (!account.invite.expiresAt || account.invite.expiresAt <= new Date()) return { status: 410, account };
  return { status: 200, account };
}
const INVITE_GONE = {
  404: "This invite link is not valid. It may have been used already or replaced by a newer one.",
  410: "This invite has expired. Ask the person who invited you to send it again.",
};

router.get("/invite/:token", loginLimiter, async (req, res) => {
  try {
    const r = await findInvite(req.params.token);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: INVITE_GONE[r.status] });
    const a = r.account;
    ok(res, { data: { firstName: a.firstName, lastName: a.lastName, email: a.email, invitedBy: a.invitedBy, expiresAt: a.invite.expiresAt, minLength: MIN_PASSWORD } });
  } catch (err) {
    logger.error("Super admin invite lookup error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/invite/:token", loginLimiter, async (req, res) => {
  try {
    const r = await findInvite(req.params.token);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: INVITE_GONE[r.status] });
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const problem = passwordProblem(password);
    if (problem) return badRequest(res, problem);

    const account = r.account;
    // Claim the invite atomically so the same link can't be used twice
    const claimed = await SuperAdmin.findOneAndUpdate(
      { _id: account._id, "invite.tokenHash": account.invite.tokenHash },
      { $set: { password: await bcrypt.hash(password, 12), active: true }, $unset: { invite: 1 } },
      { new: true },
    );
    if (!claimed) return res.status(404).json({ success: false, message: INVITE_GONE[404] });
    await writeAuditLog({ action: "SUPERADMIN_INVITE_ACCEPTED", superAdmin: claimed, ip: req.ip });
    notifyTeam(claimed, "a new super admin joined", `
      <p><strong>${esc(fullName(claimed))}</strong> (${esc(claimed.email)}) accepted the invite and is now a super admin.</p>`).catch(() => {});
    ok(res, { message: "Your password is set. Sign in with your email and password." });
  } catch (err) {
    logger.error("Super admin invite accept error:", { error: err?.message });
    serverError(res);
  }
});

// ── Public: the person being reset sets a new password ──────────────────────

async function findReset(token) {
  if (!isToken(token)) return { status: 404 };
  const account = await SuperAdmin.findOne({ "passwordReset.tokenHash": hashToken(token) }).select("+passwordReset");
  if (!account) return { status: 404 };
  if (!account.passwordReset.expiresAt || account.passwordReset.expiresAt <= new Date()) return { status: 410, account };
  return { status: 200, account };
}
const RESET_GONE = {
  404: "This reset link is not valid. It may have been used already or replaced by a newer one.",
  410: "This reset link has expired. Ask another super admin to send a new one.",
};

router.get("/reset/:token", loginLimiter, async (req, res) => {
  try {
    const r = await findReset(req.params.token);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: RESET_GONE[r.status] });
    const a = r.account;
    ok(res, { data: { firstName: a.firstName, lastName: a.lastName, email: a.email, expiresAt: a.passwordReset.expiresAt, minLength: MIN_PASSWORD } });
  } catch (err) {
    logger.error("Super admin reset lookup error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/reset/:token", loginLimiter, async (req, res) => {
  try {
    const r = await findReset(req.params.token);
    if (r.status !== 200) return res.status(r.status).json({ success: false, message: RESET_GONE[r.status] });
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const problem = passwordProblem(password);
    if (problem) return badRequest(res, problem);

    const account = r.account;
    // Claim the link atomically so it can't be used twice
    const claimed = await SuperAdmin.findOneAndUpdate(
      { _id: account._id, "passwordReset.tokenHash": account.passwordReset.tokenHash },
      { $set: { password: await bcrypt.hash(password, 12), passwordChangedAt: new Date() }, $unset: { passwordReset: 1 } },
      { new: true },
    );
    if (!claimed) return res.status(404).json({ success: false, message: RESET_GONE[404] });
    await clearFailedAttempts(claimed.email, "superadmin").catch(() => {}); // locked out by wrong tries → unlocked
    await writeAuditLog({ action: "SUPERADMIN_PASSWORD_RESET_DONE", superAdmin: claimed, ip: req.ip });
    notifyTeam(claimed, "a super admin set a new password", `
      <p><strong>${esc(fullName(claimed))}</strong> (${esc(claimed.email)}) set a new password using a reset link.</p>`).catch(() => {});
    ok(res, { message: "Your new password is set. Sign in with your email and password." });
  } catch (err) {
    logger.error("Super admin reset accept error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
