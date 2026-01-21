// server/routes/bookingRoutes.js - ENHANCED BOOKING COMPLETION WITH PAYMENT TRACKING
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * PATCH /api/bookings/:id/complete
 * ✅ ENHANCED: Mark booking as completed, reduce student classes, AND update teacher earnings
 */
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses");
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only allow completion if booking is accepted
    if (booking.status !== "accepted") {
      return res.status(400).json({ 
        message: `Cannot complete booking with status: ${booking.status}` 
      });
    }

    // Start a transaction session for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Update booking status
      booking.status = "completed";
      booking.completedAt = new Date();
      await booking.save({ session });

      // 2. Reduce student's noOfClasses by 1
      const student = await Student.findById(booking.studentId._id).session(session);
      
      if (student && student.noOfClasses > 0) {
        student.noOfClasses -= 1;
        await student.save({ session });
        console.log(`✅ Reduced student ${student.firstName} ${student.surname}'s classes: ${student.noOfClasses + 1} → ${student.noOfClasses}`);
      } else if (student && student.noOfClasses === 0) {
        console.warn(`⚠️ Student ${student.firstName} ${student.surname} has 0 classes remaining`);
      }

      // 3. 🔥 UPDATE TEACHER EARNINGS
      const teacher = await Teacher.findById(booking.teacherId._id).session(session);
      
      if (teacher) {
        const ratePerClass = parseFloat(teacher.ratePerClass || 0);
        
        // Update teacher's earnings and lessons completed
        teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
        teacher.earned = (teacher.earned || 0) + ratePerClass;
        await teacher.save({ session });

        console.log(`💰 Updated teacher ${teacher.firstName} ${teacher.lastName}'s earnings:`);
        console.log(`   Lessons Completed: ${teacher.lessonsCompleted - 1} → ${teacher.lessonsCompleted}`);
        console.log(`   Earned: $${(teacher.earned - ratePerClass).toFixed(2)} → $${teacher.earned.toFixed(2)}`);

        // 4. 🔥 CREATE PAYMENT TRANSACTION RECORD
        const paymentTransaction = new PaymentTransaction({
          teacherId: teacher._id,
          bookingId: booking._id,
          amount: ratePerClass,
          type: "class_completion",
          status: "pending",
          description: `Payment for completed class: ${booking.classTitle}`,
          classTitle: booking.classTitle,
          studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
          completedAt: booking.completedAt
        });

        await paymentTransaction.save({ session });
        console.log(`📝 Created payment transaction: ${paymentTransaction._id}`);
      }

      // Commit the transaction
      await session.commitTransaction();

      // Return updated data
      const updatedBooking = await Booking.findById(booking._id)
        .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
        .populate("studentId", "firstName surname email noOfClasses");

      res.json({
        success: true,
        message: "Class completed successfully! Teacher earnings updated.",
        booking: updatedBooking,
        studentClassesRemaining: updatedBooking.studentId.noOfClasses,
        teacherEarned: updatedBooking.teacherId.earned,
        teacherLessonsCompleted: updatedBooking.teacherId.lessonsCompleted
      });

    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error completing booking:", err);
    res.status(500).json({ 
      message: "Error completing booking",
      error: err.message 
    });
  }
});

/**
 * GET /api/bookings/teacher/:teacherId
 * Get all bookings for a teacher with optional status filter
 */
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;

    // Teachers can only view their own bookings unless they're admin
    if (req.user.role === "teacher" && req.user.id !== teacherId) {
      return res.status(403).json({ message: "You can only view your own bookings" });
    }

    const filter = { teacherId };
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate("studentId", "firstName surname email")
      .sort({ scheduledTime: -1 });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching teacher bookings" });
  }
});

/**
 * GET /api/bookings/student/:studentId
 * Get all bookings for a student
 */
router.get("/student/:studentId", verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { status } = req.query;

    // Students can only view their own bookings unless they're admin/teacher
    if (req.user.role === "student" && req.user.id !== studentId) {
      return res.status(403).json({ message: "You can only view your own bookings" });
    }

    const filter = { studentId };
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate("teacherId", "firstName lastName email continent")
      .sort({ scheduledTime: 1 });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching student bookings" });
  }
});

/**
 * GET /api/bookings
 * Get all bookings (Admin only)
 */
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
    console.error(err);
    res.status(500).json({ message: "Error fetching bookings" });
  }
});

/**
 * POST /api/bookings
 * Create a new booking
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

    // Validation
    if (!teacherId || !studentId || !classTitle || !scheduledTime) {
      return res.status(400).json({ 
        message: "Teacher, student, class title, and scheduled time are required" 
      });
    }

    // Verify teacher and student exist
    const teacher = await Teacher.findById(teacherId);
    const student = await Student.findById(studentId);

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Create booking
    const booking = await Booking.create({
      teacherId,
      studentId,
      classTitle,
      topic: topic || "",
      scheduledTime: new Date(scheduledTime),
      duration: duration || 60,
      notes: notes || "",
      status: "pending",
      createdBy,
      createdByUserId: req.user.id,
      createdByUserModel: createdBy === "admin" ? "Admin" : createdBy === "teacher" ? "Teacher" : "Student"
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.status(201).json({
      message: "Booking created successfully",
      booking: populatedBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating booking" });
  }
});

/**
 * PATCH /api/bookings/:id/accept
 * Teacher accepts a booking
 */
router.patch("/:id/accept", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Verify the teacher is accepting their own booking
    if (booking.teacherId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to accept this booking" });
    }

    booking.status = "accepted";
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.json({
      message: "Booking accepted",
      booking: populatedBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error accepting booking" });
  }
});

/**
 * PATCH /api/bookings/:id/reject
 * Teacher rejects a booking
 */
router.patch("/:id/reject", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Verify the teacher is rejecting their own booking
    if (booking.teacherId.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized to reject this booking" });
    }

    booking.status = "rejected";
    booking.rejectionReason = reason || "No reason provided";
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.json({
      message: "Booking rejected",
      booking: populatedBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error rejecting booking" });
  }
});

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel a booking
 */
router.patch("/:id/cancel", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.notes = reason || booking.notes;
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.json({
      message: "Booking cancelled",
      booking: populatedBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error cancelling booking" });
  }
});

/**
 * DELETE /api/bookings/:id
 * Delete a booking (Admin only)
 */
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting booking" });
  }
});

export default router;