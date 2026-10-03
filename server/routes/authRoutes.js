import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import redisClient from "../config/redis.js";

import { config, JWT_STANDARD_CLAIMS, JWT_VERIFY_OPTIONS } from "../config/config.js";
import { getCenterSecret } from "../utils/jwtUtils.js";
import { loginLimiter, passwordResetLimiter, trackFailedLogin, isAccountLocked, clearFailedAttempts } from "../middleware/rateLimiter.js";
import { validatePasswordStrength } from "../utils/passwordUtils.js";
import { startSession, verifyDeviceProof, endSession, notifySessionsRevoked, alertNewDevice, endSessionsAfterPasswordChange } from "../utils/sessionManager.js";
import { buildRoleClaims, signAccessToken } from "../utils/sessionClaims.js";
import { getUserModelForRole, isAccountUsable, normaliseRole } from "../utils/roleModels.js";
import mongoose from "mongoose";
import { SESSION_EXPIRY_DAYS } from "../config/constants.js";
import { sendForgotPasswordEmail, sendStudentForgotPasswordEmail, sendAdminForgotPasswordEmail } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { isTokenBlacklisted } from "../middleware/authMiddleware.js";
import { decrypt, hashBackupCode } from "../utils/fieldEncryption.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { parentSchema } from "../schemas/parentSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import {
  loginRules,
  changePasswordRules,
  forgotPasswordRules,
  resetPasswordRules,
  verify2faRules,
  validate,
} from '../middleware/validate.js';

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAdminModel    = (db) => db.models.Admin    || db.model("Admin",    adminSchema);
const getTeacherModel  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getStudentModel  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getSubAdminModel = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);
const getParentModel   = (db) => db.models.Parent   || db.model("Parent",   parentSchema);

/**
 * Resolve the appropriate user model + document for any center-scoped role.
 * Used by /logout-session and /logout-all-devices so the same endpoint can
 * revoke sessions for teacher, student, admin, sub-admin, and parent without
 * duplicate role branches everywhere.
 */
const getUserDocForRole = async (db, role, userId) => {
  const Model = getUserModelForRole(db, role);
  return Model ? Model.findById(userId) : null;
};

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
      return badRequest(res, "Email/username and password are required");
    }

    const centerSlug = req.center?.slug || null;
    const lockStatus = await isAccountLocked(identifier, centerSlug);
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${lockStatus.remainingTime} minute(s).`,
      });
    }

    const Model = getModel(req.db);
    const user  = await Model.findOne(buildFindQuery(identifier));

    if (!user) {
      await trackFailedLogin(identifier, centerSlug);
      return res.status(401).json({ message: invalidCredMsg });
    }

    if (!user.active) {
      return forbidden(res, "Your account has been deactivated. Please contact admin.");
    }

    if (extraChecks) {
      const check = extraChecks(user);
      if (check) return res.status(check.status).json({ message: check.message });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await trackFailedLogin(identifier, centerSlug);
      return res.status(401).json({ message: invalidCredMsg });
    }

    await clearFailedAttempts(identifier, centerSlug);

    if (user.twoFactorEnabled) {
      if (!twoFactorToken && !backupCode) {
        // Sign a short-lived token so the role is server-determined, not client-supplied
        const pendingToken = jwt.sign(
          { ...JWT_STANDARD_CLAIMS, tempUserId: user._id.toString(), role, centerId: req.center.slug },
          getCenterSecret(req.center.slug),
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
        isValid = verifyTwoFactorToken(twoFactorToken, decrypt(user.twoFactorSecret));
      } else if (backupCode) {
        const hashedInput = hashBackupCode(backupCode);
        const updated = await Model.findOneAndUpdate(
          { _id: user._id, twoFactorBackupCodes: hashedInput },
          { $pull: { twoFactorBackupCodes: hashedInput } },
          { new: false }
        );
        isValid = !!updated;
      }

      if (!isValid) {
        return unauthorized(res, "Invalid 2FA code or backup code");
      }
    }

    const extra = buildJwtExtra ? buildJwtExtra(user) : {};
    const { token, session, isNewDevice } = startSession(req, user, (sid) =>
      signAccessToken({ role, user, centerSlug: req.center.slug, sid, extra }));
    user.lastLogin = new Date();
    await user.save();
    alertNewDevice({ req, user, role, session, isNewDevice });

    res.json({ success: true, token, sessionToken: session.token, ...buildResponse(user) });

  } catch (err) {
    logger.error(`${role} login error:`, { error: err?.message });
    serverError(res, "Server error during login");
  }
};

// Local verifyToken used only for teacher-specific routes in this file.
// Requires tenantMiddleware to run first (sets req.db).
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return unauthorized(res, "No token provided");
    }

    const decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findById(decoded.id).select("-password");

    if (!teacher || !teacher.active) {
      return unauthorized(res, "Invalid token or inactive account");
    }

    req.teacher = teacher;
    next();
  } catch (err) {
    return unauthorized(res, "Invalid token");
  }
};


// ─── 2FA verify (called after initial login when 2FA is required) ─────────────

router.post("/verify-2fa-login", tenantMiddleware, loginLimiter, verify2faRules, validate, async (req, res) => {
  try {
    const { pendingToken, twoFactorToken, backupCode } = req.body;

    if (!pendingToken) {
      return badRequest(res, "Missing 2FA session token");
    }

    if (!twoFactorToken && !backupCode) {
      return badRequest(res, "2FA code or backup code required");
    }

    // Decode the server-signed pending token — role and userId are never taken from the client
    let pending;
    try {
      pending = jwt.verify(pendingToken, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    } catch (_) {
      return unauthorized(res, "2FA session expired. Please log in again.");
    }

    const { tempUserId, role, centerId } = pending;

    // Ensure the pending token belongs to this tenant
    if (centerId !== req.center.slug) {
      return unauthorized(res, "Invalid session");
    }

    let UserModel;
    switch (role) {
      case "admin":   UserModel = getAdminModel(req.db);   break;
      case "teacher": UserModel = getTeacherModel(req.db); break;
      case "student": UserModel = getStudentModel(req.db); break;
      default: return badRequest(res, "Invalid role");
    }

    const user = await UserModel.findById(tempUserId);

    if (!user || !user.active) {
      return forbidden(res, "User not found or inactive");
    }

    if (!user.twoFactorEnabled) {
      return badRequest(res, "2FA is not enabled for this user");
    }

    let isValid = false;

    if (twoFactorToken) {
      const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
      isValid = verifyTwoFactorToken(twoFactorToken, decrypt(user.twoFactorSecret));
    } else if (backupCode) {
      const hashedInput = hashBackupCode(backupCode);
      const updated = await UserModel.findOneAndUpdate(
        { _id: user._id, twoFactorBackupCodes: hashedInput },
        { $pull: { twoFactorBackupCodes: hashedInput } },
        { new: false }
      );
      isValid = !!updated;
    }

    if (!isValid) {
      return unauthorized(res, "Invalid 2FA code or backup code");
    }

    // Same claims a password login would issue (e.g. admin username)
    const extra = await buildRoleClaims(role, user, req.db);
    const { token, session, isNewDevice } = startSession(req, user, (sid) =>
      signAccessToken({ role, user, centerSlug: req.center.slug, sid, extra }));
    user.lastLogin = new Date();
    await user.save();
    alertNewDevice({ req, user, role, session, isNewDevice });

    const userData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      twoFactorEnabled: user.twoFactorEnabled,
      active: user.active,
      hasAcceptedTerms: user.hasAcceptedTerms,
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
    serverError(res, "Server error during 2FA verification");
  }
});


// ─── Teacher Login ────────────────────────────────────────────────────────────

router.post("/teacher/login", tenantMiddleware, loginLimiter, loginRules, validate, createLoginHandler({
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
      hasAcceptedTerms: teacher.hasAcceptedTerms,
    },
  }),
  invalidCredMsg: "Invalid email or password",
}));

// Verify teacher token
router.get("/verify", tenantMiddleware, verifyToken, (req, res) => {
  res.json({ success: true, teacher: req.teacher });
});

// Teacher change password
router.post("/teacher/change-password", tenantMiddleware, verifyToken, changePasswordRules, validate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return badRequest(res, "Current password and new password are required");
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findById(req.teacher._id);

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, teacher.password);
    if (!isCurrentPasswordValid) {
      return unauthorized(res, "Current password is incorrect");
    }

    teacher.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.lastPasswordChange = new Date();
    // Sign out every other device — a stolen session must not survive a password change
    const endedSessions = await endSessionsAfterPasswordChange(teacher, req, { keepCurrent: true });
    await teacher.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, teacher._id, endedSessions);

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Change password error:", { error: err?.message });
    serverError(res, "Server error while changing password");
  }
});

// Teacher forgot password
router.post("/teacher/forgot-password", tenantMiddleware, passwordResetLimiter, forgotPasswordRules, validate, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return badRequest(res, "Email is required");
    }

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findOne({ email });

    if (!teacher || !teacher.active)
      return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    teacher.resetPasswordToken   = hashedToken;
    teacher.resetPasswordExpires = Date.now() + 3600000;
    teacher.resetPasswordCenter  = req.center.slug;
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
      return serverError(res, "Could not send reset email. Please try again later.");
    }

    res.json({ success: true, message: "Password reset link sent successfully." });

  } catch (err) {
    logger.error("Forgot password error:", { error: err?.message });
    serverError(res, "Server error while processing request");
  }
});

// Teacher reset password
router.post("/teacher/reset-password/:token", tenantMiddleware, passwordResetLimiter, resetPasswordRules, validate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return badRequest(res, "New password is required");
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
      return badRequest(res, "Invalid or expired reset token. Please request a new one.");
    }

    if (teacher.resetPasswordCenter !== req.center.slug) {
      return badRequest(res, "Invalid or expired reset token. Please request a new one.");
    }

    teacher.password             = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.lastPasswordChange   = new Date();
    teacher.resetPasswordToken   = undefined;
    teacher.resetPasswordExpires = undefined;
    teacher.resetPasswordCenter  = undefined;
    // Password was reset from an email link — sign out every device
    const endedSessions = await endSessionsAfterPasswordChange(teacher, req);
    await teacher.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, teacher._id, endedSessions);

    res.json({ success: true, message: "Password reset successfully. You can now login with your new password." });

  } catch (err) {
    logger.error("Reset password error:", { error: err?.message });
    serverError(res, "Server error while resetting password");
  }
});


// ─── Student Login ────────────────────────────────────────────────────────────

router.post("/student/login", tenantMiddleware, loginLimiter, loginRules, validate, createLoginHandler({
  role: "student",
  getModel: getStudentModel,
  getIdentifier: (req) => req.body.email?.trim().toLowerCase(),
  buildFindQuery: (email) => ({ email }),
  // Managed students never log in. Converted students have no password until they
  // finish the invite setup — stop here rather than bcrypt-comparing against undefined.
  extraChecks: (student) => (student.isManaged || !student.password
    ? { status: 401, message: "Invalid email or password" }
    : null),
  buildResponse: (student) => ({
    student: {
      id: student._id,
      studentId: student.studentId,
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
      active: student.active,
      twoFactorEnabled: student.twoFactorEnabled,
      hasAcceptedTerms: student.hasAcceptedTerms,
    },
  }),
  invalidCredMsg: "Invalid email or password",
}));

// Student verify token
router.get("/student/verify", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return unauthorized(res, "No token provided");
    }

    const decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    const Student = getStudentModel(req.db);
    const student = await Student.findById(decoded.id).select("-password");

    if (!student || !student.active) {
      return unauthorized(res, "Invalid token or inactive account");
    }

    res.json({ success: true, student });
  } catch (err) {
    unauthorized(res, "Invalid token");
  }
});

// Student change password
router.post("/student/change-password", tenantMiddleware, changePasswordRules, validate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return unauthorized(res, "No token provided");
    }

    const decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return badRequest(res, "Current password and new password are required");
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Student = getStudentModel(req.db);
    const student = await Student.findById(decoded.id);

    if (!student || !student.active) {
      return unauthorized(res, "Invalid account or inactive");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isCurrentPasswordValid) {
      return unauthorized(res, "Current password is incorrect");
    }

    student.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.lastPasswordChange = new Date();
    // Sign out every other device — a stolen session must not survive a password change
    const endedSessions = await endSessionsAfterPasswordChange(student, req, { keepCurrent: true });
    await student.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, student._id, endedSessions);

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Student change password error:", { error: err?.message });
    serverError(res, "Server error while changing password");
  }
});

// Student forgot password
router.post("/student/forgot-password", tenantMiddleware, passwordResetLimiter, forgotPasswordRules, validate, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return badRequest(res, "Email is required");
    }

    const Student = getStudentModel(req.db);
    const student = await Student.findOne({ email });

    if (!student || !student.active || student.isManaged)
      return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    student.resetPasswordToken   = hashedToken;
    student.resetPasswordExpires = Date.now() + 3600000;
    student.resetPasswordCenter  = req.center.slug;
    await student.save();

    const emailResult = await sendStudentForgotPasswordEmail(
      student.email,
      `${student.firstName} ${student.lastName}`,
      resetToken,
      req.center,
      req.center?.centerName || ""
    );

    if (!emailResult.success) {
      logger.error("Student forgot-password email failed:", emailResult.error);
      return serverError(res, "Could not send reset email. Please try again later.");
    }

    res.json({ success: true, message: "Password reset link sent successfully." });

  } catch (err) {
    logger.error("Student forgot password error:", { error: err?.message });
    serverError(res, "Server error while processing request");
  }
});

// Student reset password
router.post("/student/reset-password/:token", tenantMiddleware, passwordResetLimiter, resetPasswordRules, validate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return badRequest(res, "New password is required");
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
      return badRequest(res, "Invalid or expired reset token. Please request a new one.");
    }

    if (student.resetPasswordCenter !== req.center.slug) {
      return badRequest(res, "Invalid or expired reset token. Please request a new one.");
    }

    student.password             = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.lastPasswordChange   = new Date();
    student.resetPasswordToken   = undefined;
    student.resetPasswordExpires = undefined;
    student.resetPasswordCenter  = undefined;
    // Password was reset from an email link — sign out every device
    const endedSessions = await endSessionsAfterPasswordChange(student, req);
    await student.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, student._id, endedSessions);

    res.json({ success: true, message: "Password reset successfully. You can now login with your new password." });

  } catch (err) {
    logger.error("Student reset password error:", { error: err?.message });
    serverError(res, "Server error while resetting password");
  }
});


// ─── Admin Login ──────────────────────────────────────────────────────────────

router.post("/admin/login", tenantMiddleware, loginLimiter, loginRules, validate, createLoginHandler({
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
      hasAcceptedTerms: admin.hasAcceptedTerms,
    },
  }),
  invalidCredMsg: "Invalid credentials",
}));

// Admin verify token
router.get("/admin/verify", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return unauthorized(res, "No token provided");
    }

    const decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);

    if (decoded.role !== "admin") {
      return forbidden(res, "Admin access required");
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
      return unauthorized(res, "Invalid token or inactive account");
    }

    res.json({ success: true, admin });
  } catch (err) {
    unauthorized(res, "Invalid token");
  }
});

// Admin change password
router.post("/admin/change-password", tenantMiddleware, changePasswordRules, validate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return unauthorized(res, "No token provided");
    }

    const decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return badRequest(res, "Current password and new password are required");
    }

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findById(decoded.id);

    if (!admin || !admin.active) {
      return unauthorized(res, "Invalid account or inactive");
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return unauthorized(res, "Current password is incorrect");
    }

    admin.password = await bcrypt.hash(newPassword, config.bcryptRounds);
    admin.lastPasswordChange = new Date();
    // Sign out every other device — a stolen session must not survive a password change
    const endedSessions = await endSessionsAfterPasswordChange(admin, req, { keepCurrent: true });
    await admin.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, admin._id, endedSessions);

    res.json({ success: true, message: "Password changed successfully" });

  } catch (err) {
    logger.error("Admin change password error:", { error: err?.message });
    serverError(res, "Server error while changing password");
  }
});


// Admin forgot password
router.post("/admin/forgot-password", tenantMiddleware, passwordResetLimiter, forgotPasswordRules, validate, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return badRequest(res, "Email is required");

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin || !admin.active)
      return res.json({ success: true, message: "If that email is registered, a reset link has been sent." });

    const resetToken  = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    admin.resetPasswordToken   = hashedToken;
    admin.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    admin.resetPasswordCenter  = req.center.slug;
    await admin.save();

    const emailResult = await sendAdminForgotPasswordEmail(admin.email, admin.firstName || admin.username, resetToken, req.center, req.center?.centerName || "");

    if (!emailResult.success) {
      logger.error("Admin forgot-password email failed:", emailResult.error);
      return serverError(res, "Could not send reset email. Please try again later.");
    }

    res.json({ success: true, message: "Password reset link sent successfully." });
  } catch (err) {
    logger.error("Admin forgot password error:", { error: err?.message });
    serverError(res, "Server error while processing request");
  }
});

// Admin reset password
router.post("/admin/reset-password/:token", tenantMiddleware, passwordResetLimiter, resetPasswordRules, validate, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) return badRequest(res, "New password is required");

    const { isValid, errors } = validatePasswordStrength(newPassword);
    if (!isValid) return res.status(400).json({ message: errors[0], errors });

    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findOne({
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return badRequest(res, "Invalid or expired reset link. Please request a new one.");
    }

    if (admin.resetPasswordCenter !== req.center.slug) {
      return badRequest(res, "Invalid or expired reset link. Please request a new one.");
    }

    admin.password             = await bcrypt.hash(newPassword, config.bcryptRounds);
    admin.lastPasswordChange   = new Date();
    admin.resetPasswordToken   = undefined;
    admin.resetPasswordExpires = undefined;
    admin.resetPasswordCenter  = undefined;
    // Password was reset from an email link — sign out every device
    const endedSessions = await endSessionsAfterPasswordChange(admin, req);
    await admin.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, admin._id, endedSessions);

    res.json({ success: true, message: "Password reset successfully. You can now log in with your new password." });
  } catch (err) {
    logger.error("Admin reset password error:", { error: err?.message });
    serverError(res, "Server error while resetting password");
  }
});

// ─── Accept Terms & Conditions ───────────────────────────────────────────────
// POST /auth/accept-terms
// Called once per user after they read and click "I Accept" on the T&C modal.
// Works for teacher, student, and admin — resolved via JWT role claim.

router.post("/accept-terms", tenantMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return unauthorized(res, "No token provided");

    let decoded;
    try {
      decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    } catch (_) {
      return unauthorized(res, "Invalid or expired token");
    }

    const { id: userId, role } = decoded;

    let UserModel;
    switch (role) {
      case "admin":     UserModel = getAdminModel(req.db);    break;
      case "teacher":   UserModel = getTeacherModel(req.db);  break;
      case "student":   UserModel = getStudentModel(req.db);  break;
      case "sub-admin": UserModel = getSubAdminModel(req.db); break;
      case "parent":    UserModel = getParentModel(req.db);   break;
      default: return badRequest(res, "Terms acceptance not applicable for this role");
    }

    const user = await UserModel.findById(userId);
    // sub-admin uses a `status` field; all other roles use `active` boolean
    const isActive = role === "sub-admin"
      ? user?.status === "active"
      : !!user?.active;
    if (!user || !isActive) return unauthorized(res, "User not found or inactive");

    if (user.hasAcceptedTerms) {
      return res.json({ success: true, message: "Terms already accepted" });
    }

    user.hasAcceptedTerms = true;
    user.termsAcceptedAt  = new Date();
    await user.save();

    logger.info(`Terms accepted: ${role} ${userId} in center ${req.center.slug}`);
    res.json({ success: true, message: "Terms accepted successfully" });

  } catch (err) {
    logger.error("Accept terms error:", { error: err?.message });
    serverError(res, "Server error while recording terms acceptance");
  }
});

// ─── Session management ───────────────────────────────────────────────────────
// Every center role (admin, teacher, student, sub-admin, parent) keeps one
// session per signed-in device. The device list never exposes session tokens
// (those are the renewal secrets) — devices are addressed by their session id.

/** Verify the bearer token (signature + revocation) and load its user. */
async function authFromBearer(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: "No token provided" };
  let decoded;
  try {
    decoded = jwt.verify(token, getCenterSecret(req.center.slug), JWT_VERIFY_OPTIONS);
  } catch {
    return { error: "Invalid or expired token" };
  }
  if (decoded.centerId !== req.center.slug) return { error: "Token not valid for this center" };
  if (await isTokenBlacklisted(token)) return { error: "Session has been revoked. Please log in again.", code: "SESSION_REVOKED" };
  const user = await getUserDocForRole(req.db, decoded.role, decoded.id);
  if (!user) return { error: "User not found" };
  return { token, decoded, user };
}

/** The session this request's token belongs to */
const currentSessionOf = (user, decoded, token) =>
  (decoded.sid && user.sessions.find(s => String(s._id) === String(decoded.sid))) ||
  user.sessions.find(s => s.jwtToken === token) ||
  null;

// GET /auth/sessions — this account's signed-in devices
router.get("/sessions", tenantMiddleware, async (req, res) => {
  try {
    const auth = await authFromBearer(req);
    if (auth.error) return res.status(401).json({ success: false, message: auth.error, code: auth.code });
    const { user, decoded, token } = auth;
    const current = currentSessionOf(user, decoded, token);

    const sessions = user.sessions
      .filter(s => s.isActive)
      .sort((a, b) => new Date(b.lastActivity || b.loginTime) - new Date(a.lastActivity || a.loginTime))
      .map(s => ({
        id:            String(s._id),
        deviceInfo:    s.deviceInfo,
        ipAddress:     s.ipAddress,
        location:      s.location,
        loginTime:     s.loginTime,
        lastActivity:  s.lastActivity,
        isCurrent:     !!current && String(s._id) === String(current._id),
        deviceLocked:  !!s.devicePublicKey,
        notifications: !!s.pushSubscription?.endpoint,
      }));

    res.json({ success: true, sessions, lastLogin: user.lastLogin });
  } catch (err) {
    logger.error("Get sessions error:", { error: err?.message });
    serverError(res);
  }
});

// ─── Refresh token ────────────────────────────────────────────────────────────
// POST /auth/refresh
// The client sends its expired access token + the sessionToken (refresh token)
// + a proof that the request comes from the device the session belongs to.
// We decode the expired JWT (no signature check) only to learn the role so we
// can query the right model. The real trust comes from the matching active
// session record in the DB and the device proof.
router.post("/refresh", tenantMiddleware, async (req, res) => {
  try {
    const { sessionToken, expiredToken } = req.body;

    if (!sessionToken || !expiredToken) {
      return badRequest(res, "sessionToken and expiredToken required");
    }

    // Decode without verifying — we only need the role + userId hint.
    // Trust is established by the DB session record below, not this decode.
    const decoded = jwt.decode(expiredToken);
    if (!decoded?.id || !decoded?.role) {
      return unauthorized(res, "Invalid token");
    }

    const role = normaliseRole(decoded.role);
    const UserModel = getUserModelForRole(req.db, role);
    if (!UserModel) return unauthorized(res, "Invalid token");

    const user = await UserModel.findById(decoded.id);
    if (!isAccountUsable(role, user)) {
      return unauthorized(res, "Account not found or inactive");
    }

    // Find the matching session — this is the real auth check
    const session = user.sessions.find(s => s.token === sessionToken && s.isActive);
    if (!session) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again.", code: "SESSION_REVOKED" });
    }

    // Check session hasn't been inactive longer than the sliding window
    const lastSeen = session.lastActivity || session.loginTime;
    const inactiveDays = (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);
    if (inactiveDays > SESSION_EXPIRY_DAYS) {
      await endSession(session, "expired");
      await user.save();
      return unauthorized(res, "Session expired. Please log in again.");
    }

    // The renewal must come from the device this session was created on.
    // A session token copied to another computer fails here and is ended.
    const proof = verifyDeviceProof(session, req, sessionToken);
    if (!proof.ok) {
      logger.warn(`🔐 Session renewal from another device rejected (${role} ${user._id}, ${proof.reason})`);
      await endSession(session, "device-mismatch");
      await user.save();
      notifySessionsRevoked(req.app.get("io"), req.center.slug, user._id, [session._id]);
      return res.status(401).json({ success: false, message: "This session belongs to another device. Please log in again.", code: "SESSION_REVOKED" });
    }

    // Issue a fresh access token with up-to-date role claims
    const extra    = await buildRoleClaims(role, user, req.db);
    const newToken = signAccessToken({ role, user, centerSlug: req.center.slug, sid: String(session._id), extra });

    // Update session activity + store new JWT reference
    session.lastActivity = new Date();
    session.jwtToken     = newToken;
    await user.save();

    res.json({ success: true, token: newToken });

  } catch (err) {
    logger.error("Token refresh error:", { error: err?.message });
    serverError(res);
  }
});

// POST /auth/logout-session — sign out THIS device (body: its own sessionToken)
router.post("/logout-session", tenantMiddleware, async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return badRequest(res, "Session token required");
    }

    const auth = await authFromBearer(req);
    if (auth.error) return res.status(401).json({ success: false, message: auth.error, code: auth.code });
    const { user } = auth;

    const session = user.sessions.find(s => s.token === sessionToken);
    if (!session) return notFound(res, "Session not found");

    await endSession(session, "logout");
    await user.save();
    res.json({ success: true, message: "Session logged out successfully" });

  } catch (err) {
    logger.error("Logout session error:", { error: err?.message });
    serverError(res);
  }
});

// POST /auth/sessions/:id/revoke — sign out ONE other device remotely.
// The device is disconnected at once, wipes the app's data and returns to the
// login page; its notifications stop.
router.post("/sessions/:id/revoke", tenantMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid device");

    const auth = await authFromBearer(req);
    if (auth.error) return res.status(401).json({ success: false, message: auth.error, code: auth.code });
    const { user, decoded, token } = auth;

    const session = user.sessions.find(s => String(s._id) === req.params.id && s.isActive);
    if (!session) return notFound(res, "Device not found or already signed out");

    const current = currentSessionOf(user, decoded, token);
    if (current && String(current._id) === String(session._id)) {
      return badRequest(res, "Use Log out to sign out of this device");
    }

    await endSession(session, "remote");
    await user.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, user._id, [session._id]);

    res.json({ success: true, message: "Device signed out" });
  } catch (err) {
    logger.error("Revoke session error:", { error: err?.message });
    serverError(res);
  }
});

// POST /auth/logout-all-devices — sign out every device except this one
router.post("/logout-all-devices", tenantMiddleware, async (req, res) => {
  try {
    const auth = await authFromBearer(req);
    if (auth.error) return res.status(401).json({ success: false, message: auth.error, code: auth.code });
    const { user, decoded, token } = auth;
    const current = currentSessionOf(user, decoded, token);

    const others = user.sessions.filter(s => s.isActive && (!current || String(s._id) !== String(current._id)));
    for (const s of others) await endSession(s, "all-devices");
    await user.save();
    notifySessionsRevoked(req.app.get("io"), req.center.slug, user._id, others.map(s => s._id));

    res.json({ success: true, message: "Logged out from all other devices" });

  } catch (err) {
    logger.error("Logout all devices error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
