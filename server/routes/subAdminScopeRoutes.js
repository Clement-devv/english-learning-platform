// server/routes/subAdminScopeRoutes.js
// All routes here return data SCOPED to the sub-admin's assigned teachers only
import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { completeClass } from "../services/classCompletionService.js";
import { tenantMiddleware }           from "../middleware/tenantMiddleware.js";
import { subAdminSchema }             from "../schemas/subAdminSchema.js";
import { teacherSchema }              from "../schemas/teacherSchema.js";
import { studentSchema }              from "../schemas/studentSchema.js";
import { bookingSchema }              from "../schemas/bookingSchema.js";
import { assignmentSchema }           from "../schemas/assignmentSchema.js";
import { paymentSchema }              from "../schemas/paymentSchema.js";
import { recordingSchema }            from "../schemas/recordingSchema.js";
import { reviewSchema }               from "../schemas/reviewSchema.js";
import { notificationSchema }         from "../schemas/notificationSchema.js";
import { paymentTransactionSchema }   from "../schemas/paymentTransactionSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getSubAdmin            = (db) => db.models.SubAdmin            || db.model("SubAdmin",            subAdminSchema);
const getTeacher             = (db) => db.models.Teacher             || db.model("Teacher",             teacherSchema);
const getStudent             = (db) => db.models.Student             || db.model("Student",             studentSchema);
const getBooking             = (db) => db.models.Booking             || db.model("Booking",             bookingSchema);
const getPayment             = (db) => db.models.Payment             || db.model("Payment",             paymentSchema);
const getRecording           = (db) => db.models.Recording           || db.model("Recording",           recordingSchema);
const getReview              = (db) => db.models.Review              || db.model("Review",              reviewSchema);
const getNotification        = (db) => db.models.Notification        || db.model("Notification",        notificationSchema);
const getPaymentTransaction  = (db) => db.models.PaymentTransaction  || db.model("PaymentTransaction",  paymentTransactionSchema);

// ── Auth middleware: must be an active sub-admin ──────────────────────────────
const requireSubAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== "sub-admin")
    return forbidden(res, "Sub-admin access required");
  const subAdmin = await getSubAdmin(req.db).findById(req.user.id);
  if (!subAdmin || subAdmin.status !== "active")
    return forbidden(res, "Account inactive");
  req.subAdmin = subAdmin;
  next();
};

// ── Helper: get teacher IDs in scope ─────────────────────────────────────────
const getScopedTeacherIds = async (subAdmin, db) => {
  if (subAdmin.assignmentType === "region" && subAdmin.region) {
    const teachers = await getTeacher(db).find({ continent: subAdmin.region }).select("_id");
    return teachers.map((t) => t._id);
  }
  return subAdmin.assignedTeachers;
};

// GET /api/sub-admin-scope/overview
router.get("/overview", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);

    if (teacherIds.length === 0) {
      return res.json({
        success: true,
        data: {
          totalTeachers: 0, activeTeachers: 0,
          totalStudents: 0, activeStudents: 0,
          totalBookings: 0,
          bookingsByStatus: { pending: 0, accepted: 0, completed: 0, rejected: 0, cancelled: 0 },
          recentBookings: [],
        },
      });
    }

    const [teachers, bookings] = await Promise.all([
      getTeacher(req.db).find({ _id: { $in: teacherIds } }).select("firstName lastName active continent"),
      getBooking(req.db).find({ teacherId: { $in: teacherIds } })
        .populate("teacherId", "firstName lastName")
        .populate("studentId", "firstName lastName email")
        .sort({ scheduledTime: -1 }),
    ]);

    const studentIds = [...new Set(bookings.map((b) => b.studentId?._id?.toString()).filter(Boolean))];

    const byStatus = { pending: 0, accepted: 0, completed: 0, rejected: 0, cancelled: 0 };
    bookings.forEach((b) => { if (byStatus[b.status] !== undefined) byStatus[b.status]++; });

    res.json({
      success: true,
      data: {
        totalTeachers:  teachers.length,
        activeTeachers: teachers.filter((t) => t.active).length,
        totalStudents:  studentIds.length,
        totalBookings:  bookings.length,
        bookingsByStatus: byStatus,
        recentBookings: bookings.slice(0, 8),
        assignmentType: req.subAdmin.assignmentType,
        region: req.subAdmin.region,
      },
    });
  } catch (err) {
    logger.error("Sub-admin overview error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load overview" });
  }
});

// GET /api/sub-admin-scope/teachers
router.get("/teachers", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);

    const teachers = await getTeacher(req.db).find({ _id: { $in: teacherIds } })
      .select("-password -twoFactorSecret -twoFactorBackupCodes")
      .sort({ firstName: 1 });

    const bookingCounts = await getBooking(req.db).aggregate([
      { $match: { teacherId: { $in: teacherIds } } },
      { $group: { _id: "$teacherId", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]);

    const countMap = {};
    bookingCounts.forEach((c) => { countMap[c._id.toString()] = c; });

    const enriched = teachers.map((t) => ({
      ...t.toObject(),
      bookingStats: countMap[t._id.toString()] || { total: 0, completed: 0 },
    }));

    res.json({ success: true, teachers: enriched, total: enriched.length });
  } catch (err) {
    logger.error("Sub-admin teachers error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load teachers" });
  }
});

// GET /api/sub-admin-scope/students
router.get("/students", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);

    const bookings = await getBooking(req.db).find({ teacherId: { $in: teacherIds } })
      .populate("studentId", "firstName lastName email active classCredits age dateOfBirth rank")
      .populate("teacherId", "firstName lastName");

    const studentMap = new Map();
    bookings.forEach((b) => {
      if (!b.studentId) return;
      const sid = b.studentId._id.toString();
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          ...b.studentId.toObject(),
          assignedTeacher: b.teacherId,
          latestBookingStatus: b.status,
          latestBookingDate:   b.scheduledTime,
          totalBookings: 1,
        });
      } else {
        const existing = studentMap.get(sid);
        existing.totalBookings++;
        if (new Date(b.scheduledTime) > new Date(existing.latestBookingDate)) {
          existing.latestBookingStatus = b.status;
          existing.latestBookingDate   = b.scheduledTime;
          existing.assignedTeacher     = b.teacherId;
        }
      }
    });

    const students = Array.from(studentMap.values());
    res.json({ success: true, students, total: students.length });
  } catch (err) {
    logger.error("Sub-admin students error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load students" });
  }
});

// GET /api/sub-admin-scope/bookings
router.get("/bookings", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const { status, teacherId } = req.query;
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const filter = { teacherId: { $in: filterTeacherIds } };
    if (status) filter.status = status;

    const bookings = await getBooking(req.db).find(filter)
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .populate("studentId", "firstName lastName email")
      .sort({ scheduledTime: -1 });

    res.json({ success: true, bookings, total: bookings.length });
  } catch (err) {
    logger.error("Sub-admin bookings error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load bookings" });
  }
});

// GET /api/sub-admin-scope/me
router.get("/me", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const subAdmin = await getSubAdmin(req.db).findById(req.user.id)
      .populate("assignedTeachers", "firstName lastName email continent active")
      .populate("createdBy", "firstName lastName email");

    res.json({ success: true, subAdmin });
  } catch (err) {
    logger.error("Sub-admin me error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

// GET /api/sub-admin-scope/classes
router.get("/classes", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const { status, teacherId } = req.query;
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const statusFilter = status ? { status } : { status: { $in: ["accepted", "completed"] } };

    const bookings = await getBooking(req.db).find({ teacherId: { $in: filterTeacherIds }, ...statusFilter })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName lastName email classCredits")
      .sort({ scheduledTime: -1 });

    res.json({ success: true, bookings, total: bookings.length });
  } catch (err) {
    logger.error("Sub-admin classes error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load classes" });
  }
});

// POST /api/sub-admin-scope/classes/mark
router.post("/classes/mark", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canMarkLessons)
      return forbidden(res, "You do not have permission to mark lessons");

    const { bookingId } = req.body;
    if (!bookingId) return badRequest(res, "bookingId is required");

    const booking = await getBooking(req.db).findById(bookingId).select("teacherId status");
    if (!booking) return notFound(res, "Booking not found");

    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    if (!teacherIds.map(String).includes(booking.teacherId.toString()))
      return forbidden(res, "This booking's teacher is not in your scope");

    const result = await completeClass(req.db, bookingId, "sub-admin", { skipAttendanceCheck: true });

    if (result.alreadyProcessed) {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${result.completed ? "completed" : "missed"}.`,
      });
    }

    const subAdminName = `${req.subAdmin.firstName} ${req.subAdmin.lastName}`;
    const teacherName  = result.booking?.teacherId
      ? `${result.booking.teacherId.firstName || ""} ${result.booking.teacherId.lastName || ""}`.trim()
      : "";
    const studentName  = result.booking?.studentId
      ? `${result.booking.studentId.firstName || ""} ${result.booking.studentId.lastName || ""}`.trim()
      : "";

    getNotification(req.db).create({
      type:        "class_marked",
      message:     `${subAdminName} marked a class as completed${teacherName ? ` (Teacher: ${teacherName}` : ""}${studentName ? `, Student: ${studentName}` : ""}${teacherName || studentName ? ")" : ""}.`,
      subAdminId:  req.subAdmin._id,
      subAdminName,
      metadata: { bookingId, teacherName, studentName, classTitle: result.booking?.classTitle || "" },
    }).catch((e) => logger.error("Failed to save mark-class notification:", { error: e?.message }));

    res.json({ success: true, message: "Lesson marked as completed.", ...result });
  } catch (err) {
    logger.error("Sub-admin mark class error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error marking lesson: " + err.message });
  }
});

// POST /api/sub-admin-scope/classes/unmark
router.post("/classes/unmark", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canMarkLessons)
      return forbidden(res, "You do not have permission to unmark lessons");

    const { bookingId } = req.body;
    if (!bookingId) return badRequest(res, "bookingId is required");

    const Booking = getBooking(req.db);
    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName ratePerClass earned lessonsCompleted")
      .populate("studentId", "firstName lastName classCredits active");

    if (!booking) return notFound(res, "Booking not found");
    if (booking.status !== "completed")
      return res.status(400).json({ success: false, message: `Cannot unmark a booking with status "${booking.status}"` });

    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    if (!teacherIds.map(String).includes(booking.teacherId._id.toString()))
      return forbidden(res, "This booking's teacher is not in your scope");

    const ratePerClass = Math.round((parseFloat(booking.teacherId.ratePerClass) || 0) * 100) / 100;

    await Booking.updateOne(
      { _id: bookingId },
      { $set: { status: "accepted" }, $unset: { completedAt: "", markedBy: "" } }
    );

    await getStudent(req.db).findByIdAndUpdate(booking.studentId._id, {
      $inc: { classCredits: 1 },
      $set: { active: true },
    });

    const newEarned           = Math.max(0, Math.round(((booking.teacherId.earned || 0) - ratePerClass) * 100) / 100);
    const newLessonsCompleted = Math.max(0, (booking.teacherId.lessonsCompleted || 0) - 1);
    await getTeacher(req.db).findByIdAndUpdate(booking.teacherId._id, {
      $set: { earned: newEarned, lessonsCompleted: newLessonsCompleted },
    });

    await getPaymentTransaction(req.db).deleteOne({ bookingId, status: "pending" });

    const subAdminName = `${req.subAdmin.firstName} ${req.subAdmin.lastName}`;
    const teacherName  = `${booking.teacherId.firstName} ${booking.teacherId.lastName}`;
    const studentName  = `${booking.studentId.firstName} ${booking.studentId.lastName}`;

    getNotification(req.db).create({
      type:        "class_unmarked",
      message:     `${subAdminName} unmarked a class (Teacher: ${teacherName}, Student: ${studentName}).`,
      subAdminId:  req.subAdmin._id,
      subAdminName,
      metadata: { bookingId, teacherName, studentName, classTitle: booking.classTitle || "" },
    }).catch((e) => logger.error("Failed to save unmark notification:", { error: e?.message }));

    res.json({ success: true, message: "Class reverted to accepted." });
  } catch (err) {
    logger.error("Sub-admin unmark class error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error unmarking class: " + err.message });
  }
});

// GET /api/sub-admin-scope/payments
router.get("/payments", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canViewPayments)
      return forbidden(res, "You do not have permission to view payments");

    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const payments = await getPayment(req.db).find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });

    const summary = {};
    payments.forEach((p) => {
      const tid = p.teacherId?._id?.toString();
      if (!tid) return;
      if (!summary[tid]) summary[tid] = { teacher: p.teacherId, totalEarned: 0, totalPaid: 0, totalPending: 0, count: 0 };
      summary[tid].totalEarned += p.amount || 0;
      if (p.status === "paid") summary[tid].totalPaid    += p.amount || 0;
      else                     summary[tid].totalPending += p.amount || 0;
      summary[tid].count++;
    });

    res.json({ success: true, payments, summary: Object.values(summary), total: payments.length });
  } catch (err) {
    logger.error("Sub-admin payments error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load payments" });
  }
});

// GET /api/sub-admin-scope/recordings
router.get("/recordings", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const recordings = await getRecording(req.db).find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({ success: true, recordings, total: recordings.length });
  } catch (err) {
    logger.error("Sub-admin recordings error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load recordings" });
  }
});

// GET /api/sub-admin-scope/reports
router.get("/reports", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const completed = await getBooking(req.db).find({
      teacherId: { $in: filterTeacherIds },
      status:    "completed",
    })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName lastName email classCredits")
      .sort({ scheduledTime: -1 });

    const studentProgress = new Map();
    completed.forEach((b) => {
      if (!b.studentId) return;
      const sid = b.studentId._id.toString();
      if (!studentProgress.has(sid)) {
        studentProgress.set(sid, {
          student: b.studentId, teacher: b.teacherId,
          completedClasses: 0, remainingClasses: b.studentId.classCredits || 0, lastClass: null,
        });
      }
      const entry = studentProgress.get(sid);
      entry.completedClasses++;
      if (!entry.lastClass || new Date(b.scheduledTime) > new Date(entry.lastClass)) {
        entry.lastClass = b.scheduledTime;
        entry.teacher   = b.teacherId;
      }
    });

    res.json({
      success: true,
      completedBookings: completed,
      studentProgress: Array.from(studentProgress.values()),
      total: completed.length,
    });
  } catch (err) {
    logger.error("Sub-admin reports error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load reports" });
  }
});

// GET /api/sub-admin-scope/reviews
router.get("/reviews", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin, req.db);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId))
        return forbidden(res, "Teacher not in your scope");
      filterTeacherIds = [teacherId];
    }

    const reviews = await getReview(req.db).find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });

    const ratingMap = {};
    reviews.forEach((r) => {
      const tid = r.teacherId?._id?.toString();
      if (!tid) return;
      if (!ratingMap[tid]) ratingMap[tid] = { teacher: r.teacherId, total: 0, count: 0 };
      ratingMap[tid].total += r.rating || 0;
      ratingMap[tid].count++;
    });
    const teacherRatings = Object.values(ratingMap).map((t) => ({
      ...t, average: t.count > 0 ? (t.total / t.count).toFixed(1) : "0.0",
    }));

    res.json({ success: true, reviews, teacherRatings, total: reviews.length });
  } catch (err) {
    logger.error("Sub-admin reviews error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to load reviews" });
  }
});

export default router;
