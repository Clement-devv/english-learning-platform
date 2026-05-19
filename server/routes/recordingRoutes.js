// server/routes/recordingRoutes.js
import express    from "express";
import multer     from "multer";
import path       from "path";
import fs         from "fs";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { recordingSchema }  from "../schemas/recordingSchema.js";
import { bookingSchema }    from "../schemas/bookingSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { wrapUpload } from '../middleware/validateObjectId.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = path.join(__dirname, "../uploads/recordings");

const AUTO_DELETE_DAYS = 30;

const ALLOWED_VIDEO_TYPES = {
  "video/webm":      ".webm",
  "video/mp4":       ".mp4",
  "video/ogg":       ".ogv",
  "video/quicktime": ".mov",
};

// ── Storage backend ───────────────────────────────────────────────────────────
// Set S3_BUCKET (+ AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) in
// your environment to use S3. Otherwise recordings are saved to local disk.
// Local disk is fine for a single-server setup but does NOT work when running
// multiple instances — use S3 (or an NFS mount) for cluster deployments.

let storage;
let useS3 = false;

if (process.env.S3_BUCKET) {
  try {
    const { s3 } = await import('../utils/s3.js');
    const { default: multerS3 } = await import('multer-s3');
    useS3 = true;

    storage = multerS3({
      s3,
      bucket: process.env.S3_BUCKET,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const ext  = ALLOWED_VIDEO_TYPES[file.mimetype] || '.webm';
        const slug = req.center?.slug || 'unknown';
        const name = `centers/${slug}/recordings/rec_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, name);
      },
    });

    logger.info(`✅ Recording storage: S3 bucket "${process.env.S3_BUCKET}"`);
  } catch (err) {
    logger.warn('⚠️ S3_BUCKET set but S3 packages missing — falling back to local disk.', { error: err?.message });
  }
}

if (!useS3) {
  if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECORDINGS_DIR),
    filename:    (_req, file,  cb) => {
      const ext  = ALLOWED_VIDEO_TYPES[file.mimetype] || ".webm";
      const name = `rec_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      cb(null, name);
    },
  });
  logger.info('📁 Recording storage: local disk (set S3_BUCKET to use S3)');
}

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const baseType = file.mimetype.split(";")[0].trim();
    logger.info(`Recording fileFilter: originalname="${file.originalname}" mimetype="${file.mimetype}" baseType="${baseType}"`);
    if (baseType.startsWith("video/") || ALLOWED_VIDEO_TYPES[baseType]) return cb(null, true);
    cb(new Error(`Only video files are allowed (received: ${baseType})`));
  },
});

const router = express.Router();
router.use(tenantMiddleware);

const getRecording = (db) => db.models.Recording || db.model("Recording", recordingSchema);
const getBooking   = (db) => db.models.Booking   || db.model("Booking",   bookingSchema);

async function purgeRecording(rec) {
  if (useS3 && rec.filename) {
    try {
      const { deleteFromS3 } = await import('../utils/s3.js');
      await deleteFromS3(rec.filename);
    } catch (err) {
      logger.warn(`Failed to delete S3 object "${rec.filename}":`, { error: err?.message });
    }
  } else {
    const filePath = path.join(RECORDINGS_DIR, rec.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
  await rec.deleteOne();
}

// POST /api/recordings/upload
router.post("/upload", verifyToken, wrapUpload(upload.single("recording")), async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");
    if (!req.file)          return badRequest(res, "No file uploaded");

    const { bookingId, duration, title } = req.body;
    if (!bookingId) return badRequest(res, "bookingId is required");

    const booking   = await getBooking(req.db).findById(bookingId).select("studentId");
    const studentId = booking?.studentId || null;

    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + AUTO_DELETE_DAYS);

    // multer-s3 sets req.file.key; multer disk sets req.file.filename
    const filename = req.file.key || req.file.filename;
    if (!filename) return serverError(res, "File storage error — no filename assigned");

    const rec = await getRecording(req.db).create({
      bookingId, teacherId, studentId,
      title:    title?.trim() || "",
      filename,
      duration: parseFloat(duration) || 0,
      fileSize: req.file.size || 0,
      mimeType: (req.file.mimetype || "video/webm").split(";")[0].trim(),
      autoDeleteAt,
    });

    res.status(201).json({ success: true, recording: rec });
  } catch (err) {
    logger.error("Recording upload error:", { error: err?.message });
    if (req.file) {
      if (useS3 && req.file.key) {
        const { deleteFromS3 } = await import('../utils/s3.js');
        deleteFromS3(req.file.key).catch(() => {});
      } else if (req.file.path) {
        fs.unlink(req.file.path, () => {});
      }
    }
    serverError(res, err.message);
  }
});

// GET /api/recordings — list for current user
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    let filter = {};
    if      (role === "teacher") filter.teacherId = userId;
    else if (role === "student") { filter.studentId = userId; filter.visibleToStudent = true; }
    else if (role === "admin")   filter = {};
    else return forbidden(res, "Access denied");

    const recordings = await getRecording(req.db).find(filter)
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, recordings });
  } catch (err) {
    serverError(res, err.message);
  }
});

// GET /api/recordings/teacher/:teacherId — admin views one teacher's recordings
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admins only");

    const recordings = await getRecording(req.db).find({ teacherId: req.params.teacherId })
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, recordings });
  } catch (err) {
    serverError(res, err.message);
  }
});

// PATCH /api/recordings/:id/visibility
router.patch("/:id/visibility", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");

    const rec = await getRecording(req.db).findOne({ _id: req.params.id, teacherId });
    if (!rec) return notFound(res, "Recording not found");

    rec.visibleToStudent = !rec.visibleToStudent;
    await rec.save();

    res.json({ success: true, visibleToStudent: rec.visibleToStudent });
  } catch (err) {
    serverError(res, err.message);
  }
});

// GET /api/recordings/:id/stream — stream with range support
router.get("/:id/stream", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const rec = await getRecording(req.db).findById(req.params.id);
    if (!rec) return notFound(res, "Recording not found");

    if (role === "teacher" && rec.teacherId.toString() !== userId)
      return forbidden(res, "Access denied");
    if (role === "student") {
      if (rec.studentId?.toString() !== userId || !rec.visibleToStudent)
        return forbidden(res, "Access denied");
    }

    // ── S3: redirect to a 1-hour presigned URL ────────────────────────────────
    if (useS3) {
      const { getPresignedUrl } = await import('../utils/s3.js');
      const url = await getPresignedUrl(rec.filename, 3600);
      return res.redirect(302, url);
    }

    // ── Local disk: range-request streaming ───────────────────────────────────
    const filePath = path.join(RECORDINGS_DIR, rec.filename);
    if (!fs.existsSync(filePath))
      return notFound(res, "File not found on disk");

    const stat     = fs.statSync(filePath);
    const fileSize = stat.size;
    const range    = req.headers.range;

    if (range) {
      const parts     = range.replace(/bytes=/, "").split("-");
      const start     = parseInt(parts[0], 10);
      const end       = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": chunkSize,
        "Content-Type":   rec.mimeType || "video/webm",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type":   rec.mimeType || "video/webm",
        "Accept-Ranges":  "bytes",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    logger.error("Recording stream error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// GET /api/recordings/:id/download — admin or the owning teacher
router.get("/:id/download", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    if (role !== "admin" && role !== "teacher") return forbidden(res, "Access denied");

    const rec = await getRecording(req.db).findById(req.params.id);
    if (!rec) return notFound(res, "Recording not found");
    if (role === "teacher" && rec.teacherId.toString() !== userId)
      return forbidden(res, "Access denied");

    const filename = `recording-${rec._id}${rec.mimeType === "video/mp4" ? ".mp4" : ".webm"}`;

    if (useS3) {
      const { getPresignedUrl } = await import('../utils/s3.js');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { s3 } = await import('../utils/s3.js');
      const cmd = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: rec.filename,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
      return res.redirect(302, url);
    }

    const filePath = path.join(RECORDINGS_DIR, rec.filename);
    if (!fs.existsSync(filePath)) return notFound(res, "File not found");

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", rec.mimeType || "video/webm");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    logger.error("Recording download error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// DELETE /api/recordings/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const rec = await getRecording(req.db).findById(req.params.id);
    if (!rec) return notFound(res, "Not found");

    if (role === "student")
      return forbidden(res, "Students cannot delete recordings");
    if (role === "teacher" && rec.teacherId.toString() !== userId)
      return forbidden(res, "Access denied");

    await purgeRecording(rec);
    res.json({ success: true, message: "Recording deleted" });
  } catch (err) {
    serverError(res, err.message);
  }
});

// Auto-delete scheduler — runs daily, purges expired recordings for a given center db
export function startRecordingCleanup(db) {
  const Recording = getRecording(db);
  const run = async () => {
    try {
      const expired = await Recording.find({ autoDeleteAt: { $lte: new Date() } });
      if (expired.length === 0) return;
      logger.info(`Auto-deleting ${expired.length} expired recording(s)...`);
      await Promise.all(expired.map(rec => purgeRecording(rec)));
      logger.info(`Deleted ${expired.length} recording(s)`);
    } catch (err) {
      logger.error("Recording cleanup error:", { error: err?.message });
    }
  };

  run();
  setInterval(run, 24 * 60 * 60 * 1000);
}

export default router;
