// server/routes/contentRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

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
    const bookingId = req.query.bookingId;
    if (!bookingId) return cb(new Error("bookingId required"));
    // Sanitise: only allow alphanumeric and hyphen/underscore characters in the ID
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) {
      return cb(new Error("Invalid bookingId format"));
    }
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

// ── POST /api/content/upload — teachers and admins only ─────────────────────
router.post("/upload", tenantMiddleware, verifyToken, verifyAdminOrTeacher, upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) {
      return badRequest(res, "No file uploaded");
    }
    const bookingId = req.query.bookingId || req.body.bookingId;
    if (!bookingId) {
      return badRequest(res, "bookingId required");
    }

    res.json({
      success: true,
      message: "PDF uploaded successfully",
      bookingId,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (err) {
    logger.error("Upload error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// ── GET /api/content/info/:bookingId — authenticated users only ─────────────
router.get("/info/:bookingId", tenantMiddleware, verifyToken, (req, res) => {
  const { bookingId } = req.params;

  // Prevent path traversal
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) {
    return badRequest(res, "Invalid bookingId");
  }

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

// ── GET /api/content/file/:bookingId — authenticated users only ─────────────
router.get("/file/:bookingId", tenantMiddleware, verifyToken, (req, res) => {
  const { bookingId } = req.params;

  // Prevent path traversal
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) {
    return badRequest(res, "Invalid bookingId");
  }

  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);

  if (!fs.existsSync(filePath)) {
    return notFound(res, "No PDF found for this booking");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
});

// ── DELETE /api/content/:bookingId — teachers and admins only ───────────────
router.delete("/:bookingId", tenantMiddleware, verifyToken, verifyAdminOrTeacher, (req, res) => {
  const { bookingId } = req.params;

  // Prevent path traversal
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) {
    return badRequest(res, "Invalid bookingId");
  }

  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true, message: "PDF deleted" });
});

export default router;
