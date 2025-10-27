import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Admin from "../models/Admin.js"; 

import { config } from "../config/config.js";
import { loginLimiter, passwordResetLimiter } from "../middleware/rateLimiter.js";

import { createSession, cleanExpiredSessions } from "../utils/sessionManager.js";


//import { sendForgotPasswordEmail } from "../utils/emailService.js";
import { sendForgotPasswordEmail, sendStudentForgotPasswordEmail } from "../utils/emailService.js";

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
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


// Teacher Login

router.post("/teacher/login", loginLimiter, async  (req, res) => {
  try {
    const { email, password } = req.body;

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    if (!teacher.active) {
      return res.status(403).json({ 
        success: false,
        message: "Your account has been deactivated. Please contact admin." 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, teacher.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Generate JWT token using config
    const token = jwt.sign(
      { 
        id: teacher._id, 
        email: teacher.email,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        role: "teacher"
      },
      config.jwtSecret,  // Using config instead of hardcoded
      { expiresIn: config.jwtExpiry }  // Using config for expiry
    );

    // Create session
    const session = createSession(req, token);
    
    // Clean old sessions and add new one
    teacher.sessions = cleanExpiredSessions(teacher.sessions || []);
    teacher.sessions.push(session);
    teacher.lastLogin = new Date();
    await teacher.save();

    res.json({
      success: true,
      token,
      sessionToken: session.token, // Return session token for logout
      teacher: {
        id: teacher._id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        email: teacher.email,
        continent: teacher.continent,
        ratePerClass: teacher.ratePerClass,
        active: teacher.active
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});


// Verify Token
router.get("/verify", verifyToken, (req, res) => {
  res.json({ success: true, teacher: req.teacher });
});

// Change Password (Teacher changes their own password)
router.post("/teacher/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const teacher = await Teacher.findById(req.teacher._id);
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, teacher.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.password = hashedPassword;
    teacher.lastPasswordChange = new Date();
    await teacher.save();

    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });

  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error while changing password" });
  }
});

// Forgot Password - Request reset
router.post("/teacher/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const teacher = await Teacher.findOne({ email });
    
    // Don't reveal if email exists or not for security
    if (!teacher) {
      return res.json({ 
        success: true, 
        message: "If that email exists, a reset link has been sent" 
      });
    }

    if (!teacher.active) {
      return res.status(403).json({ 
        message: "Your account is deactivated. Please contact admin." 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save token to database (expires in 1 hour)
    teacher.resetPasswordToken = hashedToken;
    teacher.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await teacher.save();

    // Send email with reset link
    await sendForgotPasswordEmail(
      teacher.email,
      `${teacher.firstName} ${teacher.lastName}`,
      resetToken // Send unhashed token in email
    );

    res.json({ 
      success: true, 
      message: "If that email exists, a reset link has been sent" 
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error while processing request" });
  }
});

// Reset Password - Using token from email
router.post("/teacher/reset-password/:token", async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Hash the token from URL to compare with database
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Find teacher with valid token
    const teacher = await Teacher.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!teacher) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new one." 
      });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
    teacher.password = hashedPassword;
    teacher.lastPasswordChange = new Date();
    teacher.resetPasswordToken = undefined;
    teacher.resetPasswordExpires = undefined;
    await teacher.save();

    res.json({ 
      success: true, 
      message: "Password reset successfully. You can now login with your new password." 
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error while resetting password" });
  }
});




//student......................................................


// Student Login
router.post("/student/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!student.active) {
      return res.status(403).json({ 
        message: "Your account has been deactivated. Please contact your administrator." 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: student._id, 
        email: student.email,
        firstName: student.firstName,
        surname: student.surname,
        role: "student"
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    // Create session
    const session = createSession(req, token);
    
    // Clean old sessions and add new one
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
        firstName: student.firstName,
        surname: student.surname,
        email: student.email,
        noOfClasses: student.noOfClasses,
        active: student.active
      }
    });

  } catch (err) {
    console.error("Student login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Student verify token endpoint - 
router.get("/student/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const student = await Student.findById(decoded.id).select("-password");
    
    if (!student || !student.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    res.json({ success: true, student });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Student Change Password - 
router.post("/student/change-password", async (req, res) => {
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

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const student = await Student.findById(decoded.id);
    
    if (!student || !student.active) {
      return res.status(401).json({ message: "Invalid account or inactive" });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.password = hashedPassword;
    student.lastPasswordChange = new Date();
    await student.save();

    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });

  } catch (err) {
    console.error("Student change password error:", err);
    res.status(500).json({ message: "Server error while changing password" });
  }
});


// Student Forgot Password - Request reset
router.post("/student/forgot-password", passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const student = await Student.findOne({ email });
    
    // Don't reveal if email exists or not for security
    if (!student) {
      return res.json({ 
        success: true, 
        message: "If that email exists, a reset link has been sent" 
      });
    }

    if (!student.active) {
      return res.status(403).json({ 
        message: "Your account is deactivated. Please contact your administrator." 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save token to database (expires in 1 hour)
    student.resetPasswordToken = hashedToken;
    student.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await student.save();

    // Send email with reset link
    await sendStudentForgotPasswordEmail(
      student.email,
      `${student.firstName} ${student.surname}`,
      resetToken // Send unhashed token in email
    );

    res.json({ 
      success: true, 
      message: "If that email exists, a reset link has been sent" 
    });

  } catch (err) {
    console.error("Student forgot password error:", err);
    res.status(500).json({ message: "Server error while processing request" });
  }
});

// Student Reset Password - Using token from email
router.post("/student/reset-password/:token", async (req, res) => {
  try {
    const { newPassword } = req.body;
    const resetToken = req.params.token;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Hash the token from URL to compare with database
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Find student with valid token
    const student = await Student.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!student) {
      return res.status(400).json({ 
        message: "Invalid or expired reset token. Please request a new one." 
      });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
    student.password = hashedPassword;
    student.lastPasswordChange = new Date();
    student.resetPasswordToken = undefined;
    student.resetPasswordExpires = undefined;
    await student.save();

    res.json({ 
      success: true, 
      message: "Password reset successfully. You can now login with your new password." 
    });

  } catch (err) {
    console.error("Student reset password error:", err);
    res.status(500).json({ message: "Server error while resetting password" });
  }
});


// Admin Login........................................................................
router.post("/admin/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ $or: [{ username }, { email: username }] });
    
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!admin.active) {
      return res.status(403).json({ message: "Account deactivated" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin._id, 
        username: admin.username,
        email: admin.email,
        role: "admin"
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    // Create session
    const session = createSession(req, token);
    
    // Clean old sessions and add new one
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
        role: "admin"
      }
    });

  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Admin Verify Token - ADD THIS
router.get("/admin/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    
    if (!admin || !admin.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    res.json({ success: true, admin });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// Admin Change Password - ADD THIS TOO (optional but recommended)
router.post("/admin/change-password", async (req, res) => {
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

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const admin = await Admin.findById(decoded.id);
    
    if (!admin || !admin.active) {
      return res.status(401).json({ message: "Invalid account or inactive" });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
    admin.password = hashedPassword;
    admin.lastPasswordChange = new Date();
    await admin.save();

    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });

  } catch (err) {
    console.error("Admin change password error:", err);
    res.status(500).json({ message: "Server error while changing password" });
  }
});

// Get all active sessions for current user
router.get("/sessions", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    let user;
    if (decoded.role === "teacher") {
      user = await Teacher.findById(decoded.id).select("sessions lastLogin");
    } else if (decoded.role === "student") {
      user = await Student.findById(decoded.id).select("sessions lastLogin");
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id).select("sessions lastLogin");
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter only active sessions
    const activeSessions = user.sessions
      .filter(s => s.isActive)
      .map(s => ({
        sessionToken: s.token,
        deviceInfo: s.deviceInfo,
        ipAddress: s.ipAddress,
        location: s.location,
        loginTime: s.loginTime,
        lastActivity: s.lastActivity,
        isCurrent: s.jwtToken === token, // Mark current session
      }));

    res.json({
      success: true,
      sessions: activeSessions,
      lastLogin: user.lastLogin,
    });

  } catch (err) {
    console.error("Get sessions error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Logout from specific session
router.post("/logout-session", async (req, res) => {
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
      user = await Teacher.findById(decoded.id);
    } else if (decoded.role === "student") {
      user = await Student.findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Deactivate the specific session
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

// Logout from all devices except current
router.post("/logout-all-devices", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    let user;
    if (decoded.role === "teacher") {
      user = await Teacher.findById(decoded.id);
    } else if (decoded.role === "student") {
      user = await Student.findById(decoded.id);
    } else if (decoded.role === "admin") {
      user = await Admin.findById(decoded.id);
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Deactivate all sessions except current
    user.sessions = user.sessions.map(session => {
      if (session.jwtToken !== token) {
        session.isActive = false;
      }
      return session;
    });

    await user.save();

    res.json({ 
      success: true, 
      message: "Logged out from all other devices" 
    });

  } catch (err) {
    console.error("Logout all devices error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;