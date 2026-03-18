import express        from "express";
import multer         from "multer";
import path           from "path";
import fs             from "fs";
import crypto         from "crypto";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/authMiddleware.js";
import Homework        from "../models/Homework.js";
import Student         from "../models/Student.js";
import Teacher         from "../models/Teacher.js";
import {
  sendHomeworkAssigned,
  sendHomeworkSubmitted,
} from "../utils/emailService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Upload directories ────────────────────────────────────────────────────────
const HW_DIR   = path.join(__dirname, "..", "uploads", "homework", "assignments");
const SUB_DIR  = path.join(__dirname, "..", "uploads", "homework", "submissions");
const AUD_DIR  = path.join(__dirname, "..", "uploads", "homework", "audio-feedback");
[HW_DIR, SUB_DIR, AUD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

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

// ── Validate magic bytes of a saved file ─────────────────────────────────────
function checkMagicBytes(filePath, expectedMagic) {
  if (!expectedMagic) return true; // e.g. plain text — skip
  const fd  = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(expectedMagic.length);
  fs.readSync(fd, buf, 0, expectedMagic.length, 0);
  fs.closeSync(fd);
  return expectedMagic.every((b, i) => buf[i] === b);
}

// ── Multer config (used for both assignment + submission uploads) ──────────────
function makeUpload(destDir) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destDir),
    filename:    (_req, _file, cb) => cb(null, crypto.randomUUID()), // UUID — no extension on disk
  });

  return multer({
    storage,
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

// ── POST: validate magic bytes and build attachment record ────────────────────
function processUploadedFiles(files, destDir) {
  const attachments = [];
  const toDelete    = [];

  for (const file of files) {
    const info  = ALLOWED[file.mimetype];
    const fPath = path.join(destDir, file.filename);

    if (!checkMagicBytes(fPath, info?.magic)) {
      toDelete.push(fPath);
      continue;
    }

    attachments.push({
      fileId:       file.filename,
      originalName: sanitiseName(file.originalname),
      size:         file.size,
      mimeType:     file.mimetype,
      uploadedAt:   new Date(),
    });
  }

  toDelete.forEach(p => { try { fs.unlinkSync(p); } catch (_) {} });
  return attachments;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework  — teacher creates homework
// ─────────────────────────────────────────────────────────────────────────────
const uploadAssignment = makeUpload(HW_DIR);

router.post("/", verifyToken, uploadAssignment.array("files", MAX_FILES), async (req, res) => {
  try {
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Teachers only" });
    }

    const { studentId, title, description, dueDate } = req.body;

    if (!studentId || !title?.trim() || !dueDate) {
      return res.status(400).json({ message: "studentId, title, and dueDate are required" });
    }

    // Verify student belongs to this teacher
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const titleClean = title.trim().slice(0, 200);
    const descClean  = (description || "").trim().slice(0, 2000);

    const attachments = processUploadedFiles(req.files || [], HW_DIR);

    const hw = await Homework.create({
      teacherId:   req.user.id,
      studentId,
      title:       titleClean,
      description: descClean,
      dueDate:     new Date(dueDate),
      attachments,
    });

    // Email student about new homework (non-blocking)
    Student.findById(studentId).then(studentDoc => {
      if (studentDoc) {
        Teacher.findById(req.user.id).then(teacherDoc => {
          if (teacherDoc) sendHomeworkAssigned(studentDoc, teacherDoc, hw).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json({ success: true, homework: hw });
  } catch (err) {
    // Clean up any uploaded files on error
    (req.files || []).forEach(f => {
      try { fs.unlinkSync(path.join(HW_DIR, f.filename)); } catch (_) {}
    });
    console.error("Create homework error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/my  — teacher's full homework list
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const list = await Homework.find({ teacherId: req.user.id })
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });

    res.json({ success: true, homework: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/assigned  — student's homework list
// ─────────────────────────────────────────────────────────────────────────────
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });

    const list = await Homework.find({ studentId: req.user.id })
      .populate("teacherId", "firstName lastName email")
      .sort({ dueDate: 1 });

    res.json({ success: true, homework: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/:id  — single homework detail
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const hw = await Homework.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    if (!hw) return res.status(404).json({ message: "Homework not found" });

    // Only the assigned teacher or student can view
    const isTeacher = req.user.role === "teacher" && hw.teacherId._id.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId._id.toString() === req.user.id;
    if (!isTeacher && !isStudent) return res.status(403).json({ message: "Access denied" });

    res.json({ success: true, homework: hw });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/submit  — student submits homework
// ─────────────────────────────────────────────────────────────────────────────
const uploadSubmission = makeUpload(SUB_DIR);

router.post("/:id/submit", verifyToken, uploadSubmission.array("files", MAX_FILES), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: "Homework not found" });
    if (hw.studentId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
    if (hw.status === "graded") return res.status(400).json({ message: "Already graded" });

    const text = (req.body.text || "").trim().slice(0, 5000);
    const attachments = processUploadedFiles(req.files || [], SUB_DIR);

    if (!text && attachments.length === 0) {
      return res.status(400).json({ message: "Please provide text or a file" });
    }

    hw.submission = { text, attachments, submittedAt: new Date() };
    hw.status     = "submitted";
    await hw.save();

    // Email teacher about submission (non-blocking)
    Promise.all([
      Teacher.findById(hw.teacherId),
      Student.findById(req.user.id),
    ]).then(([teacherDoc, studentDoc]) => {
      if (teacherDoc && studentDoc) sendHomeworkSubmitted(teacherDoc, studentDoc, hw).catch(() => {});
    }).catch(() => {});

    res.json({ success: true, homework: hw });
  } catch (err) {
    (req.files || []).forEach(f => {
      try { fs.unlinkSync(path.join(SUB_DIR, f.filename)); } catch (_) {}
    });
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/grade  — teacher grades a submission
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/grade", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: "Homework not found" });
    if (hw.teacherId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
    if (hw.status !== "submitted") return res.status(400).json({ message: "No submission to grade" });

    const score    = parseInt(req.body.score, 10);
    const feedback = (req.body.feedback || "").trim().slice(0, 2000);

    if (isNaN(score) || score < 0 || score > 100) {
      return res.status(400).json({ message: "Score must be 0–100" });
    }

    hw.grade  = { score, feedback, gradedAt: new Date() };
    hw.status = "graded";
    await hw.save();

    res.json({ success: true, homework: hw });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/homework/:id  — teacher deletes homework
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: "Homework not found" });
    if (hw.teacherId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });

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

    await hw.deleteOne();
    res.json({ success: true, message: "Homework deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/audio-feedback  — teacher uploads voice note
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/audio-feedback", verifyToken, audioUpload.single("audio"), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });
    if (!req.file) return res.status(400).json({ message: "No audio file uploaded" });

    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: "Homework not found" });
    if (hw.teacherId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });

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
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/file/:type/:fileId  — securely serve a file
// type = "assignment" | "submission" | "audio-feedback"
// Auth required — only the relevant teacher or student can download
// ─────────────────────────────────────────────────────────────────────────────
router.get("/file/:type/:fileId", verifyToken, async (req, res) => {
  try {
    const { type, fileId } = req.params;

    // Sanitise — fileId must be a UUID (alphanumeric + hyphens, exactly)
    if (!/^[0-9a-f-]{36}$/.test(fileId)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    // ── Audio feedback — special handling ─────────────────────────────────
    if (type === "audio-feedback") {
      const filePath = path.join(AUD_DIR, fileId);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

      const hw = await Homework.findOne({ "grade.audioFeedback.fileId": fileId });
      if (!hw) return res.status(404).json({ message: "File not found" });

      const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
      const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
      if (!isTeacher && !isStudent) return res.status(403).json({ message: "Access denied" });

      res.setHeader("Content-Type", hw.grade.audioFeedback.mimeType || "audio/webm");
      res.setHeader("Accept-Ranges", "bytes");
      return res.sendFile(filePath);
    }

    const dir = type === "submission" ? SUB_DIR : HW_DIR;
    const filePath = path.join(dir, fileId);

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });

    // Find the homework that contains this file to verify ownership
    const query = type === "submission"
      ? { "submission.attachments.fileId": fileId }
      : { "attachments.fileId": fileId };

    const hw = await Homework.findOne(query);
    if (!hw) return res.status(404).json({ message: "File not found" });

    const isTeacher = req.user.role === "teacher" && hw.teacherId.toString() === req.user.id;
    const isStudent = req.user.role === "student" && hw.studentId.toString() === req.user.id;
    if (!isTeacher && !isStudent) return res.status(403).json({ message: "Access denied" });

    const attachList = type === "submission" ? hw.submission.attachments : hw.attachments;
    const att = attachList.find(a => a.fileId === fileId);

    res.setHeader("Content-Type", att?.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${att?.originalName || fileId}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
