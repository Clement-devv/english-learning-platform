// server/routes/bookingRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { subAdminNeeds, isSubAdmin, inScope, scopedStudentIds } from "../middleware/staffAccess.js";
import {
  sendBookingRequestToTeacher, sendBookingAcceptedToStudent,
  sendBookingRejectedToStudent, sendBookingCreatedToStudent, sendClassCancelledEmail,
  sendClassCompletedNotification,
} from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { teacherAvailabilitySchema } from "../schemas/teacherAvailabilitySchema.js";
import { freeIntervals, teacherTz, bookingInterval, BUSY_STATUSES, findTeacherClash } from "../utils/schedule.js";
import { notifyAdmins } from "../utils/adminNotify.js";
import { sendJoinReminder, ReminderError } from "../utils/joinReminder.js";
import logger from "../utils/logger.js";
import { pushTeacher, pushStudent } from "../utils/notifyPush.js";
import { badRequest, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { parsePagination } from '../utils/pagination.js';
import { toStr, toObjectId } from '../utils/inputSanitizer.js';
import { pushToUser } from '../utils/webPushService.js';
import { disputeDeadlineFrom, DISPUTE_DAYS } from '../utils/parentCheck.js';
import { sendEmail, getCenterBaseUrl } from '../utils/emailService.js';
import { completeClass } from '../services/classCompletionService.js';

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacherAvailability = (db) => db.models.TeacherAvailability || db.model("TeacherAvailability", teacherAvailabilitySchema);

// Statuses whose booking can be deleted outright (nothing charged, paid or disputed).
// Teachers can't delete missed classes (their attendance record).
const TEACHER_DELETABLE = ["pending", "accepted", "rejected", "cancelled"];
const ADMIN_DELETABLE   = ["pending", "accepted", "rejected", "cancelled", "missed"];

const canCreateBooking = (req, createdBy) => {
  const { role, id } = req.user;
  if (role === "admin"   && createdBy === "admin")   return true;
  // Sub-admin with "Bookings": sends the same request to the teacher as the admin would
  if (role === "sub-admin" && createdBy === "admin") return !!req.subAdmin;
  if (role === "teacher" && createdBy === "teacher") return req.body.teacherId === id;
  return false;
};

// ─── GET single booking ───────────────────────────────────────────────────────
router.get("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    // Ensure Teacher and Student models are registered on this connection before populate
    getTeacher(req.db);
    getStudent(req.db);
    const booking = await getBooking(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email continent googleMeetLink zoomLink timezone")
      .populate("studentId", "firstName lastName email classCredits isManaged emailLanguage timezone");
    if (!booking) return notFound(res, "Booking not found");

    const isAuthorized =
      req.user.role === "admin" ||
      (req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id) ||
      (req.user.role === "student" && booking.studentId._id.toString() === req.user.id);
    if (!isAuthorized) return forbidden(res, "Not authorized to view this booking");

    res.json({ success: true, booking });
  } catch (err) {
    logger.error("Error fetching booking:", { error: err?.message });
    if (err.name === "CastError") return badRequest(res, "Invalid booking ID format");
    res.status(500).json({ success: false, message: "Error fetching booking" });
  }
});

// ─── POST create booking ──────────────────────────────────────────────────────
router.post("/", verifyToken, subAdminNeeds("canCreateBookings"), async (req, res) => {
  try {
    const { scheduledTime, duration, createdBy = "admin" } = req.body;
    const isTrial = !!req.body.isTrial;

    // Validate and coerce — toStr/toObjectId throw { statusCode: 400 } on bad input,
    // which the global errorHandler maps to a clean 400 JSON response.
    const teacherId  = toObjectId(req.body.teacherId,  "teacherId");
    const studentId  = toObjectId(req.body.studentId,  "studentId");
    const classTitle = toStr(req.body.classTitle, "classTitle", { required: true, maxLen: 200 });
    const topic      = toStr(req.body.topic,      "topic",      { maxLen: 500 });
    const notes      = toStr(req.body.notes,      "notes",      { maxLen: 2000 });

    if (!canCreateBooking(req, createdBy))
      return forbidden(res, "You are not authorized to create bookings with this role");
    if (!scheduledTime)
      return badRequest(res, "scheduledTime is required");
    const start = new Date(scheduledTime);
    const mins  = duration == null || duration === "" ? 60 : Number(duration);
    if (isNaN(start)) return badRequest(res, "scheduledTime is invalid");
    if (!Number.isFinite(mins) || mins < 15 || mins > 180) return badRequest(res, "Duration must be 15–180 minutes");
    // A few minutes' grace for "starting now"; classes that already happened are
    // recorded through Logged classes, not booked
    if (start.getTime() < Date.now() - 5 * 60000) return badRequest(res, "Please pick a time in the future");

    const [teacher, student] = await Promise.all([
      getTeacher(req.db).findById(teacherId),
      getStudent(req.db).findById(studentId),
    ]);
    if (!teacher || !inScope(req, teacher._id)) return notFound(res, "Teacher not found");
    if (!student) return notFound(res, "Student not found");
    if (isSubAdmin(req) && !(await scopedStudentIds(req)).has(String(student._id)))
      return notFound(res, "Student not found");
    if (!isTrial && student.classCredits <= 0)
      return res.status(400).json({ success: false, message: `Student ${student.firstName} ${student.lastName} has no classes remaining` });

    const initialStatus = createdBy === "admin" ? "pending" : "accepted";
    const Booking = getBooking(req.db);

    const clash = await findTeacherClash(Booking, { teacherId, start, mins, classTitle });
    if (clash) return conflict(res, `${teacher.firstName} already has a class then ("${clash.classTitle}") — pick another time`);

    const booking = await Booking.create({
      teacherId, studentId, classTitle,
      topic: topic || "", scheduledTime: start,
      duration: mins, notes: notes || "",
      status: initialStatus, createdBy,
      isTrial,
      createdByUserId: req.user.id,
      createdByUserModel: isSubAdmin(req) ? "SubAdmin" : createdBy === "admin" ? "Admin" : "Teacher",
      teacherTimezone: teacher.timezone || "",
      studentTimezone: student.timezone || "",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email timezone")
      .populate("studentId", "firstName lastName email classCredits isManaged emailLanguage timezone");

    if (createdBy === "admin") {
      sendBookingRequestToTeacher(teacher, student, populatedBooking, req.center?.centerName || "", req.center).catch(e => logger.error("Teacher booking email failed:", { error: e?.message }));
      pushTeacher(req.db, teacherId, "📅 New class request", `${student.firstName} ${student.lastName || ""} — "${classTitle}"`, { tag: `booking-${booking._id}`, tab: "bookings" });
    }
    sendBookingCreatedToStudent(student, teacher, populatedBooking, req.center?.centerName || "", req.center).catch(e => logger.error("Student booking email failed:", { error: e?.message }));

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`student-room:${req.center.slug}:${studentId.toString()}`).emit('booking-update', {
          type: 'created',
          title: '📅 New Class Scheduled!',
          message: `A new class "${classTitle}" has been scheduled for you`,
          bookingId: booking._id,
        });
      }
    } catch (_) {}
    pushToUser(req.db, 'student', student._id, { title: initialStatus === 'pending' ? '📅 New class requested' : '📅 New class scheduled', body: initialStatus === 'pending' ? `"${classTitle}" — waiting for your teacher to confirm` : `"${classTitle}" has been booked for you`, icon: '/icons/icon.svg', tag: `booking-${booking._id}`, data: { url: '/student/dashboard' } }); // web push: independent of the socket server

    res.status(201).json({
      success: true,
      message: initialStatus === "pending" ? "Booking request sent to teacher" : "Class created successfully",
      booking: populatedBooking,
    });
  } catch (err) {
    logger.error("Error creating booking:", { error: err?.message });
    serverError(res, "Error creating booking", err);
  }
});

// ─── Student confirms / disputes a teacher-logged class ──────────────────────
// A teacher logged a class held outside the app (offlineClassRoutes.js). Real
// students answer in their dashboard (components/student/ClassConfirmation.jsx);
// managed students' parents answer via a link (parentCheckRoutes.js). Same states:
//   confirm → parentCheck "confirmed"
//   dispute → parentCheck "denied" + dispute with a 3-day deadline (DISPUTE_DAYS)
// No answer by autoConfirmAt → counts as attended (utils/parentCheck.js sweep).
async function loadOwnLoggedClass(req, res) {
  if (req.user.role !== "student") { forbidden(res, "Students only"); return null; }
  const booking = await getBooking(req.db).findById(req.params.id).select("studentId loggedByTeacher status parentCheck");
  if (!booking || String(booking.studentId) !== req.user.id || !booking.loggedByTeacher) { notFound(res, "Class not found"); return null; }
  if (booking.parentCheck?.status !== "waiting") { badRequest(res, "You've already answered for this class"); return null; }
  return booking;
}

router.patch("/:id/student-confirm", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (!(await loadOwnLoggedClass(req, res))) return;
    const updated = await getBooking(req.db).findOneAndUpdate(
      { _id: req.params.id, "parentCheck.status": "waiting" },
      { $set: { "parentCheck.status": "confirmed", "parentCheck.respondedAt": new Date() } },
      { new: true },
    );
    if (!updated) return badRequest(res, "You've already answered for this class");
    res.json({ success: true, message: "Thanks for confirming!" });
  } catch (err) {
    logger.error("Student confirm error:", { error: err?.message });
    serverError(res, undefined, err);
  }
});

router.patch("/:id/dispute", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const booking = await loadOwnLoggedClass(req, res);
    if (!booking) return;
    const reason = toStr(req.body?.reason, "reason", { required: true, maxLen: 500 });
    const now = new Date();
    getStudent(req.db); getTeacher(req.db);
    const updated = await getBooking(req.db).findOneAndUpdate(
      { _id: booking._id, "parentCheck.status": "waiting", adminRejected: { $ne: true } },
      { $set: {
        "parentCheck.status": "denied", "parentCheck.respondedAt": now, "parentCheck.comment": reason,
        "parentCheck.disputeDeadline": disputeDeadlineFrom(now),
        disputeRaised: true, disputeStatus: "pending", disputedAt: now,
        disputeReason: `Student says this class didn't happen: "${reason}"`,
        disputedBy: "Student",
      } },
      { new: true },
    ).populate("studentId", "firstName lastName").populate("teacherId", "firstName lastName");
    if (!updated) return badRequest(res, "You've already answered for this class");

    const adminEmail = req.center?.adminEmail;
    if (adminEmail) {
      const { baseUrl } = getCenterBaseUrl(req.center);
      const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      sendEmail({
        centerName: req.center?.centerName, to: adminEmail,
        subject: `Student disputes a class logged by their teacher`,
        html: `<p>${esc(updated.studentId.firstName)} ${esc(updated.studentId.lastName)} says this class didn't happen:</p>
<ul><li><strong>Class:</strong> ${esc(updated.classTitle)} — ${esc(new Date(updated.scheduledTime).toUTCString())}</li>
<li><strong>Teacher:</strong> ${esc(updated.teacherId.firstName)} ${esc(updated.teacherId.lastName)}</li>
<li><strong>Reason:</strong> ${esc(reason)}</li></ul>
<p>Please review it within ${DISPUTE_DAYS} days in <a href="${baseUrl}/admin?tab=disputes">Disputes</a>, or it will be rejected automatically.</p>`,
      }).catch(e => logger.warn("Student dispute email failed:", { error: e?.message }));
    }
    res.json({ success: true, message: "Dispute sent — your school will review it." });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Student dispute error:", { error: err?.message });
    serverError(res, undefined, err);
  }
});

// ─── PATCH accept ─────────────────────────────────────────────────────────────
router.patch("/:id/accept", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email timezone")
      .populate("studentId", "firstName lastName email classCredits isManaged emailLanguage timezone");
    if (!booking) return notFound(res, "Booking not found");

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return forbidden(res, "You are not authorized to accept this booking");
    if (booking.status !== "pending")
      return res.status(400).json({ success: false, message: `Cannot accept booking with status: ${booking.status}` });
    // Credits may have run out since the request — a completed class would then be
    // free for the student while the teacher is still paid
    if (!booking.isTrial && (booking.studentId?.classCredits || 0) <= 0)
      return badRequest(res, `${booking.studentId?.firstName || "The student"} has no classes left — they need to buy more before this class can be accepted.`);
    // Other pending requests compete for the slot; an accepted class owns it
    const clash = await findTeacherClash(Booking, {
      teacherId: booking.teacherId._id, start: booking.scheduledTime, mins: booking.duration || 60,
      statuses: ["accepted", "in-progress", "scheduled"], excludeId: booking._id, classTitle: booking.classTitle,
    });
    if (clash) return conflict(res, `This overlaps another class already accepted ("${clash.classTitle}"). Reject one of them, or move this class.`);

    const acceptedAt = new Date();
    const claimed = await Booking.updateOne({ _id: booking._id, status: "pending" }, { $set: { status: "accepted", acceptedAt } });
    if (claimed.modifiedCount === 0) return conflict(res, "This booking was already handled — please refresh");
    Object.assign(booking, { status: "accepted", acceptedAt });

    // A class the admin booked → tell the admins the teacher accepted it
    if (isTeacher && booking.createdBy === "admin") {
      const tName = `${booking.teacherId.firstName} ${booking.teacherId.lastName}`.trim();
      const sName = `${booking.studentId.firstName} ${booking.studentId.lastName || ""}`.trim();
      notifyAdmins(req.db, {
        type: "booking_accepted", actorName: tName, actorRole: "teacher",
        message: `${tName} accepted the class "${booking.classTitle}" with ${sName}.`,
        metadata: { bookingId: booking._id, classTitle: booking.classTitle, teacherName: tName, studentName: sName, scheduledTime: booking.scheduledTime },
      });
    }

    try { await sendBookingAcceptedToStudent(booking.studentId, booking.teacherId, booking, req.center?.centerName || "", req.center); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'accepted',
        title: '✅ Class Confirmed!',
        message: `Your class "${booking.classTitle}" has been confirmed`,
        bookingId: booking._id,
      });
    } catch (_) {}
    pushToUser(req.db, 'student', booking.studentId._id, { title: '✅ Class Confirmed!', body: `"${booking.classTitle}" is confirmed`, icon: '/icons/icon.svg', tag: `booking-${booking._id}`, data: { url: '/student/dashboard' } }); // web push: independent of the socket server

    res.json({ success: true, message: "Booking accepted successfully", booking });
  } catch (err) {
    logger.error("Error accepting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error accepting booking" });
  }
});

// ─── POST join-reminder — "your class is starting, please join" email ────────
// Teacher of the class (if the admin allows it for this student) or an admin.
// The response never contains the student's email address for teachers.
router.post("/:id/join-reminder", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) return forbidden(res, "Not allowed");
    const r = await sendJoinReminder(req.db, req.center, req.params.id, { role: req.user.role, id: req.user.id });
    res.json({ success: true, message: `Reminder sent to ${r.studentName || "the student"}`, ...(req.user.role === "admin" ? { sentTo: r.sentTo } : {}) });
  } catch (err) {
    if (err instanceof ReminderError) return res.status(err.status).json({ success: false, message: err.message });
    logger.error("Join reminder error:", { error: err?.message });
    serverError(res, "Could not send the reminder", err);
  }
});

// ─── PATCH reject ─────────────────────────────────────────────────────────────
router.patch("/:id/reject", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const { reason } = req.body;
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email timezone")
      .populate("studentId", "firstName lastName email isManaged emailLanguage timezone");
    if (!booking) return notFound(res, "Booking not found");

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return forbidden(res, "You are not authorized to reject this booking");

    // Reject = decline a booking REQUEST. A class that is accepted, completed (already
    // paid) or settled can't be rejected — use cancel / the admin unmark flow instead.
    const rejectionReason = toStr(reason, "reason", { maxLen: 500 }) || "No reason provided";
    const rejectedAt = new Date();
    const updated = await Booking.updateOne(
      { _id: booking._id, status: "pending" },
      { $set: { status: "rejected", rejectionReason, rejectedAt } },
    );
    if (updated.modifiedCount === 0)
      return badRequest(res, `Only a pending booking request can be rejected (this one is ${booking.status === "pending" ? "no longer pending" : booking.status})`);
    Object.assign(booking, { status: "rejected", rejectionReason, rejectedAt });

    // A class the admin booked → tell the admins the teacher declined it (with the reason)
    if (isTeacher && booking.createdBy === "admin") {
      const tName = `${booking.teacherId.firstName} ${booking.teacherId.lastName}`.trim();
      const sName = `${booking.studentId.firstName} ${booking.studentId.lastName || ""}`.trim();
      notifyAdmins(req.db, {
        type: "booking_rejected", actorName: tName, actorRole: "teacher",
        message: `${tName} declined the class "${booking.classTitle}" with ${sName}. Reason: ${booking.rejectionReason}`,
        metadata: { bookingId: booking._id, classTitle: booking.classTitle, teacherName: tName, studentName: sName, scheduledTime: booking.scheduledTime, reason: booking.rejectionReason },
      });
    }

    try { await sendBookingRejectedToStudent(booking.studentId, booking.teacherId, booking, req.center?.centerName || "", req.center); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'rejected',
        title: '❌ Booking Declined',
        message: `Your booking "${booking.classTitle}" was not accepted`,
        bookingId: booking._id,
      });
    } catch (_) {}
    pushToUser(req.db, 'student', booking.studentId._id, { title: '❌ Booking Declined', body: `"${booking.classTitle}" was not accepted`, icon: '/icons/icon.svg', tag: `booking-${booking._id}`, data: { url: '/student/dashboard' } }); // web push: independent of the socket server

    res.json({ success: true, message: "Booking rejected", booking });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Error rejecting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error rejecting booking" });
  }
});

// ─── PATCH complete ───────────────────────────────────────────────────────────
// Admin-only manual completion (classes normally complete through the
// classroom attendance flow). Previously any signed-in user could call this
// and trigger teacher pay + a credit deduction for any class.
router.patch("/:id/complete", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const current = await Booking.findById(req.params.id).select("status").lean();
    if (!current) return notFound(res, "Booking not found");
    if (current.status !== "accepted")
      return res.status(400).json({ success: false, message: `Cannot complete booking with status: ${current.status}` });

    // The single completion path: claims the booking atomically (a double click can't
    // pay twice), charges the credit, pays the teacher (trial classes are free), deletes the PDF.
    const result = await completeClass(req.db, req.params.id, "admin", { skipAttendanceCheck: true });
    if (result.alreadyProcessed)
      return conflict(res, "This class was already completed — please refresh");

    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email googleMeetLink zoomLink timezone")
      .populate("studentId", "firstName lastName email classCredits isManaged emailLanguage timezone");

    try { await sendClassCompletedNotification(booking.teacherId, booking.studentId, booking, req.center?.centerName || "", req.center); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Milestone certificates were awarded (and emailed) by completeClass
    const newCerts = result.newCertificates || [];

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'completed',
        title: '🎉 Class Completed!',
        message: `Your class "${booking.classTitle}" has been marked as completed`,
        bookingId: booking._id,
      });
      // Notify student of any new certificates
      for (const cert of newCerts) {
        io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('certificate-awarded', {
          title:             '🏆 Certificate Earned!',
          message:           `You've earned: ${cert.title}`,
          certificateNumber: cert.certificateNumber,
          certId:            cert._id,
        });
      }
    } catch (_) {}
    pushToUser(req.db, 'student', booking.studentId._id, { title: '🎉 Class Completed!', body: `"${booking.classTitle}" is done — great work!`, icon: '/icons/icon.svg', tag: `booking-${booking._id}`, data: { url: '/student/dashboard' } }); // web push: independent of the socket server

    const updatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName earned lessonsCompleted")
      .populate("studentId", "firstName lastName classCredits isManaged");

    res.json({
      success: true, message: "Class completed successfully",
      booking: updatedBooking,
      studentClassesRemaining: updatedBooking.studentId.classCredits,
      teacherEarned: updatedBooking.teacherId.earned,
      teacherLessonsCompleted: updatedBooking.teacherId.lessonsCompleted,
    });
  } catch (err) {
    logger.error("Error completing booking:", { error: err?.message });
    serverError(res, "Error completing booking", err);
  }
});

// ─── GET all bookings ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const { status, sort } = req.query;
    // ?active=1 — accepted classes that are live now or still to come, soonest first
    // (admin Classes tab). Classes run at most 3h, so 4h back covers every live one.
    const active = req.query.active === "1";
    const { limit, skip } = parsePagination(req.query, active ? 500 : 100, 500);
    const filter = active
      ? { status: "accepted", scheduledTime: { $gte: new Date(Date.now() - 4 * 3600000) } }
      : (typeof status === "string" && status ? { status } : {});
    // sort=recent → newest-created first (dashboard "Recent Bookings"); default is by class time
    const order = active ? { scheduledTime: 1 } : sort === "recent" ? { createdAt: -1 } : { scheduledTime: -1 };
    const [bookings, total, acceptedTotal] = await Promise.all([
      getBooking(req.db).find(filter)
        .populate("teacherId", "firstName lastName email googleMeetLink zoomLink timezone")
        .populate("studentId", "firstName lastName email isManaged emailLanguage timezone")
        .sort(order).skip(skip).limit(limit).lean(),
      getBooking(req.db).countDocuments(filter),
      active ? getBooking(req.db).countDocuments({ status: "accepted" }) : undefined,
    ]);
    res.json({ success: true, bookings, total, limit, skip, ...(active ? { acceptedTotal } : {}) });
  } catch (err) {
    logger.error("Error fetching bookings:", { error: err?.message });
    serverError(res, "Error fetching bookings", err);
  }
});

// ─── GET teacher bookings ─────────────────────────────────────────────────────
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;
    // Allow-list: admin, the teacher themself, or a student (busy times only, below)
    const { role } = req.user;
    if (role === "teacher" && req.user.id !== teacherId)
      return forbidden(res, "You can only view your own bookings");
    if (!["admin", "teacher", "student"].includes(role))
      return forbidden(res, "Not authorized to view these bookings");

    const { limit, skip } = parsePagination(req.query, 50, 200);
    const filter = { teacherId };
    if (status === "completed") filter.status = { $in: ["completed", "missed"] };
    else if (status?.includes(",")) filter.status = { $in: status.split(",") };
    else if (status) filter.status = status;

    // Students only need busy times for the booking calendar — never expose
    // other students' identities, notes, or booking details.
    if (req.user.role === "student") {
      const rows = await getBooking(req.db).find(filter)
        .select("_id scheduledTime duration status studentId classTitle")
        .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean();
      return res.json(rows.map(({ studentId, classTitle, ...b }) => {
        const isMine = String(studentId) === String(req.user.id);
        return isMine ? { ...b, isMine, studentId, classTitle } : { ...b, isMine };
      }));
    }

    getStudent(req.db);
    const bookings = await getBooking(req.db).find(filter)
      .populate("studentId", "firstName lastName email classCredits isManaged emailLanguage timezone")
      .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching teacher bookings:", { error: err?.message });
    serverError(res, "Error fetching teacher bookings", err);
  }
});

// ─── GET student bookings ─────────────────────────────────────────────────────
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    // Allow-list: admin, the student themself, or a teacher (filtered to their own classes below)
    if (req.user.role === "student" && req.user.id !== studentId)
      return forbidden(res, "You can only view your own bookings");
    if (!["admin", "teacher", "student"].includes(req.user.role))
      return forbidden(res, "Not authorized to view these bookings");

    // Teachers may only view bookings where they are the assigned teacher
    getTeacher(req.db);
    const { limit, skip } = parsePagination(req.query, 50, 200);
    const filter = { studentId };
    if (req.user.role === "teacher") filter.teacherId = req.user.id;
    if (status === "completed") filter.status = { $in: ["completed", "missed"] };
    else if (status === "pending_confirmation") {
      // Teacher-logged classes still waiting for this student's answer (ClassConfirmation)
      Object.assign(filter, { status, loggedByTeacher: true, "parentCheck.status": "waiting" });
    }
    else if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("teacherId", "firstName lastName email continent googleMeetLink zoomLink timezone")
      // Past classes newest first (otherwise the cap keeps the OLDEST ones); upcoming soonest first
      .sort({ scheduledTime: status === "completed" ? -1 : 1 }).skip(skip).limit(limit).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching student bookings:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching student bookings" });
  }
});

// ─── PATCH cancel ─────────────────────────────────────────────────────────────
router.patch("/:id/cancel", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const { reason } = req.body;
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id);
    if (!booking) return notFound(res, "Booking not found");

    // Only an admin or someone in this class may cancel it
    const { role, id: userId } = req.user;
    const isParticipant =
      (role === "teacher" && String(booking.teacherId) === String(userId)) ||
      (role === "student" && String(booking.studentId) === String(userId));
    if (role !== "admin" && !isParticipant) return forbidden(res, "You can only cancel your own classes");
    if (["completed", "cancelled"].includes(booking.status)) {
      return badRequest(res, `This class is already ${booking.status}`);
    }

    booking.status      = "cancelled";
    booking.cancelledAt = new Date();
    booking.notes       = reason || booking.notes;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email timezone")
      .populate("studentId", "firstName lastName email isManaged emailLanguage timezone");
    res.json({ success: true, message: "Booking cancelled", booking: populatedBooking });

    // Tell whoever didn't cancel — nobody was told before, so a teacher could wait
    // for a class the student had cancelled. (Managed students' placeholder
    // addresses are skipped by sendEmail.)
    const byRole = role === "teacher" || role === "student" ? role : "admin";
    const tell = [
      byRole !== "teacher" && { to: populatedBooking.teacherId, role: "teacher" },
      byRole !== "student" && { to: populatedBooking.studentId, role: "student" },
    ].filter((x) => x && x.to?.email);
    for (const t of tell) {
      sendClassCancelledEmail({ ...t, byRole, booking: populatedBooking, reason: typeof reason === "string" ? reason.slice(0, 500) : "",
        centerName: req.center?.centerName || "", center: req.center })
        .catch((e) => logger.warn("Class cancelled email failed:", { error: e?.message }));
    }
    const when = new Date(populatedBooking.scheduledTime).toUTCString().slice(0, 22);
    const tag = `booking-${populatedBooking._id}`;
    if (byRole !== "teacher") pushTeacher(req.db, populatedBooking.teacherId, "🚫 Class cancelled", `"${populatedBooking.classTitle}" · ${when} UTC`, { tag, tab: "classes" });
    if (byRole !== "student") pushStudent(req.db, populatedBooking.studentId, "🚫 Class cancelled", `"${populatedBooking.classTitle}" · ${when} UTC`, { tag });
  } catch (err) {
    logger.error("Error cancelling booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error cancelling booking" });
  }
});

// ─── POST student-request — student self-books a pending class ────────────────
// Student picks a teacher + slot from the calendar; booking lands as "pending"
// and goes into the teacher's accept/reject queue.
router.post("/student-request", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student")
      return forbidden(res, "Only students can use this endpoint");

    const { scheduledTime, duration, topic, notes } = req.body;
    const teacherId  = toObjectId(req.body.teacherId, "teacherId");
    const classTitle = toStr(req.body.classTitle || "Class Request", "classTitle", { maxLen: 200 });

    if (!scheduledTime) return badRequest(res, "scheduledTime is required");
    if (!teacherId)     return badRequest(res, "teacherId is required");

    const [teacher, student] = await Promise.all([
      getTeacher(req.db).findById(teacherId).select("firstName lastName email timezone active status workingHours workingHoursTz"),
      getStudent(req.db).findById(req.user.id).select("firstName lastName email classCredits timezone emailLanguage"),
    ]);
    if (!teacher || !teacher.active || teacher.status !== "active")
      return notFound(res, "Teacher not found or unavailable");
    if (!student) return notFound(res, "Student not found");

    // Each class costs a credit. Classes already requested/booked and not yet held
    // will use credits too, so a student with 1 credit can't request 10 classes.
    const credits = student.classCredits || 0;
    const upcoming = credits > 0 ? await getBooking(req.db).countDocuments({
      studentId: req.user.id, isTrial: { $ne: true },
      status: { $in: ["pending", "accepted"] }, scheduledTime: { $gte: new Date(Date.now() - 4 * 3600000) },
    }) : 0;
    if (credits - upcoming <= 0) {
      return badRequest(res, credits <= 0
        ? "You have no classes left. Please contact your school to buy more classes."
        : `Your ${credits} remaining class${credits === 1 ? " is" : "es are"} already booked. Please buy more classes to request another.`);
    }

    const slotStart = new Date(scheduledTime);
    const mins = Number(duration) || 60;
    if (isNaN(slotStart)) return badRequest(res, "scheduledTime is invalid");
    if (mins < 15 || mins > 180) return badRequest(res, "Duration must be 15–180 minutes");
    if (slotStart.getTime() <= Date.now()) return badRequest(res, "Please pick a time in the future");
    const slotEnd = new Date(slotStart.getTime() + mins * 60000);

    // Conflict check — don't double-book the teacher (classes run at most 3h,
    // so anything that could overlap starts within 4h before this one)
    const nearby = await getBooking(req.db).find({
      teacherId,
      scheduledTime: { $lt: slotEnd, $gte: new Date(slotStart.getTime() - 4 * 3600000) },
      status: { $in: BUSY_STATUSES },
    }).lean();
    if (nearby.some(b => bookingInterval(b).end > slotStart.getTime()))
      return res.status(409).json({ success: false, message: "That time slot is already requested or booked" });

    // When the teacher has set working hours, the class must sit inside their
    // free time (working hours − time off − other classes). No hours set →
    // any time can be requested; the teacher approves or declines.
    if ((teacher.workingHours || []).length) {
      const blocks = await getTeacherAvailability(req.db).find({ teacherId }).lean();
      const free = freeIntervals({
        teacher, tz: teacherTz(teacher, blocks), blocks, bookings: nearby,
        from: new Date(slotStart.getTime() - 86400000), to: new Date(slotEnd.getTime() + 86400000),
      });
      if (!free.some(f => f.start <= slotStart.getTime() && f.end >= slotEnd.getTime()))
        return res.status(409).json({ success: false, message: "That time isn't free in the teacher's schedule — please pick one of the green times" });
    }

    const Booking = getBooking(req.db);
    const booking  = await Booking.create({
      teacherId,
      studentId:          req.user.id,
      classTitle,
      topic:              toStr(topic,  "topic",  { maxLen: 500 }) || "",
      notes:              toStr(notes,  "notes",  { maxLen: 2000 }) || "",
      scheduledTime:      slotStart,
      duration:           mins,
      status:             "pending",
      createdBy:          "student",
      createdByUserId:    req.user.id,
      createdByUserModel: "Student",
      teacherTimezone:    teacher.timezone || "",
      studentTimezone:    student.timezone || "",
    });

    const populated = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email timezone")
      .populate("studentId", "firstName lastName email isManaged emailLanguage timezone");

    pushTeacher(req.db, teacher._id, "📅 New class request", `${student.firstName} ${student.lastName || ""} — "${populated.classTitle}"`, { tag: `booking-${populated._id}`, tab: "bookings" });
    sendBookingRequestToTeacher(teacher, student, populated, req.center?.centerName || "", req.center)
      .catch(e => logger.error("Teacher booking email failed:", { error: e?.message }));
    sendBookingCreatedToStudent(student, teacher, populated, req.center?.centerName || "", req.center)
      .catch(e => logger.error("Student booking email failed:", { error: e?.message }));

    res.status(201).json({
      success: true,
      message: "Booking request sent to teacher — you'll be notified when they confirm",
      booking: populated,
    });
  } catch (err) {
    logger.error("Error creating student booking request:", { error: err?.message });
    serverError(res, "Error creating booking request", err);
  }
});

// ─── DELETE booking ───────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const booking = await getBooking(req.db).findById(req.params.id);
    if (!booking) return notFound(res, "Booking not found");

    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.role === "teacher" && String(booking.teacherId) === String(req.user.id);
    if (!isAdmin && !isOwner) return forbidden(res, "Not authorised to delete this booking");

    // Bookings that carry money or a record of what happened are never deleted —
    // a completed class has a payment, a disputed one is evidence, a logged one awaits approval.
    const filter = {
      _id: booking._id,
      status: { $in: isAdmin ? ADMIN_DELETABLE : TEACHER_DELETABLE },
      adminRejected: { $ne: true },
      disputeStatus: { $ne: "pending" },
      // A teacher can't erase a class that has already started (hiding a no-show before it's marked missed)
      ...(isAdmin ? {} : { $or: [{ status: { $ne: "accepted" } }, { scheduledTime: { $gt: new Date() } }] }),
    };
    const deleted = await getBooking(req.db).findOneAndDelete(filter);
    if (!deleted) {
      return badRequest(res, booking.status === "completed" || booking.adminRejected
        ? "A completed class can't be deleted — it has a payment record. Use \"unmark\" to reverse it instead."
        : booking.disputeStatus === "pending"
        ? "This class has an open dispute and can't be deleted"
        : booking.status === "accepted"
        ? "This class has already started, so it can't be deleted. Cancel it instead — the cancellation stays on record."
        : `This class can't be deleted (${booking.status}). Cancel it instead.`);
    }
    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    logger.error("Error deleting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error deleting booking" });
  }
});

export default router;
