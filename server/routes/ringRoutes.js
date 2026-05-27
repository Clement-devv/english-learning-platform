// server/routes/ringRoutes.js
// REST endpoints for the ring / attention-call feature.
// Real-time ringing is handled via Socket.IO events in socketServer.js.

import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { ringLogSchema } from "../schemas/ringLogSchema.js";
import logger from "../utils/logger.js";
import { ok, badRequest, notFound, serverError } from "../utils/apiResponse.js";
import { s3Enabled, uploadToS3, deleteFromS3, s3PublicUrl } from "../utils/s3.js";

// ── Multer — hold audio in memory, validate MIME type, cap at 10 MB ──────────
const AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/ogg",
  "audio/aac", "audio/mp4", "audio/x-m4a", "audio/flac", "audio/webm",
  "audio/x-wav", "audio/x-flac",
]);

const ringtoneUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (AUDIO_TYPES.has(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error("Unsupported audio format"), { code: "INVALID_TYPE" }));
  },
});

const router = express.Router();
router.use(tenantMiddleware);

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getAdmin   = (db) => db.models.Admin   || db.model("Admin",   adminSchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getRingLog = (db) => db.models.RingLog || db.model("RingLog", ringLogSchema);

// Resolve the model + document for the current user by their role.
async function getCurrentUserDoc(req) {
  const role = req.user.role;
  const uid  = req.user.id || req.user._id;
  if (role === "student") {
    return { Model: getStudent(req.db), doc: await getStudent(req.db).findById(uid) };
  }
  if (role === "teacher") {
    return { Model: getTeacher(req.db), doc: await getTeacher(req.db).findById(uid) };
  }
  if (role === "admin" || role === "subAdmin") {
    return { Model: getAdmin(req.db), doc: await getAdmin(req.db).findById(uid) };
  }
  return { Model: null, doc: null };
}

// Resolve the document for another user by role + id.
async function getUserDoc(db, role, userId) {
  if (role === "student") return getStudent(db).findById(userId).select("firstName lastName ringEnabled").lean();
  if (role === "teacher") return getTeacher(db).findById(userId).select("firstName lastName ringEnabled").lean();
  if (role === "admin" || role === "subAdmin") return getAdmin(db).findById(userId).select("firstName lastName ringEnabled").lean();
  return null;
}

// ── GET /ring/preference ─────────────────────────────────────────────────────
// Returns the calling user's current ring preference.
router.get("/preference", verifyToken, async (req, res) => {
  try {
    const { doc } = await getCurrentUserDoc(req);
    if (!doc) return notFound(res, "User not found");
    ok(res, { ringEnabled: doc.ringEnabled ?? true });
  } catch (err) {
    logger.error("ring/preference GET error:", { error: err?.message });
    serverError(res, "Failed to fetch ring preference");
  }
});

// ── PUT /ring/preference ─────────────────────────────────────────────────────
// Toggle or set the ring preference for the calling user.
// Body: { ringEnabled: boolean }
router.put("/preference", verifyToken, async (req, res) => {
  try {
    const { ringEnabled } = req.body;
    if (typeof ringEnabled !== "boolean") {
      return badRequest(res, "ringEnabled must be a boolean");
    }

    const { doc } = await getCurrentUserDoc(req);
    if (!doc) return notFound(res, "User not found");

    doc.ringEnabled = ringEnabled;
    await doc.save();

    logger.info(`🔔 Ring preference updated: user=${req.user._id} role=${req.user.role} ringEnabled=${ringEnabled}`);
    ok(res, { ringEnabled });
  } catch (err) {
    logger.error("ring/preference PUT error:", { error: err?.message });
    serverError(res, "Failed to update ring preference");
  }
});

// ── GET /ring/user/:userId?role=teacher|student|admin ───────────────────────
// Check whether a target user has ringing enabled and get their display name.
// Used by the caller before initiating a ring so the UI can show a disabled state.
router.get("/user/:userId", verifyToken, validateObjectId("userId"), async (req, res) => {
  try {
    const { role } = req.query;
    if (!["student", "teacher", "admin", "subAdmin"].includes(role)) {
      return badRequest(res, "role query param must be student, teacher, admin, or subAdmin");
    }

    const target = await getUserDoc(req.db, role, req.params.userId);
    if (!target) return notFound(res, "User not found");

    ok(res, {
      userId: target._id,
      name: `${target.firstName} ${target.lastName}`.trim(),
      ringEnabled: target.ringEnabled ?? true,
    });
  } catch (err) {
    logger.error("ring/user GET error:", { error: err?.message });
    serverError(res, "Failed to fetch user ring status");
  }
});

// ── GET /ring/admin ──────────────────────────────────────────────────────────
// Returns the center's admin ID + name so teachers/students can ring them
// without storing adminId on every DM document.
router.get("/admin", verifyToken, async (req, res) => {
  try {
    const admin = await getAdmin(req.db).findOne().select("firstName lastName ringEnabled").lean();
    if (!admin) return notFound(res, "No admin found for this center");
    ok(res, {
      userId: admin._id,
      name: `${admin.firstName} ${admin.lastName}`.trim(),
      ringEnabled: admin.ringEnabled ?? true,
      role: "admin",
    });
  } catch (err) {
    logger.error("ring/admin GET error:", { error: err?.message });
    serverError(res, "Failed to fetch admin info");
  }
});

// ── GET /ring/missed-calls ───────────────────────────────────────────────────
// Returns the last 50 missed/declined calls where the current user was the target.
// Also returns calls placed by this user that went unanswered (outcome=missed/declined).
router.get("/missed-calls", verifyToken, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id || req.user._id);
    const Log = getRingLog(req.db);

    const [incoming, outgoing] = await Promise.all([
      // Calls I received but didn't answer
      Log.find({ targetId: uid, outcome: { $in: ["missed", "declined"] } })
        .sort({ createdAt: -1 }).limit(50).lean(),
      // Calls I made that were missed or declined
      Log.find({ callerId: uid, outcome: { $in: ["missed", "declined"] } })
        .sort({ createdAt: -1 }).limit(50).lean(),
    ]);

    ok(res, { incoming, outgoing });
  } catch (err) {
    logger.error("ring/missed-calls GET error:", { error: err?.message });
    serverError(res, "Failed to fetch missed calls");
  }
});

// ── DELETE /ring/missed-calls ─────────────────────────────────────────────────
// Mark all missed calls as cleared (delete) for the current user as target.
router.delete("/missed-calls", verifyToken, async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.id || req.user._id);
    const Log = getRingLog(req.db);
    await Log.deleteMany({ targetId: uid, outcome: { $in: ["missed", "declined"] } });
    ok(res, { cleared: true });
  } catch (err) {
    logger.error("ring/missed-calls DELETE error:", { error: err?.message });
    serverError(res, "Failed to clear missed calls");
  }
});

// ── GET /ring/contacts ───────────────────────────────────────────────────────
// Returns role-appropriate contacts using booking relationships:
//   student  → their assigned teacher(s) from bookings + center admin
//   teacher  → students assigned to them from bookings
//   admin    → all active teachers + all active students
router.get("/contacts", verifyToken, async (req, res) => {
  try {
    const role    = req.user.role;
    const Booking = getBooking(req.db);
    const rawId   = req.user.id || req.user._id;
    const uid     = new mongoose.Types.ObjectId(rawId);

    const displayName = (doc, r) => {
      if (r === "admin" || r === "subAdmin") return "Admin";
      const first = doc.firstName || "";
      const last  = doc.lastName  || "";
      return (first + " " + last).trim() || doc.username || "Unknown";
    };

    const toContact = (doc, r) => ({
      id:          doc._id,
      name:        displayName(doc, r),
      role:        r,
      ringEnabled: doc.ringEnabled ?? true,
    });

    if (role === "student") {
      const teacherIds = await Booking.distinct("teacherId", { studentId: uid });
      const [teachers, admin] = await Promise.all([
        getTeacher(req.db)
          .find({ _id: { $in: teacherIds } })
          .select("firstName lastName username ringEnabled")
          .lean(),
        getAdmin(req.db).findOne().select("firstName lastName username ringEnabled").lean(),
      ]);
      const contacts = teachers.map(t => toContact(t, "teacher"));
      if (admin) contacts.push(toContact(admin, "admin"));
      return ok(res, { contacts });
    }

    if (role === "teacher") {
      const studentIds = await Booking.distinct("studentId", { teacherId: uid });
      const [students, admin] = await Promise.all([
        getStudent(req.db)
          .find({ _id: { $in: studentIds } })
          .select("firstName lastName username ringEnabled")
          .lean(),
        getAdmin(req.db).findOne().select("firstName lastName username ringEnabled").lean(),
      ]);
      const contacts = students.map(s => toContact(s, "student"));
      if (admin) contacts.push(toContact(admin, "admin"));
      return ok(res, { contacts });
    }

    if (role === "admin" || role === "subAdmin") {
      const [teachers, students] = await Promise.all([
        getTeacher(req.db).find({ active: true }).select("firstName lastName username ringEnabled").lean(),
        getStudent(req.db).find({ active: true }).select("firstName lastName username ringEnabled").lean(),
      ]);
      return ok(res, {
        contacts: [
          ...teachers.map(t => toContact(t, "teacher")),
          ...students.map(s => toContact(s, "student")),
        ],
      });
    }

    return ok(res, { contacts: [] });
  } catch (err) {
    logger.error("ring/contacts GET error:", { error: err?.message });
    serverError(res, "Failed to fetch ring contacts");
  }
});

// ── POST /ring/ringtone ───────────────────────────────────────────────────────
// Upload a custom ringtone audio file.  Stores it at a predictable S3 key
// so re-uploading automatically replaces the previous file — no delete needed.
//
// S3 key pattern: centers/<slug>/ringtones/<userId>
// The bucket must allow public GET on this prefix (or swap to presigned URLs).
// Returns: { url }  — the public HTTPS URL the client should store locally.
router.post("/ringtone", verifyToken, (req, res, next) => {
  ringtoneUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "INVALID_TYPE")      return badRequest(res, "Unsupported audio format. Accepted: mp3, wav, ogg, aac, m4a, flac, webm");
    if (err.code === "LIMIT_FILE_SIZE")   return badRequest(res, "Audio file must be 10 MB or smaller");
    return serverError(res, err.message || "Upload failed");
  });
}, async (req, res) => {
  try {
    if (!s3Enabled()) {
      return res.status(503).json({ success: false, message: "S3 is not configured on this server — custom ringtones are unavailable" });
    }
    if (!req.file) return badRequest(res, "No audio file provided");

    const slug   = req.center.slug;
    const userId = (req.user.id || req.user._id).toString();
    const key    = `centers/${slug}/ringtones/${userId}`;

    await uploadToS3(req.file.buffer, key, req.file.mimetype);
    const url = s3PublicUrl(key);

    logger.info(`🎵 Custom ringtone uploaded: user=${userId} center=${slug} size=${req.file.size}B`);
    ok(res, { url });
  } catch (err) {
    logger.error("ring/ringtone POST error:", { error: err?.message });
    serverError(res, "Failed to upload ringtone");
  }
});

// ── DELETE /ring/ringtone ─────────────────────────────────────────────────────
// Remove the caller's custom ringtone from S3.
// The key is derived server-side from the auth token — no body needed.
router.delete("/ringtone", verifyToken, async (req, res) => {
  try {
    if (!s3Enabled()) return ok(res, { cleared: true }); // no-op when S3 is off
    const slug   = req.center.slug;
    const userId = (req.user.id || req.user._id).toString();
    await deleteFromS3(`centers/${slug}/ringtones/${userId}`);
    logger.info(`🗑️  Custom ringtone deleted: user=${userId} center=${slug}`);
    ok(res, { cleared: true });
  } catch (err) {
    logger.error("ring/ringtone DELETE error:", { error: err?.message });
    serverError(res, "Failed to delete ringtone");
  }
});

export default router;
