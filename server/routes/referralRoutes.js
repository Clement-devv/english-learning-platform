// server/routes/referralRoutes.js

import express          from "express";
import crypto           from "crypto";
import {
  verifyToken,
  verifyStudent,
  verifyAdmin,
} from "../middleware/authMiddleware.js";
import { sendStudentInviteEmail } from "../utils/emailService.js";
import { config }       from "../config/config.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { referralSchema } from "../schemas/referralSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getReferral = (db) => db.models.Referral || db.model("Referral", referralSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);

// ── helpers ───────────────────────────────────────────────────────────────────
async function makeUniqueCode(db) {
  const Student = getStudent(db);
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    const exists = await Student.exists({ referralCode: code });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique referral code");
}

// ── GET /api/referrals/my  —  student: their code + stats ────────────────────
router.get("/my", verifyToken, verifyStudent, async (req, res) => {
  try {
    const Student  = getStudent(req.db);
    const Referral = getReferral(req.db);

    let student = await Student.findById(req.user.id)
      .select("referralCode referralCreditsEarned firstName");
    if (!student) return res.status(404).json({ error: "Student not found" });

    if (!student.referralCode) {
      student.referralCode = await makeUniqueCode(req.db);
      await student.save();
    }

    const referrals = await Referral.find({ referrerId: req.user.id })
      .sort({ createdAt: -1 })
      .select("referredFirstName referredLastName referredEmail status creditAwarded createdAt");

    const stats = {
      total:   referrals.length,
      active:  referrals.filter(r => r.status === "active").length,
      pending: referrals.filter(r => r.status === "pending").length,
      invited: referrals.filter(r => r.status === "invited").length,
      credits: student.referralCreditsEarned,
    };

    res.json({
      code:    student.referralCode,
      joinUrl: `${config.frontendUrl}/join?ref=${student.referralCode}`,
      stats,
      referrals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/referrals/apply  —  PUBLIC: new person applies via referral link ─
router.post("/apply", async (req, res) => {
  try {
    const { firstName, lastName, email, referralCode } = req.body;
    if (!firstName || !lastName || !email || !referralCode)
      return res.status(400).json({ error: "All fields are required" });

    const Student  = getStudent(req.db);
    const Referral = getReferral(req.db);

    const referrer = await Student.findOne({ referralCode: referralCode.trim().toUpperCase() });
    if (!referrer) return res.status(404).json({ error: "Invalid referral code" });

    const normalizedRefEmail = email.toLowerCase().trim();
    const [existingStudent, existingTeacher, existingSubAdmin] = await Promise.all([
      Student.findOne({ email: normalizedRefEmail }).lean(),
      getTeacher(req.db).findOne({ email: normalizedRefEmail }).lean(),
      getSubAdmin(req.db).findOne({ email: normalizedRefEmail }).lean(),
    ]);
    if (existingStudent)  return res.status(409).json({ error: "An account with this email already exists as a student" });
    if (existingTeacher)  return res.status(409).json({ error: "An account with this email already exists as a teacher" });
    if (existingSubAdmin) return res.status(409).json({ error: "An account with this email already exists as a sub-admin" });

    const existingRef = await Referral.findOne({ referredEmail: email.toLowerCase().trim() });
    if (existingRef)
      return res.status(409).json({ error: "An application for this email already exists" });

    const referral = await Referral.create({
      referrerId:        referrer._id,
      referrerCode:      referralCode.trim().toUpperCase(),
      referredFirstName: firstName.trim(),
      referredLastName:  lastName.trim(),
      referredEmail:     email.toLowerCase().trim(),
    });

    res.status(201).json({ ok: true, referralId: referral._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/referrals  —  admin: all referral applications ──────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Referral = getReferral(req.db);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const referrals = await Referral.find(filter)
      .sort({ createdAt: -1 })
      .populate("referrerId", "firstName surname email referralCode")
      .populate("referredStudentId", "firstName surname email status");

    res.json(referrals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/referrals/:id/approve  —  admin approves → creates student + credits referrer ──
router.post("/:id/approve", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Student  = getStudent(req.db);
    const Referral = getReferral(req.db);

    const referral = await Referral.findById(req.params.id).populate("referrerId");
    if (!referral) return res.status(404).json({ error: "Referral not found" });
    if (referral.status !== "pending")
      return res.status(400).json({ error: `Referral is already ${referral.status}` });

    const [emailAsStudent, emailAsTeacher, emailAsSubAdmin] = await Promise.all([
      Student.findOne({ email: referral.referredEmail }).lean(),
      getTeacher(req.db).findOne({ email: referral.referredEmail }).lean(),
      getSubAdmin(req.db).findOne({ email: referral.referredEmail }).lean(),
    ]);
    if (emailAsStudent)  return res.status(409).json({ error: "Email already registered as a student" });
    if (emailAsTeacher)  return res.status(409).json({ error: "Email already registered as a teacher" });
    if (emailAsSubAdmin) return res.status(409).json({ error: "Email already registered as a sub-admin" });

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const newStudent = await Student.create({
      firstName:  referral.referredFirstName,
      surname:    referral.referredLastName,
      email:      referral.referredEmail,
      status:     "pending",
      active:     false,
      inviteToken,
      inviteExpires,
      referredBy: referral.referrerId._id,
    });

    const setupUrl = `${config.frontendUrl}/student/setup?token=${inviteToken}&center=${req.center.slug}`;
    try { await sendStudentInviteEmail(newStudent, setupUrl, req.center?.centerName || ""); }
    catch (emailErr) { console.error("Referral invite email failed:", emailErr.message); }

    referral.status            = "invited";
    referral.referredStudentId = newStudent._id;
    await referral.save();

    res.json({ ok: true, studentId: newStudent._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/referrals/:id/reject  —  admin rejects ─────────────────────────
router.post("/:id/reject", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Referral = getReferral(req.db);
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    if (!referral) return res.status(404).json({ error: "Referral not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── called internally when student activates account ─────────────────────────
// Accepts db so it can query the correct per-center connection.
export async function completeReferral(studentId, db) {
  try {
    const Student  = getStudent(db);
    const Referral = getReferral(db);

    const student = await Student.findById(studentId);
    if (!student?.referredBy) return;

    const referral = await Referral.findOne({
      referredStudentId: studentId,
      status: "invited",
      creditAwarded: false,
    });
    if (!referral) return;

    await Student.findByIdAndUpdate(referral.referrerId, {
      $inc: { noOfClasses: 1, referralCreditsEarned: 1 },
    });

    referral.status        = "active";
    referral.creditAwarded = true;
    referral.creditedAt    = new Date();
    await referral.save();

    console.log(`Referral credit: +1 class awarded to student ${referral.referrerId}`);
  } catch (err) {
    console.error("completeReferral error:", err.message);
  }
}

export default router;
