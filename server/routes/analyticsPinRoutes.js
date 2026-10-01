// server/routes/analyticsPinRoutes.js
// Admin analytics PIN — an optional 4-digit PIN that must be entered (once per
// login session) before revenue and analytics data are returned.
import express from "express";
import bcrypt from "bcryptjs";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { getAnalyticsAccess, signAnalyticsUnlock, ANALYTICS_UNLOCK_TTL } from "../middleware/analyticsPinMiddleware.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { config } from "../config/config.js";
import logger from "../utils/logger.js";
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

// PUT /api/v1/admin/analytics-pin — set or change the PIN
router.put("/", rejectImpersonation, async (req, res) => {
  try {
    const { pin } = req.body;
    if (typeof pin !== "string" || !PIN_RE.test(pin)) return badRequest(res, "PIN must be exactly 4 digits");

    const admin = await loadAdminWithPassword(req, res);
    if (!admin) return;

    admin.analyticsPinHash           = await bcrypt.hash(pin, config.bcryptRounds);
    admin.analyticsPinSetAt          = new Date();   // revokes existing unlock tokens
    admin.analyticsPinFailedAttempts = 0;
    admin.analyticsPinLockedUntil    = null;
    await admin.save();

    res.json({ success: true, message: "Analytics PIN saved" });
  } catch (err) {
    logger.error("Analytics PIN set error:", { error: err?.message });
    serverError(res, "Error saving analytics PIN");
  }
});

// DELETE /api/v1/admin/analytics-pin — remove the PIN
router.delete("/", rejectImpersonation, async (req, res) => {
  try {
    const admin = await loadAdminWithPassword(req, res);
    if (!admin) return;

    admin.analyticsPinHash           = null;
    admin.analyticsPinSetAt          = null;
    admin.analyticsPinFailedAttempts = 0;
    admin.analyticsPinLockedUntil    = null;
    await admin.save();

    res.json({ success: true, message: "Analytics PIN removed" });
  } catch (err) {
    logger.error("Analytics PIN remove error:", { error: err?.message });
    serverError(res, "Error removing analytics PIN");
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
