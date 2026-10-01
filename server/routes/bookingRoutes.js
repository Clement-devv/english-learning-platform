// server/routes/bookingRoutes.js
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import {
  sendBookingRequestToTeacher, sendBookingAcceptedToStudent,
  sendBookingRejectedToStudent, sendBookingCreatedToStudent,
  sendClassCompletedNotification,
} from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { teacherAvailabilitySchema } from "../schemas/teacherAvailabilitySchema.js";
import { freeIntervals, teacherTz, bookingInterval, BUSY_STATUSES } from "../utils/schedule.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { checkAndAwardCertificates } from './certificateRoutes.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { parsePagination } from '../utils/pagination.js';
import { toStr, toObjectId } from '../utils/inputSanitizer.js';
import { sendPush } from '../utils/webPushService.js';
import { disputeDeadlineFrom, DISPUTE_DAYS } from '../utils/parentCheck.js';
import { sendEmail, getCenterBaseUrl } from '../utils/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Silently remove the session PDF for a booking — never throws.
function deleteSessionPdf(bookingId) {
  try {
    const filePath = path.join(__dirname, "..", "uploads", "content", `${bookingId}.pdf`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    logger.error("PDF cleanup failed:", { bookingId, error: e?.message });
  }
}

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacherAvailability = (db) => db.models.TeacherAvailability || db.model("TeacherAvailability", teacherAvailabilitySchema);

const canCreateBooking = (req, createdBy) => {
  const { role, id } = req.user;
  if (role === "admin"   && createdBy === "admin")   return true;
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
      .populate("teacherId", "firstName lastName email continent googleMeetLink zoomLink")
      .populate("studentId", "firstName lastName email classCredits isManaged");
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
router.post("/", verifyToken, async (req, res) => {
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

    const [teacher, student] = await Promise.all([
      getTeacher(req.db).findById(teacherId),
      getStudent(req.db).findById(studentId),
    ]);
    if (!teacher) return notFound(res, "Teacher not found");
    if (!student) return notFound(res, "Student not found");
    if (!isTrial && student.classCredits <= 0)
      return res.status(400).json({ success: false, message: `Student ${student.firstName} ${student.lastName} has no classes remaining` });

    const initialStatus = createdBy === "admin" ? "pending" : "accepted";
    const Booking = getBooking(req.db);

    const booking = await Booking.create({
      teacherId, studentId, classTitle,
      topic: topic || "", scheduledTime: new Date(scheduledTime),
      duration: duration || 60, notes: notes || "",
      status: initialStatus, createdBy,
      isTrial,
      createdByUserId: req.user.id,
      createdByUserModel: createdBy === "admin" ? "Admin" : "Teacher",
      teacherTimezone: teacher.timezone || "",
      studentTimezone: student.timezone || "",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email classCredits isManaged");

    if (createdBy === "admin") {
      sendBookingRequestToTeacher(teacher, student, populatedBooking, req.center?.centerName || "", req.center).catch(e => logger.error("Teacher booking email failed:", { error: e?.message }));
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
      if (student.pushSubscription?.endpoint) {
        sendPush(student.pushSubscription, { title: '📅 New Class Scheduled!', body: `"${classTitle}" has been booked for you`, icon: '/icons/icon.svg', data: { url: '/student/dashboard' } }).catch(() => {});
      }
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: initialStatus === "pending" ? "Booking request sent to teacher" : "Class created successfully",
      booking: populatedBooking,
    });
  } catch (err) {
    logger.error("Error creating booking:", { error: err?.message });
    serverError(res, "Error creating booking");
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
    serverError(res);
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
<p>Please review it within ${DISPUTE_DAYS} days in <a href="${baseUrl}/admin/dashboard">Disputes</a>, or it will be rejected automatically.</p>`,
      }).catch(e => logger.warn("Student dispute email failed:", { error: e?.message }));
    }
    res.json({ success: true, message: "Dispute sent — your school will review it." });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Student dispute error:", { error: err?.message });
    serverError(res);
  }
});

// ─── PATCH accept ─────────────────────────────────────────────────────────────
router.patch("/:id/accept", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email classCredits isManaged");
    if (!booking) return notFound(res, "Booking not found");

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return forbidden(res, "You are not authorized to accept this booking");
    if (booking.status !== "pending")
      return res.status(400).json({ success: false, message: `Cannot accept booking with status: ${booking.status}` });

    booking.status     = "accepted";
    booking.acceptedAt = new Date();
    await booking.save();

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
      getStudent(req.db).findById(booking.studentId._id).select('pushSubscription').then(s => {
        if (s?.pushSubscription?.endpoint)
          sendPush(s.pushSubscription, { title: '✅ Class Confirmed!', body: `"${booking.classTitle}" is confirmed`, icon: '/icons/icon.svg', data: { url: '/student/dashboard' } }).catch(() => {});
      }).catch(() => {});
    } catch (_) {}

    res.json({ success: true, message: "Booking accepted successfully", booking });
  } catch (err) {
    logger.error("Error accepting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error accepting booking" });
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
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email isManaged");
    if (!booking) return notFound(res, "Booking not found");

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return forbidden(res, "You are not authorized to reject this booking");

    booking.status          = "rejected";
    booking.rejectionReason = reason || "No reason provided";
    booking.rejectedAt      = new Date();
    await booking.save();

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
      getStudent(req.db).findById(booking.studentId._id).select('pushSubscription').then(s => {
        if (s?.pushSubscription?.endpoint)
          sendPush(s.pushSubscription, { title: '❌ Booking Declined', body: `"${booking.classTitle}" was not accepted`, icon: '/icons/icon.svg', data: { url: '/student/dashboard' } }).catch(() => {});
      }).catch(() => {});
    } catch (_) {}

    res.json({ success: true, message: "Booking rejected", booking });
  } catch (err) {
    logger.error("Error rejecting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error rejecting booking" });
  }
});

// ─── PATCH complete ───────────────────────────────────────────────────────────
router.patch("/:id/complete", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned googleMeetLink zoomLink")
      .populate("studentId", "firstName lastName email classCredits isManaged");
    if (!booking) return notFound(res, "Booking not found");
    if (booking.status !== "accepted")
      return res.status(400).json({ success: false, message: `Cannot complete booking with status: ${booking.status}` });

    booking.status        = "completed";
    booking.markedBy      = "classroom";
    booking.adminRejected = false;
    booking.completedAt   = new Date();
    await booking.save();

    // Remove the session PDF — no longer needed after class ends
    deleteSessionPdf(booking._id.toString());

    const Student = getStudent(req.db);
    const student = await Student.findById(booking.studentId._id);
    if (student && student.classCredits > 0) {
      student.classCredits -= 1;
      await student.save();
    }

    const Teacher = getTeacher(req.db);
    const teacher = await Teacher.findById(booking.teacherId._id);
    if (teacher) {
      const rate = parseFloat(teacher.ratePerClass || 0);
      teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
      teacher.earned           = (teacher.earned || 0) + rate;
      await teacher.save();

      await getPaymentTransaction(req.db).create({
        bookingId: booking._id, teacherId: teacher._id,
        studentId: student?._id, amount: rate,
        status: "pending", completedAt: new Date(),
      });
    }

    try { await sendClassCompletedNotification(booking.teacherId, booking.studentId, booking, req.center?.centerName || "", req.center); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Auto-award certificates for milestones reached
    const newCerts = await checkAndAwardCertificates(
      req.db, booking.studentId._id, req.center?.slug, req.center?._id
    );

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'completed',
        title: '🎉 Class Completed!',
        message: `Your class "${booking.classTitle}" has been marked as completed`,
        bookingId: booking._id,
      });
      getStudent(req.db).findById(booking.studentId._id).select('pushSubscription').then(s => {
        if (s?.pushSubscription?.endpoint)
          sendPush(s.pushSubscription, { title: '🎉 Class Completed!', body: `"${booking.classTitle}" is done — great work!`, icon: '/icons/icon.svg', data: { url: '/student/dashboard' } }).catch(() => {});
      }).catch(() => {});
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
    serverError(res, "Error completing booking");
  }
});

// ─── GET all bookings ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const { status } = req.query;
    // ?active=1 — accepted classes that are live now or still to come, soonest first
    // (admin Classes tab). Classes run at most 3h, so 4h back covers every live one.
    const active = req.query.active === "1";
    const { limit, skip } = parsePagination(req.query, active ? 500 : 100, 500);
    const filter = active
      ? { status: "accepted", scheduledTime: { $gte: new Date(Date.now() - 4 * 3600000) } }
      : (typeof status === "string" && status ? { status } : {});
    const [bookings, total, acceptedTotal] = await Promise.all([
      getBooking(req.db).find(filter)
        .populate("teacherId", "firstName lastName email googleMeetLink zoomLink")
        .populate("studentId", "firstName lastName email isManaged")
        .sort({ scheduledTime: active ? 1 : -1 }).skip(skip).limit(limit).lean(),
      getBooking(req.db).countDocuments(filter),
      active ? getBooking(req.db).countDocuments({ status: "accepted" }) : undefined,
    ]);
    res.json({ success: true, bookings, total, limit, skip, ...(active ? { acceptedTotal } : {}) });
  } catch (err) {
    logger.error("Error fetching bookings:", { error: err?.message });
    serverError(res, "Error fetching bookings");
  }
});

// ─── GET teacher bookings ─────────────────────────────────────────────────────
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;
    if (req.user.role === "teacher" && req.user.id !== teacherId)
      return forbidden(res, "You can only view your own bookings");

    getStudent(req.db);
    const { limit, skip } = parsePagination(req.query, 50, 200);
    const filter = { teacherId };
    if (status === "completed") filter.status = { $in: ["completed", "missed"] };
    else if (status?.includes(",")) filter.status = { $in: status.split(",") };
    else if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("studentId", "firstName lastName email classCredits isManaged")
      .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching teacher bookings:", { error: err?.message });
    serverError(res, "Error fetching teacher bookings");
  }
});

// ─── GET student bookings ─────────────────────────────────────────────────────
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    if (req.user.role === "student" && req.user.id !== studentId)
      return forbidden(res, "You can only view your own bookings");

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
      .populate("teacherId", "firstName lastName email continent googleMeetLink zoomLink")
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

    booking.status      = "cancelled";
    booking.cancelledAt = new Date();
    booking.notes       = reason || booking.notes;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email isManaged");
    res.json({ success: true, message: "Booking cancelled", booking: populatedBooking });
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
      getStudent(req.db).findById(req.user.id).select("firstName lastName email classCredits timezone"),
    ]);
    if (!teacher || !teacher.active || teacher.status !== "active")
      return notFound(res, "Teacher not found or unavailable");
    if (!student) return notFound(res, "Student not found");

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
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email isManaged");

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
    serverError(res, "Error creating booking request");
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

    await booking.deleteOne();
    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    logger.error("Error deleting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error deleting booking" });
  }
});

export default router;
