import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { config, JWT_STANDARD_CLAIMS } from "../config/config.js";
import { loginLimiter, passwordResetLimiter, trackFailedLogin, isAccountLocked, clearFailedAttempts } from "../middleware/rateLimiter.js";
import { validatePasswordStrength } from "../utils/passwordUtils.js";
import { createSession, cleanExpiredSessions, pruneSessionsToLimit } from "../utils/sessionManager.js";
import { SESSION_EXPIRY_DAYS } from "../config/constants.js";
import { sendForgotPasswordEmail, sendStudentForgotPasswordEmail, sendAdminForgotPasswordEmail } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import logger from "../utils/logger.js";

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAdminModel   = (db) => db.models.Admin   || db.model("Admin",   adminSchema);
const getTeacherModel = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getStudentModel = (db) => db.models.Student || db.model("Student", studentSchema);

/**
 * Factory that builds a login route handler, eliminating the near-identical
 * teacher / student / admin login blocks.
 *
 * @param {object} opts
 * @param {string}   opts.role            - 'teacher' | 'student' | 'admin'
 * @param {Function} opts.getModel        - (db) => MongooseModel
 * @param {Function} opts.getIdentifier   - (req) => string — the login identifier (email or username)
 * @param {Function} opts.buildFindQuery  - (identifier) => mongoose filter object
 * @param {Function} [opts.extraChecks]   - (user) => { status, message } | null — role-specific checks
 * @param {Function} [opts.buildJwtExtra] - (user) => object — extra fields merged into JWT payload
 * @param {Function} opts.buildResponse   - (user) => object — the role-keyed user object in the response
 * @param {string}   opts.invalidCredMsg  - message returned for wrong credentials
 */
const createLoginHandler = ({
  role,
  getModel,
  getIdentifier,
  buildFindQuery,
  extraChecks,
  buildJwtExtra,
  buildResponse,
  invalidCredMsg,
}) => async (req, res) => {
  try {
    const { password, twoFactorToken, backupCode } = req.body;
    const identifier = getIdentifier(req);

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/username and password are required" });
    }

    const lockStatus = await isAccountLocked(identifier);
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${lockStatus.remainingTime} minute(s).`,
      });
    }

    const Model = getModel(req.db);
    const user  = await Model.findOne(buildFindQuery(identifier));

    if (!user) {
      await trackFailedLogin(identifier);
      return res.status(401).json({ message: invalidCredMsg });
    }

    if (!user.active) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact admin." });
    }

    if (extraChecks) {
      const check = extraChecks(user);
      if (check) return res.status(check.status).json({ message: check.message });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await trackFailedLogin(identifier);
      return res.status(401).json({ message: invalidCredMsg });
    }

    await clearFailedAttempts(identifier);

    if (user.twoFactorEnabled) {
      if (!twoFactorToken && !backupCode) {
        // Sign a short-lived token so the role is server-determined, not client-supplied
        const pendingToken = jwt.sign(
          { ...JWT_STANDARD_CLAIMS, tempUserId: user._id.toString(), role, centerId: req.center.slug },
          config.jwtSecret,
          { expiresIn: "5m" }
        );
        return res.status(202).json({
          success: false,
          requires2FA: true,
          message: "Please enter your 2FA code",
          pendingToken,
        });
      }

      let isValid = false;
      if (twoFactorToken) {
        const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
        isValid = verifyTwoFactorToken(twoFactorToken, user.twoFactorSecret);
      } else if (backupCode) {
        const normalizedCode = backupCode.toUpperCase().trim();
        const updated = await Model.findOneAndUpdate(
          { _id: user._id, twoFactorBackupCodes: normalizedCode },
          { $pull: { twoFactorBackupCodes: normalizedCode } },
          { new: false }
        );
        isValid = !!updated;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: "Invalid 2FA code or backup code" });
      }
    }

    const jwtPayload = {
      ...JWT_STANDARD_CLAIMS,
      id: user._id,
      email: user.email,
      role,
      centerId: req.center.slug,
      ...(buildJwtExtra ? buildJwtExtra(user) : {}),
    };
    const token = jwt.sign(jwtPayload, config.jwtSecret, { expiresIn: config.jwtExpiry });

    const session = createSession(req, token);
    user.sessions = cleanExpiredSessions(user.sessions || []);
    user.sessions.push(session);
    user.sessions = pruneSessionsToLimit(user.sessions);
    user.lastLogin = new Date();
    await user.save();

    res.json({ success: true, token, sessionToken: session.token, ...buildResponse(user) });

  } catch (err) {
    logger.error(`${role} login error:`, { error: err?.message });
    res.status(500).json({ message: "Server error during login" });
  }
};

// Local verifyToken used only for teacher-specific routes in this file.
// Requires tenantMiddleware to run first (sets req.db).
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findById(decoded.id).select("-password");

    if (!teacher || !teacher.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    req.teacher = teacher;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};


// ─── 2FA verify (called after initial login when 2FA is required) ─────────────

router.post("/verify-2fa-login", tenantMiddleware, loginLimiter, async (req, res) => {
  try {
    const { pendingToken, twoFactorToken, backupCode } = req.body;

    if (!pendingToken) {
      return res.status(400).json({ message: "Missing 2FA session token" });
    }

    if (!twoFactorToken && !backupCode) {
      return res.status(400).json({ message: "2FA code or backup code required" });
    }

    // Decode the server-signed pending token — role and userId are never taken from the client
    let pending;
    try {
      pending = jwt.verify(pendingToken, config.jwtSecret);
    } catch (_) {
      return res.status(401).json({ message: "2FA session expired. Please log in again." });
    }

    const { tempUserId, role, centerId } = pending;

    // Ensure the pending token belongs to this tenant
    if (centerId !== req.center.slug) {
      return res.status(401).json({ message: "Invalid session" });
    }

    let UserModel;
    switch (role) {
      case "admin":   UserModel = getAdminModel(req.db);   break;
      case "teacher": UserModel = getTeacherModel(req.db); break;
      case "student": UserModel = getStudentModel(req.db); break;
      default: return res.status(400).json({ message: "Invalid role" });
    }

    const user = await UserModel.findById(tempUserId);

    if (!user || !user.active) {
      return res.status(403).json({ message: "User not found or inactive" });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this user" });
    }

    let isValid = false;

    if (twoFactorToken) {
      const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
      isValid = verifyTwoFactorToken(twoFactorToken, user.twoFactorSecret);
    } else if (backupCode) {
      const normalizedCode = backupCode.toUpperCase().trim();
      const updated = await UserModel.findOneAndUpdate(
        { _id: user._id, twoFactorBackupCodes: normalizedCode },
        { $pull: { twoFactorBackupCodes: normalizedCode } },
        { new: false }
      );
      isValid = !!updated;
    }

    if (!isValid) {
      return res.status(401).json({ success: false, message: "Invalid 2FA code or backup code" });
    }

    const token = jwt.sign(
      { ...JWT_STANDARD_CLAIMS, id: user._id, email: user.email, role, centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    user.sessions = cleanExpiredSessions(user.sessions || []);
    user.sessions.push(session);
    user.sessions = pruneSessionsToLimit(user.sessions);
    user.lastLogin = new Date();
    await user.save();

    const userData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      twoFactorEnabled: user.twoFactorEnabled,
      active: user.active,
    };

    if (role === "admin") {
      userData.username = user.username;
    } else if (role === "teacher") {
      userData.continent = user.continent;
      userData.ratePerClass = user.ratePerClass;
    }

    res.json({ success: true, token, sessionToken: session.token, user: userData });

  } catch (err) {
    logger.error("2FA verification error:", { error: err?.message });
    res.status(500).json({ message: "Server error during 2FA verification" });
  }
});


// ─── Teacher Login ────────────────────────────────────────────────────────────

router.post("/teacher/login", tenantMiddleware, loginLimiter, createLoginHandler({
  role: "teacher",
  getModel: getTeacherModel,
  getIdentifier: (req) => req.body.email?.trim().toLowerCase(),
  buildFindQuery: (email) => ({ email }),
  extraChecks: (teacher) => {
    if (teacher.status === "pending") {
      return { status: 403, message: "Your account setup is incomplete. Please check your invite email." };
    }
    return null;
  },
  buildResponse: (teacher) => ({
    teacher: {
      id: teacher._id,
      email: teacher.email,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      continent: teacher.continent,
      ratePerClass: teacher.ratePerClass,
      active: teacher.active,
      twoFactorEnabled: teacher.twoFactorEnabled,
    },
  }),
  invalidCredMsg: "Invalid email or password",
}));

// Verify teacher token
router.get("/verify", tenantMiddleware, verifyToken, (req, res) => {
  res.json({ success: true, teacher: req.teacher });
});

// Teacher change password
router.post("/teacher/change-password", tenantMiddleware, verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findById(req.teacher._id);

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, teacher.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    teacher.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.lastPasswordChange = new Date();
    await teacher.save();

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Change password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while changing password" });
  }
});

// Teacher forgot password
router.post("/teacher/forgot-password", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findOne({ email });

    if (!teacher) {
      return res.json({ success: true, message: "If that email exists, a reset link has been sent" });
    }

    if (!teacher.active) {
      return res.status(403).json({ message: "Your account is deactivated. Please contact admin." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    teacher.resetPasswordToken = hashedToken;
    teacher.resetPasswordExpires = Date.now() + 3600000;
    await teacher.save();

    const emailResult = await sendForgotPasswordEmail(
      teacher.email,
      `${teacher.firstName} ${teacher.lastName}`,
      resetToken,
      req.center,
      req.center?.centerName || ""
    );

    if (!emailResult.success) {
      logger.error("Teacher forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });

  } catch (err) {
    logger.error("Forgot password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while processing request" });
  }
});

// Teacher reset password
router.post("/teacher/reset-password/:token", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!teacher) {
      return res.status(400).json({ message: "Invalid or expired reset token. Please request a new one." });
    }

    teacher.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.lastPasswordChange = new Date();
    teacher.resetPasswordToken = undefined;
    teacher.resetPasswordExpires = undefined;
    await teacher.save();

    res.json({ success: true, message: "Password reset successfully. You can now login with your new password." });

  } catch (err) {
    logger.error("Reset password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while resetting password" });
  }
});


// ─── Student Login ────────────────────────────────────────────────────────────

router.post("/student/login", tenantMiddleware, loginLimiter, createLoginHandler({
  role: "student",
  getModel: getStudentModel,
  getIdentifier: (req) => req.body.email?.trim().toLowerCase(),
  buildFindQuery: (email) => ({ email }),
  buildResponse: (student) => ({
    student: {
      id: student._id,
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
      active: student.active,
      twoFactorEnabled: student.twoFactorEnabled,
    },
  }),
  invalidCredMsg: "Invalid email or password",
}));

// Student verify token
router.get("/student/verify", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const Student = getStudentModel(req.db);
    const student = await Student.findById(decoded.id).select("-password");

    if (!student || !student.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    res.json({ success: true, student });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Student change password
router.post("/student/change-password", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Student = getStudentModel(req.db);
    const student = await Student.findById(decoded.id);

    if (!student || !student.active) {
      return res.status(401).json({ message: "Invalid account or inactive" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    student.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.lastPasswordChange = new Date();
    await student.save();

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Student change password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while changing password" });
  }
});

// Student forgot password
router.post("/student/forgot-password", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const Student = getStudentModel(req.db);
    const student = await Student.findOne({ email });

    if (!student) {
      return res.json({ success: true, message: "If that email exists, a reset link has been sent" });
    }

    if (!student.active) {
      return res.status(403).json({ message: "Your account is deactivated. Please contact your administrator." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    student.resetPasswordToken = hashedToken;
    student.resetPasswordExpires = Date.now() + 3600000;
    await student.save();

    const emailResult = await sendStudentForgotPasswordEmail(
      student.email,
      `${student.firstName} ${student.surname}`,
      resetToken,
      req.center,
      req.center?.centerName || ""
    );

    if (!emailResult.success) {
      logger.error("Student forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });

  } catch (err) {
    logger.error("Student forgot password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while processing request" });
  }
});

// Student reset password
router.post("/student/reset-password/:token", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const Student = getStudentModel(req.db);
    const student = await Student.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!student) {
      return res.status(400).json({ message: "Invalid or expired reset token. Please request a new one." });
    }

    student.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.lastPasswordChange = new Date();
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await student.save();

    res.json({ success: true, message: "Password reset successfully. You can now login with your new password." });

  } catch (err) {
    logger.error("Student reset password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while resetting password" });
  }
});


// ─── Admin Login ──────────────────────────────────────────────────────────────

router.post("/admin/login", tenantMiddleware, loginLimiter, createLoginHandler({
  role: "admin",
  getModel: getAdminModel,
  getIdentifier: (req) => req.body.username?.trim().toLowerCase(),
  buildFindQuery: (username) => ({ $or: [{ username }, { email: username }] }),
  buildJwtExtra: (admin) => ({ username: admin.username }),
  buildResponse: (admin) => ({
    admin: {
      id: admin._id,
      username: admin.username,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: "admin",
      twoFactorEnabled: admin.twoFactorEnabled,
    },
  }),
  invalidCredMsg: "Invalid credentials",
}));

// Admin verify token
router.get("/admin/verify", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Impersonation tokens skip the DB lookup — short-lived JWTs issued by super admin
    if (decoded.isImpersonation) {
      return res.json({
        success: true,
        admin: {
          id: 'superadmin-impersonation', username: 'impersonation',
          email: '', firstName: 'Super Admin', lastName: '(Viewing)',
          role: 'admin', active: true,
        },
      });
    }

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin || !admin.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    res.json({ success: true, admin });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Admin change password
router.post("/admin/change-password", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.active) {
      return res.status(401).json({ message: "Invalid account or inactive" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    admin.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    admin.lastPasswordChange = new Date();
    await admin.save();

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Admin change password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while changing password" });
  }
});


// Admin forgot password
router.post("/admin/forgot-password", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    // Always respond with success to avoid email enumeration
    if (!admin || !admin.active) {
      return res.json({ success: true, message: "If that email exists, a reset link has been sent" });
    }

    const resetToken  = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    admin.resetPasswordToken   = hashedToken;
    admin.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await admin.save();

    const emailResult = await sendAdminForgotPasswordEmail(admin.email, admin.firstName || admin.username, resetToken, req.center, req.center?.centerName || "");

    if (!emailResult.success) {
      logger.error("Admin forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });
  } catch (err) {
    logger.error("Admin forgot password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while processing request" });
  }
});

// Admin reset password
router.post("/admin/reset-password/:token", tenantMiddleware, passwordResetLimiter, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) return res.status(400).json({ message: "New password is required" });

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
    }

    admin.password             = await bcrypt.hash(newPassword, config.bcryptRounds);
    admin.lastPasswordChange   = new Date();
    admin.resetPasswordToken   = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    logger.error("Admin reset password error:", { error: err?.message });
    res.status(500).json({ message: "Server error while resetting password" });
  }
});

// ─── Session management ───────────────────────────────────────────────────────

router.get("/sessions", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    let user;
    if (decoded.role === "teacher") {
      user = await getTeacherModel(req.db).findById(decoded.id).select("sessions lastLogin");
    } else if (decoded.role === "student") {
      user = await getStudentModel(req.db).findById(decoded.id).select("sessions lastLogin");
    } else if (decoded.role === "admin") {
      user = await getAdminModel(req.db).findById(decoded.id).select("sessions lastLogin");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const activeSessions = user.sessions
      .filter(s => s.isActive)
      .map(s => ({
        sessionToken: s.token,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        location: s.location,
        loginTime: s.loginTime,
        lastActivity: s.lastActivity,
        isCurrent: s.jwtToken === token,
      }));

    res.json({ success: true, sessions: activeSessions, lastLogin: user.lastLogin });

  } catch (err) {
    logger.error("Get sessions error:", { error: err?.message });
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Refresh token ────────────────────────────────────────────────────────────
// POST /auth/refresh
// The client sends its expired access token + the sessionToken (refresh token).
// We decode the expired JWT (no signature check) only to learn the role so we
// can query the right model. The real trust comes from finding the matching
// sessionToken record in the DB — that is what authorises the new access token.
router.post("/refresh", tenantMiddleware, async (req, res) => {
  try {
    const { sessionToken, expiredToken } = req.body;

    if (!sessionToken || !expiredToken) {
      return res.status(400).json({ message: "sessionToken and expiredToken required" });
    }

    // Decode without verifying — we only need the role + userId hint.
    // Trust is established by the DB session record below, not this decode.
    const decoded = jwt.decode(expiredToken);
    if (!decoded?.id || !decoded?.role) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const { id: userId, role } = decoded;

    let UserModel;
    switch (role) {
      case "admin":   UserModel = getAdminModel(req.db);   break;
      case "teacher": UserModel = getTeacherModel(req.db); break;
      case "student": UserModel = getStudentModel(req.db); break;
      default: return res.status(401).json({ message: "Invalid token" });
    }

    const user = await UserModel.findById(userId);
    if (!user || !user.active) {
      return res.status(401).json({ message: "Account not found or inactive" });
    }

    // Find the matching session — this is the real auth check
    const session = user.sessions.find(s => s.token === sessionToken && s.isActive);
    if (!session) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    // Check session hasn't exceeded the 7-day window
    const sessionAgeDays = (Date.now() - new Date(session.loginTime).getTime()) / (1000 * 60 * 60 * 24);
    if (sessionAgeDays > SESSION_EXPIRY_DAYS) {
      session.isActive = false;
      await user.save();
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    // Issue a fresh access token
    const newToken = jwt.sign(
      { ...JWT_STANDARD_CLAIMS, id: user._id, email: user.email, role, centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    // Update session activity + store new JWT reference
    session.lastActivity = new Date();
    session.jwtToken     = newToken;
    await user.save();

    res.json({ success: true, token: newToken });

  } catch (err) {
    logger.error("Token refresh error:", { error: err?.message });
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout-session", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { sessionToken } = req.body;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    if (!sessionToken) {
      return res.status(400).json({ message: "Session token required" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    let user;
    if (decoded.role === "teacher") {
      user = await getTeacherModel(req.db).findById(decoded.id);
    } else if (decoded.role === "student") {
      user = await getStudentModel(req.db).findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await getAdminModel(req.db).findById(decoded.id);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const session = user.sessions.find(s => s.token === sessionToken);
    if (session) {
      session.isActive = false;
      await user.save();
      res.json({ success: true, message: "Session logged out successfully" });
    } else {
      res.status(404).json({ message: "Session not found" });
    }

  } catch (err) {
    logger.error("Logout session error:", { error: err?.message });
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout-all-devices", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    let user;
    if (decoded.role === "teacher") {
      user = await getTeacherModel(req.db).findById(decoded.id);
    } else if (decoded.role === "student") {
      user = await getStudentModel(req.db).findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await getAdminModel(req.db).findById(decoded.id);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.sessions = user.sessions.map(session => {
      if (session.jwtToken !== token) {
        session.isActive = false;
      }
      return session;
    });

    await user.save();

    res.json({ success: true, message: "Logged out from all other devices" });

  } catch (err) {
    logger.error("Logout all devices error:", { error: err?.message });
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
