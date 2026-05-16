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
  getCenterBaseUrl,
} from "../utils/emailService.js";
import { generateTeacherRecordPdf } from "../utils/recordPdfGenerator.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { strictLimiter } from "../middleware/rateLimiter.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { parsePagination } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { cachedQuery, invalidateCache } from '../utils/cache.js';

const teacherCacheKey = (slug, id) => `teacher:${slug}:${id}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Multer config for teacher photos ─────────────────────────────────────────
// Both MIME type and extension must match — extension alone is trivially spoofed.
// SVG excluded: it can carry embedded scripts.
const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_PHOTO_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.webp']);

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
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_PHOTO_EXTS.has(ext) && ALLOWED_PHOTO_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WebP images are allowed"));
    }
  },
});

const router = express.Router();
router.use(tenantMiddleware);

const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);

// GET /teachers/for-booking — student-accessible list of active teachers whose
// schedule is visible to students. Returns only the fields needed for the
// booking calendar (no pay rates, earnings, or private info).
router.get("/for-booking", verifyToken, async (req, res) => {
  try {
    if (!["student", "admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const teachers = await getTeacher(req.db)
      .find({ active: true, showScheduleToStudents: { $ne: false } })
      .select("firstName lastName photo bio continent specializations showScheduleToStudents")
      .sort({ firstName: 1 })
      .lean();
    res.json({ teachers });
  } catch (err) {
    logger.error("for-booking teachers error:", { error: err?.message });
    serverError(res, "Server error");
  }
});

// ─── GET single teacher ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const cacheKey = teacherCacheKey(req.center?.slug, req.params.id);
    const teacher = await cachedQuery(cacheKey, 60, () =>
      getTeacher(req.db)
        .findById(req.params.id)
        .select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes -sessions")
        .lean()
    );
    if (!teacher) return notFound(res, "Teacher not found");
    res.json(teacher);
  } catch (err) {
    serverError(res, "Error fetching teacher data");
  }
});

// ─── GET all teachers ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const teachers = await getTeacher(req.db)
      .find()
      .select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes -sessions")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(teachers);
  } catch (err) {
    serverError(res, err.message);
  }
});

// Ownership guard
const requireOwnerOrAdmin = (req, res, next) => {
  if (req.user?.role === "admin") return next();
  if (req.user?.role === "teacher" && String(req.user.id) === String(req.params.id)) return next();
  return forbidden(res, "You can only update your own profile");
};

// ─── POST upload photo ────────────────────────────────────────────────────────
router.post("/:id/photo", verifyToken, requireOwnerOrAdmin, (req, res, next) => {
  photoUpload.single("photo")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No file uploaded");
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return notFound(res, "Teacher not found");

    // Delete old photo file if it exists.
    // path.basename() prevents path traversal: only the filename is used,
    // not any directory components that may have been stored.
    if (teacher.photo) {
      const old = path.join(__dirname, "../uploads/teachers", path.basename(teacher.photo));
      fs.unlink(old, () => {});
    }

    const photoUrl = `/uploads/teachers/${req.file.filename}`;
    teacher.photo = photoUrl;
    await teacher.save();
    await invalidateCache(teacherCacheKey(req.center?.slug, req.params.id));
    res.json({ message: "Photo uploaded", photo: photoUrl });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error uploading photo");
  }
});

// ─── DELETE photo ─────────────────────────────────────────────────────────────
router.delete("/:id/photo", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return notFound(res, "Teacher not found");
    if (teacher.photo) {
      const filePath = path.join(__dirname, "../uploads/teachers", path.basename(teacher.photo));
      fs.unlink(filePath, () => {});
      teacher.photo = "";
      await teacher.save();
      await invalidateCache(teacherCacheKey(req.center?.slug, req.params.id));
    }
    res.json({ message: "Photo removed" });
  } catch (err) {
    serverError(res, "Error removing photo");
  }
});

// ─── PATCH schedule-visibility ────────────────────────────────────────────────
router.patch("/:id/schedule-visibility", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { showScheduleToStudents } = req.body;
    if (typeof showScheduleToStudents !== "boolean")
      return badRequest(res, "showScheduleToStudents must be boolean");
    const teacher = await getTeacher(req.db).findByIdAndUpdate(
      req.params.id,
      { showScheduleToStudents },
      { new: true, select: "showScheduleToStudents" }
    );
    if (!teacher) return notFound(res, "Teacher not found");
    res.json({ showScheduleToStudents: teacher.showScheduleToStudents });
  } catch (err) {
    serverError(res, "Error updating schedule visibility");
  }
});

// ─── PATCH timezone ───────────────────────────────────────────────────────────
router.patch("/:id/timezone", verifyToken, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== "string")
      return badRequest(res, "timezone required");
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }); }
    catch { return badRequest(res, "Invalid timezone identifier"); }
    await getTeacher(req.db).findByIdAndUpdate(req.params.id, { timezone });
    res.json({ ok: true });
  } catch (err) {
    serverError(res, "Error updating timezone");
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
    if (!teacher) return notFound(res, "Teacher not found");
    res.json({ message: "Google Meet link updated", googleMeetLink: teacher.googleMeetLink });
  } catch (err) {
    logger.error("Error updating Google Meet link:", { error: err?.message });
    serverError(res, "Error updating Google Meet link");
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
      return badRequest(res, "First name, last name, email and continent are required");
    if (!["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return badRequest(res, "Invalid continent");

    const Teacher  = getTeacher(req.db);
    const Student  = getStudent(req.db);
    const SubAdmin = getSubAdmin(req.db);
    const normalizedEmail = email.trim().toLowerCase();

    const [asTeacher, asStudent, asSubAdmin] = await Promise.all([
      Teacher.findOne({ email: normalizedEmail }).lean(),
      Student.findOne({ email: normalizedEmail }).lean(),
      SubAdmin.findOne({ email: normalizedEmail }).lean(),
    ]);
    if (asTeacher)  return badRequest(res, "Email is already registered as a teacher");
    if (asStudent)  return badRequest(res, "Email is already registered as a student");
    if (asSubAdmin) return badRequest(res, "Email is already registered as a sub-admin");

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

    const { baseUrl: _tb1, needsSlug: _tn1 } = getCenterBaseUrl(req.center);
    const setupUrl   = `${_tb1}/teacher/setup?token=${inviteToken}${_tn1 ? `&center=${req.center.slug}` : ""}`;
    const centerName = req.center?.centerName || "";

    try {
      await sendTeacherInviteEmail(teacher, setupUrl, centerName);
    } catch (e) {
      logger.error("Failed to send teacher invite email:", { error: e?.message });
    }

    // Fire-and-forget: send admin a record PDF
    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      generateTeacherRecordPdf(teacher.toObject(), centerName)
        .then(pdf => sendNewTeacherRecordEmail(adminEmail, teacher.toObject(), pdf, centerName))
        .catch(err => logger.error("Admin teacher record email failed:", { error: err?.message }));
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
    logger.error("Create teacher error:", { error: err?.message });
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
      return badRequest(res, "Invalid or expired invite link. Please contact your administrator.");
    }
    res.json({ success: true, teacher: { firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email, continent: teacher.continent } });
  } catch (err) {
    serverError(res);
  }
});

// ─── POST setup-account ───────────────────────────────────────────────────────
router.post("/setup-account", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;
    if (!token || !password || !confirmPassword)
      return badRequest(res, "All fields are required");
    if (password !== confirmPassword)
      return badRequest(res, "Passwords do not match");
    if (password.length < 8)
      return badRequest(res, "Password must be at least 8 characters");

    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findOne({
      inviteToken: token, inviteExpires: { $gt: new Date() }, status: "pending",
    });
    if (!teacher) {
      return badRequest(res, "Invalid or expired invite link. Please contact your administrator.");
    }

    teacher.password           = await bcrypt.hash(password, config.bcryptRounds);
    teacher.status             = "active";
    teacher.active             = true;
    teacher.inviteToken        = undefined;
    teacher.inviteExpires      = undefined;
    teacher.lastPasswordChange = new Date();
    await teacher.save();

    try { await sendTeacherWelcomeEmail(teacher, req.center?.centerName || "", req.center); } catch (e) { logger.error("Welcome email failed:", { error: e?.message }); }

    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      const centerName = req.center?.centerName || "";
      generateTeacherRecordPdf(teacher.toObject(), centerName)
        .then((pdf) => sendNewTeacherRecordEmail(adminEmail, teacher.toObject(), pdf, centerName))
        .catch((err) => logger.error("Admin teacher record email failed:", { error: err?.message }));
    }

    res.json({ success: true, message: "Account activated successfully! You can now log in." });
  } catch (err) {
    logger.error("Setup account error:", { error: err?.message });
    serverError(res);
  }
});

// ─── POST resend-invite ───────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return notFound(res, "Teacher not found");
    if (teacher.status !== "pending")
      return badRequest(res, "Teacher account is already active");

    teacher.inviteToken   = crypto.randomBytes(32).toString("hex");
    teacher.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await teacher.save();

    const { baseUrl: _tb2, needsSlug: _tn2 } = getCenterBaseUrl(req.center);
    const setupUrl = `${_tb2}/teacher/setup?token=${teacher.inviteToken}${_tn2 ? `&center=${req.center.slug}` : ""}`;
    await sendTeacherInviteEmail(teacher, setupUrl, req.center?.centerName || "");

    res.json({ success: true, message: "Invite resent successfully" });
  } catch (err) {
    serverError(res, "Failed to resend invite");
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
    if (!teacher) return notFound(res, "Teacher not found");
    await invalidateCache(teacherCacheKey(req.center?.slug, req.params.id));
    res.json(teacher);
  } catch (err) {
    serverError(res, "Error updating profile");
  }
});

// ─── PUT update teacher (admin only) ──────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { continent, password, ...otherUpdates } = req.body;
    if (continent && !["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent))
      return badRequest(res, "Invalid continent");

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
      .select("-password -inviteToken -sessions");
    if (!teacher) return notFound(res, "Teacher not found");

    await invalidateCache(teacherCacheKey(req.center?.slug, req.params.id));
    if (password) {
      try { await sendPasswordResetEmail(teacher.email, `${teacher.firstName} ${teacher.lastName}`, password, "teacher", req.center?.centerName || "", req.center); }
      catch (e) { logger.error("Password reset email failed:", { error: e?.message }); }
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
    if (!teacher) return notFound(res, "Teacher not found");
    if (teacher.scheduledDeletionAt)
      return badRequest(res, "Teacher is already scheduled for deletion");

    const deletionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    teacher.active                   = false;
    teacher.scheduledDeletionAt      = deletionDate;
    teacher.deletionWarningEmailSent = false;
    await teacher.save();

    sendTeacherAccountDeletionWarningEmail(teacher, deletionDate, req.center?.centerName || "").catch(e =>
      logger.error("Teacher deletion warning email failed:", { error: e?.message })
    );

    await invalidateCache(teacherCacheKey(req.center?.slug, req.params.id));
    res.json({ message: "Teacher scheduled for deletion", scheduledDeletionAt: deletionDate, teacher });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─── POST restore ─────────────────────────────────────────────────────────────
router.post("/:id/restore", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return notFound(res, "Teacher not found");
    if (!teacher.scheduledDeletionAt)
      return badRequest(res, "Teacher is not scheduled for deletion");

    teacher.scheduledDeletionAt      = null;
    teacher.deletionWarningEmailSent = false;
    teacher.active                   = true;
    await teacher.save();

    res.json({ message: "Teacher account restored successfully", teacher });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
