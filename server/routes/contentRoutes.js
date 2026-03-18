// server/routes/contentRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Upload directory ────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "content");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer config ───────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, _file, cb) => {
    // req.body is NOT yet populated during diskStorage filename callback for multipart
    // requests — multer hasn't finished parsing the body at this point.
    // Read bookingId from the query string instead (frontend appends it as ?bookingId=…).
    const bookingId = req.query.bookingId;
    if (!bookingId) return cb(new Error("bookingId required"));
    cb(null, `${bookingId}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

// ── POST /api/content/upload ────────────────────────────────────────────────
router.post("/upload", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    // bookingId is sent as a query param (req.body fields from FormData are only
    // available after multer finishes, but we already used req.query in the filename
    // callback — keep consistent by reading from query here too).
    const bookingId = req.query.bookingId || req.body.bookingId;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId required" });
    }

    console.log(`📄 PDF uploaded for booking ${bookingId}: ${req.file.filename}`);

    res.json({
      success: true,
      message: "PDF uploaded successfully",
      bookingId,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/content/info/:bookingId ────────────────────────────────────────
router.get("/info/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);

  if (!fs.existsSync(filePath)) {
    return res.json({ success: true, hasPdf: false });
  }

  const stat = fs.statSync(filePath);
  res.json({
    success: true,
    hasPdf: true,
    bookingId,
    size: stat.size,
    uploadedAt: stat.mtime,
  });
});

// ── GET /api/content/file/:bookingId ────────────────────────────────────────
router.get("/file/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "No PDF found for this booking" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  // Allow PDF.js in the browser to load this cross-origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath);
});

// ── DELETE /api/content/:bookingId ──────────────────────────────────────────
router.delete("/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true, message: "PDF deleted" });
});

export default router;
