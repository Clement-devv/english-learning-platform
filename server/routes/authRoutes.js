import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js"; 

import { sendForgotPasswordEmail } from "../utils/emailService.js";

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key-change-this");
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
router.post("/teacher/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("✅ Teacher found:", teacher.firstName, teacher.lastName);
    console.log("Teacher active:", teacher.active);
    console.log("Stored password (first 10 chars):", teacher.password.substring(0, 10));


    if (!teacher.active) {
      return res.status(403).json({ message: "Your account has been deactivated. Please contact admin." });
    }


    console.log("Comparing passwords...");
    const isPasswordValid = await bcrypt.compare(password, teacher.password);
    console.log("Password valid:", isPasswordValid);
    
    if (!isPasswordValid) {
      console.log("❌ Password mismatch");
      return res.status(401).json({ message: "Invalid email or password" });
    }
    console.log("✅ Login successful!");

    const token = jwt.sign(
      { 
        id: teacher._id, 
        email: teacher.email,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        role: "teacher"
      },
      process.env.JWT_SECRET || "your-secret-key-change-this",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
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
    const hashedPassword = await bcrypt.hash(newPassword, 10);
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
router.post("/teacher/forgot-password", async (req, res) => {
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
    const hashedPassword = await bcrypt.hash(newPassword, 10);
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

// Add these routes to your existing routes/authRoutes.js file


// Student Login


// Student Login
router.post("/student/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log("✅ Student found:", student.firstName, student.surname);
    console.log("Student active:", student.active);

    if (!student.active) {
      return res.status(403).json({ 
        message: "Your account has been deactivated. Please contact your administrator." 
      });
    }

    console.log("Comparing passwords...");
    const isPasswordValid = await bcrypt.compare(password, student.password);
    console.log("Password valid:", isPasswordValid);
    
    if (!isPasswordValid) {
      console.log("❌ Password mismatch");
      return res.status(401).json({ message: "Invalid email or password" });
    }
    console.log("✅ Login successful!");

    const token = jwt.sign(
      { 
        id: student._id, 
        email: student.email,
        firstName: student.firstName,
        surname: student.surname,
        role: "student"
      },
      process.env.JWT_SECRET || "your-secret-key-change-this",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key-change-this");
    const student = await Student.findById(decoded.id).select("-password");
    
    if (!student || !student.active) {
      return res.status(401).json({ message: "Invalid token or inactive account" });
    }

    res.json({ success: true, student });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});
export default router;