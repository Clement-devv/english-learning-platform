// server/routes/disputeRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import logger from "../utils/logger.js";
import { pushTeacher } from "../utils/notifyPush.js";
import { awardMilestonesAndNotify } from "../utils/progressEmails.js";
import { badRequest, forbidden, notFound, serverError } from '../utils/apiResponse.js';
import { reverseCompletedClass } from "../utils/classReversal.js";
import { recordOutcomeChange } from "../utils/classOutcome.js";
import { payForCompletedClass } from "../utils/classPayment.js";
import { sendEmail, getCenterBaseUrl } from "../utils/emailService.js";
import { esc } from "../emails/layout.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);

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
  let claimedId = null;    // set once this request owns the dispute
  let moneyMoved = false;  // after this, a failure must NOT reopen the dispute (a retry would pay/refund twice)
  try {
    const { resolution, adminNotes } = req.body;

    if (!["approve_teacher", "approve_student"].includes(resolution)) {
      return badRequest(res, "Invalid resolution value");
    }

    // Claim the dispute atomically — a double click or a second admin can't settle it twice.
    // (Money moves below; the claim is what makes it happen once.)
    const finalStatus = resolution === "approve_teacher" ? "resolved_teacher" : "resolved_student";
    const booking = await getBooking(req.db).findOneAndUpdate(
      { _id: req.params.bookingId, disputeRaised: true, disputeStatus: "pending" },
      { $set: { disputeStatus: finalStatus } },
      { new: true },
    )
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName classCredits");

    if (!booking) {
      const exists = await getBooking(req.db).exists({ _id: req.params.bookingId });
      return exists
        ? badRequest(res, "No pending dispute found for this booking — it may have just been resolved")
        : notFound(res, "Booking not found");
    }
    claimedId = booking._id;

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
    } else {
      // Where the money stands before this decision:
      //   missed                       → never charged, never paid
      //   completed + adminRejected    → charged then reversed (reverseCompletedClass refunded
      //                                  the credit and took back the pay) = not charged, not paid
      //   completed, not rejected      → charged and paid
      const countsAsCompleted = booking.status === "completed" && !booking.adminRejected;

      if (resolution === "approve_teacher") {
        // Teacher wins → the class counts. Charge + pay only if it isn't settled as completed already.
        if (!countsAsCompleted) {
          recordOutcomeChange(booking, {
            to: "completed", source: "dispute",
            reason: `Dispute resolved for the teacher${adminNotes ? `: ${adminNotes}` : ""}`,
          });
          // Same charge/pay rules as every completion path (trial classes are free, 2dp rounding)
          moneyMoved = true;
          const { earned } = await payForCompletedClass(req.db, booking, {
            description: `Dispute approved: ${booking.classTitle} (${booking.status === "missed" ? "missed" : "admin-rejected"} → completed by admin)`,
          });
          logger.info(`💰 Teacher paid $${earned} after dispute approval for booking ${booking._id}`);
        }
        booking.adminRejected = false;
        booking.adminRejectedReason = "";
        booking.status = "completed";
        booking.markedBy = "admin";
      } else if (countsAsCompleted) {
        // Student wins on a class that still counts (e.g. a parent says their managed child
        // didn't attend): fully reverse it — credit back, teacher pay deducted.
        moneyMoved = true;
        const { alreadyReversed } = await reverseCompletedClass(req.db, booking, {
          reason: `Dispute upheld: ${booking.disputeReason || "student did not attend"}`, adminId: req.user.id, source: "dispute",
        });
        if (alreadyReversed) moneyMoved = false; // an admin unmarked it meanwhile — already refunded

      }
      // Student wins on a missed / admin-rejected class: nothing was charged (or it was already
      // refunded) — the class simply stays not completed.
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
        : moneyMoved
        ? "Dispute resolved in favour of student. Student class refunded."
        : "Dispute resolved in favour of student. The class stays not completed — nothing was charged.";

    logger.info(`✅ Dispute resolved (${resolution}) for booking ${booking._id}`);

    res.json({ success: true, message: msg, booking });

    if (resolution === "approve_teacher") awardMilestonesAndNotify(req.db, booking.studentId?._id || booking.studentId, req.center);

    // Tell the teacher how it ended — their pay for the class depends on it
    pushTeacher(req.db, booking.teacherId, resolution === "approve_teacher" ? "✅ Dispute decided for you" : "⚠️ Dispute upheld", `"${booking.classTitle}" — ${resolution === "approve_teacher" ? "the class counts" : "the class does not count"}`, { tag: `dispute-${booking._id}`, tab: "completed-classes" });
    if (booking.teacherId?.email) {
      const won = resolution === "approve_teacher";
      const { baseUrl } = getCenterBaseUrl(req.center);
      sendEmail({
        centerName: req.center?.centerName,
        to: booking.teacherId.email,
        subject: `Dispute ${won ? "resolved in your favour" : "upheld"} — ${booking.classTitle}`,
        html: `<p>Hi ${esc(booking.teacherId.firstName)}, the school has reviewed the dispute about this class:</p>
<ul><li><strong>Student:</strong> ${esc(booking.studentId?.firstName)} ${esc(booking.studentId?.lastName)}</li>
<li><strong>Class:</strong> ${esc(booking.classTitle)} — ${esc(new Date(booking.scheduledTime).toUTCString())}</li></ul>
<p><strong>Decision:</strong> ${won ? "the class counts — you are paid for it." : "the class does not count — any pay for it has been deducted."}</p>
${adminNotes ? `<p><strong>School's note:</strong> ${esc(adminNotes)}</p>` : ""}
<p>See it in <a href="${baseUrl}/teacher/dashboard">Completed classes</a>.</p>`,
      }).catch((e) => logger.warn("Dispute resolution email failed:", { error: e?.message }));
    }
  } catch (err) {
    if (claimedId && !moneyMoved) {
      // Nothing was charged or paid yet — reopen so the admin can try again
      await getBooking(req.db).updateOne({ _id: claimedId }, { $set: { disputeStatus: "pending" } }).catch(() => {});
    } else if (claimedId) {
      logger.error(`CRITICAL: dispute ${claimedId} failed after credits/pay changed — check the booking, student and teacher by hand`);
    }
    logger.error("❌ Error resolving dispute:", { error: err?.message });
    serverError(res, "Error resolving dispute");
  }
});

export default router;
