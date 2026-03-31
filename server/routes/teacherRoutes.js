// server/routes/teacherRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  sendPasswordResetEmail,
  sendTeacherInviteEmail,
  sendTeacherWelcomeEmail,
  sendTeacherAccountDeletionWarningEmail,
  sendNewTeacherRecordEmail,
} from "../utils/emailService.js";
import { generateTeacherRecordPdf } from "../utils/recordPdfGenerator.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Multer config for teacher photos ─────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/teachers");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `photo-${req.params.id}-${Date.now()}${ext}`);
  },
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only JPG, PNG, or WebP images are allowed"));
  },
});

const router = express.Router();
router.use(tenantMiddleware);

const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);

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

// ─── POST upload photo ────────────────────────────────────────────────────────
router.post("/:id/photo", verifyToken, requireOwnerOrAdmin, (req, res, next) => {
  photoUpload.single("photo")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    // Delete old photo file if it exists
    if (teacher.photo) {
      const old = path.join(__dirname, "..", teacher.photo.replace(/^\//, ""));
      fs.unlink(old, () => {});
    }

    const photoUrl = `/uploads/teachers/${req.file.filename}`;
    teacher.photo = photoUrl;
    await teacher.save();
    res.json({ message: "Photo uploaded", photo: photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error uploading photo" });
  }
});

// ─── DELETE photo ─────────────────────────────────────────────────────────────
router.delete("/:id/photo", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.photo) {
      const filePath = path.join(__dirname, "..", teacher.photo.replace(/^\//, ""));
      fs.unlink(filePath, () => {});
      teacher.photo = "";
      await teacher.save();
    }
    res.json({ message: "Photo removed" });
  } catch (err) {
    res.status(500).json({ message: "Error removing photo" });
  }
});

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
    const {
      firstName, lastName, email, ratePerClass, continent,
      phone, country, timezone, googleMeetLink, bio,
      yearsOfExperience, specializations, certifications,
    } = req.body;

    if (!firstName || !lastName || !email || !continent)
      return res.status(400).json({ message: "First name, last name, email and continent are required" });
    if (!["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return res.status(400).json({ message: "Invalid continent" });

    const Teacher  = getTeacher(req.db);
    const Student  = getStudent(req.db);
    const SubAdmin = getSubAdmin(req.db);
    const normalizedEmail = email.trim().toLowerCase();

    const [asTeacher, asStudent, asSubAdmin] = await Promise.all([
      Teacher.findOne({ email: normalizedEmail }).lean(),
      Student.findOne({ email: normalizedEmail }).lean(),
      SubAdmin.findOne({ email: normalizedEmail }).lean(),
    ]);
    if (asTeacher)  return res.status(400).json({ message: "Email is already registered as a teacher" });
    if (asStudent)  return res.status(400).json({ message: "Email is already registered as a student" });
    if (asSubAdmin) return res.status(400).json({ message: "Email is already registered as a sub-admin" });

    // ── Check teacher seat limit (-1 = unlimited) ─────────────────────────
    const maxTeachers = req.center?.maxTeachers;
    if (maxTeachers && maxTeachers !== -1) {
      const currentCount = await Teacher.countDocuments();
      if (currentCount >= maxTeachers)
        return res.status(403).json({ message: `Teacher limit reached (${currentCount}/${maxTeachers}). Contact your super admin to increase the limit.` });
    }

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const teacher = await Teacher.create({
      firstName, lastName, email: normalizedEmail,
      ratePerClass: ratePerClass || 0,
      continent, status: "pending", active: false,
      inviteToken, inviteExpires,
      phone: phone || "", country: country || "",
      timezone: timezone || "", googleMeetLink: googleMeetLink || "",
      bio: bio || "", yearsOfExperience: yearsOfExperience || 0,
      specializations: specializations || [], certifications: certifications || [],
    });

    const setupUrl   = `${config.frontendUrl}/teacher/setup?token=${inviteToken}&center=${req.center.slug}`;
    const centerName = req.center?.centerName || "";

    try {
      await sendTeacherInviteEmail(teacher, setupUrl, centerName);
    } catch (e) {
      console.error("Failed to send teacher invite email:", e.message);
    }

    // Fire-and-forget: send admin a record PDF
    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      generateTeacherRecordPdf(teacher.toObject(), centerName)
        .then(pdf => sendNewTeacherRecordEmail(adminEmail, teacher.toObject(), pdf, centerName))
        .catch(err => console.error("Admin teacher record email failed:", err.message));
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

    try { await sendTeacherWelcomeEmail(teacher, req.center?.centerName || ""); } catch (e) { console.error("Welcome email failed:", e.message); }

    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      const centerName = req.center?.centerName || "";
      generateTeacherRecordPdf(teacher.toObject(), centerName)
        .then((pdf) => sendNewTeacherRecordEmail(adminEmail, teacher.toObject(), pdf, centerName))
        .catch((err) => console.error("Admin teacher record email failed:", err.message));
    }

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

    const setupUrl = `${config.frontendUrl}/teacher/setup?token=${teacher.inviteToken}&center=${req.center.slug}`;
    await sendTeacherInviteEmail(teacher, setupUrl, req.center?.centerName || "");

    res.json({ success: true, message: "Invite resent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to resend invite" });
  }
});

// ─── PATCH self-update (teacher or admin) ─────────────────────────────────────
// Only safe fields — firstName/lastName/country/continent are admin-only (PUT below)
router.patch("/:id/profile", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const ALLOWED = ["displayName", "phone", "bio", "timezone", "googleMeetLink",
                     "yearsOfExperience", "specializations", "certifications",
                     "bankName", "accountNumber", "accountName"];
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const teacher = await getTeacher(req.db)
      .findByIdAndUpdate(req.params.id, updates, { new: true })
      .select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: "Error updating profile" });
  }
});

// ─── PUT update teacher (admin only) ──────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { continent, password, ...otherUpdates } = req.body;
    if (continent && !["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return res.status(400).json({ message: "Invalid continent" });

    let updateData = { ...otherUpdates, continent };
    if (password) {
      updateData.password           = await bcrypt.hash(password, config.bcryptRounds);
      updateData.lastPasswordChange = new Date();
      // Activate pending teachers so they can log in with the new password immediately
      updateData.status = "active";
      updateData.active = true;
    }

    const teacher = await getTeacher(req.db)
      .findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
      .select("-password -inviteToken");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    if (password) {
      try { await sendPasswordResetEmail(teacher.email, `${teacher.firstName} ${teacher.lastName}`, password, "teacher", req.center?.centerName || ""); }
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

    sendTeacherAccountDeletionWarningEmail(teacher, deletionDate, req.center?.centerName || "").catch(e =>
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
