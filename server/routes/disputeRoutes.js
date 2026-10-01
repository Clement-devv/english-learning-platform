// server/routes/disputeRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { reverseCompletedClass } from "../utils/classReversal.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

// populate("teacherId"/"studentId") needs the models registered on this center's
// connection first — otherwise the first request after a restart fails.
router.use((req, _res, next) => { if (req.db) { getStudent(req.db); getTeacher(req.db); } next(); });

/**
 * POST /api/disputes/booking/:bookingId
 * Teacher raises a dispute on an admin-rejected completed class
 */
router.post("/booking/:bookingId", verifyToken, async (req, res) => {
  try {
    const { disputeReason } = req.body;

    if (!disputeReason || !disputeReason.trim()) {
      return badRequest(res, "Dispute reason is required");
    }

    const booking = await getBooking(req.db).findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email");

    if (!booking) {
      return notFound(res, "Booking not found");
    }

    // Only the assigned teacher can raise a dispute
    if (req.user.role !== "teacher" || booking.teacherId._id.toString() !== req.user.id) {
      return forbidden(res, "Not authorized to raise a dispute for this booking");
    }

    // Can only dispute admin-rejected OR missed (attendance not met) classes
    if (!booking.adminRejected && booking.status !== "missed") {
      return badRequest(res, "Can only raise a dispute on classes that were not completed");
    }

    // Don't allow duplicate disputes
    if (booking.disputeRaised) {
      return badRequest(res, "A dispute has already been raised for this class");
    }

    booking.disputeRaised = true;
    booking.disputeReason = disputeReason.trim();
    booking.disputeStatus = "pending";
    booking.disputedAt = new Date();
    booking.disputedBy = `${booking.teacherId.firstName} ${booking.teacherId.lastName} (Teacher)`;
    await booking.save();

    logger.info(`⚠️ Dispute raised by teacher ${booking.teacherId.firstName} for booking ${booking._id}`);

    res.json({ success: true, message: "Dispute submitted successfully. Admin will review it shortly." });
  } catch (err) {
    logger.error("❌ Error raising dispute:", { error: err?.message });
    serverError(res, "Error raising dispute");
  }
});

/**
 * GET /api/disputes
 * Admin views all pending disputes
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const disputes = await getBooking(req.db).find({ disputeRaised: true, disputeStatus: "pending" })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email lastName")
      .sort({ disputedAt: -1 })
      .lean();

    res.json({ success: true, disputes });
  } catch (err) {
    logger.error("❌ Error fetching disputes:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching disputes" });
  }
});

/**
 * GET /api/disputes/stats
 * Admin views dispute statistics
 */
router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Booking = getBooking(req.db);
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
    logger.error("❌ Error fetching dispute stats:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching stats" });
  }
});

/**
 * PATCH /api/disputes/:bookingId/resolve
 * Admin resolves a dispute
 * resolution: "approve_teacher" | "approve_student"
 */
router.patch("/:bookingId/resolve", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { resolution, adminNotes } = req.body;

    if (!["approve_teacher", "approve_student"].includes(resolution)) {
      return badRequest(res, "Invalid resolution value");
    }

    const booking = await getBooking(req.db).findById(req.params.bookingId)
      .populate("teacherId", "firstName lastName")
      .populate("studentId", "firstName lastName classCredits");

    if (!booking) {
      return notFound(res, "Booking not found");
    }

    if (!booking.disputeRaised || booking.disputeStatus !== "pending") {
      return badRequest(res, "No pending dispute found for this booking");
    }

    if (booking.loggedByTeacher && booking.status === "pending_confirmation") {
      // Teacher-logged class still awaiting payment approval: nothing has been charged.
      // Teacher wins → the dispute is closed; the class still needs approval in "Logged classes".
      // Student/parent wins → the class is rejected.
      if (resolution === "approve_teacher") {
        booking.disputeStatus = "resolved_teacher";
      } else {
        booking.disputeStatus = "resolved_student";
        booking.status = "rejected";
        booking.rejectionReason = "Logged class not approved: absence confirmed by admin";
        booking.set("offline.approval", { status: "rejected", decidedAt: new Date(), decidedBy: req.user.id, note: adminNotes || "Dispute upheld" });
      }
    } else if (resolution === "approve_teacher") {
      // Teacher wins — mark as completed and process payment/deduction if not already done
      const wasMissed = booking.status === "missed";

      booking.adminRejected = false;
      booking.adminRejectedReason = "";
      booking.status = "completed";
      booking.markedBy = "admin";
      booking.disputeStatus = "resolved_teacher";

      if (wasMissed) {
        // Missed class approved: deduct student class and pay teacher
        const student = await getStudent(req.db).findById(booking.studentId._id);
        if (student && student.classCredits > 0) {
          student.classCredits -= 1;
          if (student.classCredits === 0) student.active = false;
          await student.save();
        }

        const teacher = await getTeacher(req.db).findById(booking.teacherId._id);
        if (teacher) {
          const earned = parseFloat(teacher.ratePerClass || 0);
          teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
          teacher.earned = (teacher.earned || 0) + earned;
          await teacher.save();

          await getPaymentTransaction(req.db).create({
            bookingId: booking._id,
            teacherId: booking.teacherId._id,
            studentId: booking.studentId._id,
            amount: earned,
            status: "pending",
            type: "class_completion",
            classTitle: booking.classTitle,
            completedAt: new Date(),
            studentName: `${booking.studentId.firstName || ""} ${booking.studentId.lastName || ""}`.trim(),
            description: `Dispute approved: ${booking.classTitle} (missed → completed by admin)`,
          });
          logger.info(`💰 Teacher paid $${earned} after dispute approval for booking ${booking._id}`);
        }
      }
    } else {
      // Student wins: class stays rejected/missed, no change to teacher earnings
      booking.disputeStatus = "resolved_student";

      // Only refund student class if it was already deducted (adminRejected = completed then rejected)
      // Missed classes never deducted student's class, so no refund needed
      if (booking.status === "completed" && !booking.adminRejected) {
        // Dispute on a class that still counts as completed (e.g. a parent says their
        // managed child didn't attend): fully reverse it — credit back, teacher pay deducted.
        await reverseCompletedClass(req.db, booking, {
          reason: `Dispute upheld: ${booking.disputeReason || "student did not attend"}`, adminId: req.user.id,
        });
      } else if (booking.adminRejected) {
        const student = await getStudent(req.db).findById(booking.studentId._id);
        if (student) {
          student.classCredits = (student.classCredits || 0) + 1;
          await student.save();
          logger.info(`✅ Refunded 1 class to student ${student.firstName}`);
        }
      }
    }

    booking.disputeResolution = resolution;
    booking.disputeAdminNotes = adminNotes || "";
    booking.disputeResolvedAt = new Date();
    // Settled either way → the parent-check link (if any) stops working immediately
    booking.set("shareLink", undefined);
    await booking.save();

    const msg =
      booking.loggedByTeacher && booking.status === "pending_confirmation"
        ? "Dispute closed in favour of the teacher. The class still needs payment approval in Logged classes."
        : booking.loggedByTeacher && booking.status === "rejected" && resolution === "approve_student"
        ? "Dispute upheld — the logged class was rejected. Nothing was charged or paid."
        : resolution === "approve_teacher"
        ? "Dispute resolved in favour of teacher. Class marked as completed."
        : "Dispute resolved in favour of student. Student class refunded.";

    logger.info(`✅ Dispute resolved (${resolution}) for booking ${booking._id}`);

    res.json({ success: true, message: msg, booking });
  } catch (err) {
    logger.error("❌ Error resolving dispute:", { error: err?.message });
    serverError(res, "Error resolving dispute");
  }
});

export default router;
