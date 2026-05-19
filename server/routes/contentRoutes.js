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
import { s3Enabled, uploadToS3, deleteFromS3, getPresignedUrl, s3ObjectExists } from "../utils/s3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const router = express.Router();

// ── Legacy local upload directory (still used when S3 is not configured) ────
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "content");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer — memory storage so we can forward the buffer to S3 ──────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});

function s3Key(slug, bookingId) {
  return `centers/${slug}/content/${bookingId}.pdf`;
}

// ── POST /api/content/upload — teachers and admins only ─────────────────────
router.post("/upload", tenantMiddleware, verifyToken, verifyAdminOrTeacher, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return badRequest(res, "No file uploaded");

    const bookingId = req.query.bookingId || req.body.bookingId;
    if (!bookingId) return badRequest(res, "bookingId required");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) return badRequest(res, "Invalid bookingId format");

    if (s3Enabled()) {
      const key = s3Key(req.center.slug, bookingId);
      await uploadToS3(req.file.buffer, key, "application/pdf");
    } else {
      // Fallback: write to local disk
      const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);
      fs.writeFileSync(filePath, req.file.buffer);
    }

    res.json({ success: true, message: "PDF uploaded successfully", bookingId, size: req.file.size });
  } catch (err) {
    logger.error("Upload error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// ── GET /api/content/info/:bookingId ────────────────────────────────────────
router.get("/info/:bookingId", tenantMiddleware, verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) return badRequest(res, "Invalid bookingId");

  if (s3Enabled()) {
    const exists = await s3ObjectExists(s3Key(req.center.slug, bookingId));
    return res.json({ success: true, hasPdf: exists, bookingId });
  }

  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);
  if (!fs.existsSync(filePath)) return res.json({ success: true, hasPdf: false });
  const stat = fs.statSync(filePath);
  res.json({ success: true, hasPdf: true, bookingId, size: stat.size, uploadedAt: stat.mtime });
});

// ── GET /api/content/file/:bookingId — redirect to presigned URL ─────────────
router.get("/file/:bookingId", tenantMiddleware, verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) return badRequest(res, "Invalid bookingId");

  if (s3Enabled()) {
    const key = s3Key(req.center.slug, bookingId);
    const exists = await s3ObjectExists(key);
    if (!exists) return notFound(res, "No PDF found for this booking");
    const url = await getPresignedUrl(key, 3600);
    return res.redirect(302, url);
  }

  // Legacy local file
  const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);
  if (!fs.existsSync(filePath)) return notFound(res, "No PDF found for this booking");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline");
  res.sendFile(filePath);
});

// ── DELETE /api/content/:bookingId ───────────────────────────────────────────
router.delete("/:bookingId", tenantMiddleware, verifyToken, verifyAdminOrTeacher, async (req, res) => {
  const { bookingId } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(bookingId)) return badRequest(res, "Invalid bookingId");

  if (s3Enabled()) {
    await deleteFromS3(s3Key(req.center.slug, bookingId));
  } else {
    const filePath = path.join(UPLOAD_DIR, `${bookingId}.pdf`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ success: true, message: "PDF deleted" });
});

export default router;
