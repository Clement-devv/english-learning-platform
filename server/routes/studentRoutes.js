// server/routes/studentRoutes.js - UPDATED WITH INVITE FLOW
import express from "express";
import bcrypt  from "bcryptjs";
import crypto  from "crypto";
import Student from "../models/Student.js";
import Payment from "../models/Payment.js";
import Lesson  from "../models/Lesson.js";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendStudentInviteEmail,
  sendStudentWelcomeEmail,
} from "../utils/emailService.js";
import {
  verifyToken,
  verifyAdmin,
  verifyAdminOrTeacher,
  verifyStudent,
  verifyOwnership,
} from "../middleware/authMiddleware.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { config } from "../config/config.js";

const router = express.Router();

// ================== STUDENT CRUD ==================

// 👉 Get all students - ONLY ADMIN AND TEACHERS can view
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const students = await Student.find()
    .select("firstName surname email active noOfClasses age lastPaymentDate showTempPassword status createdAt")
    .lean();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching students" });
  }
});

// 👉 Get single student by ID - Admin, Teachers, or the student themselves
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only view your own data" });
    }
    const student = await Student.findById(req.params.id)
    .select("firstName surname email active noOfClasses age lastPaymentDate showTempPassword status twoFactorEnabled googleMeetLink createdAt")
    .lean();
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching student" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 👉 Create new student — sends invite email instead of password
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { firstName, surname, email, age, noOfClasses } = req.body;

    if (!firstName || !surname || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await Student.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate invite token (48-hour expiry)
    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Create student — no password yet, status pending
    const student = await Student.create({
      firstName,
      surname,
      email,
      age,
      noOfClasses: noOfClasses || 0,
      status:       "pending",
      active:       false,
      inviteToken,
      inviteExpires,
    });

    // Send invite email
    const setupUrl = `${config.frontendUrl}/student/setup?token=${inviteToken}`;
    console.log(`📧 Sending student invite to ${email}...`);
    try {
      await sendStudentInviteEmail(student, setupUrl);
      console.log(`✅ Invite sent to ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send invite email:`, emailError);
      // Don't fail — admin can resend
    }

    res.status(201).json({
      message: "Student created. Invite email sent.",
      student: { ...student.toObject(), password: undefined, inviteToken: undefined },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating student" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 👉 Verify invite token — PUBLIC (no auth needed)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/verify-invite/:token", async (req, res) => {
  try {
    const student = await Student.findOne({
      inviteToken:   req.params.token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!student) {
      return res.status(400).json({
        message: "This invite link is invalid or has expired. Please ask your admin to resend the invitation.",
      });
    }

    res.json({
      valid: true,
      student: {
        firstName:   student.firstName,
        surname:     student.surname,
        email:       student.email,
        noOfClasses: student.noOfClasses,
        age:         student.age,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error verifying invite" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 👉 Setup account — student sets password after clicking invite link
// ─────────────────────────────────────────────────────────────────────────────
router.post("/setup-account", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ message: "Token and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const student = await Student.findOne({
      inviteToken:   token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!student) {
      return res.status(400).json({
        message: "This invite link is invalid or has expired. Please ask your admin to resend the invitation.",
      });
    }

    // Activate account
    student.password      = await bcrypt.hash(password, config.bcryptRounds);
    student.status        = "active";
    student.active        = true;
    student.inviteToken   = undefined;
    student.inviteExpires = undefined;
    await student.save();

    // Send welcome email
    console.log(`📧 Sending welcome email to ${student.email}...`);
    try {
      await sendStudentWelcomeEmail(student);
      console.log(`✅ Welcome email sent to ${student.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send welcome email:`, emailError);
    }

    res.json({
      message: "Account activated successfully! You can now login.",
      student: { firstName: student.firstName, surname: student.surname, email: student.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error setting up account" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 👉 Resend invite — admin only
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (student.status !== "pending") {
      return res.status(400).json({ message: "Student has already set up their account" });
    }

    // Refresh token
    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    student.inviteToken   = inviteToken;
    student.inviteExpires = inviteExpires;
    await student.save();

    const setupUrl = `${config.frontendUrl}/student/setup?token=${inviteToken}`;
    await sendStudentInviteEmail(student, setupUrl);

    res.json({ message: "Invite resent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resending invite" });
  }
});

// ================== UPDATE / DELETE ==================

// 👉 Update student - ONLY ADMIN AND TEACHERS
router.put("/:id", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { password, ...updates } = req.body;

    if (password) {
      updates.password = await bcrypt.hash(password, config.bcryptRounds);
      updates.showTempPassword   = false;
      updates.lastPasswordChange = new Date();
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (password) {
      console.log(`📧 Sending password reset email to ${student.email}...`);
      try {
        await sendPasswordResetEmail(
          student.email,
          `${student.firstName} ${student.surname}`,
          password
        );
        console.log(`✅ Password reset email sent to ${student.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send password reset email:`, emailError);
      }
    }

    res.json({ message: "Student updated", student });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error updating student" });
  }
});

// 👉 Delete student - ONLY ADMIN
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting student" });
  }
});

// ================== EXTRA FEATURES ==================

// 👉 Reset password - ONLY ADMIN AND TEACHERS
router.post("/:id/reset-password", verifyToken, verifyAdminOrTeacher, strictLimiter, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const newPass = Math.random().toString(36).slice(-8);
    student.password           = await bcrypt.hash(newPass, config.bcryptRounds);
    student.showTempPassword   = true;
    student.lastPasswordChange = new Date();
    await student.save();

    console.log(`📧 Sending password reset email to ${student.email}...`);
    try {
      await sendPasswordResetEmail(
        student.email,
        `${student.firstName} ${student.surname}`,
        newPass
      );
      console.log(`✅ Password reset email sent to ${student.email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email:`, emailError);
    }

    res.json({ message: "Password reset successfully", tempPassword: newPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
});


// 👉 Record payment - ONLY ADMIN
router.post("/:id/payment", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, classes, method = "Manual", status = "completed" } = req.body;

    if (!amount || !classes) {
      return res.status(400).json({ message: "Amount and number of classes are required" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Add classes and activate student
    student.lastPaymentDate = new Date();
    student.active          = true;
    student.noOfClasses     = (student.noOfClasses || 0) + (parseInt(classes, 10) || 0);
    await student.save();

    const payment = await Payment.create({
      studentId: student._id,
      amount,
      classes,
      method,
      status,
      date: new Date(),
    });

    console.log(`✅ Payment recorded: ₦${amount} for ${classes} classes → ${student.email}`);

    res.json({ message: "Payment recorded", student, payment });
  } catch (err) {
    console.error("❌ Payment error:", err);
    res.status(500).json({ message: "Error recording payment" });
  }
});

// 👉 Get all payments for a student
router.get("/:id/payments", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only view your own payments" });
    }
    const payments = await Payment.find({ studentId: req.params.id }).sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching payments" });
  }
});

export default router;