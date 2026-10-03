import express        from "express";
import multer         from "multer";
import path           from "path";
import fs             from "fs";
import crypto         from "crypto";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { uploadLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import {
  issueShareLink, withShareInfo, resolveShareLink, checkUnlock, linkExpiresAt,
  signLinkAccess, verifyLinkAccess, ACCESS_HEADER,
} from "../utils/shareLink.js";
import { homeworkSchema } from "../schemas/homeworkSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import {
  sendHomeworkAssigned,
  sendHomeworkSubmitted,
} from "../utils/emailService.js";
import { recordActivity } from "../utils/streakService.js";
import { readPaging, pageMeta, statusCounts, oid, todoFirstIds, inOrder } from "../utils/paging.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { toStr, toObjectId } from '../utils/inputSanitizer.js';
import { wrapUpload } from '../middleware/validateObjectId.js';
import { pushToUser, pushToAllAdmins } from '../utils/webPushService.js';
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
const SUB_AUD_DIR = path.join(__dirname, "..", "uploads", "homework", "submission-audio");
[HW_DIR, SUB_DIR, AUD_DIR, INS_AUD_DIR, SUB_AUD_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── S3 key builders ───────────────────────────────────────────────────────────
const hwKey  = (slug, id) => `centers/${slug}/homework/assignments/${id}`;
const subKey = (slug, id) => `centers/${slug}/homework/submissions/${id}`;
const audKey = (slug, id) => `centers/${slug}/homework/audio-feedback/${id}`;
const insKey = (slug, id) => `centers/${slug}/homework/instruction-audio/${id}`;
const subAudKey = (slug, id) => `centers/${slug}/homework/submission-audio/${id}`;

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

// ── Share-link uploads (anonymous-ish, so stricter than logged-in uploads) ────
// Only photos and PDFs: no Word files (old .doc can carry macros that run on the
// teacher's computer) and nothing a browser would execute (HTML, SVG, JS).
// Files are never executed by the server: stored under a random UUID with no
// extension, outside the web root (or in S3), and served back with their
// verified Content-Type + nosniff.
const LINK_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Voice answers: container magic bytes per type (checked after upload)
const AUDIO_TYPES = {
  "audio/webm": (b) => b.length > 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3,
  "audio/ogg":  (b) => b.length > 4 && b.toString("latin1", 0, 4) === "OggS",
  "audio/mp4":  (b) => b.length > 8 && b.toString("latin1", 4, 8) === "ftyp",   // iPhone Safari
};
const MAX_VOICE_SECONDS = 180;

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

// Delete stored files (S3 or local) for a list of attachments.
async function deleteFiles(attachments, localDir, s3KeyFn, slug) {
  for (const a of attachments || []) {
    if (s3Enabled()) await deleteFromS3(s3KeyFn(slug, a.fileId)).catch(() => {});
    else { try { fs.unlinkSync(path.join(localDir, a.fileId)); } catch (_) {} }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public share-link routes — /api/v1/homework/link/:token/...
// No login: the unguessable token is the key, and the name check is a second
// step that issues a short-lived access token (sent as X-Share-Access).
// Shared mechanics live in utils/shareLink.js.
// These never return 401 so the app's auth interceptor doesn't redirect to login.
// ─────────────────────────────────────────────────────────────────────────────
const LINK_UNAVAILABLE = "This homework link is invalid or has been removed. Please ask the teacher for a new link.";

async function findByLinkToken(req, res) {
  getStudent(req.db); getTeacher(req.db); // register models for populate
  const r = await resolveShareLink(getHomework(req.db), req.params.token, req.center);
  if (r.status === "invalid") { notFound(res, LINK_UNAVAILABLE); return null; }
  if (r.status === "expired") {
    res.status(410).json({ success: false, expired: true, message: "This homework link has expired — the due date has passed." });
    return null;
  }
  return { hw: r.doc, tokenHash: r.tokenHash, expiresAt: r.expiresAt };
}

// Resolve + require a valid access token from the name check.
async function requireLinkAccess(req, res) {
  const found = await findByLinkToken(req, res);
  if (!found) return null;
  const access = verifyLinkAccess(req.center.slug, "homework", req.get(ACCESS_HEADER), found.hw._id, found.tokenHash);
  if (!access) { forbidden(res, "Please confirm your name to open this homework."); return null; }
  return found;
}

// What the student sees — only this homework, nothing else about the account.
const linkView = (hw, expiresAt, centerName) => ({
  title:       hw.title,
  description: hw.description,
  dueDate:     hw.dueDate,
  expiresAt,
  status:      hw.status,
  studentName: hw.studentId.firstName,
  teacherName: hw.teacherId.displayName?.trim() || hw.teacherId.firstName,
  centerName:  centerName || "",
  attachments: (hw.attachments || []).map(({ fileId, originalName, mimeType, size }) => ({ fileId, originalName, mimeType, size })),
  hasInstructionAudio: !!hw.instructionAudio?.fileId,
  instructionAudioId:  hw.instructionAudio?.fileId || null,
  submission: hw.submission?.submittedAt ? {
    text:        hw.submission.text,
    submittedAt: hw.submission.submittedAt,
    attachments: (hw.submission.attachments || []).map(({ fileId, originalName, mimeType, size }) => ({ fileId, originalName, mimeType, size })),
    audio: hw.submission.audio?.fileId ? { fileId: hw.submission.audio.fileId, duration: hw.submission.audio.duration } : null,
  } : null,
});

// POST /link/:token/unlock  { studentName, teacherName }
router.post("/link/:token/unlock", loginLimiter, async (req, res) => {
  try {
    const found = await findByLinkToken(req, res);
    if (!found) return;
    const { hw, tokenHash, expiresAt } = found;

    const check = await checkUnlock(getHomework(req.db), hw,
      toStr(req.body.studentName, "studentName", { maxLen: 100 }),
      toStr(req.body.teacherName, "teacherName", { maxLen: 100 }));
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

    res.json({
      success: true,
      accessToken: signLinkAccess(req.center.slug, "homework", hw._id, tokenHash, expiresAt),
      homework: linkView(hw, expiresAt, req.center?.centerName),
    });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Homework link unlock error:", { error: err?.message });
    serverError(res);
  }
});

// GET /link/:token  (X-Homework-Access)
router.get("/link/:token", async (req, res) => {
  try {
    const found = await requireLinkAccess(req, res);
    if (!found) return;
    res.json({ success: true, homework: linkView(found.hw, found.expiresAt, req.center?.centerName) });
  } catch (err) {
    logger.error("Homework link view error:", { error: err?.message });
    serverError(res);
  }
});

// GET /link/:token/file/:type/:fileId  (X-Homework-Access)
// type = assignment | instruction-audio | submission (the student's own upload)
router.get("/link/:token/file/:type/:fileId", async (req, res) => {
  try {
    const found = await requireLinkAccess(req, res);
    if (!found) return;
    const { hw } = found;
    const { type, fileId } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(fileId)) return badRequest(res, "Invalid file ID");

    let keyFn, localDir, mimeType, name;
    if (type === "assignment") {
      const att = hw.attachments.find(a => a.fileId === fileId);
      if (!att) return notFound(res, "File not found");
      [keyFn, localDir, mimeType, name] = [hwKey, HW_DIR, att.mimeType, att.originalName];
    } else if (type === "submission") {
      const att = hw.submission?.attachments?.find(a => a.fileId === fileId);
      if (!att) return notFound(res, "File not found");
      [keyFn, localDir, mimeType, name] = [subKey, SUB_DIR, att.mimeType, att.originalName];
    } else if (type === "instruction-audio") {
      if (hw.instructionAudio?.fileId !== fileId) return notFound(res, "File not found");
      [keyFn, localDir, mimeType, name] = [insKey, INS_AUD_DIR, hw.instructionAudio.mimeType || "audio/webm", "instructions"];
    } else if (type === "submission-audio") {
      if (hw.submission?.audio?.fileId !== fileId) return notFound(res, "File not found");
      [keyFn, localDir, mimeType, name] = [subAudKey, SUB_AUD_DIR, hw.submission.audio.mimeType || "audio/webm", "voice-answer"];
    } else {
      return badRequest(res, "Invalid file type");
    }

    if (s3Enabled()) {
      // JSON instead of a redirect — the browser can't send X-Homework-Access to S3
      return res.json({ success: true, url: await getPresignedUrl(keyFn(req.center.slug, fileId), 300) });
    }
    const filePath = path.join(localDir, fileId);
    if (!fs.existsSync(filePath)) return notFound(res, "File not found");
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${sanitiseName(name)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.sendFile(filePath);
  } catch (err) {
    logger.error("Homework link file error:", { error: err?.message });
    serverError(res);
  }
});

// POST /link/:token/submit  (X-Homework-Access) — multipart: text, files[] (photo/PDF), audio (voice), duration
const uploadLinkSubmission = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES + 1, fields: 5, fieldSize: 20 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = file.mimetype.split(";")[0].trim().toLowerCase();
    if (file.fieldname === "audio") {
      return AUDIO_TYPES[type] ? cb(null, true) : cb(new Error("Voice recording format not supported"));
    }
    if (file.fieldname !== "files" || !LINK_FILE_TYPES.includes(type))
      return cb(new Error("Only photos (JPG, PNG) and PDF files can be uploaded"));
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[type].ext.includes(ext)) return cb(new Error(`File extension doesn't match type: ${ext}`));
    cb(null, true);
  },
});

// Verify + store a voice answer. Returns the audio subdoc, or null if it isn't real audio.
async function processVoiceAnswer(file, durationRaw, slug) {
  if (!file) return null;
  const type = file.mimetype.split(";")[0].trim().toLowerCase();
  if (!AUDIO_TYPES[type]?.(file.buffer)) {
    logger.warn("Voice answer rejected — not a real audio file", { mimetype: file.mimetype });
    return null;
  }
  const fileId = crypto.randomUUID();
  if (s3Enabled()) await uploadToS3(file.buffer, subAudKey(slug, fileId), type);
  else fs.writeFileSync(path.join(SUB_AUD_DIR, fileId), file.buffer);
  const duration = Math.min(Math.max(parseFloat(durationRaw) || 0, 0), MAX_VOICE_SECONDS);
  return { fileId, duration, size: file.size, mimeType: type };
}

router.post("/link/:token/submit", uploadLimiter, async (req, res, next) => {
  // Check the link + access before accepting any upload bytes
  try {
    const found = await requireLinkAccess(req, res);
    if (!found) return;
    if (found.hw.status === "graded")
      return badRequest(res, "This homework has already been graded — it can't be changed now.");
    req.linkHw = found.hw;
    next();
  } catch (err) {
    logger.error("Homework link submit pre-check error:", { error: err?.message });
    serverError(res);
  }
}, wrapUpload(uploadLinkSubmission.fields([{ name: "files", maxCount: MAX_FILES }, { name: "audio", maxCount: 1 }])), async (req, res) => {
  try {
    const hw   = req.linkHw;
    const slug = req.center.slug;
    const text = (req.body.text || "").trim().slice(0, 5000);
    const attachments = await processUploadedFiles(req.files?.files || [], SUB_DIR, subKey, slug);
    const audio       = await processVoiceAnswer(req.files?.audio?.[0], req.body.duration, slug);
    if (!text && attachments.length === 0 && !audio)
      return badRequest(res, "Please write an answer, record your voice or attach a photo/PDF");

    // Resubmitting (before grading) replaces the previous answer, its files and voice note
    const oldFiles = hw.submission?.attachments || [];
    const oldAudio = hw.submission?.audio?.fileId ? [{ fileId: hw.submission.audio.fileId }] : [];
    hw.submission = { text, attachments, submittedAt: new Date(), via: "link", ...(audio && { audio }) };
    hw.status     = "submitted";
    await hw.save();
    await deleteFiles(oldFiles, SUB_DIR, subKey, slug);
    await deleteFiles(oldAudio, SUB_AUD_DIR, subAudKey, slug);

    Promise.all([getTeacher(req.db).findById(hw.teacherId._id), getStudent(req.db).findById(hw.studentId._id)])
      .then(([teacherDoc, studentDoc]) => {
        if (teacherDoc && studentDoc) sendHomeworkSubmitted(teacherDoc, studentDoc, hw, req.center?.centerName || "", req.center)
          .catch(e => logger.warn("sendHomeworkSubmitted failed:", { error: e?.message }));
      }).catch(() => {});

    res.json({ success: true, homework: linkView(hw, linkExpiresAt(hw.dueDate, req.center?.timezone), req.center?.centerName) });
  } catch (err) {
    logger.error("Homework link submit error:", { error: err?.message });
    serverError(res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/homework/:id/share-link — create or replace the link (teacher)
// DELETE /api/homework/:id/share-link — remove it (link stops working at once)
// ─────────────────────────────────────────────────────────────────────────────
async function loadOwnHomework(req, res) {
  if (req.user.role !== "teacher") { forbidden(res, "Teachers only"); return null; }
  getStudent(req.db);
  const hw = await getHomework(req.db).findById(req.params.id)
    .select("+shareLink.tokenEnc")
    .populate("studentId", "firstName lastName email isManaged");
  if (!hw) { notFound(res, "Homework not found"); return null; }
  if (hw.teacherId.toString() !== req.user.id) { forbidden(res, "Access denied"); return null; }
  return hw;
}

router.post("/:id/share-link", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const hw = await loadOwnHomework(req, res);
    if (!hw) return;
    if (!hw.studentId?.isManaged)
      return badRequest(res, "Share links are only for managed students — this student uses the app.");
    if (Date.now() > linkExpiresAt(hw.dueDate, req.center?.timezone).getTime())
      return badRequest(res, "The due date has passed, so a new link would already be expired.");

    issueShareLink(hw);
    await hw.save();
    res.json({ success: true, homework: withShareInfo(hw, req.center) });
  } catch (err) {
    logger.error("Create share link error:", { error: err?.message });
    serverError(res);
  }
});

router.delete("/:id/share-link", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const hw = await loadOwnHomework(req, res);
    if (!hw) return;
    await getHomework(req.db).updateOne({ _id: hw._id }, { $unset: { shareLink: 1 } });
    res.json({ success: true, message: "Link deleted — it no longer works." });
  } catch (err) {
    logger.error("Delete share link error:", { error: err?.message });
    serverError(res);
  }
});

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

    const hw = new (getHomework(req.db))({
      teacherId:   req.user.id,
      studentId,
      title:       titleClean,
      description: descClean,
      dueDate:     new Date(dueDate),
      attachments,
    });
    // Managed students have no login — they get the homework through a share link
    if (student.isManaged) issueShareLink(hw);
    await hw.save();

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
      pushToUser(req.db, 'student', studentId, { title: '📚 New Homework!', body: `Your teacher assigned: "${titleClean}"`, icon: '/icons/icon.svg', data: { url: '/student/dashboard?tab=homework' } });
    } catch (_) {}

    res.status(201).json({ success: true, homework: withShareInfo(hw, req.center) });
  } catch (err) {
    logger.error("Create homework error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/homework/my
// ─────────────────────────────────────────────────────────────────────────────
// ?status=assigned|submitted|graded  ?page=1  ?limit=20 (max 50)
// Always returns counts per status, so a badge can poll with ?limit=1.
const HW_STATUSES = ["assigned", "submitted", "graded"];
router.get("/my", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const Homework = getHomework(req.db);
    const status = HW_STATUSES.includes(req.query.status) ? req.query.status : null;
    const counts = await statusCounts(Homework, { teacherId: oid(req.user.id) }, HW_STATUSES);
    const { page: want, limit } = readPaging(req.query);
    const pagination = pageMeta(want, limit, status ? counts[status] : counts.all);
    const list = await Homework.find({ teacherId: req.user.id, ...(status ? { status } : {}) })
      .select("+shareLink.tokenEnc")
      .populate("studentId", "firstName lastName email isManaged")
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({ success: true, homework: list.map(hw => withShareInfo(hw, req.center)), pagination, counts });
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
    const Homework = getHomework(req.db);
    const status = HW_STATUSES.includes(req.query.status) ? req.query.status : null;
    const mine = { studentId: oid(req.user.id) };
    const counts = await statusCounts(Homework, mine, HW_STATUSES);
    const { page: want, limit } = readPaging(req.query);
    const pagination = pageMeta(want, limit, status ? counts[status] : counts.all);
    // To-do first (soonest due), then the rest (most recent first)
    const ids = await todoFirstIds(Homework, { ...mine, ...(status ? { status } : {}) }, "assigned", pagination);
    const list = inOrder(await Homework.find({ _id: { $in: ids } })
      .populate("teacherId", "firstName lastName email")
      .lean(), ids);
    res.json({ success: true, homework: list, pagination, counts });
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
        hw.submission?.audio?.fileId    ? deleteFromS3(subAudKey(slug, hw.submission.audio.fileId))  : Promise.resolve(),
      ]);
    } else {
      hw.attachments.forEach(a => { try { fs.unlinkSync(path.join(HW_DIR, a.fileId)); } catch (_) {} });
      hw.submission?.attachments?.forEach(a => { try { fs.unlinkSync(path.join(SUB_DIR, a.fileId)); } catch (_) {} });
      if (hw.grade?.audioFeedback?.fileId) { try { fs.unlinkSync(path.join(AUD_DIR, hw.grade.audioFeedback.fileId)); } catch (_) {} }
      if (hw.instructionAudio?.fileId)     { try { fs.unlinkSync(path.join(INS_AUD_DIR, hw.instructionAudio.fileId)); } catch (_) {} }
      if (hw.submission?.audio?.fileId)    { try { fs.unlinkSync(path.join(SUB_AUD_DIR, hw.submission.audio.fileId)); } catch (_) {} }
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
      "submission-audio": subAudKey,
    };
    const localDirMap = {
      "assignment":       HW_DIR,
      "submission":       SUB_DIR,
      "audio-feedback":   AUD_DIR,
      "instruction-audio": INS_AUD_DIR,
      "submission-audio": SUB_AUD_DIR,
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
    } else if (type === "submission-audio") {
      hw = await getHomework(req.db).findOne({ "submission.audio.fileId": fileId });
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
    } else if (type === "submission-audio") {
      mimeType = hw.submission?.audio?.mimeType || "audio/webm";
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
