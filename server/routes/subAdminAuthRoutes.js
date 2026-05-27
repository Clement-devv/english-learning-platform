// server/routes/subAdminAuthRoutes.js
import express from "express";
import jwt     from "jsonwebtoken";
import crypto  from "crypto";
import { config, JWT_STANDARD_CLAIMS } from "../config/config.js";
import { getCenterSecret } from "../utils/jwtUtils.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimiter.js";
import { sendSubAdminInviteEmail, sendSubAdminWelcomeEmail, sendSubAdminForgotPasswordEmail } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { subAdminSchema }   from "../schemas/subAdminSchema.js";
import { teacherSchema }    from "../schemas/teacherSchema.js";
import { createSession, cleanExpiredSessions, pruneSessionsToLimit } from "../utils/sessionManager.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);

// POST /api/sub-admin-auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return badRequest(res, "Email and password required");

    const subAdmin = await getSubAdmin(req.db)
      .findOne({ email: email.toLowerCase().trim() })
      .populate("assignedTeachers", "firstName lastName email continent");

    if (!subAdmin)
      return unauthorized(res, "Invalid credentials");

    if (subAdmin.status === "pending")
      return forbidden(res, "Please complete your account setup using the link sent to your email.");

    if (subAdmin.status === "suspended")
      return forbidden(res, "Your account has been suspended. Contact the main administrator.");

    const isMatch = await subAdmin.comparePassword(password);
    if (!isMatch)
      return unauthorized(res, "Invalid credentials");

    let teacherScope = subAdmin.assignedTeachers.map((t) => t._id);
    if (subAdmin.assignmentType === "region" && subAdmin.region) {
      const regionTeachers = await getTeacher(req.db).find({ continent: subAdmin.region }).select("_id");
      teacherScope = regionTeachers.map((t) => t._id);
    }

    const token = jwt.sign(
      {
        ...JWT_STANDARD_CLAIMS,
        id: subAdmin._id,
        email: subAdmin.email,
        role: "sub-admin",
        centerId: req.center.slug,
        assignmentType: subAdmin.assignmentType,
        region: subAdmin.region,
        teacherScope: teacherScope.map(String),
        permissions: subAdmin.permissions,
      },
      getCenterSecret(req.center.slug),
      { expiresIn: "7d" }
    );

    // Record a per-device session — required for logout-session / logout-all-devices
    // to revoke this specific JWT server-side via the in-memory + Redis blacklist.
    const session = createSession(req, token);
    subAdmin.sessions = cleanExpiredSessions(subAdmin.sessions || []);
    subAdmin.sessions.push(session);
    subAdmin.sessions = pruneSessionsToLimit(subAdmin.sessions);
    subAdmin.lastLogin = new Date();
    await subAdmin.save();

    res.json({
      success: true,
      token,
      sessionToken: session.token,
      subAdmin: {
        id: subAdmin._id,
        firstName: subAdmin.firstName,
        lastName: subAdmin.lastName,
        email: subAdmin.email,
        assignmentType: subAdmin.assignmentType,
        region: subAdmin.region,
        permissions: subAdmin.permissions,
        teacherScope: teacherScope.map(String),
      },
    });
  } catch (err) {
    logger.error("Sub-admin login error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// GET /api/sub-admin-auth/verify-invite/:token
router.get("/verify-invite/:token", passwordResetLimiter, async (req, res) => {
  try {
    const subAdmin = await getSubAdmin(req.db).findOne({
      inviteToken:   req.params.token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!subAdmin)
      return badRequest(res, "This invite link is invalid or has expired. Please ask your administrator to resend the invite.");

    res.json({
      success: true,
      subAdmin: { firstName: subAdmin.firstName, lastName: subAdmin.lastName, email: subAdmin.email },
    });
  } catch (err) {
    logger.error("Verify invite error:", { error: err?.message });
    serverError(res);
  }
});

// POST /api/sub-admin-auth/setup-account
router.post("/setup-account", passwordResetLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword)
      return badRequest(res, "All fields are required");
    if (password !== confirmPassword)
      return badRequest(res, "Passwords do not match");
    if (password.length < 8)
      return badRequest(res, "Password must be at least 8 characters");

    const subAdmin = await getSubAdmin(req.db).findOne({
      inviteToken:   token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!subAdmin)
      return badRequest(res, "This invite link is invalid or has expired.");

    subAdmin.password      = password; // hashed by pre-save hook
    subAdmin.status        = "active";
    subAdmin.inviteToken   = null;
    subAdmin.inviteExpires = null;
    await subAdmin.save();

    sendSubAdminWelcomeEmail(subAdmin, req.center?.centerName || "", req.center).catch(e => logger.error("Sub-admin welcome email failed:", { error: e?.message }));

    res.json({ success: true, message: "Account activated successfully! You can now log in." });
  } catch (err) {
    logger.error("Setup account error:", { error: err?.message });
    serverError(res);
  }
});

// POST /api/sub-admin-auth/forgot-password
router.post("/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return badRequest(res, "Email is required");

    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findOne({ email: email.toLowerCase().trim() });

    if (!subAdmin)
      return notFound(res, "No sub-admin account found with that email address.");
    if (subAdmin.status === "pending")
      return badRequest(res, "Your account is not yet activated. Use the setup link from your invitation email, or ask the admin to resend it.");
    if (subAdmin.status === "suspended")
      return forbidden(res, "Your account has been suspended. Contact the main administrator.");

    const rawToken   = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    subAdmin.resetPasswordToken   = hashedToken;
    subAdmin.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    subAdmin.resetPasswordCenter  = req.center.slug;
    await subAdmin.save();

    const emailResult = await sendSubAdminForgotPasswordEmail(subAdmin, rawToken, req.center, req.center?.centerName || "");
    if (!emailResult?.success) {
      logger.error("Sub-admin forgot-password email failed:", emailResult?.error);
      return serverError(res, "Could not send reset email. Please try again later.");
    }

    res.json({ success: true, message: "Password reset link sent successfully." });
  } catch (err) {
    logger.error("Sub-admin forgot-password error:", { error: err?.message });
    serverError(res);
  }
});

// POST /api/sub-admin-auth/reset-password/:token
router.post("/reset-password/:token", passwordResetLimiter, async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) return badRequest(res, "All fields are required");
    if (password !== confirmPassword)   return badRequest(res, "Passwords do not match");
    if (password.length < 8)           return badRequest(res, "Password must be at least 8 characters");

    const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");

    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!subAdmin) return badRequest(res, "Reset link is invalid or has expired. Please request a new one.");

    if (subAdmin.resetPasswordCenter !== req.center.slug) {
      return badRequest(res, "Reset link is invalid or has expired. Please request a new one.");
    }

    subAdmin.password             = password; // hashed by pre-save hook
    subAdmin.resetPasswordToken   = null;
    subAdmin.resetPasswordExpires = null;
    subAdmin.resetPasswordCenter  = null;
    await subAdmin.save();

    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) {
    logger.error("Sub-admin reset-password error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
