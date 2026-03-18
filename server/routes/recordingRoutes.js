// server/routes/recordingRoutes.js
import express    from "express";
import multer     from "multer";
import path       from "path";
import fs         from "fs";
import { fileURLToPath } from "url";
import Recording  from "../models/Recording.js";
import Booking    from "../models/Booking.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RECORDINGS_DIR = path.join(__dirname, "../uploads/recordings");

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

// Auto-delete after this many days
const AUTO_DELETE_DAYS = 30;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RECORDINGS_DIR),
  filename:    (_req, file,  cb) => {
    const ext  = path.extname(file.originalname) || ".webm";
    const name = `rec_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/")) return cb(null, true);
    cb(new Error("Only video files are allowed"));
  },
});

const router = express.Router();

// ── Helper: delete file from disk + DB ───────────────────────────────────────
async function purgeRecording(rec) {
  const filePath = path.join(RECORDINGS_DIR, rec.filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
  await rec.deleteOne();
}

// ── POST /api/recordings/upload ───────────────────────────────────────────────
router.post("/upload", verifyToken, upload.single("recording"), async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });
    if (!req.file)          return res.status(400).json({ success: false, message: "No file uploaded" });

    const { bookingId, duration, title } = req.body;
    if (!bookingId) return res.status(400).json({ success: false, message: "bookingId is required" });

    const booking   = await Booking.findById(bookingId).select("studentId");
    const studentId = booking?.studentId || null;

    // Set auto-delete date
    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + AUTO_DELETE_DAYS);

    const rec = await Recording.create({
      bookingId,
      teacherId,
      studentId,
      title:    title?.trim() || "",
      filename: req.file.filename,
      duration: parseFloat(duration) || 0,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      autoDeleteAt,
    });

    res.status(201).json({ success: true, recording: rec });
  } catch (err) {
    console.error("Recording upload error:", err);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/recordings  —  list for current user ────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let filter = {};
    if      (role === "teacher") filter.teacherId = userId;
    else if (role === "student") { filter.studentId = userId; filter.visibleToStudent = true; }
    else if (role === "admin")   filter = {};
    else return res.status(403).json({ success: false, message: "Access denied" });

    const recordings = await Recording.find(filter)
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName surname")
      .sort({ createdAt: -1 });

    res.json({ success: true, recordings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/recordings/teacher/:teacherId  —  admin views one teacher's recordings
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "admin") return res.status(403).json({ success: false, message: "Admins only" });

    const recordings = await Recording.find({ teacherId: req.params.teacherId })
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName surname")
      .sort({ createdAt: -1 });

    res.json({ success: true, recordings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/recordings/:id/visibility  —  teacher toggles student visibility
router.patch("/:id/visibility", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const rec = await Recording.findOne({ _id: req.params.id, teacherId });
    if (!rec) return res.status(404).json({ success: false, message: "Recording not found" });

    rec.visibleToStudent = !rec.visibleToStudent;
    await rec.save();

    res.json({ success: true, visibleToStudent: rec.visibleToStudent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/recordings/:id/stream  —  stream with range support ──────────────
router.get("/:id/stream", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const rec = await Recording.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: "Recording not found" });

    // Access control
    if (role === "teacher" && rec.teacherId.toString() !== userId)
      return res.status(403).json({ success: false, message: "Access denied" });
    if (role === "student") {
      if (rec.studentId?.toString() !== userId || !rec.visibleToStudent)
        return res.status(403).json({ success: false, message: "Access denied" });
    }

    const filePath = path.join(RECORDINGS_DIR, rec.filename);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ success: false, message: "File not found on disk" });

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
    console.error("Recording stream error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/recordings/:id ────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const rec = await Recording.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: "Not found" });

    if (role === "student")
      return res.status(403).json({ success: false, message: "Students cannot delete recordings" });
    if (role === "teacher" && rec.teacherId.toString() !== userId)
      return res.status(403).json({ success: false, message: "Access denied" });

    await purgeRecording(rec);
    res.json({ success: true, message: "Recording deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Auto-delete scheduler — runs daily, purges expired recordings ─────────────
export function startRecordingCleanup() {
  const run = async () => {
    try {
      const expired = await Recording.find({ autoDeleteAt: { $lte: new Date() } });
      if (expired.length === 0) return;
      console.log(`🗑️  Auto-deleting ${expired.length} expired recording(s)…`);
      for (const rec of expired) await purgeRecording(rec);
      console.log(`✅ Deleted ${expired.length} recording(s)`);
    } catch (err) {
      console.error("Recording cleanup error:", err);
    }
  };

  run(); // run once on startup to catch any missed deletions
  setInterval(run, 24 * 60 * 60 * 1000); // then every 24 hours
}

export default router;
