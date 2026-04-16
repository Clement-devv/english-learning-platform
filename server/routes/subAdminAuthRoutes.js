// server/routes/subAdminAuthRoutes.js
import express from "express";
import jwt     from "jsonwebtoken";
import crypto  from "crypto";
import { config, JWT_STANDARD_CLAIMS } from "../config/config.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimiter.js";
import { sendSubAdminInviteEmail, sendSubAdminWelcomeEmail } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { subAdminSchema }   from "../schemas/subAdminSchema.js";
import { teacherSchema }    from "../schemas/teacherSchema.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);

// POST /api/sub-admin-auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });

    const subAdmin = await getSubAdmin(req.db)
      .findOne({ email: email.toLowerCase().trim() })
      .populate("assignedTeachers", "firstName lastName email continent");

    if (!subAdmin)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (subAdmin.status === "pending")
      return res.status(403).json({ success: false, message: "Please complete your account setup using the link sent to your email." });

    if (subAdmin.status === "suspended")
      return res.status(403).json({ success: false, message: "Your account has been suspended. Contact the main administrator." });

    const isMatch = await subAdmin.comparePassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

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
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    subAdmin.lastLogin = new Date();
    await subAdmin.save();

    res.json({
      success: true,
      token,
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
      return res.status(400).json({ success: false, message: "This invite link is invalid or has expired. Please ask your administrator to resend the invite." });

    res.json({
      success: true,
      subAdmin: { firstName: subAdmin.firstName, lastName: subAdmin.lastName, email: subAdmin.email },
    });
  } catch (err) {
    logger.error("Verify invite error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/sub-admin-auth/setup-account
router.post("/setup-account", passwordResetLimiter, async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword)
      return res.status(400).json({ success: false, message: "All fields are required" });
    if (password !== confirmPassword)
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });

    const subAdmin = await getSubAdmin(req.db).findOne({
      inviteToken:   token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!subAdmin)
      return res.status(400).json({ success: false, message: "This invite link is invalid or has expired." });

    subAdmin.password      = password; // hashed by pre-save hook
    subAdmin.status        = "active";
    subAdmin.inviteToken   = null;
    subAdmin.inviteExpires = null;
    await subAdmin.save();

    sendSubAdminWelcomeEmail(subAdmin, req.center?.centerName || "").catch(e => logger.error("Sub-admin welcome email failed:", { error: e?.message }));

    res.json({ success: true, message: "Account activated successfully! You can now log in." });
  } catch (err) {
    logger.error("Setup account error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
