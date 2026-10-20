// server/utils/recordingLinks.js
// Parent links to class recordings (routes/recordingLinkRoutes.js).
//
//   • One link per class per student (RecordingLink): a one-to-one class has one,
//     a group class one for each enrolled student. Same share-link security as
//     homework links (utils/shareLink.js): random token, the family confirms the
//     student's and teacher's names, 5 wrong tries lock it for 15 minutes.
//   • The page plays every part of the class straight from S3 with fresh
//     short-lived addresses (local disk: streamed through the API instead).
//   • The link lives as long as the videos (auto-deleted 30 days after the class)
//     and can be switched off by the teacher or an admin.
//   • After each recorded class, the link is emailed once to every managed student
//     with a notification address who has it switched on (utils/familyEmailPrefs.js:
//     center switch + per-student setting).
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { recordingLinkSchema } from "../schemas/recordingLinkSchema.js";
import { recordingSchema } from "../schemas/recordingSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { issueShareLink } from "./shareLink.js";
import { decrypt } from "./fieldEncryption.js";
import { getCenterBaseUrl } from "../emails/core.js";
import { sendRecordingLinkEmail } from "../emails/recordingEmails.js";
import { trackJob } from "./monitor.js";
import { loadCenterSettings, prefOnFilter } from "./familyEmailPrefs.js";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RECORDINGS_DIR = path.join(__dirname, "../uploads/recordings");

export const getRecordingLink   = (db) => db.models.RecordingLink   || db.model("RecordingLink",   recordingLinkSchema);
const getRecording  = (db) => db.models.Recording  || db.model("Recording",  recordingSchema);
const getBooking    = (db) => db.models.Booking    || db.model("Booking",    bookingSchema);
const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);

const DAY = 24 * 60 * 60 * 1000;
const LINK_KEEP_DAYS = 45;          // the link record outlives the 30-day videos a little
const S3_URL_SECONDS = 3 * 60 * 60; // a video address stays playable for 3 h (the page refreshes it)

export { loadCenterSettings, getCenterSettings } from "./familyEmailPrefs.js";

export const teacherShownName = (t) => t?.displayName?.trim() || `${t?.firstName || ""} ${t?.lastName || ""}`.trim();
const classFilter = (c) => (c.bookingId ? { bookingId: c.bookingId } : { groupClassId: c.groupClassId });

/**
 * The class behind a link or request: { bookingId?, groupClassId?, title, scheduledTime, duration,
 * teacherId, studentIds, ended, cancelled }, or null if it doesn't exist.
 */
export async function loadClass(db, { bookingId, groupClassId }) {
  if (bookingId) {
    const b = await getBooking(db).findById(bookingId).select("classTitle scheduledTime duration teacherId studentId status adminRejected").lean();
    if (!b) return null;
    return {
      bookingId: b._id, title: b.classTitle, scheduledTime: b.scheduledTime, duration: b.duration || 60,
      teacherId: b.teacherId, studentIds: b.studentId ? [b.studentId] : [],
      ended: new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000 <= Date.now(),
      cancelled: ["cancelled", "rejected"].includes(b.status) || !!b.adminRejected,
    };
  }
  const g = await getGroupClass(db).findById(groupClassId).select("title scheduledTime duration teacherId enrollments.studentId status").lean();
  if (!g) return null;
  return {
    groupClassId: g._id, title: g.title, scheduledTime: g.scheduledTime, duration: g.duration || 60,
    teacherId: g.teacherId, studentIds: (g.enrollments || []).map((e) => e.studentId),
    ended: new Date(g.scheduledTime).getTime() + (g.duration || 60) * 60000 <= Date.now(),
    cancelled: ["cancelled", "missed"].includes(g.status),
  };
}

/** The class's link for this student, created if missing. Returns { link, token }. */
export async function getOrCreateLink(db, cls, studentId) {
  const RecordingLink = getRecordingLink(db);
  const key = { ...classFilter(cls), studentId };
  const read = () => RecordingLink.findOne(key).select("+shareLink.tokenEnc");
  let link = await read();
  if (!link) {
    link = new RecordingLink({ ...key, teacherId: cls.teacherId, purgeAt: new Date(Date.now() + LINK_KEEP_DAYS * DAY) });
    issueShareLink(link);
    try {
      await link.save();
    } catch (err) {
      if (err?.code !== 11000) throw err;
      link = await read(); // made by a parallel request (e.g. the email sweep) — use theirs
    }
  }
  let token = null;
  try { token = link.shareLink?.tokenEnc ? decrypt(link.shareLink.tokenEnc) : null; } catch { token = null; }
  return { link, token };
}

/** When the class's videos are deleted (= when the link stops working), or null if there is nothing to watch. */
export async function linkExpiry(db, link) {
  const recs = await getRecording(db).find(classFilter(link)).select("source autoDeleteAt").lean();
  const app = recs.filter((r) => r.source !== "external" && r.autoDeleteAt);
  if (app.length) return new Date(Math.max(...app.map((r) => new Date(r.autoDeleteAt).getTime())));
  if (recs.length) return new Date(new Date(link.createdAt || Date.now()).getTime() + 30 * DAY); // saved Zoom / Meet links only
  return null;
}

export const linkUrl = (center, token) => `${getCenterBaseUrl(center).baseUrl}/rv/${token}`;

const useS3 = () => !!process.env.S3_BUCKET;

/**
 * Everything the parent page plays, in order: one entry per recording part, grouped by
 * session (a class recorded twice has two sessions). App videos get a playable address:
 * a fresh presigned S3 URL, or (local disk) a stream path on this API with the access token.
 */
export async function linkVideos(db, link, { token, accessToken, slug }) {
  const recs = await getRecording(db).find(classFilter(link))
    .select("source externalUrl title duration mimeType filename sessionId partNumber startOffset createdAt").sort({ createdAt: 1 }).lean();
  const sessions = new Map();
  for (const r of recs) {
    const key = r.sessionId || String(r._id);
    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(r);
  }
  const getUrl = useS3() ? (await import("./s3.js")).getPresignedUrl : null;
  const out = [];
  let n = 0;
  for (const parts of sessions.values()) {
    n++;
    parts.sort((a, b) => (a.partNumber || 1) - (b.partNumber || 1));
    for (const r of parts) {
      if (r.source === "external") {
        out.push({ id: String(r._id), session: n, part: 1, parts: 1, external: true, url: r.externalUrl, title: r.title || "" });
        continue;
      }
      const url = getUrl
        ? await getUrl(r.filename, S3_URL_SECONDS)
        // <video> can't send the center header, so the address names the center (?c=)
        : `/recording-links/link/${token}/stream/${r._id}?a=${encodeURIComponent(accessToken)}&c=${encodeURIComponent(slug || "")}`;
      out.push({
        id: String(r._id), session: n, part: r.partNumber || 1, parts: parts.length, external: false,
        url, local: !getUrl, duration: r.duration || 0, mimeType: r.mimeType || "video/webm", title: r.title || "",
      });
    }
  }
  return out;
}

/** A recording file on local disk (only used without S3). */
export const localRecordingPath = (filename) => path.join(RECORDINGS_DIR, path.basename(filename || ""));
export const localRecordingExists = (filename) => !!filename && fs.existsSync(localRecordingPath(filename));

// ── Email ────────────────────────────────────────────────────────────────────

/**
 * Email the link to a managed student's notification address. Claims the link first
 * (emailedAt) so two sweeps can never both send. `force` re-sends ("Email now").
 * Returns "sent" | "already" | "off" | "no-email" | "no-video".
 */
export async function emailLink(db, center, cls, studentId, { force = false } = {}) {
  const student = await getStudent(db).findById(studentId).select("+notifyEmail firstName isManaged emailLanguage timezone").lean();
  const to = student?.isManaged ? (student.notifyEmail || "").trim() : "";
  if (!to) return "no-email";
  const { link, token } = await getOrCreateLink(db, cls, studentId);
  if (!link.enabled) return "off";
  const expiresAt = await linkExpiry(db, link);
  if (!expiresAt || expiresAt <= new Date()) return "no-video";

  const RecordingLink = getRecordingLink(db);
  const now = new Date();
  const claim = await RecordingLink.updateOne(
    force ? { _id: link._id } : { _id: link._id, emailedAt: null },
    { $set: { emailedAt: now, emailedTo: to, emailedManual: !!force } },
  );
  if (!claim.modifiedCount && !force) return "already";

  try {
    const teacher = await getTeacher(db).findById(cls.teacherId).select("firstName lastName displayName").lean();
    await sendRecordingLinkEmail({
      student, to, cls, teacherName: teacherShownName(teacher), url: linkUrl(center, token), expiresAt,
      center, centerName: center?.centerName,
    });
    return "sent";
  } catch (err) {
    // Not sent — let the next sweep (or the button) try again
    await RecordingLink.updateOne({ _id: link._id, emailedAt: now }, { $set: { emailedAt: link.emailedAt || null, emailedTo: link.emailedTo || "", emailedManual: !!link.emailedManual } }).catch(() => {});
    throw err;
  }
}

const QUIET_MS = 15 * 60 * 1000;  // wait until the last part has been uploaded for 15 min
const LOOKBACK_MS = DAY;          // only classes recorded in the last day (never a backlog flood)

/** Email the link of every recently recorded, finished class to its managed students (once). */
export async function sweepRecordingEmails(db, center, now = new Date()) {
  const settings = await loadCenterSettings(db);
  const classes = await getRecording(db).aggregate([
    { $match: { source: { $ne: "external" }, createdAt: { $gte: new Date(now.getTime() - LOOKBACK_MS) } } },
    { $group: { _id: { b: "$bookingId", g: "$groupClassId" }, lastAt: { $max: "$createdAt" } } },
    { $match: { lastAt: { $lte: new Date(now.getTime() - QUIET_MS) } } },
    { $limit: 500 },
  ]);
  if (!classes.length) return { sent: 0 };
  // The job only carries slug / name / time zone — the email needs the domain and logo too
  const full = (center?.slug && await Center.findOne({ slug: center.slug })
    .select("slug centerName timezone customDomain domainVerified branding.logo").lean()) || center;
  let sent = 0;
  for (const c of classes) {
    try {
      const cls = await loadClass(db, { bookingId: c._id.b, groupClassId: c._id.g });
      if (!cls || cls.cancelled || !cls.ended || !cls.studentIds.length) continue;
      // Managed students with an address who haven't had this class's link yet
      const done = new Set((await getRecordingLink(db).find({ ...classFilter(cls), emailedAt: { $ne: null } }).select("studentId").lean())
        .map((l) => String(l.studentId)));
      const todo = await getStudent(db).find({
        _id: { $in: cls.studentIds.filter((id) => !done.has(String(id))) },
        isManaged: true, notifyEmail: { $nin: [null, ""] },
        ...prefOnFilter(settings, "recordingLinkEmails"), // center switch / this student's own setting
      }).select("_id").lean();
      for (const s of todo) {
        if ((await emailLink(db, full, cls, s._id)) === "sent") sent++;
      }
    } catch (err) {
      logger.warn("[RecordingLinks] class email failed", { error: err?.message });
    }
  }
  if (sent) logger.info(`[RecordingLinks] ${center?.slug}: emailed ${sent} class video link(s)`);
  return { sent };
}

const INTERVAL_MS = 10 * 60 * 1000;

/** Start the email sweep for one center (utils/centerJobs.js). */
export function startRecordingLinkScheduler(db, center) {
  const run = trackJob("Class video emails", center?.slug || db.name, INTERVAL_MS, () => sweepRecordingEmails(db, center).catch((err) => {
    logger.error("[RecordingLinks] Sweep error:", { error: err?.message });
    throw err; // → App Health
  }));
  run();
  return [setInterval(run, INTERVAL_MS)];
}
