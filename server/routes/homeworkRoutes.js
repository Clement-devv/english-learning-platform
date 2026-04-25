import express        from "express";
import multer         from "multer";
import path           from "path";
import fs             from "fs";
import crypto         from "crypto";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";
import { homeworkSchema } from "../schemas/homeworkSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import {
  sendHomeworkAssigned,
  sendHomeworkSubmitted,
} from "../utils/emailService.js";
import { recordActivity } from "../utils/streakService.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { toStr, toObjectId } from '../utils/inputSanitizer.js';
import { wrapUpload } from '../middleware/validateObjectId.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();
router.use(tenantMiddleware);

const getHomework = (db) => db.models.Homework || db.model("Homework", homeworkSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);

// ── Upload directories ────────────────────────────────────────────────────────
const HW_DIR      = path.join(__dirname, "..", "uploads", "homework", "assignments");
const SUB_DIR     = path.join(__dirname, "..", "uploads", "homework", "submissions");
const AUD_DIR     = path.join(__dirname, "..", "uploads", "homework", "audio-feedback");
const INS_AUD_DIR = path.join(__dirname, "..", "uploads", "homework", "instruction-audio");
[HW_DIR, SUB_DIR, AUD_DIR, INS_AUD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Multer for audio feedback ─────────────────────────────────────────────────
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AUD_DIR),
    filename:    (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max for audio
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) return cb(null, true);
    cb(new Error("Only audio files allowed"));
  },
});

// ── Allowed MIME types + their magic bytes ────────────────────────────────────
const ALLOWED = {
  "application/pdf":                                                          { ext: [".pdf"],         magic: [0x25,0x50,0x44,0x46] },
  "application/msword":                                                       { ext: [".doc"],          magic: [0xD0,0xCF,0x11,0xE0] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: [".docx"],         magic: [0x50,0x4B,0x03,0x04] },
  "image/jpeg":                                                               { ext: [".jpg",".jpeg"],  magic: [0xFF,0xD8,0xFF]      },
  "image/png":                                                                { ext: [".png"],          magic: [0x89,0x50,0x4E,0x47] },
  "text/plain":                                                               { ext: [".txt"],          magic: null                  }, // no magic bytes for plain text
};

const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB
const MAX_FILES      = 5;

// ── Validate magic bytes from an in-memory buffer ────────────────────────────
function checkMagicBytesBuffer(buffer, expectedMagic) {
  if (!expectedMagic) return true; // e.g. plain text — no magic bytes
  if (buffer.length < expectedMagic.length) return false;
  return expectedMagic.every((b, i) => buffer[i] === b);
}

// ── Multer config — memory storage so magic bytes are validated BEFORE any
//    file touches disk. Valid files are written manually after validation.
function makeUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    fileFilter: (_req, file, cb) => {
      const info = ALLOWED[file.mimetype];
      if (!info) return cb(new Error(`File type not allowed: ${file.mimetype}`));

      const ext = path.extname(file.originalname).toLowerCase();
      if (!info.ext.includes(ext)) return cb(new Error(`File extension doesn't match type: ${ext}`));

      cb(null, true);
    },
  });
}

// ── Sanitise a filename for safe display (no path separators) ─────────────────
function sanitiseName(name) {
  return path.basename(name).replace(/[^\w.\-\s]/g, "_").slice(0, 100);
}

// ── Validate magic bytes from buffer and write valid files to disk ────────────
// Files that fail magic-byte check are discarded — they never touch disk.
function processUploadedFiles(files, destDir) {
  const attachments = [];

  for (const file of files) {
    const info = ALLOWED[file.mimetype];

    if (!checkMagicBytesBuffer(file.buffer, info?.magic)) {
      logger.warn("File rejected — magic bytes mismatch:", {
        originalName: file.originalname,
        mimetype:     file.mimetype,
      });
      continue;
    }

    const fileId  = crypto.randomUUID();
    const outPath = path.join(destDir, fileId);
    fs.writeFileSync(outPath, file.buffer);

    attachments.push({
      fileId,
      originalName: sanitiseName(file.originalname),
      size:         file.size,
      mimeType:     file.mimetype,
      uploadedAt:   new Date(),
    });
  }

  return attachments;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework  — teacher creates homework
// ─────────────────────────────────────────────────────────────────────────────
const uploadAssignment = makeUpload();

router.post("/", verifyToken, uploadLimiter, wrapUpload(uploadAssignment.array("files", MAX_FILES)), async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return forbidden(res, "Teachers only");
    }

    // Validate and coerce — throws { statusCode: 400 } on bad type/missing value
    const studentId  = toObjectId(req.body.studentId, "studentId");
    const titleClean = toStr(req.body.title,       "title",       { required: true, maxLen: 200 });
    const descClean  = toStr(req.body.description, "description", { maxLen: 2000 });
    const { dueDate } = req.body;
    if (!dueDate) return badRequest(res, "dueDate is required");

    // Verify student belongs to this teacher
    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, "Student not found");

    const attachments = processUploadedFiles(req.files || [], HW_DIR);

    const hw = await getHomework(req.db).create({
      teacherId:   req.user.id,
      studentId,
      title:       titleClean,
      description: descClean,
      dueDate:     new Date(dueDate),
      attachments,
    });

    // Email student about new homework (non-blocking)
    getStudent(req.db).findById(studentId).then(studentDoc => {
      if (studentDoc) {
        getTeacher(req.db).findById(req.user.id).then(teacherDoc => {
          if (teacherDoc) sendHomeworkAssigned(studentDoc, teacherDoc, hw).catch(e => logger.warn("sendHomeworkAssigned failed:", { error: e?.message }));
        }).catch(e => logger.warn("Teacher lookup for homework email failed:", { error: e?.message }));
      }
    }).catch(e => logger.warn("Student lookup for homework email failed:", { error: e?.message }));

    // Push real-time update to student dashboard
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${studentId}`).emit('homework-assigned', {
        title: '📚 New Homework!',
        message: `Your teacher assigned: "${titleClean}"`,
        homeworkId: hw._id,
        dueDate,
      });
    } catch (_) {}

    res.status(201).json({ success: true, homework: hw });
  } catch (err) {
    // Clean up any uploaded files on error
    (req.files || []).forEach(f => {
      try { fs.unlinkSync(path.join(HW_DIR, f.filename)); } catch (_) {}
    });
    logger.error("Create homework error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/my  — teacher's full homework list
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const list = await getHomework(req.db).find({ teacherId: req.user.id })
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, homework: list });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/assigned  — student's homework list
// ─────────────────────────────────────────────────────────────────────────────
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const list = await getHomework(req.db).find({ studentId: req.user.id })
      .populate("teacherId", "firstName lastName email")
      .sort({ dueDate: 1 })
      .lean();

    res.json({ success: true, homework: list });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/:id  — single homework detail
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const hw = await getHomework(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");

    if (!hw) return notFound(res, "Homework not found");

    // Only the assigned teacher or student can view
    const isTeacher = req.user.role === "teacher" && hw.teacherId._id.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId._id.toString() === req.user.id;
    if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

    res.json({ success: true, homework: hw });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/submit  — student submits homework
// ─────────────────────────────────────────────────────────────────────────────
const uploadSubmission = makeUpload();

router.post("/:id/submit", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(uploadSubmission.array("files", MAX_FILES)), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return forbidden(res, "Students only");
    }

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.studentId.toString() !== req.user.id) return forbidden(res, "Access denied");
    if (hw.status === "graded") return badRequest(res, "Already graded");

    const text = (req.body.text || "").trim().slice(0, 5000);
    const attachments = processUploadedFiles(req.files || [], SUB_DIR);

    if (!text && attachments.length === 0) {
      return badRequest(res, "Please provide text or a file");
    }

    hw.submission = { text, attachments, submittedAt: new Date() };
    hw.status     = "submitted";
    await hw.save();

    // Streak — await so we can include result in response
    let streakResult = null;
    try { streakResult = await recordActivity(req.db, req.user.id); } catch (_) {}

    // Email teacher about submission (non-blocking)
    Promise.all([
      getTeacher(req.db).findById(hw.teacherId),
      getStudent(req.db).findById(req.user.id),
    ]).then(([teacherDoc, studentDoc]) => {
      if (teacherDoc && studentDoc) sendHomeworkSubmitted(teacherDoc, studentDoc, hw).catch(e => logger.warn("sendHomeworkSubmitted failed:", { error: e?.message }));
    }).catch(e => logger.warn("User lookup for submission email failed:", { error: e?.message }));

    res.json({ success: true, homework: hw, streak: streakResult });
  } catch (err) {
    (req.files || []).forEach(f => {
      try { fs.unlinkSync(path.join(SUB_DIR, f.filename)); } catch (_) {}
    });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/grade  — teacher grades a submission
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/grade", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");
    if (hw.status !== "submitted") return badRequest(res, "No submission to grade");

    const score    = parseInt(req.body.score, 10);
    const feedback = (req.body.feedback || "").trim().slice(0, 2000);

    if (isNaN(score) || score < 0 || score > 100) {
      return badRequest(res, "Score must be 0–100");
    }

    // Preserve audioFeedback that was uploaded before grading
    const existingAudio = hw.grade?.audioFeedback;
    hw.grade  = { score, feedback, gradedAt: new Date() };
    if (existingAudio?.fileId) hw.grade.audioFeedback = existingAudio;
    hw.markModified("grade");
    hw.status = "graded";
    await hw.save();

    res.json({ success: true, homework: hw });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/homework/:id  — teacher deletes homework
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    // Delete all associated files from disk
    hw.attachments.forEach(a => {
      try { fs.unlinkSync(path.join(HW_DIR, a.fileId)); } catch (_) {}
    });
    hw.submission?.attachments?.forEach(a => {
      try { fs.unlinkSync(path.join(SUB_DIR, a.fileId)); } catch (_) {}
    });
    if (hw.grade?.audioFeedback?.fileId) {
      try { fs.unlinkSync(path.join(AUD_DIR, hw.grade.audioFeedback.fileId)); } catch (_) {}
    }
    if (hw.instructionAudio?.fileId) {
      try { fs.unlinkSync(path.join(INS_AUD_DIR, hw.instructionAudio.fileId)); } catch (_) {}
    }

    await hw.deleteOne();
    res.json({ success: true, message: "Homework deleted" });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/audio-feedback  — teacher uploads voice note
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/audio-feedback", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(audioUpload.single("audio")), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    if (!req.file) return badRequest(res, "No audio file uploaded");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    // Delete old audio file from disk if one existed
    if (hw.grade?.audioFeedback?.fileId) {
      try { fs.unlinkSync(path.join(AUD_DIR, hw.grade.audioFeedback.fileId)); } catch (_) {}
    }

    if (!hw.grade) hw.grade = {};
    hw.grade.audioFeedback = {
      fileId:   req.file.filename,
      duration: parseFloat(req.body.duration) || 0,
      size:     req.file.size,
      mimeType: req.file.mimetype,
    };
    hw.markModified("grade");
    await hw.save();

    res.json({ success: true, audioFeedback: hw.grade.audioFeedback });
  } catch (err) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/instruction-audio  — teacher attaches voice note to instructions
// ─────────────────────────────────────────────────────────────────────────────
const instructionAudioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, INS_AUD_DIR),
    filename:    (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) return cb(null, true);
    cb(new Error("Only audio files allowed"));
  },
});

router.post("/:id/instruction-audio", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(instructionAudioUpload.single("audio")), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    if (!req.file) return badRequest(res, "No audio file uploaded");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    // Delete old instruction audio if present
    if (hw.instructionAudio?.fileId) {
      try { fs.unlinkSync(path.join(INS_AUD_DIR, hw.instructionAudio.fileId)); } catch (_) {}
    }

    hw.instructionAudio = {
      fileId:   req.file.filename,
      duration: parseFloat(req.body.duration) || 0,
      size:     req.file.size,
      mimeType: req.file.mimetype,
    };
    await hw.save();

    res.json({ success: true, instructionAudio: hw.instructionAudio });
  } catch (err) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/file/:type/:fileId  — securely serve a file
// type = "assignment" | "submission" | "audio-feedback" | "instruction-audio"
// Auth required — only the relevant teacher or student can download
// ─────────────────────────────────────────────────────────────────────────────
router.get("/file/:type/:fileId", verifyToken, async (req, res) => {
  try {
    const { type, fileId } = req.params;

    // Sanitise — fileId must be a UUID (alphanumeric + hyphens, exactly)
    if (!/^[0-9a-f-]{36}$/.test(fileId)) {
      return badRequest(res, "Invalid file ID");
    }

    // ── Instruction audio ──────────────────────────────────────────────────
    if (type === "instruction-audio") {
      const filePath = path.join(INS_AUD_DIR, fileId);
      if (!fs.existsSync(filePath)) return notFound(res, "File not found");

      const hw = await getHomework(req.db).findOne({ "instructionAudio.fileId": fileId });
      if (!hw) return notFound(res, "File not found");

      const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
      const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
      if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

      res.setHeader("Content-Type", hw.instructionAudio.mimeType || "audio/webm");
      res.setHeader("Accept-Ranges", "bytes");
      return res.sendFile(filePath);
    }

    // ── Audio feedback ─────────────────────────────────────────────────────
    if (type === "audio-feedback") {
      const filePath = path.join(AUD_DIR, fileId);
      if (!fs.existsSync(filePath)) return notFound(res, "File not found");

      const hw = await getHomework(req.db).findOne({ "grade.audioFeedback.fileId": fileId });
      if (!hw) return notFound(res, "File not found");

      const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
      const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
      if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

      res.setHeader("Content-Type", hw.grade.audioFeedback.mimeType || "audio/webm");
      res.setHeader("Accept-Ranges", "bytes");
      return res.sendFile(filePath);
    }

    const dir = type === "submission" ? SUB_DIR : HW_DIR;
    const filePath = path.join(dir, fileId);

    if (!fs.existsSync(filePath)) return notFound(res, "File not found");

    // Find the homework that contains this file to verify ownership
    const query = type === "submission"
      ? { "submission.attachments.fileId": fileId }
      : { "attachments.fileId": fileId };

    const hw = await getHomework(req.db).findOne(query);
    if (!hw) return notFound(res, "File not found");

    const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
    if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

    const attachList = type === "submission" ? hw.submission.attachments : hw.attachments;
    const att = attachList.find(a => a.fileId === fileId);

    res.setHeader("Content-Type", att?.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${att?.originalName || fileId}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
