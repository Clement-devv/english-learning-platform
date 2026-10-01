// server/routes/offlineClassRoutes.js
// Teacher-logged classes: a class that really happened outside the app (site
// down, held on Google Meet / Zoom directly…) and so wasn't tracked.
//
//   Teacher logs it → booking "pending_confirmation" (amber "awaiting approval"
//   heartbeat). Nothing is charged or paid yet. Optional recording link as proof.
//   Managed student → the parent check starts right away (parentCheckRoutes.js);
//   real student → confirm/dispute in their dashboard (bookingRoutes.js).
//   Admin approves → class completed, credit deducted, teacher paid.
//   Admin rejects → class rejected, nothing charged or paid.
//   Parent says "No" and nobody settles it in 3 days → rejected automatically
//   (utils/parentCheck.js).
//
// Teacher: POST /api/v1/offline-classes        GET /api/v1/offline-classes/mine
// Admin:   GET  /api/v1/offline-classes        POST /:id/approve   POST /:id/reject
import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";
import { recordingSchema } from "../schemas/recordingSchema.js";
import { issueShareLink } from "../utils/shareLink.js";
import { payForCompletedClass } from "../utils/classPayment.js";
import { LINK_DAYS } from "../utils/parentCheck.js";
import { sendEmail, getCenterBaseUrl } from "../utils/emailService.js";
import { toStr } from "../utils/inputSanitizer.js";
import logger from "../utils/logger.js";

const PAGE_SIZE = 20;
import { badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking    = (db) => db.models.Booking    || db.model("Booking",    bookingSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);
const getAssignment = (db) => db.models.Assignment || db.model("Assignment", assignmentSchema);
const getRecording  = (db) => db.models.Recording  || db.model("Recording",  recordingSchema);
router.use((req, _res, next) => { if (req.db) { getStudent(req.db); getTeacher(req.db); } next(); });

const MAX_AGE_DAYS   = 14;   // how far back a class can be logged
const MAX_PENDING    = 20;   // per teacher, awaiting approval at once
const PLATFORMS      = ["googlemeet", "zoom", "other"];
const DAY_MS         = 24 * 60 * 60 * 1000;

function cleanUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.length > 2000) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : false;
  } catch { return false; }
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ─────────────────────────────────────────────────────────────────────────────
// Teacher
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const teacherId = req.user.id;
    const b = req.body || {};

    if (!mongoose.isValidObjectId(b.studentId)) return badRequest(res, "Please choose a student");
    const classTitle = toStr(b.classTitle, "classTitle", { required: true, maxLen: 200 });
    const topic      = toStr(b.topic, "topic", { maxLen: 500 });
    const reason     = toStr(b.reason, "reason", { required: true, maxLen: 500 });
    const platform   = PLATFORMS.includes(b.platform) ? b.platform : null;
    if (!platform) return badRequest(res, "Please choose where the class took place");
    const duration = parseInt(b.duration, 10);
    if (!Number.isInteger(duration) || duration < 15 || duration > 180) return badRequest(res, "Duration must be 15–180 minutes");

    const start = new Date(b.scheduledTime);
    if (isNaN(start)) return badRequest(res, "Please choose the date and time of the class");
    const end = new Date(start.getTime() + duration * 60000);
    if (end > new Date()) return badRequest(res, "You can only log a class that has already finished");
    if (start < new Date(Date.now() - MAX_AGE_DAYS * DAY_MS)) return badRequest(res, `Classes older than ${MAX_AGE_DAYS} days can't be logged — please contact your admin`);

    const recordingUrl = cleanUrl(b.recordingUrl);
    if (recordingUrl === false) return badRequest(res, "The recording link must start with https://");

    // The student must be assigned to this teacher
    const assigned = await getAssignment(req.db).exists({ teacherId, studentId: b.studentId });
    if (!assigned) return forbidden(res, "This student isn't assigned to you");
    const student = await getStudent(req.db).findById(b.studentId).select("firstName lastName isManaged classCredits");
    if (!student) return notFound(res, "Student not found");

    const Booking = getBooking(req.db);
    // Cap the queue so this can't be used to flood the admin
    const pendingCount = await Booking.countDocuments({ teacherId, loggedByTeacher: true, "offline.approval.status": "pending" });
    if (pendingCount >= MAX_PENDING) return badRequest(res, `You already have ${MAX_PENDING} classes waiting for approval. Please wait for your admin to review them.`);

    // No overlap with another class for this teacher or this student
    const nearby = await Booking.find({
      $or: [{ teacherId }, { studentId: b.studentId }],
      status: { $nin: ["rejected", "cancelled"] },
      scheduledTime: { $gte: new Date(start.getTime() - 4 * 60 * 60000), $lt: end },
    }).select("scheduledTime duration classTitle").lean();
    const clash = nearby.find(x => new Date(x.scheduledTime).getTime() + (x.duration || 60) * 60000 > start.getTime());
    if (clash) return conflict(res, `This time overlaps another class ("${clash.classTitle}"). If that class was this one, add a recording link to it instead.`);

    const teacher = await getTeacher(req.db).findById(teacherId).select("timezone");
    const booking = new Booking({
      teacherId, studentId: student._id, classTitle, topic,
      scheduledTime: start, duration,
      status: "pending_confirmation",
      createdBy: "teacher", createdByUserId: teacherId, createdByUserModel: "Teacher",
      markedBy: "teacher",
      attendanceConfirmedBy: "teacher",
      loggedByTeacher: true,
      offline: { platform, reason, loggedAt: new Date(), approval: { status: "pending" } },
      teacherTimezone: teacher?.timezone || "",
    });
    // Someone besides the teacher confirms it happened:
    //   managed student → parent check link (the admin can send it straight away)
    //   real student    → "confirm or dispute" card in their own dashboard
    // No answer within LINK_DAYS → counts as attended.
    booking.parentCheck = { status: "waiting" };
    if (student.isManaged) {
      issueShareLink(booking);
    } else {
      booking.teacherConfirmedAt = new Date();
      booking.autoConfirmAt = new Date(Date.now() + LINK_DAYS * DAY_MS);
    }
    await booking.save();

    if (recordingUrl) {
      await getRecording(req.db).create({
        bookingId: booking._id, teacherId, studentId: student._id,
        source: "external", externalUrl: recordingUrl,
        note: toStr(b.recordingNote, "recordingNote", { maxLen: 500 }) || "Recording of a class held outside the app",
        duration: duration * 60, mimeType: "",
      });
    }

    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      const { baseUrl } = getCenterBaseUrl(req.center);
      sendEmail({
        centerName: req.center?.centerName, to: adminEmail,
        subject: `Class logged by a teacher — needs approval`,
        html: `<p>A teacher logged a class that took place outside the app:</p>
<ul><li><strong>Class:</strong> ${esc(classTitle)} — ${esc(start.toUTCString())} (${duration} min)</li>
<li><strong>Student:</strong> ${esc(student.firstName)} ${esc(student.lastName)}</li>
<li><strong>Where / why:</strong> ${esc(platform)} — ${esc(reason)}</li>
<li><strong>Recording link:</strong> ${recordingUrl ? "added" : "none"}</li></ul>
<p>Nothing is charged or paid until you approve it in <a href="${baseUrl}/admin/dashboard">Logged classes</a>.</p>`,
      }).catch(e => logger.warn("Offline class email failed:", { error: e?.message }));
    }

    res.status(201).json({ success: true, message: "Class logged — waiting for admin approval", booking });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Log offline class error:", { error: err?.message });
    serverError(res);
  }
});

// The teacher's own logged classes that aren't completed yet (pending or rejected)
router.get("/mine", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const list = await getBooking(req.db).find({
      teacherId: req.user.id, loggedByTeacher: true,
      "offline.approval.status": { $in: ["pending", "processing", "rejected"] },
      scheduledTime: { $gte: new Date(Date.now() - 90 * DAY_MS) },
    })
      .populate("studentId", "firstName lastName isManaged")
      .sort({ scheduledTime: -1 }).lean();
    res.json({ success: true, classes: list });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : null;
    const byStatus = (s) => ({ loggedByTeacher: true, "offline.approval.status": s === "pending" ? { $in: ["pending", "processing"] } : s });
    const filter = status ? byStatus(status) : { loggedByTeacher: true };
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), 50);
    const Booking = getBooking(req.db);
    const [total, pending, approved, rejected] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.countDocuments(byStatus("pending")),
      Booking.countDocuments(byStatus("approved")),
      Booking.countDocuments(byStatus("rejected")),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), totalPages);
    const list = await Booking.find(filter)
      .populate("studentId", "firstName lastName isManaged classCredits phone")
      .populate("teacherId", "firstName lastName displayName ratePerClass")
      // Waiting queue: oldest first so nothing sits forgotten; history: newest first
      .sort(status === "pending" ? { "offline.loggedAt": 1, _id: 1 } : { "offline.loggedAt": -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const recordings = await getRecording(req.db).find({ bookingId: { $in: list.map(b => b._id) } })
      .select("bookingId source externalUrl note duration createdAt").lean();
    const byBooking = {};
    recordings.forEach(r => { (byBooking[String(r.bookingId)] ||= []).push(r); });
    res.json({
      success: true,
      classes: list.map(b => ({ ...b, recordings: byBooking[String(b._id)] || [] })),
      pagination: { page, limit, total, totalPages },
      counts: { pending, approved, rejected },
    });
  } catch (err) {
    logger.error("Offline classes list error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/:id/approve", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  const Booking = getBooking(req.db);
  let claimed = null;
  try {
    const note = toStr(req.body?.note, "note", { maxLen: 500 });
    const current = await Booking.findById(req.params.id).populate("studentId", "classCredits firstName");
    if (!current || !current.loggedByTeacher) return notFound(res, "Logged class not found");
    if (current.offline?.approval?.status !== "pending" || current.status !== "pending_confirmation")
      return badRequest(res, "This class has already been reviewed");
    if (!current.isTrial && (current.studentId?.classCredits || 0) <= 0)
      return badRequest(res, `${current.studentId?.firstName || "The student"} has no classes left. Record a payment for them first, then approve.`);

    // Claim it so a double click / two admins can't pay twice
    claimed = await Booking.findOneAndUpdate(
      { _id: current._id, status: "pending_confirmation", "offline.approval.status": "pending" },
      { $set: { "offline.approval.status": "processing" } },
      { new: true },
    );
    if (!claimed) return conflict(res, "This class is being reviewed by someone else — please refresh");

    const now = new Date();
    const { earned } = await payForCompletedClass(req.db, claimed, {
      description: `Teacher-logged class approved: ${claimed.classTitle} (${claimed.offline.platform})`,
    });

    const set = {
      status: "completed", completedAt: now, markedBy: "admin",
      "offline.approval": { status: "approved", decidedAt: now, decidedBy: req.user.id, note },
    };
    // Approving over a parent's open "No" settles that dispute for the teacher
    const parentNoOpen = claimed.parentCheck?.status === "denied" && claimed.disputeStatus === "pending";
    if (parentNoOpen) Object.assign(set, {
      disputeStatus: "resolved_teacher", disputeResolution: "approve_teacher",
      disputeAdminNotes: note || "Approved by admin with the class", disputeResolvedAt: now,
    });
    await Booking.updateOne({ _id: claimed._id }, { $set: set, ...(parentNoOpen ? { $unset: { shareLink: 1 } } : {}) });

    res.json({ success: true, message: `Approved — teacher paid ${earned}`, earned });
  } catch (err) {
    // Release the claim so it can be retried
    if (claimed) await Booking.updateOne({ _id: claimed._id, "offline.approval.status": "processing" }, { $set: { "offline.approval.status": "pending" } }).catch(() => {});
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Approve offline class error:", { error: err?.message });
    serverError(res);
  }
});

router.post("/:id/reject", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  try {
    const reason = toStr(req.body?.reason, "reason", { required: true, maxLen: 500 });
    const now = new Date();
    const updated = await getBooking(req.db).findOneAndUpdate(
      { _id: req.params.id, loggedByTeacher: true, status: "pending_confirmation", "offline.approval.status": "pending" },
      {
        $set: {
          status: "rejected", rejectionReason: `Logged class not approved: ${reason}`,
          "offline.approval": { status: "rejected", decidedAt: now, decidedBy: req.user.id, note: reason },
        },
        $unset: { shareLink: 1 },
      },
      { new: true },
    );
    if (!updated) return badRequest(res, "This class has already been reviewed");
    // An open parent "No" is settled for the parent — nothing was charged, so nothing to reverse
    if (updated.parentCheck?.status === "denied" && updated.disputeStatus === "pending") {
      await getBooking(req.db).updateOne({ _id: updated._id }, { $set: {
        disputeStatus: "resolved_student", disputeResolution: "approve_student",
        disputeAdminNotes: reason, disputeResolvedAt: now,
      } });
    }
    res.json({ success: true, message: "Rejected — nothing was charged or paid" });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Reject offline class error:", { error: err?.message });
    serverError(res);
  }
});

export default router;
