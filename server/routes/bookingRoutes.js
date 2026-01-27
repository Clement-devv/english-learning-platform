// server/routes/bookingRoutes.js 
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
 * Teacher marks class as complete (pending student confirmation)
 */
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Only allow completion if booking is accepted
    if (booking.status !== "accepted") {
      return res.status(400).json({ 
        message: `Cannot complete booking with status: ${booking.status}` 
      });
    }

    // 🆕 Set to pending_confirmation instead of completed
    booking.status = "pending_confirmation";
    booking.pendingConfirmation = true;
    booking.teacherConfirmedAt = new Date();
    
    // 🆕 Set auto-confirm time (5 HOURS from now)
    const autoConfirmTime = new Date();
    autoConfirmTime.setHours(autoConfirmTime.getHours() + 5); // ✅ CHANGED FROM 24 TO 5 HOURS
    booking.autoConfirmAt = autoConfirmTime;
    
    await booking.save();

    console.log(`✅ Class marked as pending confirmation. Auto-confirm at: ${autoConfirmTime}`);

    res.json({
      success: true,
      message: "Class marked complete. Waiting for student confirmation.",
      booking: booking,
      autoConfirmAt: autoConfirmTime
    });

  } catch (err) {
    console.error("❌ Error completing booking:", err);
    res.status(500).json({ 
      message: "Error completing booking",
      error: err.message 
    });
  }
});

/**
 * PATCH /api/bookings/:id/student-confirm
 * Student confirms class completion
 */
router.patch("/:id/student-confirm", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName ratePerClass earned lessonsCompleted")
      .populate("studentId", "firstName surname noOfClasses");
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "pending_confirmation") {
      return res.status(400).json({ 
        message: "This class is not pending confirmation" 
      });
    }

    // Verify the student confirming is the correct student
    if (booking.studentId._id.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Start transaction for atomic updates
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ✅ FINALIZE COMPLETION
      booking.status = "completed";
      booking.completedAt = new Date();
      booking.studentConfirmedAt = new Date();
      booking.pendingConfirmation = false;
      await booking.save({ session });

      // ✅ Reduce student's noOfClasses
      const student = await Student.findById(booking.studentId._id).session(session);
      if (student && student.noOfClasses > 0) {
        student.noOfClasses -= 1;
        await student.save({ session });
        console.log(`✅ Reduced student classes: ${student.noOfClasses + 1} → ${student.noOfClasses}`);
      }

      // ✅ Update teacher earnings
      const teacher = await Teacher.findById(booking.teacherId._id).session(session);
      if (teacher) {
        const ratePerClass = parseFloat(teacher.ratePerClass || 0);
        teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
        teacher.earned = (teacher.earned || 0) + ratePerClass;
        await teacher.save({ session });
        
        console.log(`💰 Teacher earnings updated: $${teacher.earned.toFixed(2)}`);

        // ✅ Create payment transaction
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
      }

      await session.commitTransaction();
      
      console.log(`✅ Class ${booking._id} confirmed by student and completed`);

      res.json({
        success: true,
        message: "Class confirmed successfully",
        booking: booking
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error confirming booking:", err);
    res.status(500).json({ 
      message: "Error confirming booking",
      error: err.message 
    });
  }
});

/**
 * PATCH /api/bookings/:id/dispute
 * Student reports an issue with class completion
 */
router.patch("/:id/dispute", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason || reason.trim() === "") {
      return res.status(400).json({ message: "Dispute reason is required" });
    }

    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "pending_confirmation") {
      return res.status(400).json({ 
        message: "This class is not pending confirmation" 
      });
    }

    // Verify the student disputing is the correct student
    if (booking.studentId._id.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Mark as disputed
    booking.status = "disputed";
    booking.disputed = true;
    booking.disputeReason = reason;
    booking.disputedAt = new Date();
    booking.disputedBy = "student";
    booking.pendingConfirmation = false;
    
    await booking.save();

    console.log(`⚠️ Class ${booking._id} disputed by student: ${reason}`);

    res.json({
      success: true,
      message: "Dispute reported. Admin will review.",
      booking: booking
    });

  } catch (err) {
    console.error("❌ Error disputing booking:", err);
    res.status(500).json({ 
      message: "Error reporting dispute",
      error: err.message 
    });
  }
});

/**
 * POST /api/bookings/auto-confirm
 * Auto-confirm classes after 5 hours (called by cron job)
 */
router.post("/auto-confirm", verifyToken, async (req, res) => {
  try {
    const now = new Date();
    
    // Find all bookings pending confirmation where autoConfirmAt has passed
    const bookingsToConfirm = await Booking.find({
      status: "pending_confirmation",
      autoConfirmAt: { $lte: now }
    })
    .populate("teacherId", "firstName lastName ratePerClass earned lessonsCompleted")
    .populate("studentId", "firstName surname noOfClasses");

    console.log(`🔄 Auto-confirming ${bookingsToConfirm.length} classes...`);

    const results = [];

    for (const booking of bookingsToConfirm) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Mark as completed
        booking.status = "completed";
        booking.completedAt = new Date();
        booking.studentConfirmedAt = new Date(); // Auto-confirmed
        booking.pendingConfirmation = false;
        await booking.save({ session });

        // Reduce student's classes
        const student = await Student.findById(booking.studentId._id).session(session);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses -= 1;
          await student.save({ session });
        }

        // Update teacher earnings
        const teacher = await Teacher.findById(booking.teacherId._id).session(session);
        if (teacher) {
          const ratePerClass = parseFloat(teacher.ratePerClass || 0);
          teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
          teacher.earned = (teacher.earned || 0) + ratePerClass;
          await teacher.save({ session });

          // Create payment transaction
          const paymentTransaction = new PaymentTransaction({
            teacherId: teacher._id,
            bookingId: booking._id,
            amount: ratePerClass,
            type: "class_completion",
            status: "pending",
            description: `Payment for auto-confirmed class: ${booking.classTitle}`,
            classTitle: booking.classTitle,
            studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
            completedAt: booking.completedAt
          });
          await paymentTransaction.save({ session });
        }

        await session.commitTransaction();
        
        results.push({
          bookingId: booking._id,
          status: "auto-confirmed"
        });

        console.log(`✅ Auto-confirmed class ${booking._id}`);

      } catch (error) {
        await session.abortTransaction();
        console.error(`❌ Error auto-confirming ${booking._id}:`, error);
        
        results.push({
          bookingId: booking._id,
          status: "error",
          error: error.message
        });
      } finally {
        session.endSession();
      }
    }

    res.json({
      success: true,
      message: `Auto-confirmed ${results.filter(r => r.status === "auto-confirmed").length} classes`,
      results: results
    });

  } catch (err) {
    console.error("❌ Error in auto-confirm:", err);
    res.status(500).json({ 
      message: "Error auto-confirming bookings",
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
 * GET /api/bookings/:id
 * Get single booking by ID
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email googleMeetLink") 
      .populate("studentId", "firstName surname email");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({
      success: true,
      booking
    });
  } catch (err) {
    console.error("Error fetching booking:", err);
    res.status(500).json({ message: "Error fetching booking" });
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