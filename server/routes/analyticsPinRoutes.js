// server/routes/analyticsPinRoutes.js
// Admin analytics PIN — an optional 4-digit PIN that must be entered (once per
// login session) before revenue and analytics data are returned.
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { getAnalyticsAccess, signAnalyticsUnlock, ANALYTICS_UNLOCK_TTL } from "../middleware/analyticsPinMiddleware.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { config } from "../config/config.js";
import logger from "../utils/logger.js";
import { sendAnalyticsPinCodeEmail, sendAnalyticsPinChangedEmail } from "../utils/emailService.js";
import { badRequest, notFound, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware, verifyToken, verifyAdmin);

const getAdmin = (db) => db.models.Admin || db.model("Admin", adminSchema);

const PIN_RE        = /^\d{4}$/;
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000;

// Impersonation sessions have no admin record to attach a PIN to.
const rejectImpersonation = (req, res, next) => {
  if (req.user.isImpersonation) return badRequest(res, "Analytics PIN is not available during impersonation");
  next();
};

// Re-authenticate with the account password before changing PIN settings.
async function loadAdminWithPassword(req, res) {
  const { currentPassword } = req.body;
  if (!currentPassword || typeof currentPassword !== "string") {
    badRequest(res, "Current password is required");
    return null;
  }
  const admin = await getAdmin(req.db).findById(req.user.id).select("+password +analyticsPinHash");
  if (!admin) { notFound(res, "Admin account not found"); return null; }
  if (!await bcrypt.compare(currentPassword, admin.password)) {
    // 400, not 401 — the client treats 401 as an expired session and logs out
    badRequest(res, "Incorrect current password");
    return null;
  }
  return admin;
}

// GET /api/v1/admin/analytics-pin/status
router.get("/status", async (req, res) => {
  try {
    const { pinSet, unlocked } = await getAnalyticsAccess(req);
    res.json({ success: true, data: { pinSet, unlocked } });
  } catch (err) {
    logger.error("Analytics PIN status error:", { error: err?.message });
    serverError(res, "Error checking analytics PIN");
  }
});

// ── Changing the PIN needs the password AND a code sent to the account email ──
// Step 1  POST /request-change  { action: "set"|"remove", pin?, currentPassword }
//         → checks the password, emails a 6-digit code (valid 15 min)
// Step 2  POST /confirm-change  { code }
//         → applies the change and emails a "PIN was changed" alert
// Someone who only knows the password cannot change, reset or remove the PIN.

const CODE_TTL_MS     = 15 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_CODE_TRIES  = 5;

const maskEmail = (e = "") => {
  const [u, d] = String(e).split("@");
  if (!d) return "your email";
  return `${u.slice(0, 2)}${"*".repeat(Math.max(1, u.length - 2))}@${d}`;
};

// POST /api/v1/admin/analytics-pin/request-change
router.post("/request-change", rejectImpersonation, async (req, res) => {
  try {
    const { action, pin } = req.body;
    if (!["set", "remove"].includes(action)) return badRequest(res, "Invalid action");
    if (action === "set" && (typeof pin !== "string" || !PIN_RE.test(pin))) return badRequest(res, "PIN must be exactly 4 digits");

    const admin = await loadAdminWithPassword(req, res);
    if (!admin) return;
    if (action === "remove" && !admin.analyticsPinHash) return badRequest(res, "No analytics PIN is set");
    if (!admin.email) return badRequest(res, "Your account has no email address to send the code to");

    const pending = (await getAdmin(req.db).findById(admin._id).select("+analyticsPinPending").lean())?.analyticsPinPending;
    if (pending?.sentAt && Date.now() - new Date(pending.sentAt).getTime() < RESEND_AFTER_MS) {
      return res.status(429).json({ success: false, message: "A code was just sent. Please wait a minute before asking for another." });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const now  = new Date();
    await getAdmin(req.db).updateOne({ _id: admin._id }, {
      analyticsPinPending: {
        action,
        pinHash:   action === "set" ? await bcrypt.hash(pin, config.bcryptRounds) : null,
        codeHash:  await bcrypt.hash(code, 10),
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
        sentAt:    now,
        attempts:  0,
      },
    });

    await sendAnalyticsPinCodeEmail({
      email: admin.email, name: admin.firstName, code, action,
      centerName: req.center?.centerName || "", minutes: CODE_TTL_MS / 60000,
    });

    res.json({ success: true, data: { sentTo: maskEmail(admin.email), expiresIn: CODE_TTL_MS / 1000 } });
  } catch (err) {
    logger.error("Analytics PIN request-change error:", { error: err?.message });
    serverError(res, "Could not send the confirmation code");
  }
});

// POST /api/v1/admin/analytics-pin/confirm-change
router.post("/confirm-change", rejectImpersonation, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) return badRequest(res, "Enter the 6-digit code from the email");

    const Admin = getAdmin(req.db);
    // Reserve an attempt atomically so parallel guesses cannot bypass the limit
    const admin = await Admin.findOneAndUpdate(
      { _id: req.user.id, "analyticsPinPending.expiresAt": { $gt: new Date() } },
      { $inc: { "analyticsPinPending.attempts": 1 } },
      { new: true },
    ).select("+analyticsPinPending +analyticsPinHash");

    if (!admin?.analyticsPinPending) {
      return badRequest(res, "This code has expired or was already used. Please start again.");
    }
    const pending = admin.analyticsPinPending;
    if (pending.attempts > MAX_CODE_TRIES) {
      await Admin.updateOne({ _id: admin._id }, { analyticsPinPending: null });
      return res.status(429).json({ success: false, message: "Too many wrong codes. Please start again." });
    }
    if (!await bcrypt.compare(code, pending.codeHash)) {
      const left = MAX_CODE_TRIES - pending.attempts;
      return badRequest(res, left > 0 ? `Incorrect code. ${left} attempt${left > 1 ? "s" : ""} left.` : "Incorrect code. Please start again.");
    }

    const action = pending.action;
    const hadPin = !!admin.analyticsPinHash;
    if (action === "set") {
      admin.analyticsPinHash  = pending.pinHash;
      admin.analyticsPinSetAt = new Date();   // revokes existing unlock tokens
    } else {
      admin.analyticsPinHash  = null;
      admin.analyticsPinSetAt = null;
    }
    admin.analyticsPinFailedAttempts = 0;
    admin.analyticsPinLockedUntil    = null;
    admin.analyticsPinPending        = null;
    await admin.save();

    logger.info(`🔑 Analytics PIN ${action === "remove" ? "removed" : hadPin ? "changed" : "set"} (email-confirmed)`, { adminId: req.user.id, center: req.center.slug });
    sendAnalyticsPinChangedEmail({
      email: admin.email, name: admin.firstName, action, hadPin,
      centerName: req.center?.centerName || "",
    }).catch(err => logger.warn("PIN changed alert email failed:", { error: err?.message }));

    res.json({ success: true, data: { action }, message: action === "remove" ? "Analytics PIN removed" : "Analytics PIN saved" });
  } catch (err) {
    logger.error("Analytics PIN confirm-change error:", { error: err?.message });
    serverError(res, "Error confirming the PIN change");
  }
});

// POST /api/v1/admin/analytics-pin/verify — exchange the PIN for an unlock token
router.post("/verify", rejectImpersonation, async (req, res) => {
  try {
    const { pin } = req.body;
    if (typeof pin !== "string" || !PIN_RE.test(pin)) return badRequest(res, "PIN must be exactly 4 digits");

    const Admin = getAdmin(req.db);
    const now   = new Date();

    // Atomically reserve an attempt before comparing, so parallel guesses
    // can't all read the same counter and bypass the limit.
    const admin = await Admin.findOneAndUpdate(
      { _id: req.user.id, analyticsPinHash: { $ne: null }, $or: [{ analyticsPinLockedUntil: null }, { analyticsPinLockedUntil: { $lte: now } }] },
      { $inc: { analyticsPinFailedAttempts: 1 } },
      { new: true },
    ).select("+analyticsPinHash");

    if (!admin) {
      const existing = await Admin.findById(req.user.id).select("+analyticsPinHash analyticsPinLockedUntil").lean();
      if (!existing) return notFound(res, "Admin account not found");
      if (!existing.analyticsPinHash) return badRequest(res, "No analytics PIN is set");
      const mins = Math.max(1, Math.ceil((new Date(existing.analyticsPinLockedUntil) - Date.now()) / 60000));
      return res.status(429).json({ success: false, message: `Too many wrong attempts. Try again in ${mins} minute${mins > 1 ? "s" : ""}.` });
    }

    if (admin.analyticsPinFailedAttempts > MAX_ATTEMPTS) {
      await Admin.updateOne({ _id: admin._id }, { analyticsPinFailedAttempts: 0, analyticsPinLockedUntil: new Date(Date.now() + LOCKOUT_MS) });
      return res.status(429).json({ success: false, message: "Too many wrong attempts. Try again in 15 minutes." });
    }

    if (!await bcrypt.compare(pin, admin.analyticsPinHash)) {
      const remaining = MAX_ATTEMPTS - admin.analyticsPinFailedAttempts;
      if (remaining <= 0) {
        await Admin.updateOne({ _id: admin._id }, { analyticsPinFailedAttempts: 0, analyticsPinLockedUntil: new Date(Date.now() + LOCKOUT_MS) });
        logger.warn("Analytics PIN locked after repeated failures", { adminId: req.user.id, center: req.center.slug });
        return res.status(429).json({ success: false, message: "Too many wrong attempts. Try again in 15 minutes." });
      }
      return res.status(400).json({ success: false, message: `Incorrect PIN. ${remaining} attempt${remaining > 1 ? "s" : ""} left.` });
    }

    await Admin.updateOne({ _id: admin._id }, { analyticsPinFailedAttempts: 0, analyticsPinLockedUntil: null });

    res.json({ success: true, data: { unlockToken: signAnalyticsUnlock(req, admin), expiresIn: ANALYTICS_UNLOCK_TTL } });
  } catch (err) {
    logger.error("Analytics PIN verify error:", { error: err?.message });
    serverError(res, "Error verifying analytics PIN");
  }
});

export default router;
