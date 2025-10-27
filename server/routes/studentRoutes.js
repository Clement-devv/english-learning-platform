// routes/studentRoutes.js
import express from "express";
import bcryptjs from "bcryptjs";
import Student from "../models/Student.js";
import Payment from "../models/Payment.js";
import Lesson from "../models/Lesson.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../utils/emailService.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher, verifyStudent, verifyOwnership } from "../middleware/authMiddleware.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

import bcrypt from "bcryptjs"; 
import { config } from "../config/config.js";

const router = express.Router();


// ================== STUDENT CRUD ==================

// 👉 Get all students - ONLY ADMIN AND TEACHERS can view
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching students" });
  }
});

// 👉 Get single student by ID - Admin, Teachers, or the student themselves
router.get("/:id", verifyToken, async (req, res) => {
  try {
    // Students can only view their own data, Admin/Teachers can view any
    if (req.user.role === "student" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only view your own data" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching student" });
  }
});

// 👉 Create new student - ONLY ADMIN AND TEACHERS
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { firstName, surname, email, password, age, noOfClasses } = req.body;

    if (!firstName || !surname || !email) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await Student.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Handle password (use provided OR generate)
    let rawPassword = password;
    if (!rawPassword) {
      rawPassword = Math.random().toString(36).slice(-8);
    }
    const hashedPassword = await bcrypt.hash(rawPassword, config.bcryptRounds);
    const student = await Student.create({
      firstName,
      surname,
      email,
      password: hashedPassword,
      age,
      noOfClasses: noOfClasses || 0,
      showTempPassword: !password,
    });

    // 📧 Send welcome email
    console.log(`📧 Sending welcome email to ${email}...`);
    try {
      await sendWelcomeEmail(
        email,
        `${firstName} ${surname}`,
        rawPassword
      );
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send welcome email:`, emailError);
    }

    res.status(201).json({
      message: "Student created successfully",
      student,
      tempPassword: rawPassword,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating student" });
  }
});

// 👉 Update student - ONLY ADMIN AND TEACHERS
router.put("/:id", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { password, ...updates } = req.body;

    if (password) {
      updates.password = await bcrypt.hash(password, config.bcryptRounds);
      updates.showTempPassword = false;
      updates.lastPasswordChange = new Date();
    }

    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    if (!student) return res.status(404).json({ message: "Student not found" });

    // 📧 If password was reset, send email
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
    student.password = await bcrypt.hash(newPass, config.bcryptRounds);
    student.showTempPassword = true;
    student.lastPasswordChange = new Date();
    await student.save();

    // 📧 Send password reset email
    console.log(`📧 Sending password reset email to ${student.email}...`);
    try {
      await sendPasswordResetEmail(
        student.email,
        `${student.firstName} ${student.surname}`,
        newPass
      );
      console.log(`✅ Password reset email sent`);
    } catch (emailError) {
      console.error(`❌ Failed to send password reset email:`, emailError);
    }

    res.json({ message: "Password reset", newPassword: newPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// 👉 Record lesson - ONLY ADMIN AND TEACHERS
router.post("/:id/lesson", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (student.noOfClasses > 0) {
      student.noOfClasses -= 1;
    }
    if (student.noOfClasses === 0) {
      student.active = false;
    }
    await student.save();

    // ✅ Save lesson to database
    const lesson = await Lesson.create({
      studentId: student._id,
      teacher: req.body.teacher || "Unknown Teacher",
      date: new Date(),
    });

    res.json({ message: "Lesson recorded", student, lesson });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error recording lesson" });
  }
});

// 👉 Get all lessons for a student - Admin, Teachers, or the student themselves
router.get("/:id/lessons", verifyToken, async (req, res) => {
  try {
    // Students can only view their own lessons
    if (req.user.role === "student" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "You can only view your own lessons" });
    }

    const lessons = await Lesson.find({ studentId: req.params.id }).sort({ date: -1 });
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching lessons" });
  }
});

// 👉 Record payment - ONLY ADMIN
router.post("/:id/payment", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, classes, method = "Manual", status = "completed" } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    student.lastPaymentDate = new Date();
    student.active = true;
    student.noOfClasses = (student.noOfClasses || 0) + (parseInt(classes, 10) || 0);
    await student.save();

    const payment = await Payment.create({
      studentId: student._id,
      amount,
      classes,
      method,
      status,
      date: new Date(),
    });

    res.json({ message: "Payment recorded", student, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error recording payment" });
  }
});

// 👉 Get all payments for a student - Admin, Teachers, or the student themselves
router.get("/:id/payments", verifyToken, async (req, res) => {
  try {
    // Students can only view their own payments
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

// 👉 Toggle student active/inactive - ONLY ADMIN
router.patch("/:id/toggle", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (typeof req.body.active === "boolean") {
      student.active = req.body.active;
    } else {
      student.active = !student.active;
    }

    await student.save();
    res.json({ message: "Student status updated", student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error toggling student status" });
  }
});


export default router;