// server/routes/subAdminScopeRoutes.js
// All routes here return data SCOPED to the sub-admin's assigned teachers only
import express from "express";
import SubAdmin from "../models/SubAdmin.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Booking from "../models/Booking.js";
import Assignment from "../models/Assignment.js";
import { verifyToken } from "../middleware/authMiddleware.js";

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
      .populate("studentId", "firstName surname email active noOfClasses age")
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
      .populate("teacherId", "firstName lastName email continent")
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

export default router;