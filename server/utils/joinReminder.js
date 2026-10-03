// server/utils/joinReminder.js
// "Your class is starting — please join now" email, sent when a teacher or an
// admin presses "Remind to join" while the student hasn't joined yet.
//
//  • Online students: their account email. Managed students: their optional
//    notification email (Student.notifyEmail) — never used for login.
//  • Teachers never see the address; the admin can switch a student's
//    teacher reminders off (Student.joinReminderTeacherAllowed).
//  • Only around class time (30 min before start → end of class), and at most
//    once every COOLDOWN_MS per class, so the button can't be used to spam.
import mongoose from "mongoose";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { sendEmail, getCenterBaseUrl } from "./emailService.js";
import logger from "./logger.js";

export const COOLDOWN_MS = 3 * 60_000;
export const EARLY_MS = 30 * 60_000;

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export class ReminderError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Is `now` between 30 min before the class and its end? */
export function inReminderWindow(b, now = Date.now()) {
  const start = new Date(b.scheduledTime).getTime();
  const end = start + (b.duration || 60) * 60000;
  return now >= start - EARLY_MS && now <= end;
}

/** "m•••@gmail.com" — enough for the admin to recognise it, never the whole thing in logs/responses. */
export const maskEmail = (e) => {
  const [u, d] = String(e || "").split("@");
  return d ? `${u.slice(0, 1)}•••@${d}` : "";
};

/**
 * Send the reminder for one booking.
 * @param {{ role: "teacher"|"admin", id: string }} by  who pressed the button
 * @returns {{ sentTo: string }} masked address (admins only should display it)
 */
export async function sendJoinReminder(db, center, bookingId, by) {
  if (!mongoose.isValidObjectId(bookingId)) throw new ReminderError(400, "Invalid class");
  getTeacher(db);
  const Booking = getBooking(db);
  const b = await Booking.findById(bookingId)
    .populate("teacherId", "firstName lastName displayName googleMeetLink zoomLink")
    .populate({ path: "studentId", model: getStudent(db), select: "firstName lastName email isManaged +notifyEmail joinReminderTeacherAllowed" })
    .lean();
  if (!b) throw new ReminderError(404, "Class not found");
  if (by.role === "teacher" && String(b.teacherId?._id) !== String(by.id)) throw new ReminderError(403, "This is not your class");
  if (!["accepted", "in-progress"].includes(b.status)) throw new ReminderError(400, "Reminders are only for confirmed classes");
  if (!inReminderWindow(b)) throw new ReminderError(400, "Reminders can be sent from 30 minutes before the class until it ends");

  const s = b.studentId;
  if (!s) throw new ReminderError(404, "Student not found");
  if (by.role === "teacher" && s.joinReminderTeacherAllowed === false) {
    throw new ReminderError(403, "Your admin has turned off join reminders for this student");
  }
  const to = s.isManaged ? (s.notifyEmail || "") : (s.email || "");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new ReminderError(400, s.isManaged
      ? "No notification email on file for this student — ask your admin to add one"
      : "This student has no email address on file");
  }

  // Claim the cooldown atomically (two quick presses → one email)
  const claimed = await Booking.findOneAndUpdate(
    { _id: b._id, $or: [{ lastJoinReminderAt: { $exists: false } }, { lastJoinReminderAt: null }, { lastJoinReminderAt: { $lt: new Date(Date.now() - COOLDOWN_MS) } }] },
    { $set: { lastJoinReminderAt: new Date() } },
    { new: true, projection: { _id: 1 } },
  );
  if (!claimed) throw new ReminderError(429, "A reminder was just sent — please wait a few minutes before sending another");

  const t = b.teacherId || {};
  const teacherName = t.displayName?.trim() || `${t.firstName || ""} ${t.lastName || ""}`.trim() || "your teacher";
  const start = new Date(b.scheduledTime);
  const started = Date.now() >= start.getTime();
  const { baseUrl } = getCenterBaseUrl(center);
  const meetLink = t.googleMeetLink || t.zoomLink || "";
  const joinHtml = s.isManaged
    ? (meetLink
        ? `<p style="margin:20px 0"><a href="${esc(meetLink)}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Join the class</a></p>`
        : `<p>Please join using the class link your teacher shared with you.</p>`)
    : `<p style="margin:20px 0"><a href="${esc(baseUrl)}/student/dashboard" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700">Open my classes</a></p>`;

  try {
    const result = await sendEmail({
      centerName: center?.centerName, to,
      subject: started ? `Your class has started — please join now` : `Your class starts soon — please get ready to join`,
      html: `<p>Hello ${esc(s.firstName || "")},</p>
<p>${started ? "Your class has <strong>already started</strong> and" : "Your class starts soon and"} ${esc(teacherName)} is waiting for you:</p>
<ul><li><strong>Class:</strong> ${esc(b.classTitle || "Class")}</li><li><strong>Length:</strong> ${b.duration || 60} minutes</li></ul>
${joinHtml}
<p style="color:#64748b;font-size:13px">You're receiving this because your ${by.role === "teacher" ? "teacher" : "school"} sent a reminder from ${esc(center?.centerName || "your school")}.</p>`,
    });
    // sendEmail reports failures in its result instead of throwing
    if (result && result.success === false) throw new Error(result.error || "send failed");
  } catch (err) {
    // Release the cooldown so they can try again
    await Booking.updateOne({ _id: b._id }, { $unset: { lastJoinReminderAt: 1 } }).catch(() => {});
    logger.warn("Join reminder email failed", { bookingId: String(b._id), error: err?.message });
    throw new ReminderError(502, "The email could not be sent — please try again");
  }
  return { sentTo: maskEmail(to), studentName: `${s.firstName || ""} ${s.lastName || ""}`.trim() };
}

/** The student's class happening now (or starting within 30 min) — for the admin's button. */
export async function currentClassFor(db, studentId) {
  const now = Date.now();
  const list = await getBooking(db).find({
    studentId, status: { $in: ["accepted", "in-progress"] },
    scheduledTime: { $gte: new Date(now - 4 * 3600000), $lte: new Date(now + EARLY_MS) },
  }).select("_id scheduledTime duration classTitle").sort({ scheduledTime: 1 }).lean();
  return list.find(b => inReminderWindow(b, now)) || null;
}
