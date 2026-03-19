// server/routes/disputeRoutes.js
import express from "express";
import Booking from "../models/Booking.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/disputes/booking/:bookingId
 * Teacher raises a dispute on an admin-rejected completed class
 */
router.post("/booking/:bookingId", verifyToken, async (req, res) => {
  try {
    const { disputeReason } = req.body;

    if (!disputeReason || !disputeReason.trim()) {
      return res.status(400).json({ success: false, message: "Dispute reason is required" });
    }

    const booking = await Booking.findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Only the assigned teacher can raise a dispute
    if (req.user.role !== "teacher" || booking.teacherId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not authorized to raise a dispute for this booking" });
    }

    // Can only dispute admin-rejected OR missed (attendance not met) classes
    if (!booking.adminRejected && booking.status !== "missed") {
      return res.status(400).json({ success: false, message: "Can only raise a dispute on classes that were not completed" });
    }

    // Don't allow duplicate disputes
    if (booking.disputeRaised) {
      return res.status(400).json({ success: false, message: "A dispute has already been raised for this class" });
    }

    booking.disputeRaised = true;
    booking.disputeReason = disputeReason.trim();
    booking.disputeStatus = "pending";
    booking.disputedAt = new Date();
    booking.disputedBy = `${booking.teacherId.firstName} ${booking.teacherId.lastName} (Teacher)`;
    await booking.save();

    console.log(`⚠️ Dispute raised by teacher ${booking.teacherId.firstName} for booking ${booking._id}`);

    res.json({ success: true, message: "Dispute submitted successfully. Admin will review it shortly." });
  } catch (err) {
    console.error("❌ Error raising dispute:", err);
    res.status(500).json({ success: false, message: "Error raising dispute", error: err.message });
  }
});

/**
 * GET /api/disputes
 * Admin views all pending disputes
 */
router.get("/", verifyAdmin, async (req, res) => {
  try {
    const disputes = await Booking.find({ disputeRaised: true, disputeStatus: "pending" })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email lastName")
      .sort({ disputedAt: -1 });

    res.json({ success: true, disputes });
  } catch (err) {
    console.error("❌ Error fetching disputes:", err);
    res.status(500).json({ success: false, message: "Error fetching disputes" });
  }
});

/**
 * GET /api/disputes/stats
 * Admin views dispute statistics
 */
router.get("/stats", verifyAdmin, async (req, res) => {
  try {
    const [pending, teacherWins, studentWins] = await Promise.all([
      Booking.countDocuments({ disputeRaised: true, disputeStatus: "pending" }),
      Booking.countDocuments({ disputeRaised: true, disputeStatus: "resolved_teacher" }),
      Booking.countDocuments({ disputeRaised: true, disputeStatus: "resolved_student" }),
    ]);

    res.json({
      success: true,
      stats: {
        pendingDisputes: pending,
        teacherWins,
        studentWins,
        resolvedDisputes: teacherWins + studentWins,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching dispute stats:", err);
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
});

/**
 * PATCH /api/disputes/:bookingId/resolve
 * Admin resolves a dispute
 * resolution: "approve_teacher" | "approve_student"
 */
router.patch("/:bookingId/resolve", verifyAdmin, async (req, res) => {
  try {
    const { resolution, adminNotes } = req.body;

    if (!["approve_teacher", "approve_student"].includes(resolution)) {
      return res.status(400).json({ success: false, message: "Invalid resolution value" });
    }

    const booking = await Booking.findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName surname noOfClasses");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (!booking.disputeRaised || booking.disputeStatus !== "pending") {
      return res.status(400).json({ success: false, message: "No pending dispute found for this booking" });
    }

    if (resolution === "approve_teacher") {
      // Teacher wins — mark as completed and process payment/deduction if not already done
      const wasMissed = booking.status === "missed";

      booking.adminRejected = false;
      booking.adminRejectedReason = "";
      booking.status = "completed";
      booking.markedBy = "admin";
      booking.disputeStatus = "resolved_teacher";

      if (wasMissed) {
        // Missed class approved: deduct student class and pay teacher
        const student = await Student.findById(booking.studentId._id);
        if (student && student.noOfClasses > 0) {
          student.noOfClasses -= 1;
          if (student.noOfClasses === 0) student.active = false;
          await student.save();
        }

        const teacher = await Teacher.findById(booking.teacherId._id);
        if (teacher) {
          const earned = parseFloat(teacher.ratePerClass || 0);
          teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
          teacher.earned = (teacher.earned || 0) + earned;
          await teacher.save();

          await PaymentTransaction.create({
            bookingId: booking._id,
            teacherId: booking.teacherId._id,
            studentId: booking.studentId._id,
            amount: earned,
            status: "pending",
            type: "class_completion",
            classTitle: booking.classTitle,
            completedAt: new Date(),
            description: `Dispute approved: ${booking.classTitle} (missed → completed by admin)`,
          });
          console.log(`💰 Teacher paid $${earned} after dispute approval for booking ${booking._id}`);
        }
      }
    } else {
      // Student wins: class stays rejected/missed, no change to teacher earnings
      booking.disputeStatus = "resolved_student";

      // Only refund student class if it was already deducted (adminRejected = completed then rejected)
      // Missed classes never deducted student's class, so no refund needed
      if (booking.adminRejected) {
        const student = await Student.findById(booking.studentId._id);
        if (student) {
          student.noOfClasses = (student.noOfClasses || 0) + 1;
          await student.save();
          console.log(`✅ Refunded 1 class to student ${student.firstName}`);
        }
      }
    }

    booking.disputeResolution = resolution;
    booking.disputeAdminNotes = adminNotes || "";
    booking.disputeResolvedAt = new Date();
    await booking.save();

    const msg =
      resolution === "approve_teacher"
        ? "Dispute resolved in favour of teacher. Class marked as completed."
        : "Dispute resolved in favour of student. Student class refunded.";

    console.log(`✅ Dispute resolved (${resolution}) for booking ${booking._id}`);

    res.json({ success: true, message: msg, booking });
  } catch (err) {
    console.error("❌ Error resolving dispute:", err);
    res.status(500).json({ success: false, message: "Error resolving dispute", error: err.message });
  }
});

export default router;
