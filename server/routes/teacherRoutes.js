// server/routes/teacherRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  sendPasswordResetEmail,
  sendTeacherInviteEmail,
  sendTeacherWelcomeEmail,
  sendTeacherAccountDeletionWarningEmail,
} from "../utils/emailService.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { teacherSchema } from "../schemas/teacherSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

// ─── GET single teacher ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const teacher = await getTeacher(req.db)
      .findById(req.params.id)
      .select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes")
      .lean();
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: "Error fetching teacher data" });
  }
});

// ─── GET all teachers ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const teachers = await getTeacher(req.db)
      .find()
      .select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes")
      .lean();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Ownership guard
const requireOwnerOrAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  if (req.user?.role === "teacher" && String(req.user.id) === String(req.params.id)) return next();
  return res.status(403).json({ message: "You can only update your own profile" });
};

// ─── PATCH schedule-visibility ────────────────────────────────────────────────
router.patch("/:id/schedule-visibility", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { showScheduleToStudents } = req.body;
    if (typeof showScheduleToStudents !== "boolean")
      return res.status(400).json({ message: "showScheduleToStudents must be boolean" });
    const teacher = await getTeacher(req.db).findByIdAndUpdate(
      req.params.id,
      { showScheduleToStudents },
      { new: true, select: "showScheduleToStudents" }
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ showScheduleToStudents: teacher.showScheduleToStudents });
  } catch (err) {
    res.status(500).json({ message: "Error updating schedule visibility" });
  }
});

// ─── PATCH timezone ───────────────────────────────────────────────────────────
router.patch("/:id/timezone", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== "string")
      return res.status(400).json({ message: "timezone required" });
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); }
    catch { return res.status(400).json({ message: "Invalid timezone identifier" }); }
    await getTeacher(req.db).findByIdAndUpdate(req.params.id, { timezone });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Error updating timezone" });
  }
});

// ─── PATCH google-meet ────────────────────────────────────────────────────────
router.patch("/:id/google-meet", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { googleMeetLink } = req.body;
    const teacher = await getTeacher(req.db).findByIdAndUpdate(
      req.params.id,
      { googleMeetLink: googleMeetLink || "" },
      { new: true, select: "firstName lastName googleMeetLink" }
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Google Meet link updated", googleMeetLink: teacher.googleMeetLink });
  } catch (err) {
    console.error("Error updating Google Meet link:", err);
    res.status(500).json({ message: "Error updating Google Meet link" });
  }
});

// ─── POST create teacher (invite flow) ───────────────────────────────────────
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, ratePerClass, continent } = req.body;

    if (!firstName || !lastName || !email || !continent)
      return res.status(400).json({ message: "First name, last name, email and continent are required" });
    if (!["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return res.status(400).json({ message: "Invalid continent" });

    const Teacher = getTeacher(req.db);
    const exists = await Teacher.findOne({ email });
    if (exists) return res.status(400).json({ message: "A teacher with this email already exists" });

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const teacher = await Teacher.create({
      firstName, lastName, email,
      ratePerClass: ratePerClass || 0,
      continent, status: "pending", active: false,
      inviteToken, inviteExpires,
    });

    const setupUrl = `${config.frontendUrl}/teacher/setup?token=${inviteToken}`;
    try {
      await sendTeacherInviteEmail(teacher, setupUrl);
    } catch (e) {
      console.error("Failed to send teacher invite email:", e.message);
    }

    const response = teacher.toObject();
    delete response.password;
    delete response.inviteToken;

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}. Teacher will set their own password.`,
      teacher: response,
    });
  } catch (err) {
    console.error("Create teacher error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ─── GET verify-invite token ──────────────────────────────────────────────────
router.get("/verify-invite/:token", async (req, res) => {
  try {
    const teacher = await getTeacher(req.db).findOne({
      inviteToken:   req.params.token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });
    if (!teacher) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite link. Please contact your administrator." });
    }
    res.json({ success: true, teacher: { firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, continent: teacher.continent } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST setup-account ───────────────────────────────────────────────────────
router.post("/setup-account", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword)
      return res.status(400).json({ message: "All fields are required" });
    if (password !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });
    if (password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters" });

    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findOne({
      inviteToken: token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!teacher) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite link. Please contact your administrator." });
    }

    teacher.password           = await bcrypt.hash(password, config.bcryptRounds);
    teacher.status             = "active";
    teacher.active             = true;
    teacher.inviteToken        = undefined;
    teacher.inviteExpires      = undefined;
    teacher.lastPasswordChange = new Date();
    await teacher.save();

    try { await sendTeacherWelcomeEmail(teacher); } catch (e) { console.error("Welcome email failed:", e.message); }

    res.json({ success: true, message: "Account activated successfully! You can now log in." });
  } catch (err) {
    console.error("Setup account error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST resend-invite ───────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.status !== "pending")
      return res.status(400).json({ message: "Teacher account is already active" });

    teacher.inviteToken   = crypto.randomBytes(32).toString("hex");
    teacher.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await teacher.save();

    const setupUrl = `${config.frontendUrl}/teacher/setup?token=${teacher.inviteToken}`;
    await sendTeacherInviteEmail(teacher, setupUrl);

    res.json({ success: true, message: "Invite resent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to resend invite" });
  }
});

// ─── PUT update teacher ───────────────────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { continent, password, ...otherUpdates } = req.body;
    if (continent && !["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return res.status(400).json({ message: "Invalid continent" });

    let updateData = { ...otherUpdates, continent };
    if (password) {
      updateData.password           = await bcrypt.hash(password, config.bcryptRounds);
      updateData.lastPasswordChange = new Date();
    }

    const teacher = await getTeacher(req.db)
      .findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .select("-password -inviteToken");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    if (password) {
      try { await sendPasswordResetEmail(teacher.email, `${teacher.firstName} ${teacher.lastName}`, password); }
      catch (e) { console.error("Password reset email failed:", e.message); }
      const resp = teacher.toObject();
      resp.temporaryPassword = password;
      return res.json(resp);
    }
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─── DELETE (soft-delete) ─────────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.scheduledDeletionAt)
      return res.status(400).json({ message: "Teacher is already scheduled for deletion" });

    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    teacher.active                   = false;
    teacher.scheduledDeletionAt      = deletionDate;
    teacher.deletionWarningEmailSent = false;
    await teacher.save();

    sendTeacherAccountDeletionWarningEmail(teacher, deletionDate).catch(e =>
      console.error("Teacher deletion warning email failed:", e.message)
    );

    res.json({ message: "Teacher scheduled for deletion", scheduledDeletionAt: deletionDate, teacher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── POST restore ─────────────────────────────────────────────────────────────
router.post("/:id/restore", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (!teacher.scheduledDeletionAt)
      return res.status(400).json({ message: "Teacher is not scheduled for deletion" });

    teacher.scheduledDeletionAt      = null;
    teacher.deletionWarningEmailSent = false;
    teacher.active                   = true;
    await teacher.save();

    res.json({ message: "Teacher account restored successfully", teacher });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
