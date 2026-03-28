// server/routes/studentRoutes.js
import express from "express";
import bcrypt  from "bcryptjs";
import crypto  from "crypto";
import {
  sendPasswordResetEmail,
  sendStudentInviteEmail,
  sendStudentWelcomeEmail,
  sendAccountDeletionWarningEmail,
} from "../utils/emailService.js";
import {
  verifyToken, verifyAdmin, verifyAdminOrTeacher, verifyOwnership,
} from "../middleware/authMiddleware.js";
import { completeReferral } from "./referralRoutes.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { config } from "../config/config.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { paymentSchema } from "../schemas/paymentSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getPayment = (db) => db.models.Payment || db.model("Payment", paymentSchema);

// ─── GET all students ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const students = await getStudent(req.db)
      .find()
      .select("firstName surname email active noOfClasses age lastPaymentDate showTempPassword status createdAt")
      .lean();
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching students" });
  }
});

// ─── GET single student ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id)
      return res.status(403).json({ message: "You can only view your own data" });
    const student = await getStudent(req.db)
      .findById(req.params.id)
      .select("firstName surname email active noOfClasses age lastPaymentDate showTempPassword status twoFactorEnabled createdAt")
      .lean();
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching student" });
  }
});

// ─── POST create student (invite flow) ───────────────────────────────────────
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { firstName, surname, email, age, noOfClasses } = req.body;
    if (!firstName || !surname || !email)
      return res.status(400).json({ message: "Missing required fields" });

    const Student = getStudent(req.db);
    const exists = await Student.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already exists" });

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const student = await Student.create({
      firstName, surname, email, age,
      noOfClasses: noOfClasses || 0,
      status: "pending", active: false,
      inviteToken, inviteExpires,
    });

    const setupUrl = `${config.frontendUrl}/student/setup?token=${inviteToken}`;
    try {
      await sendStudentInviteEmail(student, setupUrl);
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
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

// ─── GET verify-invite token ──────────────────────────────────────────────────
router.get("/verify-invite/:token", strictLimiter, async (req, res) => {
  try {
    const student = await getStudent(req.db).findOne({
      inviteToken: req.params.token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!student) {
      return res.status(400).json({ message: "This invite link is invalid or has expired. Please ask your admin to resend the invitation." });
    }
    res.json({ valid: true, student: { firstName: student.firstName, surname: student.surname, email: student.email, noOfClasses: student.noOfClasses, age: student.age } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error verifying invite" });
  }
});

// ─── POST setup-account ───────────────────────────────────────────────────────
router.post("/setup-account", strictLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: "Token and password are required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const Student = getStudent(req.db);
    const student = await Student.findOne({
      inviteToken: token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!student) {
      return res.status(400).json({ message: "This invite link is invalid or has expired. Please ask your admin to resend the invitation." });
    }

    student.password      = await bcrypt.hash(password, config.bcryptRounds);
    student.status        = "active";
    student.active        = true;
    student.inviteToken   = undefined;
    student.inviteExpires = undefined;

    // Auto-generate unique referral code
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const taken = await Student.exists({ referralCode: code });
      if (!taken) { student.referralCode = code; break; }
    }

    await student.save();

    completeReferral(student._id, req.db).catch(() => {});

    try { await sendStudentWelcomeEmail(student); }
    catch (e) { console.error("Failed to send welcome email:", e); }

    res.json({ message: "Account activated successfully! You can now login.", student: { firstName: student.firstName, surname: student.surname, email: student.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error setting up account" });
  }
});

// ─── POST resend-invite ───────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (student.status !== "pending") return res.status(400).json({ message: "Student has already set up their account" });

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

// ─── PATCH timezone ───────────────────────────────────────────────────────────
router.patch("/:id/timezone", verifyToken, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== "string")
      return res.status(400).json({ message: "timezone required" });
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); }
    catch { return res.status(400).json({ message: "Invalid timezone identifier" }); }
    await getStudent(req.db).findByIdAndUpdate(req.params.id, { timezone });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error updating timezone" });
  }
});

// ─── PUT update student ───────────────────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { password, ...updates } = req.body;
    if (password) {
      updates.password           = await bcrypt.hash(password, config.bcryptRounds);
      updates.showTempPassword   = false;
      updates.lastPasswordChange = new Date();
    }

    const student = await getStudent(req.db).findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (password) {
      try { await sendPasswordResetEmail(student.email, `${student.firstName} ${student.surname}`, password); }
      catch (e) { console.error("Failed to send password reset email:", e); }
    }

    res.json({ message: "Student updated", student });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error updating student" });
  }
});

// ─── PATCH toggle active ──────────────────────────────────────────────────────
router.patch("/:id/toggle", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean") return res.status(400).json({ message: "active (boolean) is required" });
    const student = await getStudent(req.db)
      .findByIdAndUpdate(req.params.id, { active }, { new: true })
      .select("firstName surname email active noOfClasses age lastPaymentDate status");
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: `Student ${active ? "enabled" : "disabled"}`, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error toggling student status" });
  }
});

// ─── DELETE (soft-delete) ─────────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (student.scheduledDeletionAt) return res.status(400).json({ message: "Student is already scheduled for deletion" });

    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    student.active                   = false;
    student.scheduledDeletionAt      = deletionDate;
    student.deletionWarningEmailSent = false;
    await student.save();

    sendAccountDeletionWarningEmail(student, deletionDate).catch(e => console.error("Deletion warning email failed:", e.message));

    res.json({ message: "Student scheduled for deletion", scheduledDeletionAt: deletionDate, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error scheduling student deletion" });
  }
});

// ─── POST restore ─────────────────────────────────────────────────────────────
router.post("/:id/restore", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!student.scheduledDeletionAt) return res.status(400).json({ message: "Student is not scheduled for deletion" });

    student.scheduledDeletionAt      = null;
    student.deletionWarningEmailSent = false;
    student.active                   = true;
    await student.save();

    res.json({ message: "Student account restored successfully", student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error restoring student" });
  }
});

// ─── POST reset-password ──────────────────────────────────────────────────────
router.post("/:id/reset-password", verifyToken, verifyAdminOrTeacher, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const newPass          = Math.random().toString(36).slice(-8);
    student.password       = await bcrypt.hash(newPass, config.bcryptRounds);
    student.showTempPassword   = true;
    student.lastPasswordChange = new Date();
    await student.save();

    try { await sendPasswordResetEmail(student.email, `${student.firstName} ${student.surname}`, newPass); }
    catch (e) { console.error("Failed to send password reset email:", e); }

    res.json({ message: "Password reset successfully", tempPassword: newPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// ─── POST record payment ──────────────────────────────────────────────────────
router.post("/:id/payment", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, classes, method = "Manual", status = "completed" } = req.body;
    if (!amount || !classes) return res.status(400).json({ message: "Amount and number of classes are required" });

    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    student.lastPaymentDate = new Date();
    student.active          = true;
    student.noOfClasses     = (student.noOfClasses || 0) + (parseInt(classes, 10) || 0);
    await student.save();

    const payment = await getPayment(req.db).create({
      studentId: student._id, amount, classes, method, status, date: new Date(),
    });

    res.json({ message: "Payment recorded", student, payment });
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ message: "Error recording payment" });
  }
});

// ─── GET payments for a student ───────────────────────────────────────────────
router.get("/:id/payments", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id)
      return res.status(403).json({ message: "You can only view your own payments" });
    const payments = await getPayment(req.db).find({ studentId: req.params.id }).sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching payments" });
  }
});

export default router;
