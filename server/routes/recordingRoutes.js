// server/routes/recordingRoutes.js
import express    from "express";
import mongoose   from "mongoose";
import multer     from "multer";
import path       from "path";
import fs         from "fs";
import { fileURLToPath } from "url";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { recordingSchema }  from "../schemas/recordingSchema.js";
import { bookingSchema }    from "../schemas/bookingSchema.js";
import { studentSchema }    from "../schemas/studentSchema.js";
import { readPaging, pageMeta, oid } from "../utils/paging.js";
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
  if (rec.source === 'external' || !rec.filename) {
    // Only a saved link — no file of ours to remove
  } else if (useS3) {
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

// Remove an uploaded file that we decided not to keep (error or duplicate part)
async function discardUploadedFile(file) {
  if (!file) return;
  if (useS3 && file.key) {
    const { deleteFromS3 } = await import('../utils/s3.js');
    deleteFromS3(file.key).catch(() => {});
  } else if (file.path) {
    fs.unlink(file.path, () => {});
  }
}

const SESSION_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ── External recording links ─────────────────────────────────────────────────
// A teacher who recorded in Zoom / Google Meet directly saves the share link
// against the class, so admins can open it to confirm the class happened.

const CLASSES_FOR_LINK_DAYS = 90;

// Only plain web links — never javascript:, data:, file: etc.
function cleanExternalUrl(raw) {
  const value = String(raw || "").trim();
  if (!value || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

const populateRecording = (query) => query
  .populate("bookingId", "classTitle scheduledTime")
  .populate("teacherId", "firstName lastName")
  .populate("studentId", "firstName lastName");

// GET /api/recordings/classes-for-link — the teacher's recent classes to attach a link to
router.get("/classes-for-link", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");

    const since = new Date(Date.now() - CLASSES_FOR_LINK_DAYS * 24 * 60 * 60 * 1000);
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000); // allow today's upcoming class
    const classes = await getBooking(req.db).find({
      teacherId,
      scheduledTime: { $gte: since, $lte: until },
      status: { $nin: ["rejected", "cancelled"] },
    })
      .select("classTitle scheduledTime duration status studentId")
      .populate("studentId", "firstName lastName")
      .sort({ scheduledTime: -1 })
      .limit(300)
      .lean();

    res.json({ success: true, data: classes });
  } catch (err) {
    serverError(res, err.message);
  }
});

// POST /api/recordings/external — save a recording link for one of my classes
router.post("/external", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");

    const { bookingId, url, note, durationMinutes } = req.body || {};
    if (!mongoose.isValidObjectId(bookingId)) return badRequest(res, "Please choose a class");
    const externalUrl = cleanExternalUrl(url);
    if (!externalUrl) return badRequest(res, "Please paste a valid link starting with https://");

    const booking = await getBooking(req.db).findOne({ _id: bookingId, teacherId }).select("studentId classTitle");
    if (!booking) return notFound(res, "Class not found");

    const Recording = getRecording(req.db);
    const duplicate = await Recording.findOne({ bookingId, teacherId, source: "external", externalUrl });
    if (duplicate) return conflict(res, "This link is already saved for this class");

    const classmate = await Recording.findOne({ bookingId, teacherId }).sort({ createdAt: 1 }).select("visibleToStudent");
    const minutes   = Math.min(Math.max(parseFloat(durationMinutes) || 0, 0), 600);

    const rec = await Recording.create({
      bookingId, teacherId,
      studentId:        booking.studentId || null,
      source:           "external",
      externalUrl,
      note:             String(note || "").trim().slice(0, 500),
      duration:         Math.round(minutes * 60),
      mimeType:         "",
      visibleToStudent: classmate?.visibleToStudent || false,
      // No autoDeleteAt: it is only a link, and admins may need it as proof later
    });

    const saved = await populateRecording(Recording.findById(rec._id)).lean();
    res.status(201).json({ success: true, recording: saved, message: "Recording link saved" });
  } catch (err) {
    logger.error("External recording error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// PATCH /api/recordings/:id/external — fix the link or note
router.patch("/:id/external", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid id");

    const rec = await getRecording(req.db).findOne({ _id: req.params.id, teacherId, source: "external" });
    if (!rec) return notFound(res, "Recording link not found");

    if (req.body?.url !== undefined) {
      const externalUrl = cleanExternalUrl(req.body.url);
      if (!externalUrl) return badRequest(res, "Please paste a valid link starting with https://");
      rec.externalUrl = externalUrl;
    }
    if (req.body?.note !== undefined) rec.note = String(req.body.note || "").trim().slice(0, 500);
    if (req.body?.durationMinutes !== undefined) {
      rec.duration = Math.round(Math.min(Math.max(parseFloat(req.body.durationMinutes) || 0, 0), 600) * 60);
    }
    await rec.save();

    const saved = await populateRecording(getRecording(req.db).findById(rec._id)).lean();
    res.json({ success: true, recording: saved, message: "Recording link updated" });
  } catch (err) {
    serverError(res, err.message);
  }
});

// POST /api/recordings/upload
// Accepts a whole recording or one part of a split recording
// (sessionId + partNumber + startOffset). Re-uploading a part that is already
// saved returns the existing record, so client retries are safe.
router.post("/upload", verifyToken, wrapUpload(upload.single("recording")), async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") { await discardUploadedFile(req.file); return forbidden(res, "Teachers only"); }
    if (!req.file)          return badRequest(res, "No file uploaded");

    const { bookingId, duration, title } = req.body;
    if (!bookingId) { await discardUploadedFile(req.file); return badRequest(res, "bookingId is required"); }

    const sessionId   = req.body.sessionId ? String(req.body.sessionId) : null;
    const partNumber  = parseInt(req.body.partNumber, 10) || 1;
    const startOffset = parseFloat(req.body.startOffset) || 0;
    if (sessionId && !SESSION_ID_RE.test(sessionId)) {
      await discardUploadedFile(req.file);
      return badRequest(res, "Invalid sessionId");
    }
    if (partNumber < 1 || partNumber > 1000) {
      await discardUploadedFile(req.file);
      return badRequest(res, "Invalid partNumber");
    }

    const Recording = getRecording(req.db);

    // Parts already saved for this session (same teacher only)
    let sibling = null;
    if (sessionId) {
      const existing = await Recording.findOne({ sessionId, teacherId, partNumber });
      if (existing) {
        // Retry of a part that was already saved — keep the first copy
        await discardUploadedFile(req.file);
        return res.status(200).json({ success: true, recording: existing, duplicate: true });
      }
      sibling = await Recording.findOne({ sessionId, teacherId }).sort({ partNumber: 1 })
        .select("autoDeleteAt visibleToStudent");
    }
    // Any earlier video from the same class sets the visibility for new ones
    const classmate = await Recording.findOne({ bookingId, teacherId }).sort({ createdAt: 1 })
      .select("visibleToStudent");

    const booking   = await getBooking(req.db).findById(bookingId).select("studentId");
    const studentId = booking?.studentId || null;

    // All parts of one class share the same expiry and visibility
    let autoDeleteAt = sibling?.autoDeleteAt;
    if (!autoDeleteAt) {
      autoDeleteAt = new Date();
      autoDeleteAt.setDate(autoDeleteAt.getDate() + AUTO_DELETE_DAYS);
    }

    // multer-s3 sets req.file.key; multer disk sets req.file.filename
    const filename = req.file.key || req.file.filename;
    if (!filename) return serverError(res, "File storage error — no filename assigned");

    const rec = await Recording.create({
      bookingId, teacherId, studentId,
      title:    title?.trim() || "",
      filename,
      duration: parseFloat(duration) || 0,
      fileSize: req.file.size || 0,
      mimeType: (req.file.mimetype || "video/webm").split(";")[0].trim(),
      autoDeleteAt,
      visibleToStudent: classmate?.visibleToStudent || sibling?.visibleToStudent || false,
      ...(sessionId ? { sessionId, partNumber, startOffset } : {}),
    });

    res.status(201).json({ success: true, recording: rec });
  } catch (err) {
    logger.error("Recording upload error:", { error: err?.message });
    await discardUploadedFile(req.file);
    serverError(res, err.message, err);
  }
});

// ── Listing ──────────────────────────────────────────────────────────────────
// Recordings are paged by CLASS: every part of a class (split recordings, or
// Record pressed twice) always lands on the same page.
const LEGACY_MAX = 500;
const UNASSIGNED = "__unassigned__";
const classKey = { $ifNull: ["$bookingId", { $ifNull: ["$sessionId", "$_id"] }] };
const getStudentModel = (db) => db.models.Student || db.model("Student", studentSchema);

/** Who can see what: teacher → own, student → own + shared, admin → all (or ?teacherId). */
function scopeFor(req) {
  const { role, id } = req.user;
  if (role === "teacher") return { teacherId: oid(id) };
  if (role === "student") return { studentId: oid(id), visibleToStudent: true };
  if (role === "admin") {
    const t = req.query.teacherId;
    if (t && !mongoose.isValidObjectId(t)) return null;
    return t ? { teacherId: oid(t) } : {};
  }
  return null;
}
/** ?studentId= (teacher/admin only); "__unassigned__" = recordings with no student. */
function withStudent(req, filter) {
  const sid = req.query.studentId;
  if (!sid || req.user.role === "student") return filter;
  if (sid === UNASSIGNED) return { ...filter, studentId: null };
  if (!mongoose.isValidObjectId(sid)) return null;
  return { ...filter, studentId: oid(sid) };
}
const populateList = (q) => q
  .populate("bookingId", "classTitle scheduledTime")
  .populate("teacherId", "firstName lastName")
  .populate("studentId", "firstName lastName email")
  .sort({ createdAt: -1 })
  .lean();

async function listRecordings(req, res, scope) {
  const filter = withStudent(req, scope);
  if (!filter) return badRequest(res, "Invalid filter");
  const Recording = getRecording(req.db);

  // Old clients (no ?page): everything, but never unbounded
  if (req.query.page === undefined) {
    const recordings = await populateList(Recording.find(filter)).then(r => r.slice(0, LEGACY_MAX));
    return res.json({ success: true, recordings });
  }

  const { page: want, limit } = readPaging(req.query, { defaultLimit: 10, maxLimit: 30 });
  const [agg] = await Recording.aggregate([
    { $match: filter },
    { $group: { _id: classKey, bookingId: { $first: "$bookingId" }, firstAt: { $min: "$createdAt" } } },
    { $lookup: { from: getBooking(req.db).collection.name, localField: "bookingId", foreignField: "_id", as: "b",
                 pipeline: [{ $project: { scheduledTime: 1 } }] } },
    { $addFields: { classDate: { $ifNull: [{ $arrayElemAt: ["$b.scheduledTime", 0] }, "$firstAt"] } } },
    { $sort: { classDate: -1, _id: -1 } },
    { $facet: { keys: [{ $skip: (Math.max(want, 1) - 1) * limit }, { $limit: limit }, { $project: { _id: 1 } }], total: [{ $count: "n" }] } },
  ]);
  const total = agg?.total?.[0]?.n || 0;
  const pagination = pageMeta(want, limit, total);
  const keys = (agg?.keys || []).map(k => k._id);
  const recordings = keys.length
    ? await populateList(Recording.find({ ...filter, $or: [
        { bookingId: { $in: keys.filter(k => k instanceof mongoose.Types.ObjectId) } },
        { sessionId: { $in: keys.filter(k => typeof k === "string") } },
        { _id: { $in: keys.filter(k => k instanceof mongoose.Types.ObjectId) } },
      ] }))
    : [];
  res.json({ success: true, recordings, pagination });
}

// GET /api/recordings/students — per-student summary (teacher: own; admin: ?teacherId=)
// [{ id, name, email, count (classes), links (saved links), latest }] most recent first
router.get("/students", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) return forbidden(res, "Access denied");
    const scope = scopeFor(req);
    if (!scope) return badRequest(res, "Invalid filter");
    const rows = await getRecording(req.db).aggregate([
      { $match: scope },
      { $group: { _id: { s: "$studentId", k: classKey }, latest: { $max: "$createdAt" },
                  links: { $sum: { $cond: [{ $eq: ["$source", "external"] }, 1, 0] } } } },
      { $group: { _id: "$_id.s", count: { $sum: 1 }, latest: { $max: "$latest" }, links: { $sum: "$links" } } },
      { $lookup: { from: getStudentModel(req.db).collection.name, localField: "_id", foreignField: "_id", as: "st",
                   pipeline: [{ $project: { firstName: 1, lastName: 1, email: 1 } }] } },
      { $sort: { latest: -1 } },
    ]);
    const students = rows.map(r => {
      const st = r.st?.[0];
      return {
        id: r._id ? String(r._id) : UNASSIGNED,
        name: r._id ? (st ? `${st.firstName || ""} ${st.lastName || ""}`.trim() || "Unknown" : "Unknown") : "Unassigned",
        email: st?.email || "",
        count: r.count,
        links: r.links,
        latest: r.latest ? new Date(r.latest).getTime() : 0,
      };
    });
    res.json({ success: true, students });
  } catch (err) {
    serverError(res, err.message);
  }
});

// GET /api/recordings — list for current user
//   ?page=&limit= (classes per page)  ?studentId= (teacher/admin)  ?teacherId= (admin)
router.get("/", verifyToken, async (req, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) return req.user.role === "admin" ? badRequest(res, "Invalid filter") : forbidden(res, "Access denied");
    await listRecordings(req, res, scope);
  } catch (err) {
    serverError(res, err.message);
  }
});

// GET /api/recordings/teacher/:teacherId — admin views one teacher's recordings
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admins only");
    if (!mongoose.isValidObjectId(req.params.teacherId)) return badRequest(res, "Invalid teacher");
    await listRecordings(req, res, { teacherId: oid(req.params.teacherId) });
  } catch (err) {
    serverError(res, err.message);
  }
});

// PATCH /api/recordings/:id/visibility
// For split recordings the toggle applies to every part of the class.
router.patch("/:id/visibility", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");

    const Recording = getRecording(req.db);
    const rec = await Recording.findOne({ _id: req.params.id, teacherId });
    if (!rec) return notFound(res, "Recording not found");

    const visibleToStudent = !rec.visibleToStudent;
    if (rec.sessionId) {
      await Recording.updateMany({ sessionId: rec.sessionId, teacherId }, { $set: { visibleToStudent } });
    } else {
      rec.visibleToStudent = visibleToStudent;
      await rec.save();
    }

    res.json({ success: true, visibleToStudent, sessionId: rec.sessionId || null });
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

    // Recorded elsewhere — hand back the saved link
    if (rec.source === "external") return res.json({ url: rec.externalUrl, external: true });

    // ── S3: return presigned URL as JSON so the browser uses it directly ─────
    // (A redirect causes a cross-origin preflight to S3 which CORS can't satisfy)
    if (useS3) {
      const { getPresignedUrl } = await import('../utils/s3.js');
      const url = await getPresignedUrl(rec.filename, 3600);
      return res.json({ url });
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

    if (rec.source === "external") return res.json({ url: rec.externalUrl, external: true });

    const filename = `recording-${rec._id}${rec.mimeType === "video/mp4" ? ".mp4" : ".webm"}`;

    if (useS3) {
      const { s3 } = await import('../utils/s3.js');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const cmd = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: rec.filename,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
      return res.json({ url });
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

// PATCH /api/recordings/booking/:bookingId/visibility — show/hide every video of a class
router.patch("/booking/:bookingId/visibility", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return forbidden(res, "Teachers only");
    if (!mongoose.isValidObjectId(req.params.bookingId)) return badRequest(res, "Invalid bookingId");
    if (typeof req.body?.visibleToStudent !== "boolean") return badRequest(res, "visibleToStudent must be true or false");

    const { visibleToStudent } = req.body;
    const result = await getRecording(req.db).updateMany(
      { bookingId: req.params.bookingId, teacherId },
      { $set: { visibleToStudent } },
    );
    if (result.matchedCount === 0) return notFound(res, "Recording not found");

    res.json({ success: true, visibleToStudent });
  } catch (err) {
    serverError(res, err.message);
  }
});

// DELETE /api/recordings/booking/:bookingId — delete every video of a class
router.delete("/booking/:bookingId", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    if (role !== "teacher" && role !== "admin") return forbidden(res, "Access denied");
    if (!mongoose.isValidObjectId(req.params.bookingId)) return badRequest(res, "Invalid bookingId");

    const filter = { bookingId: req.params.bookingId };
    if (role === "teacher") filter.teacherId = userId;

    const parts = await getRecording(req.db).find(filter);
    if (parts.length === 0) return notFound(res, "Not found");

    await Promise.all(parts.map(rec => purgeRecording(rec)));
    res.json({ success: true, message: `Deleted ${parts.length} video${parts.length !== 1 ? "s" : ""}` });
  } catch (err) {
    serverError(res, err.message);
  }
});

// DELETE /api/recordings/session/:sessionId — delete every part of a recording session
router.delete("/session/:sessionId", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    if (role !== "teacher" && role !== "admin") return forbidden(res, "Access denied");
    if (!SESSION_ID_RE.test(req.params.sessionId)) return badRequest(res, "Invalid sessionId");

    const filter = { sessionId: req.params.sessionId };
    if (role === "teacher") filter.teacherId = userId;

    const parts = await getRecording(req.db).find(filter);
    if (parts.length === 0) return notFound(res, "Not found");

    await Promise.all(parts.map(rec => purgeRecording(rec)));
    res.json({ success: true, message: `Deleted ${parts.length} part${parts.length !== 1 ? "s" : ""}` });
  } catch (err) {
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
