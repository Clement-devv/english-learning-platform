// server/routes/bookingRoutes.js - WITH EMAIL NOTIFICATIONS
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { 
  verifyToken, 
  verifyAdmin, 
  verifyAdminOrTeacher 
} from "../middleware/authMiddleware.js";
import {
  sendBookingRequestToTeacher,
  sendBookingAcceptedToStudent,
  sendBookingRejectedToStudent,
  sendClassCompletedNotification
} from "../utils/emailService.js";

const router = express.Router();

// ==================== HELPER FUNCTIONS ====================

const canCreateBooking = (req, createdBy) => {
  const { role, id } = req.user;
  if (role === "admin" && createdBy === "admin") return true;
  if (role === "teacher" && createdBy === "teacher") {
    return req.body.teacherId === id;
  }
  return false;
};

const getInitialStatus = (createdBy) => {
  return createdBy === "admin" ? "pending" : "accepted";
};

// server/routes/bookingRoutes.js
// Add near the top, after imports

/**
 * GET /api/bookings/:id
 * Get a specific booking by ID
 * Accessible by: Admin, assigned teacher, assigned student
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email continent")
      .populate("studentId", "firstName surname email noOfClasses");
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    // Check authorization
    const isAuthorized = 
      req.user.role === "admin" ||
      (req.user.role === "teacher" && booking.teacherId._id.toString() === req.user.id) ||
      (req.user.role === "student" && booking.studentId._id.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false,
        message: "Not authorized to view this booking" 
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (err) {
    console.error("❌ Error fetching booking:", err);
    
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        success: false,
        message: "Invalid booking ID format" 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Error fetching booking" 
    });
  }
});

// ==================== ROUTES WITH EMAIL NOTIFICATIONS ====================

/**
 * POST /api/bookings
 * Create a new booking and send email notification
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      teacherId,
      studentId,
      classTitle,
      topic,
      scheduledTime,
      duration,
      notes,
      createdBy = "admin"
    } = req.body;

    // Authorization check
    if (!canCreateBooking(req, createdBy)) {
      return res.status(403).json({ 
        success: false,
        message: "You are not authorized to create bookings with this role" 
      });
    }

    // Validation
    if (!teacherId || !studentId || !classTitle || !scheduledTime) {
      return res.status(400).json({ 
        success: false,
        message: "Teacher, student, class title, and scheduled time are required" 
      });
    }

    // Verify teacher and student exist
    const [teacher, student] = await Promise.all([
      Teacher.findById(teacherId),
      Student.findById(studentId)
    ]);

    if (!teacher) {
      return res.status(404).json({ 
        success: false,
        message: "Teacher not found" 
      });
    }

    if (!student) {
      return res.status(404).json({ 
        success: false,
        message: "Student not found" 
      });
    }

    // Check student has classes remaining
    if (student.noOfClasses <= 0) {
      return res.status(400).json({
        success: false,
        message: `Student ${student.firstName} ${student.surname} has no classes remaining`
      });
    }

    const initialStatus = getInitialStatus(createdBy);

    // Create booking
    const booking = await Booking.create({
      teacherId,
      studentId,
      classTitle,
      topic: topic || "",
      scheduledTime: new Date(scheduledTime),
      duration: duration || 60,
      notes: notes || "",
      status: initialStatus,
      createdBy,
      createdByUserId: req.user.id,
      createdByUserModel: createdBy === "admin" ? "Admin" : "Teacher"
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email noOfClasses");

    // ✅ SEND EMAIL NOTIFICATION (if admin-created booking)
    if (createdBy === "admin") {
      try {
        await sendBookingRequestToTeacher(teacher, student, populatedBooking);
        console.log(`📧 Booking notification sent to ${teacher.email}`);
      } catch (emailError) {
        console.error("📧 Email notification failed:", emailError.message);
        // Don't fail the booking creation if email fails
      }
    }

    console.log(`✅ Booking created by ${req.user.role}:`, {
      bookingId: booking._id,
      teacher: `${teacher.firstName} ${teacher.lastName}`,
      student: `${student.firstName} ${student.surname}`,
      status: initialStatus,
      createdBy
    });

    res.status(201).json({
      success: true,
      message: initialStatus === "pending" 
        ? "Booking request sent to teacher (email notification sent)" 
        : "Class created successfully",
      booking: populatedBooking
    });

  } catch (err) {
    console.error("❌ Error creating booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error creating booking",
      error: err.message 
    });
  }
});

/**
 * PATCH /api/bookings/:id/accept
 * Teacher accepts booking and sends email to student
 */
router.patch("/:id/accept", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email noOfClasses");
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    // Authorization check
    const isTeacher = req.user.role === "teacher" && 
                      booking.teacherId._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: "You are not authorized to accept this booking" 
      });
    }

    // Only pending bookings can be accepted
    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot accept booking with status: ${booking.status}`
      });
    }

    // Update booking status
    booking.status = "accepted";
    booking.acceptedAt = new Date();
    await booking.save();

    // ✅ SEND EMAIL NOTIFICATION TO STUDENT
    try {
      await sendBookingAcceptedToStudent(
        booking.studentId, 
        booking.teacherId, 
        booking
      );
      console.log(`📧 Acceptance notification sent to ${booking.studentId.email}`);
    } catch (emailError) {
      console.error("📧 Email notification failed:", emailError.message);
      // Don't fail the acceptance if email fails
    }

    console.log(`✅ Booking accepted:`, {
      bookingId: booking._id,
      acceptedBy: req.user.role,
      teacher: booking.teacherId.firstName,
      student: booking.studentId.firstName
    });

    res.json({
      success: true,
      message: "Booking accepted successfully (email sent to student)",
      booking
    });

  } catch (err) {
    console.error("❌ Error accepting booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error accepting booking" 
    });
  }
});

/**
 * PATCH /api/bookings/:id/reject
 * Teacher rejects booking and notifies student
 */
router.patch("/:id/reject", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    // Authorization check
    const isTeacher = req.user.role === "teacher" && 
                      booking.teacherId._id.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isTeacher && !isAdmin) {
      return res.status(403).json({ 
        success: false,
        message: "You are not authorized to reject this booking" 
      });
    }

    // Update booking status
    booking.status = "rejected";
    booking.rejectionReason = reason || "No reason provided";
    booking.rejectedAt = new Date();
    await booking.save();

    // ✅ SEND EMAIL NOTIFICATION TO STUDENT
    try {
      await sendBookingRejectedToStudent(
        booking.studentId, 
        booking.teacherId, 
        booking
      );
      console.log(`📧 Rejection notification sent to ${booking.studentId.email}`);
    } catch (emailError) {
      console.error("📧 Email notification failed:", emailError.message);
    }

    console.log(`❌ Booking rejected:`, {
      bookingId: booking._id,
      reason: booking.rejectionReason,
      rejectedBy: req.user.role
    });

    res.json({
      success: true,
      message: "Booking rejected (email sent to student)",
      booking
    });

  } catch (err) {
    console.error("❌ Error rejecting booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error rejecting booking" 
    });
  }
});

/**
 * PATCH /api/bookings/:id/complete
 * Complete booking and send notifications
 */
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses");
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({ 
        success: false,
        message: `Cannot complete booking with status: ${booking.status}` 
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update booking
      booking.status = "completed";
      booking.completedAt = new Date();
      await booking.save({ session });

      // Update student
      const student = await Student.findById(booking.studentId._id).session(session);
      if (student && student.noOfClasses > 0) {
        student.noOfClasses -= 1;
        await student.save({ session });
      }

      // Update teacher
      const teacher = await Teacher.findById(booking.teacherId._id).session(session);
      if (teacher) {
        const ratePerClass = parseFloat(teacher.ratePerClass || 0);
        teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
        teacher.earned = (teacher.earned || 0) + ratePerClass;
        await teacher.save({ session });

        // Create payment transaction
        await PaymentTransaction.create([{
          bookingId: booking._id,
          teacherId: teacher._id,
          studentId: student._id,
          amount: ratePerClass,
          status: "pending",
          completedAt: new Date()
        }], { session });
      }

      await session.commitTransaction();

      // ✅ SEND COMPLETION EMAILS
      try {
        await sendClassCompletedNotification(
          booking.teacherId,
          booking.studentId,
          booking
        );
        console.log(`📧 Completion notifications sent`);
      } catch (emailError) {
        console.error("📧 Email notification failed:", emailError.message);
      }

      const updatedBooking = await Booking.findById(booking._id)
        .populate("teacherId", "firstName lastName earned lessonsCompleted")
        .populate("studentId", "firstName surname noOfClasses");

      res.json({
        success: true,
        message: "Class completed successfully (notifications sent)",
        booking: updatedBooking,
        studentClassesRemaining: updatedBooking.studentId.noOfClasses,
        teacherEarned: updatedBooking.teacherId.earned,
        teacherLessonsCompleted: updatedBooking.teacherId.lessonsCompleted
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error completing booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error completing booking",
      error: err.message 
    });
  }
});

// ==================== OTHER ROUTES (unchanged) ====================

router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};

    const bookings = await Booking.find(filter)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ scheduledTime: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("❌ Error fetching bookings:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching bookings" 
    });
  }
});

router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;

    if (req.user.role === "teacher" && req.user.id !== teacherId) {
      return res.status(403).json({ 
        success: false,
        message: "You can only view your own bookings" 
      });
    }

    const filter = { teacherId };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("studentId", "firstName surname email noOfClasses")
      .sort({ scheduledTime: -1 });

    res.json(bookings);
  } catch (err) {
    console.error("❌ Error fetching teacher bookings:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching teacher bookings" 
    });
  }
});

router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    if (req.user.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ 
        success: false,
        message: "You can only view your own bookings" 
      });
    }

    const filter = { studentId };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("teacherId", "firstName lastName email continent")
      .sort({ scheduledTime: 1 });

    res.json(bookings);
  } catch (err) {
    console.error("❌ Error fetching student bookings:", err);
    res.status(500).json({ 
      success: false,
      message: "Error fetching student bookings" 
    });
  }
});

router.patch("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.notes = reason || booking.notes;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.json({
      success: true,
      message: "Booking cancelled",
      booking: populatedBooking
    });

  } catch (err) {
    console.error("❌ Error cancelling booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error cancelling booking" 
    });
  }
});

router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: "Booking not found" 
      });
    }

    res.json({ 
      success: true,
      message: "Booking deleted successfully" 
    });

  } catch (err) {
    console.error("❌ Error deleting booking:", err);
    res.status(500).json({ 
      success: false,
      message: "Error deleting booking" 
    });
  }
});

export default router;