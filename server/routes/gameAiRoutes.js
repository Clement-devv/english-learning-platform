// server/routes/gameAiRoutes.js
// Word Squad questions from book pages (mounted at /api/v1/games/ai), for
// teachers and admins:
//   GET    /credits              the center's AI credit balance
//   GET    /uploads              my uploaded pages (each deletes itself after 30 days)
//   POST   /uploads              { files: [{ name, mime, size }] } → where to upload each one
//   PUT    /uploads/:id/file     (local storage only) the file itself
//   POST   /uploads/:id/done     the browser finished uploading to S3
//   DELETE /uploads/:id          delete a page now
//   GET    /jobs                 my recent AI jobs
//   POST   /jobs                 { sourceIds, title, level, wantedCount, focus } → queued
// With S3 the browser uploads straight to a private key (presigned PUT); the
// server never holds the file in memory. The AI work runs in the background
// (utils/questionJobs.js) and ends as a draft set the teacher reviews.
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { questionSourceSchema, SOURCE_TTL_DAYS } from "../schemas/questionSourceSchema.js";
import { questionJobSchema } from "../schemas/questionJobSchema.js";
import { getPresignedPutUrl, s3ObjectExists } from "../utils/s3.js";
import { sourceKey, storageKind, saveLocal, localExists, removeSourceFile } from "../utils/questionSources.js";
import { getAiBalance, estimateCredits } from "../utils/aiCredits.js";
import { LEVELS } from "../utils/questionRules.js";
import { ok, created, badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";
import { toStr, toInt } from "../utils/inputSanitizer.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);
const staff = [verifyToken, verifyAdminOrTeacher];

const getSource = (db) => db.models.QuestionSource || db.model("QuestionSource", questionSourceSchema);
const getJob    = (db) => db.models.QuestionJob    || db.model("QuestionJob", questionJobSchema);

export const UPLOAD_LIMITS = { pdfBytes: 15 * 1024 * 1024, imageBytes: 1.5 * 1024 * 1024, images: 10, perJob: 10, stored: 40, jobsPerHour: 5 };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const who = (req) => (req.admin ? { role: "admin", id: req.admin._id || null } : { role: "teacher", id: req.teacher._id });
const mine = (req) => (req.admin ? {} : { "createdBy.id": req.teacher._id });
const fail = (res, err, what) => {
  if (err?.statusCode === 400) return badRequest(res, err.message);
  logger.error(`Word Squad AI ${what} failed`, { error: err?.message });
  return serverError(res, undefined, err);
};
const publicSource = (s) => ({ id: s._id, name: s.name, mime: s.mime, size: s.size, status: s.status, createdAt: s.createdAt, expiresAt: s.expiresAt });
const publicJob = (j) => ({
  id: j._id, title: j.title, level: j.level, wantedCount: j.wantedCount, focus: j.focus, status: j.status,
  made: j.made, setId: j.setId, creditsUsed: j.creditsUsed, error: j.error, createdAt: j.createdAt, finishedAt: j.finishedAt,
  pages: (j.sourceIds || []).length,
});

router.get("/credits", ...staff, async (req, res) => {
  try {
    return ok(res, { data: { balance: await getAiBalance(req.center.slug), enabled: !!process.env.ANTHROPIC_API_KEY } });
  } catch (err) { return fail(res, err, "credits"); }
});

// ── Uploads ─────────────────────────────────────────────────────────────────
router.get("/uploads", ...staff, async (req, res) => {
  try {
    const list = await getSource(req.db).find({ ...mine(req), status: "ready", expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(100).lean();
    return ok(res, { data: list.map(publicSource) });
  } catch (err) { return fail(res, err, "list uploads"); }
});

router.post("/uploads", ...staff, async (req, res) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) return badRequest(res, "Choose a PDF or some photos of the pages");
    if (files.length > UPLOAD_LIMITS.images) return badRequest(res, `Upload at most ${UPLOAD_LIMITS.images} files at a time`);
    const clean = files.map((f) => ({
      name: toStr(f?.name, "name", { maxLen: 140, required: true }),
      mime: String(f?.mime || ""),
      size: Number(f?.size) || 0,
    }));
    for (const f of clean) {
      if (f.mime === "application/pdf") {
        if (f.size > UPLOAD_LIMITS.pdfBytes) return badRequest(res, "A PDF can be at most 15 MB (about 20 pages)");
      } else if (IMAGE_TYPES.includes(f.mime)) {
        if (f.size > UPLOAD_LIMITS.imageBytes) return badRequest(res, "Each photo must be under 1.5 MB");
      } else return badRequest(res, "Only PDF files and photos (JPG, PNG, WebP) can be uploaded");
      if (f.size < 1) return badRequest(res, "That file is empty");
    }
    const stored = await getSource(req.db).countDocuments({ ...mine(req), expiresAt: { $gt: new Date() } });
    if (stored + clean.length > UPLOAD_LIMITS.stored) return conflict(res, `You can keep ${UPLOAD_LIMITS.stored} uploaded pages at a time — delete some first`);

    const kind = storageKind();
    const out = [];
    for (const f of clean) {
      const src = new (getSource(req.db))({
        createdBy: who(req), name: f.name, mime: f.mime, size: f.size, storage: kind, status: "pending",
        expiresAt: new Date(Date.now() + SOURCE_TTL_DAYS * 86400000),
        key: "pending",
      });
      src.key = sourceKey(req.center.slug, src._id, f.mime);
      await src.save();
      out.push({
        id: src._id,
        mime: f.mime,
        // S3: PUT straight to S3 with this Content-Type. Local: PUT to our own endpoint (with the login).
        upload: kind === "s3"
          ? { url: await getPresignedPutUrl(src.key, f.mime), local: false }
          : { url: `/games/ai/uploads/${src._id}/file`, local: true },
      });
    }
    return created(res, { data: out });
  } catch (err) { return fail(res, err, "start upload"); }
});

// Local storage only (no S3): the file comes to us. Production uses S3 above.
router.put("/uploads/:id/file", validateObjectId("id"), ...staff,
  express.raw({ type: () => true, limit: UPLOAD_LIMITS.pdfBytes + 1024 }),
  async (req, res) => {
    try {
      const src = await getSource(req.db).findOne({ _id: req.params.id, ...mine(req) });
      if (!src) return notFound(res, "Upload not found");
      if (src.storage !== "local") return badRequest(res, "Upload this file to S3");
      const buf = Buffer.isBuffer(req.body) ? req.body : null;
      if (!buf?.length) return badRequest(res, "No file received");
      if (buf.length > src.size + 1024) return badRequest(res, "The file is bigger than announced");
      await saveLocal(src.key, buf);
      src.status = "ready";
      await src.save();
      return ok(res, { data: publicSource(src) });
    } catch (err) { return fail(res, err, "save upload"); }
  });

router.post("/uploads/:id/done", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const src = await getSource(req.db).findOne({ _id: req.params.id, ...mine(req) });
    if (!src) return notFound(res, "Upload not found");
    const there = src.storage === "s3" ? await s3ObjectExists(src.key) : await localExists(src.key);
    if (!there) return badRequest(res, "The upload didn't finish — try again");
    src.status = "ready";
    await src.save();
    return ok(res, { data: publicSource(src) });
  } catch (err) { return fail(res, err, "finish upload"); }
});

router.delete("/uploads/:id", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const src = await getSource(req.db).findOne({ _id: req.params.id, ...mine(req) }).lean();
    if (!src) return notFound(res, "Upload not found");
    await removeSourceFile(src);
    await getSource(req.db).deleteOne({ _id: src._id });
    return ok(res, { message: "Deleted" });
  } catch (err) { return fail(res, err, "delete upload"); }
});

// ── Jobs ────────────────────────────────────────────────────────────────────
router.get("/jobs", ...staff, async (req, res) => {
  try {
    const list = await getJob(req.db).find(mine(req)).sort({ createdAt: -1 }).limit(20).lean();
    return ok(res, { data: list.map(publicJob) });
  } catch (err) { return fail(res, err, "list jobs"); }
});

router.post("/jobs", ...staff, async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ success: false, message: "AI isn't set up on this server yet" });
    const b = req.body || {};
    const title = toStr(b.title, "title", { maxLen: 120, required: true });
    const level = LEVELS.includes(b.level) ? b.level : "A1";
    const focus = ["grammar", "vocabulary", "both"].includes(b.focus) ? b.focus : "both";
    const wantedCount = toInt(b.wantedCount, "wantedCount", { min: 10, max: 30, default: 15 });
    const ids = [...new Set((Array.isArray(b.sourceIds) ? b.sourceIds : []).map(String))];
    if (!ids.length) return badRequest(res, "Choose the pages to make questions from");
    if (ids.length > UPLOAD_LIMITS.perJob) return badRequest(res, `Use at most ${UPLOAD_LIMITS.perJob} files in one go`);

    const sources = await getSource(req.db).find({ _id: { $in: ids }, ...mine(req), status: "ready", expiresAt: { $gt: new Date() } }).lean();
    if (sources.length !== ids.length) return forbidden(res, "Some of those pages aren't yours or were deleted");

    // 5 AI jobs per teacher per hour
    const lastHour = await getJob(req.db).countDocuments({ "createdBy.id": who(req).id, createdAt: { $gt: new Date(Date.now() - 3600000) } });
    if (lastHour >= UPLOAD_LIMITS.jobsPerHour) return res.status(429).json({ success: false, message: "That's 5 AI jobs this hour — please wait a little before the next one" });

    // Check the center's AI credits against an estimate first
    const estimate = estimateCredits(sources);
    const balance = await getAiBalance(req.center.slug);
    if (balance < estimate) {
      return res.status(402).json({ success: false, message: `Not enough AI credits: this needs about ${estimate}, your center has ${balance}. Ask your admin to top up.`, estimate, balance });
    }

    const job = await getJob(req.db).create({ createdBy: who(req), sourceIds: sources.map((s) => s._id), title, level, focus, wantedCount, estimate });
    return created(res, { data: publicJob(job), message: "Making your questions — this takes about a minute" });
  } catch (err) { return fail(res, err, "start job"); }
});

export default router;
