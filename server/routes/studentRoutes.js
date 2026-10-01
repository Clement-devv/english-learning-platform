// server/routes/studentRoutes.js
import express from "express";
import bcrypt  from "bcryptjs";
import crypto  from "crypto";
import {
  sendPasswordResetEmail,
  sendStudentInviteEmail,
  sendStudentWelcomeEmail,
  sendAccountDeletionWarningEmail,
  sendNewStudentRecordEmail,
  getCenterBaseUrl,
} from "../utils/emailService.js";
import { generateStudentRecordPdf } from "../utils/recordPdfGenerator.js";
import {
  verifyToken, verifyAdmin, verifyAdminOrTeacher, verifyOwnership,
} from "../middleware/authMiddleware.js";
import { completeReferral } from "./referralRoutes.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { config } from "../config/config.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { paymentSchema }  from "../schemas/paymentSchema.js";
import { parsePagination, DIRECTORY_MAX } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { assignStudentId, generateStudentId } from '../utils/studentIdGenerator.js';
import { generateSecurePassword } from '../utils/passwordUtils.js';
import { makeManagedEmail, isManagedEmail } from '../utils/managedStudent.js';
import { planBlocksStudentMode } from '../utils/planFeatures.js';

const router = express.Router();
router.use(tenantMiddleware);

const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);
const getPayment  = (db) => db.models.Payment  || db.model("Payment",  paymentSchema);

// Returns an error message if the center's student seat limit is reached (-1 = unlimited).
// Managed students count toward the limit — they receive classes like any student.
const checkSeatLimit = async (Student, center) => {
  const maxStudents = center?.maxStudents;
  if (!maxStudents || maxStudents === -1) return null;
  const currentCount = await Student.countDocuments({ status: { $ne: 'disabled' } });
  return currentCount >= maxStudents
    ? `Student limit reached (${currentCount}/${maxStudents}). Contact your super admin to increase the limit.`
    : null;
};

// Returns an error message if the email already belongs to a student, teacher or sub-admin.
const findEmailConflict = async (db, email) => {
  const [asStudent, asTeacher, asSubAdmin] = await Promise.all([
    getStudent(db).exists({ email }),
    getTeacher(db).exists({ email }),
    getSubAdmin(db).exists({ email }),
  ]);
  if (asStudent)  return "Email is already registered as a student";
  if (asTeacher)  return "Email is already registered as a teacher";
  if (asSubAdmin) return "Email is already registered as a sub-admin";
  return null;
};

const MANAGED_NO_LOGIN_MSG = "Managed students have no login — this action is not available.";

// ─── GET all students ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    // Directory list: screens filter + page it locally, so allow the whole center
    // (default stays 50 for callers that don't ask)
    const { limit, skip } = parsePagination(req.query, 50, DIRECTORY_MAX);
    const Student = getStudent(req.db);
    // ?type=managed | real — omitted returns both (assign/booking pickers need everyone)
    const filter = req.query.type === "managed" ? { isManaged: true }
                 : req.query.type === "real"  ? { isManaged: { $ne: true } }
                 : {};
    const students = await Student
      .find(filter)
      .select("studentId firstName lastName email active classCredits age lastPaymentDate showTempPassword status createdAt phone country rank dateOfBirth scheduledDeletionAt isManaged")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Backfill IDs for existing students who predate this feature.
    // Sequential (not Promise.all) to avoid concurrent ID collisions.
    const missing = students.filter(s => !s.studentId);
    for (const s of missing) {
      s.studentId = await assignStudentId(Student, s._id);
    }

    res.json(students);
  } catch (err) {
    logger.error(err);
    serverError(res, "Server error fetching students");
  }
});

// ─── GET /streak  —  student fetches their own streak data ───────────────────
// NOTE: Must be defined BEFORE /:id or Express would match /:id with id="streak"
router.get("/streak", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");
    const student = await getStudent(req.db)
      .findById(req.user.id)
      .select("currentStreak longestStreak lastActivityDate streakFreezes weeklyClassStreak longestWeeklyClassStreak lastClassWeek activityDates")
      .lean();
    if (!student) return notFound(res, "Student not found");
    res.json(student);
  } catch (err) {
    logger.error("GET /streak error:", { error: err?.message });
    serverError(res);
  }
});

// ─── GET single student ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id)
      return forbidden(res, "You can only view your own data");
    const student = await getStudent(req.db)
      .findById(req.params.id)
      .select("studentId firstName lastName email active classCredits age lastPaymentDate showTempPassword status twoFactorEnabled createdAt isManaged")
      .lean();
    if (!student) return notFound(res, "Student not found");
    res.json(student);
  } catch (err) {
    logger.error(err);
    serverError(res, "Server error fetching student");
  }
});

// ─── POST create student (invite flow) ───────────────────────────────────────
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { firstName, lastName, email, age, dateOfBirth, rank, phone, country } = req.body;
    if (!firstName || !lastName || !email)
      return badRequest(res, "Missing required fields");

    const planError = planBlocksStudentMode(req.center, "real");
    if (planError) return forbidden(res, planError);

    const Student  = getStudent(req.db);
    const normalizedEmail = email.trim().toLowerCase();

    const emailConflict = await findEmailConflict(req.db, normalizedEmail);
    if (emailConflict) return badRequest(res, emailConflict);

    const seatError = await checkSeatLimit(Student, req.center);
    if (seatError) return res.status(403).json({ message: seatError });

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Retry student creation on the rare E11000 duplicate studentId collision
    let student;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        student = await Student.create({
          studentId: await generateStudentId(Student),
          firstName, lastName, email: normalizedEmail, age,
          classCredits: 0,
          phone: phone || "", country: country || "",
          dateOfBirth: dateOfBirth || null,
          rank: rank || "",
          status: "pending", active: false,
          inviteToken, inviteExpires,
        });
        break;
      } catch (e) {
        if (e.code !== 11000 || attempt === 4) throw e;
      }
    }

    const { baseUrl, needsSlug } = getCenterBaseUrl(req.center);
    const setupUrl = `${baseUrl}/student/setup?token=${inviteToken}${needsSlug ? `&center=${req.center.slug}` : ""}`;
    const centerName = req.center?.centerName || "";

    try {
      await sendStudentInviteEmail(student, setupUrl, centerName);
    } catch (emailError) {
      logger.error("Failed to send invite email:", emailError);
    }

    res.status(201).json({
      message: "Student created. Invite email sent.",
      student: { ...student.toObject(), password: undefined, inviteToken: undefined },
    });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error creating student");
  }
});

// ─── POST create managed student (admin only, no login) ────────────────────────
// Active immediately — no email, no invite, no password.
router.post("/managed", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const firstName = req.body.firstName?.trim();
    const lastName  = req.body.lastName?.trim() || "";
    const { age, dateOfBirth, rank, phone, country } = req.body;
    if (!firstName) return badRequest(res, "Name is required");

    const planError = planBlocksStudentMode(req.center, "managed");
    if (planError) return forbidden(res, planError);

    const Student = getStudent(req.db);
    const seatError = await checkSeatLimit(Student, req.center);
    if (seatError) return res.status(403).json({ message: seatError });

    // Retry on the rare E11000 duplicate studentId collision
    let student;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        student = await Student.create({
          studentId: await generateStudentId(Student),
          firstName, lastName,
          email: makeManagedEmail(),
          isManaged: true,
          age: age || undefined,
          classCredits: 0,
          phone: phone || "", country: country || "",
          dateOfBirth: dateOfBirth || null,
          rank: rank || "",
          status: "active", active: true,
          // Admin manages this record — the student never sees a terms prompt
          hasAcceptedTerms: true,
          // No device to ring — nobody ever logs in as this student
          ringEnabled: false,
        });
        break;
      } catch (e) {
        if (e.code !== 11000 || attempt === 4) throw e;
      }
    }

    res.status(201).json({
      message: "Managed student created.",
      student: { ...student.toObject(), password: undefined },
    });
  } catch (err) {
    logger.error("Create managed student error:", { error: err?.message });
    serverError(res, "Error creating managed student");
  }
});

// ─── POST convert managed → real student account (admin only) ───────────────
// Keeps the same record, so bookings, assignments, credits and history carry over.
// The student becomes "pending" and receives the normal invite to set a password.
router.post("/:id/convert", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return badRequest(res, "A valid email address is required");
    if (isManagedEmail(email)) return badRequest(res, "Please use the student's real email address");

    const planError = planBlocksStudentMode(req.center, "real");
    if (planError) return forbidden(res, planError);

    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");
    if (!student.isManaged) return badRequest(res, "This student already has an account");

    const emailConflict = await findEmailConflict(req.db, email);
    if (emailConflict) return badRequest(res, emailConflict);

    const inviteToken = crypto.randomBytes(32).toString("hex");
    student.email            = email;
    student.isManaged        = false;
    student.status           = "pending";   // becomes "active" once they set a password
    student.inviteToken      = inviteToken;
    student.inviteExpires    = new Date(Date.now() + 48 * 60 * 60 * 1000);
    student.hasAcceptedTerms = false;       // the student accepts terms themselves on first login
    student.termsAcceptedAt  = null;
    student.ringEnabled      = true;
    // `active` stays true so existing bookings and teacher scheduling keep working
    try {
      await student.save();
    } catch (e) {
      if (e.code === 11000) return badRequest(res, "Email is already registered as a student");
      throw e;
    }

    const { baseUrl, needsSlug } = getCenterBaseUrl(req.center);
    const setupUrl = `${baseUrl}/student/setup?token=${inviteToken}${needsSlug ? `&center=${req.center.slug}` : ""}`;
    let emailSent = true;
    try {
      await sendStudentInviteEmail(student, setupUrl, req.center?.centerName || "");
    } catch (emailError) {
      emailSent = false;
      logger.error("Convert: failed to send invite email:", { error: emailError?.message });
    }

    const { password, inviteToken: _t, twoFactorSecret, twoFactorBackupCodes, ...safe } = student.toObject();
    res.json({
      message: emailSent
        ? `Converted. Invite email sent to ${email}.`
        : "Converted, but the invite email failed — use Resend Invite.",
      emailSent,
      student: safe,
    });
  } catch (err) {
    logger.error("Convert managed student error:", { error: err?.message });
    serverError(res, "Error converting student");
  }
});

// ─── POST resend invite email ─────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);

    if (!student) {
      return notFound(res, "Student not found");
    }

    if (student.isManaged) return badRequest(res, MANAGED_NO_LOGIN_MSG);

    if (student.status !== "pending") {
      return badRequest(res, "This student has already completed their account setup.");
    }

    // Issue a fresh token and extend the expiry by 48 hours
    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    student.inviteToken   = inviteToken;
    student.inviteExpires = inviteExpires;
    await student.save();

    const { baseUrl, needsSlug } = getCenterBaseUrl(req.center);
    const setupUrl   = `${baseUrl}/student/setup?token=${inviteToken}${needsSlug ? `&center=${req.center.slug}` : ""}`;
    const centerName = req.center?.centerName || "";

    await sendStudentInviteEmail(student, setupUrl, centerName);

    res.json({ success: true, message: `Invite email resent to ${student.email}.` });
  } catch (err) {
    logger.error("Resend invite error:", { error: err?.message });
    serverError(res, "Failed to resend invite email.");
  }
});

// ─── GET verify-invite token ──────────────────────────────────────────────────
router.get("/verify-invite/:token", strictLimiter, async (req, res) => {
  try {
    const student = await getStudent(req.db).findOne({
      inviteToken: req.params.token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!student) {
      return badRequest(res, "This invite link is invalid or has expired. Please ask your admin to resend the invitation.");
    }
    res.json({ valid: true, student: { firstName: student.firstName, lastName: student.lastName, email: student.email, classCredits: student.classCredits, age: student.age } });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error verifying invite");
  }
});

// ─── POST setup-account ───────────────────────────────────────────────────────
router.post("/setup-account", strictLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return badRequest(res, "Token and password are required");
    if (password.length < 8) return badRequest(res, "Password must be at least 8 characters");

    const Student = getStudent(req.db);
    const student = await Student.findOne({
      inviteToken: token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!student) {
      return badRequest(res, "This invite link is invalid or has expired. Please ask your admin to resend the invitation.");
    }

    student.password      = await bcrypt.hash(password, config.bcryptRounds);
    student.status        = "active";
    student.active        = true;
    student.inviteToken   = undefined;
    student.inviteExpires = undefined;

    // Assign studentId if not already set (handles students created before this feature)
    if (!student.studentId) {
      student.studentId = await assignStudentId(Student, student._id);
    }

    // Auto-generate unique referral code
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      const taken = await Student.exists({ referralCode: code });
      if (!taken) { student.referralCode = code; break; }
    }

    await student.save();

    completeReferral(student._id, req.db).catch(() => {});

    const centerName = req.center?.centerName || "";

    try { await sendStudentWelcomeEmail(student, centerName, req.center); }
    catch (e) { logger.error("Failed to send welcome email:", { error: e?.message }); }

    // Fire-and-forget: send admin the student record PDF now that account is fully activated
    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      generateStudentRecordPdf(student.toObject(), centerName)
        .then(pdf => sendNewStudentRecordEmail(adminEmail, student.toObject(), pdf, centerName))
        .catch(err => logger.error("Admin student record email failed:", { error: err?.message }));
    }

    res.json({ message: "Account activated successfully! You can now login.", student: { firstName: student.firstName, lastName: student.lastName, email: student.email } });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error setting up account");
  }
});

// ─── POST resend-invite ───────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");
    if (student.isManaged) return badRequest(res, MANAGED_NO_LOGIN_MSG);
    if (student.status !== "pending") return badRequest(res, "Student has already set up their account");

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    student.inviteToken   = inviteToken;
    student.inviteExpires = inviteExpires;
    await student.save();

    const { baseUrl, needsSlug } = getCenterBaseUrl(req.center);
    const setupUrl = `${baseUrl}/student/setup?token=${inviteToken}${needsSlug ? `&center=${req.center.slug}` : ""}`;
    await sendStudentInviteEmail(student, setupUrl, req.center?.centerName || "");

    res.json({ message: "Invite resent successfully" });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error resending invite");
  }
});

// ─── PATCH timezone ───────────────────────────────────────────────────────────
router.patch("/:id/timezone", verifyToken, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== "string")
      return badRequest(res, "timezone required");
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); }
    catch { return badRequest(res, "Invalid timezone identifier"); }
    await getStudent(req.db).findByIdAndUpdate(req.params.id, { timezone });
    res.json({ ok: true });
  } catch (err) {
    serverError(res, "Error updating timezone");
  }
});

// ─── PUT update student ───────────────────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    // isManaged is fixed at creation — never flipped through a generic update
    const { password, isManaged: _isManaged, ...updates } = req.body;

    const existing = await getStudent(req.db).findById(req.params.id).select("isManaged").lean();
    if (!existing) return notFound(res, "Student not found");
    if (existing.isManaged && (password || updates.email))
      return badRequest(res, MANAGED_NO_LOGIN_MSG);

    if (password) {
      updates.password           = await bcrypt.hash(password, config.bcryptRounds);
      updates.showTempPassword   = false;
      updates.lastPasswordChange = new Date();
    }

    const student = await getStudent(req.db).findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!student) return notFound(res, "Student not found");

    if (password) {
      try { await sendPasswordResetEmail(student.email, `${student.firstName} ${student.lastName}`, password, "student", req.center?.centerName || "", req.center); }
      catch (e) { logger.error("Failed to send password reset email:", { error: e?.message }); }
    }

    res.json({ message: "Student updated", student });
  } catch (err) {
    logger.error(err);
    badRequest(res, "Error updating student");
  }
});

// ─── PATCH toggle active ──────────────────────────────────────────────────────
router.patch("/:id/toggle", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== "boolean") return badRequest(res, "active (boolean) is required");
    const student = await getStudent(req.db)
      .findByIdAndUpdate(req.params.id, { active }, { new: true })
      .select("firstName lastName email active classCredits age lastPaymentDate status");
    if (!student) return notFound(res, "Student not found");
    res.json({ message: `Student ${active ? "enabled" : "disabled"}`, student });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error toggling student status");
  }
});

// ─── DELETE (soft-delete) ─────────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");
    if (student.scheduledDeletionAt) return badRequest(res, "Student is already scheduled for deletion");

    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    student.active                   = false;
    student.scheduledDeletionAt      = deletionDate;
    student.deletionWarningEmailSent = false;
    await student.save();

    sendAccountDeletionWarningEmail(student, deletionDate, req.center?.centerName || "").catch(e => logger.error("Deletion warning email failed:", { error: e?.message }));

    res.json({ message: "Student scheduled for deletion", scheduledDeletionAt: deletionDate, student });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error scheduling student deletion");
  }
});

// ─── POST restore ─────────────────────────────────────────────────────────────
router.post("/:id/restore", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");
    if (!student.scheduledDeletionAt) return badRequest(res, "Student is not scheduled for deletion");

    student.scheduledDeletionAt      = null;
    student.deletionWarningEmailSent = false;
    student.active                   = true;
    await student.save();

    res.json({ message: "Student account restored successfully", student });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error restoring student");
  }
});

// ─── POST reset-password ──────────────────────────────────────────────────────
router.post("/:id/reset-password", verifyToken, verifyAdminOrTeacher, strictLimiter, async (req, res) => {
  try {
    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");
    if (student.isManaged) return badRequest(res, MANAGED_NO_LOGIN_MSG);

    const newPass          = generateSecurePassword(12);
    student.password       = await bcrypt.hash(newPass, config.bcryptRounds);
    student.showTempPassword   = true;
    student.lastPasswordChange = new Date();
    await student.save();

    try { await sendPasswordResetEmail(student.email, `${student.firstName} ${student.lastName}`, newPass, "student", req.center?.centerName || "", req.center); }
    catch (e) { logger.error("Failed to send password reset email:", { error: e?.message }); }

    res.json({ message: "Password reset successfully", tempPassword: newPass });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error resetting password");
  }
});

// ─── POST record payment ──────────────────────────────────────────────────────
router.post("/:id/payment", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { amount, classes, method = "Manual", status = "completed" } = req.body;
    if (!amount || !classes) return badRequest(res, "Amount and number of classes are required");

    const Student = getStudent(req.db);
    const student = await Student.findById(req.params.id);
    if (!student) return notFound(res, "Student not found");

    student.lastPaymentDate = new Date();
    student.active          = true;
    student.classCredits     = (student.classCredits || 0) + (parseInt(classes, 10) || 0);
    await student.save();

    const payment = await getPayment(req.db).create({
      studentId: student._id, amount, classes, method, status, date: new Date(),
    });

    res.json({ message: "Payment recorded", student, payment });
  } catch (err) {
    logger.error("Payment error:", { error: err?.message });
    serverError(res, "Error recording payment");
  }
});

// ─── GET payments for a student ───────────────────────────────────────────────
router.get("/:id/payments", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.id !== req.params.id)
      return forbidden(res, "You can only view your own payments");
    const payments = await getPayment(req.db).find({ studentId: req.params.id }).sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    logger.error(err);
    serverError(res, "Error fetching payments");
  }
});

export default router;
