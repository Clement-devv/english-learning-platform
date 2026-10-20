// server/utils/familyLinkEmails.js
// Email managed students' families the links they already get by hand (no login):
//   • the parent attendance check ("did your child attend?") — automatic within ~10 min
//     of the link being made (scheduler below), until the parent answers or it expires
//   • homework / quiz links — automatic as soon as the teacher assigns them
// Automatic sends follow the switches in utils/familyEmailPrefs.js (parentCheckEmails,
// shareLinkEmails). The "Email to family" buttons send now, regardless of the switches.
// Each record remembers when it was emailed (and whether by hand) so it goes out once.
import { bookingSchema } from "../schemas/bookingSchema.js";
import { homeworkSchema } from "../schemas/homeworkSchema.js";
import { quizSchema } from "../schemas/quizSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { decrypt } from "./fieldEncryption.js";
import { linkExpiresAt } from "./shareLink.js";
import { parentCheckExpiresAt, LINK_DAYS } from "./parentCheck.js";
import { getCenterBaseUrl } from "../emails/core.js";
import { sendParentCheckLinkEmail, sendShareLinkEmail } from "../emails/familyLinkEmails.js";
import { loadCenterSettings, prefOn } from "./familyEmailPrefs.js";
import { trackJob } from "./monitor.js";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const getBooking  = (db) => db.models.Booking  || db.model("Booking",  bookingSchema);
const getHomework = (db) => db.models.Homework || db.model("Homework", homeworkSchema);
const getQuiz     = (db) => db.models.Quiz     || db.model("Quiz",     quizSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);

const teacherShown = (t) => t?.displayName?.trim() || `${t?.firstName || ""} ${t?.lastName || ""}`.trim();
const tokenOf = (doc) => { try { return doc?.shareLink?.tokenEnc ? decrypt(doc.shareLink.tokenEnc) : null; } catch { return null; } };

/** The managed student's family address, if this kind of email may go to them. { student, to } | reason string */
async function familyOf(db, studentId, kind, force) {
  const student = await getStudent(db).findById(studentId)
    .select(`+notifyEmail firstName isManaged emailLanguage timezone ${kind}`).lean();
  const to = student?.isManaged ? (student.notifyEmail || "").trim() : "";
  if (!to) return "no-email";
  if (!force && !prefOn(student, await loadCenterSettings(db), kind)) return "off";
  return { student, to };
}

// ── Parent attendance check ──────────────────────────────────────────────────

/**
 * Email the parent-check link of one class. `force` = "Email to family" (sends again, ignores
 * the switches). Returns "sent" | "no-email" | "off" | "already" | "answered" | "expired".
 */
export async function emailParentCheck(db, center, bookingId, { force = false } = {}) {
  const Booking = getBooking(db);
  const b = await Booking.findById(bookingId)
    .select("+shareLink.tokenEnc shareLink.createdAt completedAt classTitle scheduledTime teacherId studentId parentCheck").lean();
  const token = tokenOf(b);
  if (!b || !token || b.parentCheck?.status !== "waiting") return "answered";
  const expiresAt = parentCheckExpiresAt(b, center?.timezone);
  if (expiresAt <= new Date()) return "expired";
  const fam = await familyOf(db, b.studentId, "parentCheckEmails", force);
  if (typeof fam === "string") return fam;

  const now = new Date();
  const claim = await Booking.updateOne(
    { _id: b._id, "parentCheck.status": "waiting", ...(force ? {} : { "parentCheck.emailedAt": null }) },
    { $set: { "parentCheck.emailedAt": now, "parentCheck.emailedTo": fam.to, "parentCheck.emailedManual": !!force } },
  );
  if (!claim.modifiedCount) return "already";
  try {
    const teacher = await getTeacher(db).findById(b.teacherId).select("firstName lastName displayName").lean();
    await sendParentCheckLinkEmail({
      student: fam.student, to: fam.to, cls: { title: b.classTitle, scheduledTime: b.scheduledTime },
      teacherName: teacherShown(teacher), url: `${getCenterBaseUrl(center).baseUrl}/ac/${token}`, expiresAt,
      center, centerName: center?.centerName,
    });
    return "sent";
  } catch (err) {
    const prev = b.parentCheck || {};
    await Booking.updateOne({ _id: b._id, "parentCheck.emailedAt": now }, { $set: {
      "parentCheck.emailedAt": prev.emailedAt || null, "parentCheck.emailedTo": prev.emailedTo || "", "parentCheck.emailedManual": !!prev.emailedManual,
    } }).catch(() => {});
    throw err;
  }
}

/** Email every waiting parent check that hasn't been emailed yet (managed students, switch on). */
export async function sweepParentCheckEmails(db, center, now = new Date()) {
  const waiting = await getBooking(db).find({
    "parentCheck.status": "waiting", "parentCheck.emailedAt": null,
    "shareLink.createdAt": { $gte: new Date(now.getTime() - (LINK_DAYS + 1) * 86400000) },
  }).select("_id").limit(500).lean();
  if (!waiting.length) return { sent: 0 };
  const full = (center?.slug && await Center.findOne({ slug: center.slug })
    .select("slug centerName timezone customDomain domainVerified branding.logo").lean()) || center;
  let sent = 0;
  for (const w of waiting) {
    try {
      if ((await emailParentCheck(db, full, w._id)) === "sent") sent++;
    } catch (err) {
      logger.warn("[FamilyLinks] parent check email failed", { error: err?.message });
    }
  }
  if (sent) logger.info(`[FamilyLinks] ${center?.slug}: emailed ${sent} parent check link(s)`);
  return { sent };
}

// ── Homework / quiz links ────────────────────────────────────────────────────

const SHARE = {
  homework: { model: getHomework, path: "hw" },
  quiz:     { model: getQuiz,     path: "q" },
};

/**
 * Email a homework / quiz share link to the family. Automatic on assignment (switches apply),
 * or "Email to family" (`force`). Returns "sent" | "no-email" | "off" | "already" | "expired" | "no-link".
 */
export async function emailShareLink(db, center, kind, id, { force = false } = {}) {
  const { model, path } = SHARE[kind];
  const Model = model(db);
  const doc = await Model.findById(id).select("+shareLink.tokenEnc title dueDate studentId teacherId familyEmail").lean();
  const token = tokenOf(doc);
  if (!doc || !token) return "no-link";
  if (linkExpiresAt(doc.dueDate, center?.timezone) <= new Date()) return "expired";
  const fam = await familyOf(db, doc.studentId, "shareLinkEmails", force);
  if (typeof fam === "string") return fam;

  const now = new Date();
  const claim = await Model.updateOne(
    { _id: doc._id, ...(force ? {} : { "familyEmail.at": null }) },
    { $set: { familyEmail: { at: now, to: fam.to, manual: !!force } } },
  );
  if (!claim.modifiedCount) return "already";
  try {
    const teacher = await getTeacher(db).findById(doc.teacherId).select("firstName lastName displayName").lean();
    await sendShareLinkEmail({
      kind, student: fam.student, to: fam.to, title: doc.title, dueDate: doc.dueDate,
      teacherName: teacherShown(teacher), url: `${getCenterBaseUrl(center).baseUrl}/${path}/${token}`,
      center, centerName: center?.centerName,
    });
    return "sent";
  } catch (err) {
    await Model.updateOne({ _id: doc._id, "familyEmail.at": now }, { $set: { familyEmail: doc.familyEmail || { at: null, to: "", manual: false } } }).catch(() => {});
    throw err;
  }
}

/** Fire-and-forget for the assign routes: email the link if the switches allow. */
export function emailShareLinkLater(db, center, kind, id) {
  emailShareLink(db, center, kind, id).catch((err) => logger.warn(`[FamilyLinks] ${kind} link email failed`, { error: err?.message }));
}

const INTERVAL_MS = 10 * 60 * 1000;

/** Start the parent-check email sweep for one center (utils/centerJobs.js). */
export function startFamilyLinkScheduler(db, center) {
  const run = trackJob("Parent check emails", center?.slug || db.name, INTERVAL_MS, () => sweepParentCheckEmails(db, center).catch((err) => {
    logger.error("[FamilyLinks] Sweep error:", { error: err?.message });
    throw err;
  }));
  run();
  return [setInterval(run, INTERVAL_MS)];
}
