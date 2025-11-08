// server/routes/bookingRoutes.js
import express from "express";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";

const router = express.Router();



/**
 * PATCH /api/bookings/:id/complete
 * Mark booking as completed AND reduce student's noOfClasses
 * This is the ENHANCED version that properly updates student records
 */
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
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

    // Update booking status
    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();

    // ✅ CRITICAL: Reduce student's noOfClasses by 1
    const Student = mongoose.model("Student");
    const student = await Student.findById(booking.studentId._id);
    
    if (student && student.noOfClasses > 0) {
      student.noOfClasses -= 1;
      await student.save();
      
      console.log(`✅ Reduced student ${student.firstName} ${student.surname}'s classes: ${student.noOfClasses + 1} → ${student.noOfClasses}`);
    } else if (student && student.noOfClasses === 0) {
      console.warn(`⚠️ Student ${student.firstName} ${student.surname} has 0 classes remaining`);
    }

    // Return updated data
    const updatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email noOfClasses");

    res.json({
      message: "Booking completed and student class count updated",
      booking: updatedBooking,
      studentClassesRemaining: updatedBooking.studentId.noOfClasses
    });
  } catch (err) {
    console.error("Error completing booking:", err);
    res.status(500).json({ message: "Error completing booking" });
  }
});

/**
 * POST /api/bookings/auto-complete
 * Auto-complete bookings that have passed their scheduled time + duration
 * This can be called by a cron job or manually
 */
router.post("/auto-complete", verifyToken, async (req, res) => {
  try {
    const now = new Date();
    
    // Find all accepted bookings that should be completed
    // (scheduled time + duration has passed)
    const bookingsToComplete = await Booking.find({
      status: "accepted",
      scheduledTime: { $lt: now }
    }).populate("studentId", "firstName surname email noOfClasses");

    const completed = [];
    const Student = mongoose.model("Student");

    for (const booking of bookingsToComplete) {
      // Check if the booking has ended (scheduledTime + duration)
      const endTime = new Date(booking.scheduledTime);
      endTime.setMinutes(endTime.getMinutes() + (booking.duration || 60));

      if (now > endTime) {
        // Mark as completed
        booking.status = "completed";
        booking.completedAt = new Date();
        await booking.save();

        // Reduce student's class count
        const student = await Student.findById(booking.studentId._id);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses -= 1;
          await student.save();
          
          console.log(`✅ Auto-completed: ${booking.classTitle} for ${student.firstName} ${student.surname}`);
          console.log(`   Classes remaining: ${student.noOfClasses}`);
        }

        completed.push({
          bookingId: booking._id,
          classTitle: booking.classTitle,
          studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
          classesRemaining: student?.noOfClasses || 0
        });
      }
    }

    res.json({
      message: `Auto-completed ${completed.length} bookings`,
      completed: completed
    });
  } catch (err) {
    console.error("Error auto-completing bookings:", err);
    res.status(500).json({ message: "Error auto-completing bookings" });
  }
});




/**
 * GET /api/bookings
 * Get all bookings (Admin only)
 * Using verifyAdminOrTeacher as fallback if verifyAdmin has issues
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const bookings = await Booking.find()
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
 * GET /api/bookings/teacher/:teacherId
 * Get all bookings for a specific teacher
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
      .populate("studentId", "firstName surname email noOfClasses")
      .sort({ scheduledTime: 1 });

    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching teacher bookings" });
  }
});

/**
 * GET /api/bookings/student/:studentId
 * Get all bookings for a specific student
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

    // Populate the booking
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
 * PATCH /api/bookings/:id/complete
 * Mark booking as completed
 */
router.patch("/:id/complete", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    res.json({
      message: "Booking completed",
      booking: populatedBooking
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error completing booking" });
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
    booking.rejectionReason = reason || "Cancelled";
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
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

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