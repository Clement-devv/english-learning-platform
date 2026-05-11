// server/routes/bookingRoutes.js
import express from "express";
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
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { checkAndAwardCertificates } from './certificateRoutes.js';
import { validateObjectId } from '../middleware/validateObjectId.js';
import { parsePagination } from '../utils/pagination.js';
import { toStr, toObjectId } from '../utils/inputSanitizer.js';
import { sendPush } from '../utils/webPushService.js';

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

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
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .populate("studentId", "firstName lastName email classCredits");
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
    if (student.classCredits <= 0)
      return res.status(400).json({ success: false, message: `Student ${student.firstName} ${student.lastName} has no classes remaining` });

    const initialStatus = createdBy === "admin" ? "pending" : "accepted";
    const Booking = getBooking(req.db);

    const booking = await Booking.create({
      teacherId, studentId, classTitle,
      topic: topic || "", scheduledTime: new Date(scheduledTime),
      duration: duration || 60, notes: notes || "",
      status: initialStatus, createdBy,
      createdByUserId: req.user.id,
      createdByUserModel: createdBy === "admin" ? "Admin" : "Teacher",
      teacherTimezone: teacher.timezone || "",
      studentTimezone: student.timezone || "",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email classCredits");

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

// ─── PATCH accept ─────────────────────────────────────────────────────────────
router.patch("/:id/accept", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email classCredits");
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
      .populate("studentId", "firstName lastName email");
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
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned googleMeetLink")
      .populate("studentId", "firstName lastName email classCredits");
    if (!booking) return notFound(res, "Booking not found");
    if (booking.status !== "accepted")
      return res.status(400).json({ success: false, message: `Cannot complete booking with status: ${booking.status}` });

    booking.status        = "completed";
    booking.markedBy      = "classroom";
    booking.adminRejected = false;
    booking.completedAt   = new Date();
    await booking.save();

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
      .populate("studentId", "firstName lastName classCredits");

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
    const { limit, skip } = parsePagination(req.query, 100, 500);
    const filter = status ? { status } : {};
    const [bookings, total] = await Promise.all([
      getBooking(req.db).find(filter)
        .populate("teacherId", "firstName lastName email googleMeetLink")
        .populate("studentId", "firstName lastName email")
        .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean(),
      getBooking(req.db).countDocuments(filter),
    ]);
    res.json({ success: true, bookings, total, limit, skip });
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
      .populate("studentId", "firstName lastName email classCredits")
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
    else if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .sort({ scheduledTime: 1 }).skip(skip).limit(limit).lean();
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
      .populate("studentId", "firstName lastName email");
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
      getTeacher(req.db).findById(teacherId).select("firstName lastName email timezone active status"),
      getStudent(req.db).findById(req.user.id).select("firstName lastName email classCredits timezone"),
    ]);
    if (!teacher || !teacher.active || teacher.status !== "active")
      return notFound(res, "Teacher not found or unavailable");
    if (!student) return notFound(res, "Student not found");

    // Conflict check — don't allow double-booking same teacher at same time
    const slotStart = new Date(scheduledTime);
    const slotEnd   = new Date(slotStart.getTime() + ((duration || 60) * 60000));
    const clashingBooking = await getBooking(req.db).findOne({
      teacherId,
      scheduledTime: { $lt: slotEnd, $gte: new Date(slotStart.getTime() - ((duration || 60) * 60000)) },
      status: { $in: ["pending", "accepted"] },
    });
    if (clashingBooking)
      return res.status(409).json({ success: false, message: "That time slot is already requested or booked" });

    const Booking = getBooking(req.db);
    const booking  = await Booking.create({
      teacherId,
      studentId:          req.user.id,
      classTitle,
      topic:              toStr(topic,  "topic",  { maxLen: 500 }) || "",
      notes:              toStr(notes,  "notes",  { maxLen: 2000 }) || "",
      scheduledTime:      slotStart,
      duration:           duration || 60,
      status:             "pending",
      createdBy:          "student",
      createdByUserId:    req.user.id,
      createdByUserModel: "Student",
      teacherTimezone:    teacher.timezone || "",
      studentTimezone:    student.timezone || "",
    });

    const populated = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");

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
