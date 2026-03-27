// server/routes/subAdminScopeRoutes.js
// All routes here return data SCOPED to the sub-admin's assigned teachers only
import express from "express";
import SubAdmin from "../models/SubAdmin.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Booking from "../models/Booking.js";
import Assignment from "../models/Assignment.js";
import Payment from "../models/Payment.js";
import Recording from "../models/Recording.js";
import Review from "../models/Review.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { completeClass } from "../services/classCompletionService.js";
import Notification from "../models/Notification.js";
import PaymentTransaction from "../models/PaymentTransaction.js";

const router = express.Router();

// ── Auth middleware: must be an active sub-admin ──────────────────────────────
const requireSubAdmin = async (req, res, next) => {
  if (!req.user || req.user.role !== "sub-admin") {
    return res.status(403).json({ success: false, message: "Sub-admin access required" });
  }
  const subAdmin = await SubAdmin.findById(req.user.id);
  if (!subAdmin || subAdmin.status !== "active") {
    return res.status(403).json({ success: false, message: "Account inactive" });
  }
  req.subAdmin = subAdmin;
  next();
};

// ── Helper: get teacher IDs in scope ─────────────────────────────────────────
const getScopedTeacherIds = async (subAdmin) => {
  if (subAdmin.assignmentType === "region" && subAdmin.region) {
    const teachers = await Teacher.find({ continent: subAdmin.region }).select("_id");
    return teachers.map((t) => t._id);
  }
  return subAdmin.assignedTeachers;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/overview
// Dashboard summary stats scoped to this sub-admin
// ─────────────────────────────────────────────────────────────────────────────
router.get("/overview", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);

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

    // Get teachers
    const [teachers, bookings] = await Promise.all([
      Teacher.find({ _id: { $in: teacherIds } }).select("firstName lastName active continent"),
      Booking.find({ teacherId: { $in: teacherIds } })
        .populate("teacherId", "firstName lastName")
        .populate("studentId", "firstName surname email")
        .sort({ scheduledTime: -1 }),
    ]);

    // Get unique students from bookings
    const studentIds = [...new Set(bookings.map((b) => b.studentId?._id?.toString()).filter(Boolean))];

    // Booking status counts
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
    console.error("Sub-admin overview error:", err);
    res.status(500).json({ success: false, message: "Failed to load overview" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/teachers
// Teachers in this sub-admin's scope (read-only)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/teachers", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);

    const teachers = await Teacher.find({ _id: { $in: teacherIds } })
      .select("-password -twoFactorSecret -twoFactorBackupCodes")
      .sort({ firstName: 1 });

    // Attach booking counts per teacher
    const bookingCounts = await Booking.aggregate([
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
    console.error("Sub-admin teachers error:", err);
    res.status(500).json({ success: false, message: "Failed to load teachers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/students
// Students derived from assigned teachers' bookings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/students", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);

    // Get all unique students that have bookings with these teachers
    const bookings = await Booking.find({ teacherId: { $in: teacherIds } })
      .populate("studentId", "firstName surname email active noOfClasses age dateOfBirth rank")
      .populate("teacherId", "firstName lastName");

    // Deduplicate students, keep latest booking info
    const studentMap = new Map();
    bookings.forEach((b) => {
      if (!b.studentId) return;
      const sid = b.studentId._id.toString();
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          ...b.studentId.toObject(),
          assignedTeacher: b.teacherId,
          latestBookingStatus: b.status,
          latestBookingDate: b.scheduledTime,
          totalBookings: 1,
        });
      } else {
        const existing = studentMap.get(sid);
        existing.totalBookings++;
        if (new Date(b.scheduledTime) > new Date(existing.latestBookingDate)) {
          existing.latestBookingStatus = b.status;
          existing.latestBookingDate = b.scheduledTime;
          existing.assignedTeacher = b.teacherId;
        }
      }
    });

    const students = Array.from(studentMap.values());
    res.json({ success: true, students, total: students.length });
  } catch (err) {
    console.error("Sub-admin students error:", err);
    res.status(500).json({ success: false, message: "Failed to load students" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/bookings
// Bookings scoped to assigned teachers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/bookings", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const { status, teacherId } = req.query;
    const teacherIds = await getScopedTeacherIds(req.subAdmin);

    // If a specific teacherId is requested, verify it's in scope
    let filterTeacherIds = teacherIds;
    if (teacherId) {
      const inScope = teacherIds.map(String).includes(teacherId);
      if (!inScope) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const filter = { teacherId: { $in: filterTeacherIds } };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate("teacherId", "firstName lastName email continent googleMeetLink")
      .populate("studentId", "firstName surname email")
      .sort({ scheduledTime: -1 });

    res.json({ success: true, bookings, total: bookings.length });
  } catch (err) {
    console.error("Sub-admin bookings error:", err);
    res.status(500).json({ success: false, message: "Failed to load bookings" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/me
// Current sub-admin's own profile + scope info
// ─────────────────────────────────────────────────────────────────────────────
router.get("/me", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findById(req.user.id)
      .populate("assignedTeachers", "firstName lastName email continent active")
      .populate("createdBy", "firstName lastName email");

    res.json({ success: true, subAdmin });
  } catch (err) {
    console.error("Sub-admin me error:", err);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/classes
// Accepted + completed bookings for assigned teachers (markable classes)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/classes", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const { status, teacherId } = req.query;
    const teacherIds = await getScopedTeacherIds(req.subAdmin);

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId)) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const statusFilter = status ? { status } : { status: { $in: ["accepted", "completed"] } };

    const bookings = await Booking.find({ teacherId: { $in: filterTeacherIds }, ...statusFilter })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName surname email noOfClasses")
      .sort({ scheduledTime: -1 });

    res.json({ success: true, bookings, total: bookings.length });
  } catch (err) {
    console.error("Sub-admin classes error:", err);
    res.status(500).json({ success: false, message: "Failed to load classes" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sub-admin-scope/classes/mark
// Mark a class as completed — requires canMarkLessons permission
// Teacher must be in this sub-admin's scope
// ─────────────────────────────────────────────────────────────────────────────
router.post("/classes/mark", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canMarkLessons) {
      return res.status(403).json({ success: false, message: "You do not have permission to mark lessons" });
    }

    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId is required" });
    }

    // Verify booking's teacher is within this sub-admin's scope
    const booking = await Booking.findById(bookingId).select("teacherId status");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    if (!teacherIds.map(String).includes(booking.teacherId.toString())) {
      return res.status(403).json({ success: false, message: "This booking's teacher is not in your scope" });
    }

    const result = await completeClass(bookingId, "sub-admin", { skipAttendanceCheck: true });

    if (result.alreadyProcessed) {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${result.completed ? "completed" : "missed"}.`,
      });
    }

    // Persist notification for admin
    const subAdminName = `${req.subAdmin.firstName} ${req.subAdmin.lastName}`;
    const teacherName  = booking.teacherId
      ? `${result.booking?.teacherId?.firstName || ""} ${result.booking?.teacherId?.lastName || ""}`.trim()
      : "";
    const studentName  = result.booking?.studentId
      ? `${result.booking.studentId.firstName || ""} ${result.booking.studentId.surname || ""}`.trim()
      : "";

    Notification.create({
      type:        "class_marked",
      message:     `${subAdminName} marked a class as completed${teacherName ? ` (Teacher: ${teacherName}` : ""}${studentName ? `, Student: ${studentName}` : ""}${teacherName || studentName ? ")" : ""}.`,
      subAdminId:  req.subAdmin._id,
      subAdminName,
      metadata: {
        bookingId,
        teacherName,
        studentName,
        classTitle: result.booking?.classTitle || "",
      },
    }).catch((e) => console.error("Failed to save mark-class notification:", e));

    res.json({ success: true, message: "Lesson marked as completed.", ...result });
  } catch (err) {
    console.error("Sub-admin mark class error:", err);
    res.status(500).json({ success: false, message: "Error marking lesson: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sub-admin-scope/classes/unmark
// Revert a completed class back to accepted — requires canMarkLessons
// ─────────────────────────────────────────────────────────────────────────────
router.post("/classes/unmark", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canMarkLessons) {
      return res.status(403).json({ success: false, message: "You do not have permission to unmark lessons" });
    }

    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "bookingId is required" });
    }

    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName ratePerClass earned lessonsCompleted")
      .populate("studentId", "firstName surname noOfClasses active");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ success: false, message: `Cannot unmark a booking with status "${booking.status}"` });
    }

    // Scope check
    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    if (!teacherIds.map(String).includes(booking.teacherId._id.toString())) {
      return res.status(403).json({ success: false, message: "This booking's teacher is not in your scope" });
    }

    const ratePerClass = Math.round((parseFloat(booking.teacherId.ratePerClass) || 0) * 100) / 100;

    // 1 — Revert booking to accepted
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { status: "accepted" }, $unset: { completedAt: "", markedBy: "" } }
    );

    // 2 — Restore student class credit
    await Student.findByIdAndUpdate(booking.studentId._id, {
      $inc: { noOfClasses: 1 },
      $set: { active: true },
    });

    // 3 — Deduct teacher earnings
    const newEarned           = Math.max(0, Math.round(((booking.teacherId.earned || 0) - ratePerClass) * 100) / 100);
    const newLessonsCompleted = Math.max(0, (booking.teacherId.lessonsCompleted || 0) - 1);
    await Teacher.findByIdAndUpdate(booking.teacherId._id, {
      $set: { earned: newEarned, lessonsCompleted: newLessonsCompleted },
    });

    // 4 — Remove the pending PaymentTransaction for this booking (if not yet paid)
    await PaymentTransaction.deleteOne({ bookingId, status: "pending" });

    // 5 — Persist notification for admin
    const subAdminName = `${req.subAdmin.firstName} ${req.subAdmin.lastName}`;
    const teacherName  = `${booking.teacherId.firstName} ${booking.teacherId.lastName}`;
    const studentName  = `${booking.studentId.firstName} ${booking.studentId.surname}`;

    Notification.create({
      type:        "class_unmarked",
      message:     `${subAdminName} unmarked a class (Teacher: ${teacherName}, Student: ${studentName}).`,
      subAdminId:  req.subAdmin._id,
      subAdminName,
      metadata: {
        bookingId,
        teacherName,
        studentName,
        classTitle: booking.classTitle || "",
      },
    }).catch((e) => console.error("Failed to save unmark notification:", e));

    res.json({ success: true, message: "Class reverted to accepted." });
  } catch (err) {
    console.error("Sub-admin unmark class error:", err);
    res.status(500).json({ success: false, message: "Error unmarking class: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/payments
// Teacher payment records for assigned teachers — requires canViewPayments
// ─────────────────────────────────────────────────────────────────────────────
router.get("/payments", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    if (!req.subAdmin.permissions?.canViewPayments) {
      return res.status(403).json({ success: false, message: "You do not have permission to view payments" });
    }

    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId)) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const payments = await Payment.find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });

    // Summary per teacher
    const summary = {};
    payments.forEach((p) => {
      const tid = p.teacherId?._id?.toString();
      if (!tid) return;
      if (!summary[tid]) {
        summary[tid] = {
          teacher: p.teacherId,
          totalEarned: 0,
          totalPaid: 0,
          totalPending: 0,
          count: 0,
        };
      }
      summary[tid].totalEarned += p.amount || 0;
      if (p.status === "paid") summary[tid].totalPaid += p.amount || 0;
      else summary[tid].totalPending += p.amount || 0;
      summary[tid].count++;
    });

    res.json({
      success: true,
      payments,
      summary: Object.values(summary),
      total: payments.length,
    });
  } catch (err) {
    console.error("Sub-admin payments error:", err);
    res.status(500).json({ success: false, message: "Failed to load payments" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/recordings
// Recordings for assigned teachers' classes
// ─────────────────────────────────────────────────────────────────────────────
router.get("/recordings", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId)) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const recordings = await Recording.find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });

    res.json({ success: true, recordings, total: recordings.length });
  } catch (err) {
    console.error("Sub-admin recordings error:", err);
    res.status(500).json({ success: false, message: "Failed to load recordings" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/reports
// Progress reports — completed classes per student/teacher in scope
// ─────────────────────────────────────────────────────────────────────────────
router.get("/reports", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId)) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const completed = await Booking.find({
      teacherId: { $in: filterTeacherIds },
      status: "completed",
    })
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("studentId", "firstName surname email noOfClasses")
      .sort({ scheduledTime: -1 });

    // Build per-student progress summary
    const studentProgress = new Map();
    completed.forEach((b) => {
      if (!b.studentId) return;
      const sid = b.studentId._id.toString();
      if (!studentProgress.has(sid)) {
        studentProgress.set(sid, {
          student: b.studentId,
          teacher: b.teacherId,
          completedClasses: 0,
          remainingClasses: b.studentId.noOfClasses || 0,
          lastClass: null,
        });
      }
      const entry = studentProgress.get(sid);
      entry.completedClasses++;
      if (!entry.lastClass || new Date(b.scheduledTime) > new Date(entry.lastClass)) {
        entry.lastClass = b.scheduledTime;
        entry.teacher = b.teacherId;
      }
    });

    res.json({
      success: true,
      completedBookings: completed,
      studentProgress: Array.from(studentProgress.values()),
      total: completed.length,
    });
  } catch (err) {
    console.error("Sub-admin reports error:", err);
    res.status(500).json({ success: false, message: "Failed to load reports" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admin-scope/reviews
// Reviews for assigned teachers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/reviews", verifyToken, requireSubAdmin, async (req, res) => {
  try {
    const teacherIds = await getScopedTeacherIds(req.subAdmin);
    const { teacherId } = req.query;

    let filterTeacherIds = teacherIds;
    if (teacherId) {
      if (!teacherIds.map(String).includes(teacherId)) {
        return res.status(403).json({ success: false, message: "Teacher not in your scope" });
      }
      filterTeacherIds = [teacherId];
    }

    const reviews = await Review.find({ teacherId: { $in: filterTeacherIds } })
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });

    // Average rating per teacher
    const ratingMap = {};
    reviews.forEach((r) => {
      const tid = r.teacherId?._id?.toString();
      if (!tid) return;
      if (!ratingMap[tid]) ratingMap[tid] = { teacher: r.teacherId, total: 0, count: 0 };
      ratingMap[tid].total += r.rating || 0;
      ratingMap[tid].count++;
    });
    const teacherRatings = Object.values(ratingMap).map((t) => ({
      ...t,
      average: t.count > 0 ? (t.total / t.count).toFixed(1) : "0.0",
    }));

    res.json({ success: true, reviews, teacherRatings, total: reviews.length });
  } catch (err) {
    console.error("Sub-admin reviews error:", err);
    res.status(500).json({ success: false, message: "Failed to load reviews" });
  }
});

export default router;