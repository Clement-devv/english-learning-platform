// server/utils/classSummaryEmails.js
// Email the teacher's class summary to managed students' families.
//
//   • Automatic: a few minutes after a summary is written (so quick edits go out in the
//     same email), once per class per student, to managed students with a notification
//     address who have it switched on (utils/familyEmailPrefs.js).
//   • Manual: teachers / admins press "Email to family" — sends now, even again.
//   • A one-to-one summary is shared by every booking of the same class slot (same
//     teacher, time and title — routes/classSummaryRoutes.js); a GroupClass summary by
//     every enrolled student who wasn't absent. Each student's family gets their own email.
import mongoose from "mongoose";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { sendClassSummaryEmail } from "../emails/summaryEmails.js";
import { loadCenterSettings, prefOnFilter } from "./familyEmailPrefs.js";
import { trackJob } from "./monitor.js";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

const { ObjectId } = mongoose.Schema.Types;
/** One row per class per student whose family got the summary (manual sends update it). */
export const classSummaryEmailSchema = new mongoose.Schema({
  bookingId:    { type: ObjectId, ref: "Booking" },
  groupClassId: { type: ObjectId, ref: "GroupClass" },
  studentId:    { type: ObjectId, ref: "Student", required: true },
  emailedAt:    { type: Date, required: true },
  emailedTo:    { type: String, default: "" },
  manual:       { type: Boolean, default: false },
}, { timestamps: true });
classSummaryEmailSchema.index({ bookingId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $exists: true } } });
classSummaryEmailSchema.index({ groupClassId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { groupClassId: { $exists: true } } });
// Only needed until the class is well past (the sweep looks back a few days)
classSummaryEmailSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

export const getSummaryEmail = (db) => db.models.ClassSummaryEmail || db.model("ClassSummaryEmail", classSummaryEmailSchema);
const getBooking    = (db) => db.models.Booking    || db.model("Booking",    bookingSchema);
const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);

const DONE = { status: "completed", adminRejected: { $ne: true } };
const teacherShown = (t) => t?.displayName?.trim() || `${t?.firstName || ""} ${t?.lastName || ""}`.trim();

/**
 * A class with its summary and who it's for:
 * { cls: { title, scheduledTime, text, teacherId }, targets: [{ studentId, key: { bookingId } | { groupClassId } }] }
 * or null if there's no completed class / no summary.
 */
export async function summaryTargets(db, { bookingId, groupClassId }) {
  if (groupClassId) {
    const g = await getGroupClass(db).findById(groupClassId).select("title scheduledTime teacherId status enrollments classSummary").lean();
    if (!g || g.status !== "completed" || !g.classSummary?.text) return null;
    return {
      cls: { title: g.title, scheduledTime: g.scheduledTime, text: g.classSummary.text, teacherId: g.teacherId, groupClassId: g._id },
      targets: (g.enrollments || []).filter((e) => e.studentId && e.attendance !== "absent")
        .map((e) => ({ studentId: e.studentId, key: { groupClassId: g._id } })),
    };
  }
  const b = await getBooking(db).findById(bookingId).select("teacherId scheduledTime classTitle status adminRejected classSummary").lean();
  if (!b || b.status !== "completed" || b.adminRejected || !b.classSummary?.text) return null;
  // Every booking of the same class slot shares the summary
  const slot = await getBooking(db).find({ teacherId: b.teacherId, scheduledTime: b.scheduledTime, classTitle: b.classTitle, ...DONE })
    .select("studentId").lean();
  return {
    cls: { title: b.classTitle, scheduledTime: b.scheduledTime, text: b.classSummary.text, teacherId: b.teacherId, bookingId: b._id },
    targets: slot.filter((x) => x.studentId).map((x) => ({ studentId: x.studentId, key: { bookingId: x._id } })),
  };
}

/** Send one family their copy. Returns "sent" | "no-email" | "already". */
async function sendOne(db, center, cls, target, { force, teacherName }) {
  const student = await getStudent(db).findById(target.studentId).select("+notifyEmail firstName isManaged emailLanguage timezone").lean();
  const to = student?.isManaged ? (student.notifyEmail || "").trim() : "";
  if (!to) return "no-email";
  const Log = getSummaryEmail(db);
  const where = { ...target.key, studentId: target.studentId };
  const now = new Date();
  if (force) {
    await Log.updateOne(where, { $set: { emailedAt: now, emailedTo: to, manual: true } }, { upsert: true });
  } else {
    try { await Log.create({ ...where, emailedAt: now, emailedTo: to }); } // claim — a second sweep can't send twice
    catch (err) { if (err?.code === 11000) return "already"; throw err; }
  }
  try {
    await sendClassSummaryEmail({ student, to, cls, teacherName, center, centerName: center?.centerName });
    return "sent";
  } catch (err) {
    if (!force) await Log.deleteOne({ ...where, emailedAt: now }).catch(() => {}); // let the next sweep retry
    throw err;
  }
}

/**
 * "Email to family": send the summary of one class now to every managed student with an
 * address (whatever the automatic switches say). Returns { sent, noEmail: [names] }.
 */
export async function emailSummaryNow(db, center, which) {
  const found = await summaryTargets(db, which);
  if (!found) return null;
  const teacher = await getTeacher(db).findById(found.cls.teacherId).select("firstName lastName displayName").lean();
  const students = await getStudent(db).find({ _id: { $in: found.targets.map((t) => t.studentId) } }).select("firstName lastName isManaged").lean();
  const nameOf = new Map(students.map((s) => [String(s._id), `${s.firstName || ""} ${s.lastName || ""}`.trim()]));
  let sent = 0;
  const noEmail = [];
  for (const target of found.targets) {
    const r = await sendOne(db, center, found.cls, target, { force: true, teacherName: teacherShown(teacher) });
    if (r === "sent") sent++;
    else if (r === "no-email") noEmail.push(nameOf.get(String(target.studentId)) || "");
  }
  return { sent, noEmail };
}

/** Per class + student: when the family last got the summary (for the lists). Map("<classId>:<studentId>" → { at, to, manual }) */
export async function summaryEmailLog(db, { bookingIds = [], groupClassIds = [] }) {
  const rows = await getSummaryEmail(db).find({ $or: [{ bookingId: { $in: bookingIds } }, { groupClassId: { $in: groupClassIds } }] })
    .select("bookingId groupClassId studentId emailedAt emailedTo manual").lean();
  return new Map(rows.map((r) => [`${r.bookingId || r.groupClassId}:${r.studentId}`, { at: r.emailedAt, to: r.emailedTo, manual: !!r.manual }]));
}

const QUIET_MS = 10 * 60 * 1000;          // let the teacher finish editing first
const LOOKBACK_MS = 3 * 24 * 3600 * 1000; // summaries written in the last 3 days

/** Email every recently written summary to the families who have it switched on (once). */
export async function sweepSummaryEmails(db, center, now = new Date()) {
  const settings = await loadCenterSettings(db);
  const window = { $gte: new Date(now.getTime() - LOOKBACK_MS), $lte: new Date(now.getTime() - QUIET_MS) };
  const written = { "classSummary.text": { $exists: true, $ne: "" }, "classSummary.updatedAt": window };
  const [bookings, groups] = await Promise.all([
    getBooking(db).find({ ...DONE, ...written }).select("_id").limit(1000).lean(),
    getGroupClass(db).find({ status: "completed", ...written }).select("_id").limit(300).lean(),
  ]);
  const work = [...bookings.map((b) => ({ bookingId: b._id })), ...groups.map((g) => ({ groupClassId: g._id }))];
  if (!work.length) return { sent: 0 };

  const full = (center?.slug && await Center.findOne({ slug: center.slug })
    .select("slug centerName timezone customDomain domainVerified branding.logo").lean()) || center;
  const Log = getSummaryEmail(db);
  let sent = 0;
  for (const which of work) {
    try {
      const found = await summaryTargets(db, which);
      if (!found) continue;
      // One-to-one: only this booking's student (its slot-mates are their own rows)
      const targets = which.bookingId ? found.targets.filter((t) => String(t.key.bookingId) === String(which.bookingId)) : found.targets;
      if (!targets.length) continue;
      const done = new Set((await Log.find({ $or: targets.map((t) => ({ ...t.key, studentId: t.studentId })) }).select("studentId").lean())
        .map((r) => String(r.studentId)));
      const eligible = new Set((await getStudent(db).find({
        _id: { $in: targets.filter((t) => !done.has(String(t.studentId))).map((t) => t.studentId) },
        isManaged: true, notifyEmail: { $nin: [null, ""] }, ...prefOnFilter(settings, "classSummaryEmails"),
      }).select("_id").lean()).map((s) => String(s._id)));
      if (!eligible.size) continue;
      const teacher = await getTeacher(db).findById(found.cls.teacherId).select("firstName lastName displayName").lean();
      for (const t of targets.filter((x) => eligible.has(String(x.studentId)))) {
        if ((await sendOne(db, full, found.cls, t, { force: false, teacherName: teacherShown(teacher) })) === "sent") sent++;
      }
    } catch (err) {
      logger.warn("[SummaryEmails] class email failed", { error: err?.message });
    }
  }
  if (sent) logger.info(`[SummaryEmails] ${center?.slug}: emailed ${sent} class summary(ies)`);
  return { sent };
}

const INTERVAL_MS = 10 * 60 * 1000;

/** Start the sweep for one center (utils/centerJobs.js). */
export function startSummaryEmailScheduler(db, center) {
  const run = trackJob("Class summary emails", center?.slug || db.name, INTERVAL_MS, () => sweepSummaryEmails(db, center).catch((err) => {
    logger.error("[SummaryEmails] Sweep error:", { error: err?.message });
    throw err;
  }));
  run();
  return [setInterval(run, INTERVAL_MS)];
}
