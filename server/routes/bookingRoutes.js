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
router.get("/:id", verifyToken, async (req, res) => {
  try {
    // Ensure Teacher and Student models are registered on this connection before populate
    getTeacher(req.db);
    getStudent(req.db);
    const booking = await getBooking(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .populate("studentId", "firstName surname email noOfClasses");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isAuthorized =
      req.user.role === "admin" ||
      (req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id) ||
      (req.user.role === "student" && booking.studentId._id.toString() === req.user.id);
    if (!isAuthorized) return res.status(403).json({ success: false, message: "Not authorized to view this booking" });

    res.json({ success: true, booking });
  } catch (err) {
    logger.error("Error fetching booking:", { error: err?.message });
    if (err.name === "CastError") return res.status(400).json({ success: false, message: "Invalid booking ID format" });
    res.status(500).json({ success: false, message: "Error fetching booking" });
  }
});

// ─── POST create booking ──────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    const { teacherId, studentId, classTitle, topic, scheduledTime, duration, notes, createdBy = "admin" } = req.body;

    if (!canCreateBooking(req, createdBy))
      return res.status(403).json({ success: false, message: "You are not authorized to create bookings with this role" });
    if (!teacherId || !studentId || !classTitle || !scheduledTime)
      return res.status(400).json({ success: false, message: "Teacher, student, class title, and scheduled time are required" });
    if (classTitle.length > 200) return res.status(400).json({ success: false, message: "Class title must be 200 characters or fewer" });
    if (topic && topic.length > 500) return res.status(400).json({ success: false, message: "Topic must be 500 characters or fewer" });
    if (notes && notes.length > 2000) return res.status(400).json({ success: false, message: "Notes must be 2000 characters or fewer" });

    const [teacher, student] = await Promise.all([
      getTeacher(req.db).findById(teacherId),
      getStudent(req.db).findById(studentId),
    ]);
    if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    if (student.noOfClasses <= 0)
      return res.status(400).json({ success: false, message: `Student ${student.firstName} ${student.surname} has no classes remaining` });

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
      .populate("studentId", "firstName surname email noOfClasses");

    if (createdBy === "admin") {
      sendBookingRequestToTeacher(teacher, student, populatedBooking, req.center?.centerName || "").catch(e => logger.error("Teacher booking email failed:", { error: e?.message }));
    }
    sendBookingCreatedToStudent(student, teacher, populatedBooking, req.center?.centerName || "").catch(e => logger.error("Student booking email failed:", { error: e?.message }));

    res.status(201).json({
      success: true,
      message: initialStatus === "pending" ? "Booking request sent to teacher" : "Class created successfully",
      booking: populatedBooking,
    });
  } catch (err) {
    logger.error("Error creating booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error creating booking", error: err.message });
  }
});

// ─── PATCH accept ─────────────────────────────────────────────────────────────
router.patch("/:id/accept", verifyToken, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email noOfClasses");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "You are not authorized to accept this booking" });
    if (booking.status !== "pending")
      return res.status(400).json({ success: false, message: `Cannot accept booking with status: ${booking.status}` });

    booking.status     = "accepted";
    booking.acceptedAt = new Date();
    await booking.save();

    try { await sendBookingAcceptedToStudent(booking.studentId, booking.teacherId, booking, req.center?.centerName || ""); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Push real-time update to student dashboard
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'accepted',
        title: '✅ Class Confirmed!',
        message: `Your class "${booking.classTitle}" has been confirmed`,
        bookingId: booking._id,
      });
    } catch (_) {}

    res.json({ success: true, message: "Booking accepted successfully", booking });
  } catch (err) {
    logger.error("Error accepting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error accepting booking" });
  }
});

// ─── PATCH reject ─────────────────────────────────────────────────────────────
router.patch("/:id/reject", verifyToken, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const { reason } = req.body;
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isTeacher = req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id;
    if (!isTeacher && req.user.role !== "admin")
      return res.status(403).json({ success: false, message: "You are not authorized to reject this booking" });

    booking.status          = "rejected";
    booking.rejectionReason = reason || "No reason provided";
    booking.rejectedAt      = new Date();
    await booking.save();

    try { await sendBookingRejectedToStudent(booking.studentId, booking.teacherId, booking, req.center?.centerName || ""); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Push real-time update to student dashboard
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'rejected',
        title: '❌ Booking Declined',
        message: `Your booking "${booking.classTitle}" was not accepted`,
        bookingId: booking._id,
      });
    } catch (_) {}

    res.json({ success: true, message: "Booking rejected", booking });
  } catch (err) {
    logger.error("Error rejecting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error rejecting booking" });
  }
});

// ─── PATCH complete ───────────────────────────────────────────────────────────
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned googleMeetLink")
      .populate("studentId", "firstName surname email noOfClasses");
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.status !== "accepted")
      return res.status(400).json({ success: false, message: `Cannot complete booking with status: ${booking.status}` });

    booking.status        = "completed";
    booking.markedBy      = "classroom";
    booking.adminRejected = false;
    booking.completedAt   = new Date();
    await booking.save();

    const Student = getStudent(req.db);
    const student = await Student.findById(booking.studentId._id);
    if (student && student.noOfClasses > 0) {
      student.noOfClasses -= 1;
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

    try { await sendClassCompletedNotification(booking.teacherId, booking.studentId, booking); }
    catch (e) { logger.error("Email notification failed:", { error: e?.message }); }

    // Push real-time update to student dashboard
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${booking.studentId._id}`).emit('booking-update', {
        type: 'completed',
        title: '🎉 Class Completed!',
        message: `Your class "${booking.classTitle}" has been marked as completed`,
        bookingId: booking._id,
      });
    } catch (_) {}

    const updatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName earned lessonsCompleted")
      .populate("studentId", "firstName surname noOfClasses");

    res.json({
      success: true, message: "Class completed successfully",
      booking: updatedBooking,
      studentClassesRemaining: updatedBooking.studentId.noOfClasses,
      teacherEarned: updatedBooking.teacherId.earned,
      teacherLessonsCompleted: updatedBooking.teacherId.lessonsCompleted,
    });
  } catch (err) {
    logger.error("Error completing booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error completing booking", error: err.message });
  }
});

// ─── GET all bookings ─────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const { status } = req.query;
    const filter = status ? { status } : {};
    const bookings = await getBooking(req.db).find(filter)
      .populate("teacherId", "firstName lastName email googleMeetLink")
      .populate("studentId", "firstName surname email")
      .sort({ scheduledTime: -1 }).limit(500).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching bookings:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching bookings" });
  }
});

// ─── GET teacher bookings ─────────────────────────────────────────────────────
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;
    if (req.user.role === "teacher" && req.user.id !== teacherId)
      return res.status(403).json({ success: false, message: "You can only view your own bookings" });

    getStudent(req.db);
    const filter = { teacherId };
    if (status === "completed") filter.status = { $in: ["completed", "missed"] };
    else if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("studentId", "firstName surname email noOfClasses")
      .sort({ scheduledTime: -1 }).limit(200).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching teacher bookings:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching teacher bookings" });
  }
});

// ─── GET student bookings ─────────────────────────────────────────────────────
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;
    if (req.user.role === "student" && req.user.id !== studentId)
      return res.status(403).json({ success: false, message: "You can only view your own bookings" });

    getTeacher(req.db);
    const filter = { studentId };
    if (status === "completed") filter.status = { $in: ["completed", "missed"] };
    else if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .sort({ scheduledTime: 1 }).limit(200).lean();
    res.json(bookings);
  } catch (err) {
    logger.error("Error fetching student bookings:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching student bookings" });
  }
});

// ─── PATCH cancel ─────────────────────────────────────────────────────────────
router.patch("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const Booking = getBooking(req.db);
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.status      = "cancelled";
    booking.cancelledAt = new Date();
    booking.notes       = reason || booking.notes;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");
    res.json({ success: true, message: "Booking cancelled", booking: populatedBooking });
  } catch (err) {
    logger.error("Error cancelling booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error cancelling booking" });
  }
});

// ─── DELETE booking ───────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await getBooking(req.db).findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.role === "teacher" && String(booking.teacherId) === String(req.user.id);
    if (!isAdmin && !isOwner) return res.status(403).json({ success: false, message: "Not authorised to delete this booking" });

    await booking.deleteOne();
    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    logger.error("Error deleting booking:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error deleting booking" });
  }
});

export default router;
