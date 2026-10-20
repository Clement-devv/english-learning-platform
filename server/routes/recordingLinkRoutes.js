// server/routes/recordingLinkRoutes.js — mounted at /recording-links
// Parent links to class recordings. The logic lives in utils/recordingLinks.js.
//
// Staff (the class's teacher, or an admin)
//   GET   /class?bookingId= | ?groupClassId=   — the class's students and their links
//   POST  /class  { bookingId | groupClassId, studentId }  — get / create a student's link
//   PATCH /:id    { enabled }                  — switch a link off / on
//   POST  /:id/email                           — email it now (managed students with an address)
// Admin — automatic after-class emails to families (utils/familyEmailPrefs.js)
//   GET /settings                     — both center switches + how many families each reaches
//   PUT /settings  { recordingLinkEmails?, classSummaryEmails? }
//                                     — flips the center switch AND every managed student
// Public (the family — no login; never 401 so the app's auth redirect stays out of it)
//   POST /link/:token/unlock  { studentName, teacherName }
//   GET  /link/:token                 (X-Share-Access)
//   GET  /link/:token/stream/:recId?a= (local-disk storage only; S3 plays straight from S3)
import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { loginLimiter } from "../middleware/rateLimiter.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { recordingSchema } from "../schemas/recordingSchema.js";
import {
  resolveShareLink, checkUnlock, signLinkAccess, verifyLinkAccess, ACCESS_HEADER,
} from "../utils/shareLink.js";
import {
  getRecordingLink, loadCenterSettings, loadClass, getOrCreateLink, linkExpiry, linkVideos,
  emailLink, teacherShownName, localRecordingPath, localRecordingExists,
} from "../utils/recordingLinks.js";
import { toStr } from "../utils/inputSanitizer.js";
import { FAMILY_EMAIL_KINDS, prefCounts, setCenterPref } from "../utils/familyEmailPrefs.js";
import { sendVideoFile } from "../utils/videoFile.js";
import logger from "../utils/logger.js";
import { ok, badRequest, forbidden, notFound, serverError } from "../utils/apiResponse.js";

const router = express.Router();

// The local-disk video stream is opened by a <video> tag, which can't send the
// x-center-slug header — the address carries the center as ?c= instead. Registered
// before router.use(tenantMiddleware) below so it runs with the center filled in.
// (Safe: the ?a= access token is signed with that center's own secret.)
const centerFromQuery = (req, _res, next) => {
  if (!req.headers["x-center-slug"] && typeof req.query.c === "string" && /^[a-z0-9-]{1,63}$/.test(req.query.c)) {
    req.headers["x-center-slug"] = req.query.c;
  }
  next();
};
router.get("/link/:token/stream/:recId", centerFromQuery, tenantMiddleware, (req, res) => streamVideo(req, res));

router.use(tenantMiddleware);

const getStudent   = (db) => db.models.Student   || db.model("Student",   studentSchema);
const getTeacher   = (db) => db.models.Teacher   || db.model("Teacher",   teacherSchema);
const getRecording = (db) => db.models.Recording || db.model("Recording", recordingSchema);

// ── Staff ────────────────────────────────────────────────────────────────────

/** The class from ?bookingId / ?groupClassId (or the body), if this teacher / admin may manage it. */
async function staffClass(req, res, src) {
  const { role, id } = req.user || {};
  if (role !== "admin" && role !== "teacher") { forbidden(res, "Access denied"); return null; }
  const bookingId = src.bookingId || null, groupClassId = bookingId ? null : (src.groupClassId || null);
  if (!(bookingId || groupClassId) || !mongoose.isValidObjectId(bookingId || groupClassId)) { badRequest(res, "Choose a class"); return null; }
  const cls = await loadClass(req.db, { bookingId, groupClassId });
  if (!cls || (role === "teacher" && String(cls.teacherId) !== String(id))) { notFound(res, "Class not found"); return null; }
  return cls;
}

/** One row per student of the class. Teachers never see a managed student's private address. */
async function classRows(req, cls) {
  const isAdmin = req.user.role === "admin";
  const [students, links] = await Promise.all([
    getStudent(req.db).find({ _id: { $in: cls.studentIds } }).select("+notifyEmail firstName lastName isManaged").lean(),
    getRecordingLink(req.db).find({ ...(cls.bookingId ? { bookingId: cls.bookingId } : { groupClassId: cls.groupClassId }) })
      .select("+shareLink.tokenEnc").lean(),
  ]);
  const { decrypt } = await import("../utils/fieldEncryption.js");
  const byStudent = new Map(links.map((l) => [String(l.studentId), l]));
  return students.map((s) => {
    const l = byStudent.get(String(s._id));
    let token = null;
    try { token = l?.shareLink?.tokenEnc ? decrypt(l.shareLink.tokenEnc) : null; } catch { token = null; }
    return {
      studentId: s._id,
      studentName: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      isManaged: !!s.isManaged,
      hasEmail: !!(s.isManaged && s.notifyEmail),
      ...(isAdmin ? { email: s.isManaged ? s.notifyEmail || "" : "" } : {}),
      link: l ? {
        id: l._id, token, enabled: l.enabled !== false, emailedAt: l.emailedAt, emailedManual: !!l.emailedManual,
        ...(isAdmin ? { emailedTo: l.emailedTo } : {}),
      } : null,
    };
  });
}

async function classView(req, cls) {
  const [rows, settings, sample] = await Promise.all([
    classRows(req, cls), loadCenterSettings(req.db),
    getRecording(req.db).findOne(cls.bookingId ? { bookingId: cls.bookingId } : { groupClassId: cls.groupClassId }).select("_id").lean(),
  ]);
  const expiresAt = sample ? await linkExpiry(req.db, { ...cls, createdAt: new Date() }) : null;
  return { students: rows, expiresAt, hasVideo: !!sample, autoEmail: settings.recordingLinkEmails };
}

router.get("/class", verifyToken, async (req, res) => {
  try {
    const cls = await staffClass(req, res, req.query);
    if (!cls) return;
    ok(res, { data: await classView(req, cls) });
  } catch (err) {
    logger.error("Recording links: class", { error: err?.message });
    serverError(res, "Error loading parent links");
  }
});

router.post("/class", verifyToken, async (req, res) => {
  try {
    const cls = await staffClass(req, res, req.body || {});
    if (!cls) return;
    const studentId = req.body?.studentId;
    if (!mongoose.isValidObjectId(studentId) || !cls.studentIds.some((id) => String(id) === String(studentId))) {
      return badRequest(res, "This student isn't in the class");
    }
    if (!(await getRecording(req.db).exists(cls.bookingId ? { bookingId: cls.bookingId } : { groupClassId: cls.groupClassId }))) {
      return badRequest(res, "This class has no recording yet");
    }
    await getOrCreateLink(req.db, cls, studentId);
    ok(res, { data: await classView(req, cls) });
  } catch (err) {
    logger.error("Recording links: create", { error: err?.message });
    serverError(res, "Error creating the parent link");
  }
});

/** A link this teacher / admin may manage, with its class. */
async function staffLink(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) { badRequest(res, "Invalid link"); return null; }
  const link = await getRecordingLink(req.db).findById(req.params.id);
  if (!link) { notFound(res, "Link not found"); return null; }
  const cls = await staffClass(req, res, { bookingId: link.bookingId, groupClassId: link.groupClassId });
  if (!cls) return null;
  return { link, cls };
}

router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const found = await staffLink(req, res);
    if (!found) return;
    if (typeof req.body?.enabled !== "boolean") return badRequest(res, "enabled must be true or false");
    found.link.enabled = req.body.enabled;
    await found.link.save();
    ok(res, { data: await classView(req, found.cls), message: req.body.enabled ? "Link switched on" : "Link switched off" });
  } catch (err) {
    logger.error("Recording links: toggle", { error: err?.message });
    serverError(res, "Error updating the link");
  }
});

const EMAIL_RESULT = {
  sent: [200, "Email sent"],
  "no-email": [400, "This student has no notification email address"],
  off: [400, "Switch the link on first"],
  "no-video": [400, "There is no video to watch (it may have been deleted)"],
};

router.post("/:id/email", verifyToken, async (req, res) => {
  try {
    const found = await staffLink(req, res);
    if (!found) return;
    const result = await emailLink(req.db, req.center, found.cls, found.link.studentId, { force: true });
    const [status, message] = EMAIL_RESULT[result] || [400, "Email not sent"];
    if (status !== 200) return badRequest(res, message);
    ok(res, { data: await classView(req, found.cls), message });
  } catch (err) {
    logger.error("Recording links: email", { error: err?.message });
    serverError(res, "Error sending the email");
  }
});

/** Center switches + { withEmail, on } per kind (families with an address / with it switched on) */
async function settingsView(db) {
  const settings = await loadCenterSettings(db);
  const counts = {};
  for (const kind of FAMILY_EMAIL_KINDS) counts[kind] = await prefCounts(db, settings, kind);
  return { ...Object.fromEntries(FAMILY_EMAIL_KINDS.map((k) => [k, settings[k] !== false])), counts };
}

router.get("/settings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    ok(res, { data: await settingsView(req.db) });
  } catch (err) {
    logger.error("Recording links: load settings", { error: err?.message });
    serverError(res, "Error loading settings");
  }
});

router.put("/settings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const changes = FAMILY_EMAIL_KINDS.filter((k) => req.body?.[k] !== undefined);
    if (!changes.length || changes.some((k) => typeof req.body[k] !== "boolean")) {
      return badRequest(res, `Send ${FAMILY_EMAIL_KINDS.join(" or ")} as true or false`);
    }
    for (const kind of changes) await setCenterPref(req.db, kind, req.body[kind]);
    ok(res, { data: await settingsView(req.db), message: "Settings saved" });
  } catch (err) {
    logger.error("Recording links: save settings", { error: err?.message });
    serverError(res, "Error saving settings");
  }
});

// ── Public (the family) ──────────────────────────────────────────────────────
const LINK_UNAVAILABLE = "This link is invalid or has been replaced. Please ask the school for a new link.";
const FAR_FUTURE = () => new Date(8.64e15);

async function findByLink(req, res) {
  getStudent(req.db); getTeacher(req.db);
  // Expiry depends on the class's videos (async) — checked right after
  const r = await resolveShareLink(getRecordingLink(req.db), req.params.token, req.center, {
    select: "studentId teacherId bookingId groupClassId enabled createdAt", expiresAt: FAR_FUTURE,
  });
  if (r.status !== "ok") { notFound(res, LINK_UNAVAILABLE); return null; }
  const link = r.doc;
  const expiresAt = await linkExpiry(req.db, link);
  if (!link.enabled || !expiresAt || expiresAt <= new Date()) {
    res.status(410).json({
      success: false, expired: true,
      message: !link.enabled
        ? "The school has switched this video link off. Please contact the school if you need it."
        : "This class video is no longer available. Videos are kept for 30 days after the class.",
    });
    return null;
  }
  return { link, tokenHash: r.tokenHash, expiresAt };
}

async function requireAccess(req, res, accessToken = req.get(ACCESS_HEADER)) {
  const found = await findByLink(req, res);
  if (!found) return null;
  if (!verifyLinkAccess(req.center.slug, "recording", accessToken, found.link._id, found.tokenHash)) {
    forbidden(res, "Please confirm the names to open this page.");
    return null;
  }
  return found;
}

async function publicView(req, { link, expiresAt }, accessToken) {
  const cls = await loadClass(req.db, { bookingId: link.bookingId, groupClassId: link.groupClassId });
  return {
    studentName: link.studentId.firstName,
    teacherName: teacherShownName(link.teacherId),
    centerName: req.center?.centerName || "",
    classTitle: cls?.title || "",
    scheduledTime: cls?.scheduledTime || null,
    duration: cls?.duration || null,
    expiresAt,
    videos: await linkVideos(req.db, link, { token: req.params.token, accessToken, slug: req.center?.slug }),
  };
}

router.post("/link/:token/unlock", loginLimiter, async (req, res) => {
  try {
    const found = await findByLink(req, res);
    if (!found) return;
    const check = await checkUnlock(getRecordingLink(req.db), found.link,
      toStr(req.body.studentName, "studentName", { maxLen: 100 }),
      toStr(req.body.teacherName, "teacherName", { maxLen: 100 }));
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
    const accessToken = signLinkAccess(req.center.slug, "recording", found.link._id, found.tokenHash, found.expiresAt);
    res.json({ success: true, accessToken, video: await publicView(req, found, accessToken) });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Recording link unlock error:", { error: err?.message });
    serverError(res);
  }
});

router.get("/link/:token", async (req, res) => {
  try {
    const accessToken = req.get(ACCESS_HEADER);
    const found = await requireAccess(req, res, accessToken);
    if (!found) return;
    res.json({ success: true, video: await publicView(req, found, accessToken) });
  } catch (err) {
    logger.error("Recording link view error:", { error: err?.message });
    serverError(res);
  }
});

// Local-disk storage only. <video> can't send headers, so the access token comes as ?a=
// (and the center as ?c= — see centerFromQuery at the top)
async function streamVideo(req, res) {
  try {
    const found = await requireAccess(req, res, String(req.query.a || ""));
    if (!found) return;
    const { link } = found;
    if (!mongoose.isValidObjectId(req.params.recId)) return notFound(res, "Video not found");
    const rec = await getRecording(req.db).findOne({
      _id: req.params.recId, source: { $ne: "external" },
      ...(link.bookingId ? { bookingId: link.bookingId } : { groupClassId: link.groupClassId }),
    }).select("filename mimeType").lean();
    if (!rec || !localRecordingExists(rec.filename)) return notFound(res, "Video not found");

    sendVideoFile(req, res, localRecordingPath(rec.filename), rec.mimeType || "video/webm");
  } catch (err) {
    logger.error("Recording link stream error:", { error: err?.message });
    if (!res.headersSent) serverError(res);
  }
}

export default router;
