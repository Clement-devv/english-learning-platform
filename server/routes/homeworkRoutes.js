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
import { sendPush } from '../utils/webPushService.js';
import { s3Enabled, uploadToS3, deleteFromS3, getPresignedUrl } from "../utils/s3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();
router.use(tenantMiddleware);

const getHomework = (db) => db.models.Homework || db.model("Homework", homeworkSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);

// ── Legacy local upload directories (used when S3 not configured) ─────────────
const HW_DIR      = path.join(__dirname, "..", "uploads", "homework", "assignments");
const SUB_DIR     = path.join(__dirname, "..", "uploads", "homework", "submissions");
const AUD_DIR     = path.join(__dirname, "..", "uploads", "homework", "audio-feedback");
const INS_AUD_DIR = path.join(__dirname, "..", "uploads", "homework", "instruction-audio");
[HW_DIR, SUB_DIR, AUD_DIR, INS_AUD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── S3 key builders ───────────────────────────────────────────────────────────
const hwKey  = (slug, id) => `centers/${slug}/homework/assignments/${id}`;
const subKey = (slug, id) => `centers/${slug}/homework/submissions/${id}`;
const audKey = (slug, id) => `centers/${slug}/homework/audio-feedback/${id}`;
const insKey = (slug, id) => `centers/${slug}/homework/instruction-audio/${id}`;

// ── Allowed MIME types + their magic bytes ────────────────────────────────────
const ALLOWED = {
  "application/pdf":                                                          { ext: [".pdf"],         magic: [0x25,0x50,0x44,0x46] },
  "application/msword":                                                       { ext: [".doc"],          magic: [0xD0,0xCF,0x11,0xE0] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: [".docx"],         magic: [0x50,0x4B,0x03,0x04] },
  "image/jpeg":                                                               { ext: [".jpg",".jpeg"],  magic: [0xFF,0xD8,0xFF]      },
  "image/png":                                                                { ext: [".png"],          magic: [0x89,0x50,0x4E,0x47] },
  "text/plain":                                                               { ext: [".txt"],          magic: null                  },
};

const MAX_FILE_SIZE  = 10 * 1024 * 1024;
const MAX_FILES      = 5;

function checkMagicBytesBuffer(buffer, expectedMagic) {
  if (!expectedMagic) return true;
  if (buffer.length < expectedMagic.length) return false;
  return expectedMagic.every((b, i) => buffer[i] === b);
}

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

const audioMemUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) return cb(null, true);
    cb(new Error("Only audio files allowed"));
  },
});

function sanitiseName(name) {
  return path.basename(name).replace(/[^\w.\-\s]/g, "_").slice(0, 100);
}

// Validate magic bytes and either upload to S3 or write to local disk.
async function processUploadedFiles(files, localDir, s3KeyFn, slug) {
  const attachments = [];
  for (const file of files) {
    const info = ALLOWED[file.mimetype];
    if (!checkMagicBytesBuffer(file.buffer, info?.magic)) {
      logger.warn("File rejected — magic bytes mismatch:", { originalName: file.originalname, mimetype: file.mimetype });
      continue;
    }
    const fileId = crypto.randomUUID();
    if (s3Enabled()) {
      await uploadToS3(file.buffer, s3KeyFn(slug, fileId), file.mimetype);
    } else {
      fs.writeFileSync(path.join(localDir, fileId), file.buffer);
    }
    attachments.push({ fileId, originalName: sanitiseName(file.originalname), size: file.size, mimeType: file.mimetype, uploadedAt: new Date() });
  }
  return attachments;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework
// ─────────────────────────────────────────────────────────────────────────────
const uploadAssignment = makeUpload();

router.post("/", verifyToken, uploadLimiter, wrapUpload(uploadAssignment.array("files", MAX_FILES)), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const studentId  = toObjectId(req.body.studentId, "studentId");
    const titleClean = toStr(req.body.title,       "title",       { required: true, maxLen: 200 });
    const descClean  = toStr(req.body.description, "description", { maxLen: 2000 });
    const { dueDate } = req.body;
    if (!dueDate) return badRequest(res, "dueDate is required");

    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, "Student not found");

    const attachments = await processUploadedFiles(req.files || [], HW_DIR, hwKey, req.center.slug);

    const hw = await getHomework(req.db).create({
      teacherId:   req.user.id,
      studentId,
      title:       titleClean,
      description: descClean,
      dueDate:     new Date(dueDate),
      attachments,
    });

    getStudent(req.db).findById(studentId).then(studentDoc => {
      if (studentDoc) {
        getTeacher(req.db).findById(req.user.id).then(teacherDoc => {
          if (teacherDoc) sendHomeworkAssigned(studentDoc, teacherDoc, hw, req.center?.centerName || "", req.center).catch(e => logger.warn("sendHomeworkAssigned failed:", { error: e?.message }));
        }).catch(e => logger.warn("Teacher lookup for homework email failed:", { error: e?.message }));
      }
    }).catch(e => logger.warn("Student lookup for homework email failed:", { error: e?.message }));

    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${studentId}`).emit('homework-assigned', {
        title: '📚 New Homework!',
        message: `Your teacher assigned: "${titleClean}"`,
        homeworkId: hw._id,
        dueDate,
      });
      getStudent(req.db).findById(studentId).select('pushSubscription').then(s => {
        if (s?.pushSubscription?.endpoint)
          sendPush(s.pushSubscription, { title: '📚 New Homework!', body: `Your teacher assigned: "${titleClean}"`, icon: '/icons/icon.svg', data: { url: '/student/dashboard?tab=homework' } }).catch(() => {});
      }).catch(() => {});
    } catch (_) {}

    res.status(201).json({ success: true, homework: hw });
  } catch (err) {
    logger.error("Create homework error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/my
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
// GET /api/homework/assigned
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
// GET /api/homework/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const hw = await getHomework(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");
    if (!hw) return notFound(res, "Homework not found");

    const isTeacher = req.user.role === "teacher" && hw.teacherId._id.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId._id.toString() === req.user.id;
    if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

    res.json({ success: true, homework: hw });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/submit
// ─────────────────────────────────────────────────────────────────────────────
const uploadSubmission = makeUpload();

router.post("/:id/submit", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(uploadSubmission.array("files", MAX_FILES)), async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.studentId.toString() !== req.user.id) return forbidden(res, "Access denied");
    if (hw.status === "graded") return badRequest(res, "Already graded");

    const text = (req.body.text || "").trim().slice(0, 5000);
    const attachments = await processUploadedFiles(req.files || [], SUB_DIR, subKey, req.center.slug);

    if (!text && attachments.length === 0) return badRequest(res, "Please provide text or a file");

    hw.submission = { text, attachments, submittedAt: new Date() };
    hw.status     = "submitted";
    await hw.save();

    let streakResult = null;
    try { streakResult = await recordActivity(req.db, req.user.id); } catch (_) {}

    Promise.all([
      getTeacher(req.db).findById(hw.teacherId),
      getStudent(req.db).findById(req.user.id),
    ]).then(([teacherDoc, studentDoc]) => {
      if (teacherDoc && studentDoc) sendHomeworkSubmitted(teacherDoc, studentDoc, hw, req.center?.centerName || "", req.center).catch(e => logger.warn("sendHomeworkSubmitted failed:", { error: e?.message }));
    }).catch(e => logger.warn("User lookup for submission email failed:", { error: e?.message }));

    res.json({ success: true, homework: hw, streak: streakResult });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/grade
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
    if (isNaN(score) || score < 0 || score > 100) return badRequest(res, "Score must be 0–100");

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
// DELETE /api/homework/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    const slug = req.center.slug;

    if (s3Enabled()) {
      await Promise.all([
        ...hw.attachments.map(a => deleteFromS3(hwKey(slug, a.fileId))),
        ...(hw.submission?.attachments || []).map(a => deleteFromS3(subKey(slug, a.fileId))),
        hw.grade?.audioFeedback?.fileId ? deleteFromS3(audKey(slug, hw.grade.audioFeedback.fileId)) : Promise.resolve(),
        hw.instructionAudio?.fileId     ? deleteFromS3(insKey(slug, hw.instructionAudio.fileId))     : Promise.resolve(),
      ]);
    } else {
      hw.attachments.forEach(a => { try { fs.unlinkSync(path.join(HW_DIR, a.fileId)); } catch (_) {} });
      hw.submission?.attachments?.forEach(a => { try { fs.unlinkSync(path.join(SUB_DIR, a.fileId)); } catch (_) {} });
      if (hw.grade?.audioFeedback?.fileId) { try { fs.unlinkSync(path.join(AUD_DIR, hw.grade.audioFeedback.fileId)); } catch (_) {} }
      if (hw.instructionAudio?.fileId)     { try { fs.unlinkSync(path.join(INS_AUD_DIR, hw.instructionAudio.fileId)); } catch (_) {} }
    }

    await hw.deleteOne();
    res.json({ success: true, message: "Homework deleted" });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/audio-feedback
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/audio-feedback", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(audioMemUpload.single("audio")), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    if (!req.file) return badRequest(res, "No audio file uploaded");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    const slug   = req.center.slug;
    const fileId = crypto.randomUUID();

    // Delete old audio
    if (hw.grade?.audioFeedback?.fileId) {
      if (s3Enabled()) await deleteFromS3(audKey(slug, hw.grade.audioFeedback.fileId));
      else { try { fs.unlinkSync(path.join(AUD_DIR, hw.grade.audioFeedback.fileId)); } catch (_) {} }
    }

    if (s3Enabled()) {
      await uploadToS3(req.file.buffer, audKey(slug, fileId), req.file.mimetype);
    } else {
      fs.writeFileSync(path.join(AUD_DIR, fileId), req.file.buffer);
    }

    if (!hw.grade) hw.grade = {};
    hw.grade.audioFeedback = { fileId, duration: parseFloat(req.body.duration) || 0, size: req.file.size, mimeType: req.file.mimetype };
    hw.markModified("grade");
    await hw.save();

    res.json({ success: true, audioFeedback: hw.grade.audioFeedback });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/instruction-audio
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/instruction-audio", verifyToken, uploadLimiter, validateObjectId("id"), wrapUpload(audioMemUpload.single("audio")), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    if (!req.file) return badRequest(res, "No audio file uploaded");

    const hw = await getHomework(req.db).findById(req.params.id);
    if (!hw) return notFound(res, "Homework not found");
    if (hw.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");

    const slug   = req.center.slug;
    const fileId = crypto.randomUUID();

    if (hw.instructionAudio?.fileId) {
      if (s3Enabled()) await deleteFromS3(insKey(slug, hw.instructionAudio.fileId));
      else { try { fs.unlinkSync(path.join(INS_AUD_DIR, hw.instructionAudio.fileId)); } catch (_) {} }
    }

    if (s3Enabled()) {
      await uploadToS3(req.file.buffer, insKey(slug, fileId), req.file.mimetype);
    } else {
      fs.writeFileSync(path.join(INS_AUD_DIR, fileId), req.file.buffer);
    }

    hw.instructionAudio = { fileId, duration: parseFloat(req.body.duration) || 0, size: req.file.size, mimeType: req.file.mimetype };
    await hw.save();

    res.json({ success: true, instructionAudio: hw.instructionAudio });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/file/:type/:fileId
// type = "assignment" | "submission" | "audio-feedback" | "instruction-audio"
// ─────────────────────────────────────────────────────────────────────────────
router.get("/file/:type/:fileId", verifyToken, async (req, res) => {
  try {
    const { type, fileId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(fileId)) return badRequest(res, "Invalid file ID");

    const slug = req.center.slug;

    const keyFnMap = {
      "assignment":       hwKey,
      "submission":       subKey,
      "audio-feedback":   audKey,
      "instruction-audio": insKey,
    };
    const localDirMap = {
      "assignment":       HW_DIR,
      "submission":       SUB_DIR,
      "audio-feedback":   AUD_DIR,
      "instruction-audio": INS_AUD_DIR,
    };

    const keyFn    = keyFnMap[type];
    const localDir = localDirMap[type];
    if (!keyFn) return badRequest(res, "Invalid file type");

    // ── Auth: look up the homework record to verify ownership ─────────────────
    let hw;
    if (type === "instruction-audio") {
      hw = await getHomework(req.db).findOne({ "instructionAudio.fileId": fileId });
    } else if (type === "audio-feedback") {
      hw = await getHomework(req.db).findOne({ "grade.audioFeedback.fileId": fileId });
    } else if (type === "submission") {
      hw = await getHomework(req.db).findOne({ "submission.attachments.fileId": fileId });
    } else {
      hw = await getHomework(req.db).findOne({ "attachments.fileId": fileId });
    }
    if (!hw) return notFound(res, "File not found");

    const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
    if (!isTeacher && !isStudent) return forbidden(res, "Access denied");

    if (s3Enabled()) {
      const url = await getPresignedUrl(keyFn(slug, fileId), 3600);
      return res.redirect(302, url);
    }

    // Legacy local file
    const filePath = path.join(localDir, fileId);
    if (!fs.existsSync(filePath)) return notFound(res, "File not found");

    let mimeType = "application/octet-stream";
    let disposition = `inline; filename="${fileId}"`;

    if (type === "audio-feedback") {
      mimeType = hw.grade?.audioFeedback?.mimeType || "audio/webm";
    } else if (type === "instruction-audio") {
      mimeType = hw.instructionAudio?.mimeType || "audio/webm";
    } else {
      const attachList = type === "submission" ? hw.submission?.attachments : hw.attachments;
      const att = attachList?.find(a => a.fileId === fileId);
      mimeType    = att?.mimeType || "application/octet-stream";
      disposition = `inline; filename="${att?.originalName || fileId}"`;
    }

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
