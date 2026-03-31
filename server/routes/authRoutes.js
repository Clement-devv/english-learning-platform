import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { config } from "../config/config.js";
import { loginLimiter, passwordResetLimiter, trackFailedLogin, isAccountLocked, clearFailedAttempts } from "../middleware/rateLimiter.js";
import { validatePasswordStrength } from "../utils/passwordUtils.js";
import { createSession, cleanExpiredSessions } from "../utils/sessionManager.js";
import { sendForgotPasswordEmail, sendStudentForgotPasswordEmail, sendAdminForgotPasswordEmail } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAdminModel   = (db) => db.models.Admin   || db.model("Admin",   adminSchema);
const getTeacherModel = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getStudentModel = (db) => db.models.Student || db.model("Student", studentSchema);

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
    const { tempUserId, twoFactorToken, backupCode, role } = req.body;

    if (!tempUserId || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!twoFactorToken && !backupCode) {
      return res.status(400).json({ message: "2FA code or backup code required" });
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
      { id: user._id, email: user.email, role, centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    user.sessions = cleanExpiredSessions(user.sessions || []);
    user.sessions.push(session);
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
    console.error("2FA verification error:", err);
    res.status(500).json({ message: "Server error during 2FA verification" });
  }
});


// ─── Teacher Login ────────────────────────────────────────────────────────────

router.post("/teacher/login", tenantMiddleware, loginLimiter, async (req, res) => {
  try {
    const { password, twoFactorToken, backupCode } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const lockStatus = await isAccountLocked(email);
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${lockStatus.remainingTime} minute(s).`
      });
    }

    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findOne({ email });

    console.log(`[teacher-login] center=${req.center?.slug} email=${email} found=${!!teacher} active=${teacher?.active} status=${teacher?.status} hasPassword=${!!teacher?.password}`);

    if (!teacher) {
      await trackFailedLogin(email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!teacher.active) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact admin." });
    }

    if (teacher.status === "pending") {
      return res.status(403).json({ message: "Your account setup is incomplete. Please check your invite email." });
    }

    const isPasswordValid = await bcrypt.compare(password, teacher.password);
    console.log(`[teacher-login] passwordValid=${isPasswordValid}`);
    if (!isPasswordValid) {
      await trackFailedLogin(email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await clearFailedAttempts(email);

    if (teacher.twoFactorEnabled) {
      if (!twoFactorToken && !backupCode) {
        return res.status(202).json({
          success: false,
          requires2FA: true,
          message: "Please enter your 2FA code",
          tempUserId: teacher._id,
        });
      }

      let isValid = false;

      if (twoFactorToken) {
        const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
        isValid = verifyTwoFactorToken(twoFactorToken, teacher.twoFactorSecret);
      } else if (backupCode) {
        const normalizedCode = backupCode.toUpperCase().trim();
        const updated = await Teacher.findOneAndUpdate(
          { _id: teacher._id, twoFactorBackupCodes: normalizedCode },
          { $pull: { twoFactorBackupCodes: normalizedCode } },
          { new: false }
        );
        isValid = !!updated;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: "Invalid 2FA code or backup code" });
      }
    }

    const token = jwt.sign(
      { id: teacher._id, email: teacher.email, role: "teacher", centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    teacher.sessions = cleanExpiredSessions(teacher.sessions || []);
    teacher.sessions.push(session);
    teacher.lastLogin = new Date();
    await teacher.save();

    res.json({
      success: true,
      token,
      sessionToken: session.token,
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
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

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
    console.error("Change password error:", err);
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
      req.center.slug,
      req.center?.centerName || ""
    );

    if (!emailResult.success) {
      console.error("Teacher forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });

  } catch (err) {
    console.error("Forgot password error:", err);
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
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error while resetting password" });
  }
});


// ─── Student Login ────────────────────────────────────────────────────────────

router.post("/student/login", tenantMiddleware, loginLimiter, async (req, res) => {
  try {
    const { password, twoFactorToken, backupCode } = req.body;
    const email = req.body.email?.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const lockStatus = await isAccountLocked(email);
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${lockStatus.remainingTime} minute(s).`
      });
    }

    const Student = getStudentModel(req.db);
    const student = await Student.findOne({ email });

    if (!student) {
      await trackFailedLogin(email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!student.active) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact admin." });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password);
    if (!isPasswordValid) {
      await trackFailedLogin(email);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await clearFailedAttempts(email);

    if (student.twoFactorEnabled) {
      if (!twoFactorToken && !backupCode) {
        return res.status(202).json({
          success: false,
          requires2FA: true,
          message: "Please enter your 2FA code",
          tempUserId: student._id,
        });
      }

      let isValid = false;

      if (twoFactorToken) {
        const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
        isValid = verifyTwoFactorToken(twoFactorToken, student.twoFactorSecret);
      } else if (backupCode) {
        const normalizedCode = backupCode.toUpperCase().trim();
        const updated = await Student.findOneAndUpdate(
          { _id: student._id, twoFactorBackupCodes: normalizedCode },
          { $pull: { twoFactorBackupCodes: normalizedCode } },
          { new: false }
        );
        isValid = !!updated;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: "Invalid 2FA code or backup code" });
      }
    }

    const token = jwt.sign(
      { id: student._id, email: student.email, role: "student", centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    student.sessions = cleanExpiredSessions(student.sessions || []);
    student.sessions.push(session);
    student.lastLogin = new Date();
    await student.save();

    res.json({
      success: true,
      token,
      sessionToken: session.token,
      student: {
        id: student._id,
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        active: student.active,
        twoFactorEnabled: student.twoFactorEnabled,
      },
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

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
    console.error("Student change password error:", err);
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
      req.center.slug,
      req.center?.centerName || ""
    );

    if (!emailResult.success) {
      console.error("Student forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });

  } catch (err) {
    console.error("Student forgot password error:", err);
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
    console.error("Student reset password error:", err);
    res.status(500).json({ message: "Server error while resetting password" });
  }
});


// ─── Admin Login ──────────────────────────────────────────────────────────────

router.post("/admin/login", tenantMiddleware, loginLimiter, async (req, res) => {
  try {
    const { password, twoFactorToken, backupCode } = req.body;
    const username = req.body.username?.trim().toLowerCase();

    if (!username || !password) {
      return res.status(400).json({ message: "Username/email and password are required" });
    }

    const lockStatus = await isAccountLocked(username);
    if (lockStatus.isLocked) {
      return res.status(423).json({
        message: `Account locked due to too many failed attempts. Try again in ${lockStatus.remainingTime} minute(s).`
      });
    }

    const Admin = getAdminModel(req.db);
    const admin = await Admin.findOne({ $or: [{ username }, { email: username }] });

    if (!admin) {
      await trackFailedLogin(username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!admin.active) {
      return res.status(403).json({ message: "Account deactivated" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      await trackFailedLogin(username);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    await clearFailedAttempts(username);

    if (admin.twoFactorEnabled) {
      if (!twoFactorToken && !backupCode) {
        return res.status(202).json({
          success: false,
          requires2FA: true,
          message: "Please enter your 2FA code",
          tempUserId: admin._id,
        });
      }

      let isValid = false;

      if (twoFactorToken) {
        const { verifyTwoFactorToken } = await import("../utils/twoFactorAuth.js");
        isValid = verifyTwoFactorToken(twoFactorToken, admin.twoFactorSecret);
      } else if (backupCode) {
        const normalizedCode = backupCode.toUpperCase().trim();
        const updated = await Admin.findOneAndUpdate(
          { _id: admin._id, twoFactorBackupCodes: normalizedCode },
          { $pull: { twoFactorBackupCodes: normalizedCode } },
          { new: false }
        );
        isValid = !!updated;
      }

      if (!isValid) {
        return res.status(401).json({ success: false, message: "Invalid 2FA code or backup code" });
      }
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, email: admin.email, role: "admin", centerId: req.center.slug },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    const session = createSession(req, token);
    admin.sessions = cleanExpiredSessions(admin.sessions || []);
    admin.sessions.push(session);
    admin.lastLogin = new Date();
    await admin.save();

    res.json({
      success: true,
      token,
      sessionToken: session.token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: "admin",
        twoFactorEnabled: admin.twoFactorEnabled,
      },
    });

  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

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
    console.error("Admin change password error:", err);
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

    const emailResult = await sendAdminForgotPasswordEmail(admin.email, admin.firstName || admin.username, resetToken, req.center.slug, req.center?.centerName || "");

    if (!emailResult.success) {
      console.error("Admin forgot-password email failed:", emailResult.error);
      return res.status(500).json({ message: "Could not send reset email. Please try again later." });
    }

    res.json({ success: true, message: "If that email exists, a reset link has been sent" });
  } catch (err) {
    console.error("Admin forgot password error:", err);
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
    console.error("Admin reset password error:", err);
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
    console.error("Get sessions error:", err);
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
    console.error("Logout session error:", err);
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
    console.error("Logout all devices error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
