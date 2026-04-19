// server/routes/analyticsRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware }           from "../middleware/tenantMiddleware.js";
import { bookingSchema }              from "../schemas/bookingSchema.js";
import { teacherSchema }              from "../schemas/teacherSchema.js";
import { studentSchema }              from "../schemas/studentSchema.js";
import { paymentTransactionSchema }   from "../schemas/paymentTransactionSchema.js";
import { parsePagination }            from "../utils/pagination.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);

// GET /api/analytics/overview
router.get("/overview", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);
    const bookingFilter = Object.keys(dateFilter).length > 0 ? { scheduledTime: dateFilter } : {};

    const Teacher            = getTeacher(req.db);
    const Student            = getStudent(req.db);
    const Booking            = getBooking(req.db);
    const PaymentTransaction = getPaymentTransaction(req.db);

    const [
      totalTeachers,
      activeTeachers,
      totalStudents,
      activeStudents,
      bookingStats,
      revenueStats,
      pendingPayments,
    ] = await Promise.all([
      Teacher.countDocuments(),
      Teacher.countDocuments({ active: true }),
      Student.countDocuments(),
      Student.countDocuments({ active: true, classCredits: { $gt: 0 } }),
      Booking.aggregate([
        { $match: bookingFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      PaymentTransaction.aggregate([
        { $group: { _id: "$status", total: { $sum: "$amount" } } },
      ]),
      Teacher.aggregate([
        { $match: { earned: { $gt: 0 } } },
        { $group: { _id: null, totalPending: { $sum: "$earned" }, teachersWithPending: { $sum: 1 } } },
      ]),
    ]);

    const bookingsByStatus = { pending: 0, accepted: 0, completed: 0, rejected: 0, cancelled: 0 };
    bookingStats.forEach(s => { bookingsByStatus[s._id] = s.count; });

    const revenue = { paid: 0, pending: 0 };
    revenueStats.forEach(s => { revenue[s._id] = s.total; });
    if (pendingPayments.length > 0) revenue.pending += pendingPayments[0].totalPending || 0;

    res.json({
      success: true,
      data: {
        users: {
          teachers: { total: totalTeachers, active: activeTeachers },
          students: { total: totalStudents, active: activeStudents },
        },
        bookings: {
          total: Object.values(bookingsByStatus).reduce((a, b) => a + b, 0),
          byStatus: bookingsByStatus,
        },
        revenue: {
          total: revenue.paid + revenue.pending,
          paid:  revenue.paid,
          pending: revenue.pending,
          teachersWithPending: pendingPayments[0]?.teachersWithPending || 0,
        },
      },
    });
  } catch (err) {
    logger.error("Error fetching analytics overview:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching analytics" });
  }
});

// GET /api/analytics/bookings-timeline
router.get("/bookings-timeline", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { period = "week", startDate, endDate } = req.query;

    const dateFormat = {
      day:   { $dateToString: { format: "%Y-%m-%d", date: "$scheduledTime" } },
      week:  { $dateToString: { format: "%Y-W%U",   date: "$scheduledTime" } },
      month: { $dateToString: { format: "%Y-%m",    date: "$scheduledTime" } },
      year:  { $dateToString: { format: "%Y",       date: "$scheduledTime" } },
    };

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);

    const timeline = await getBooking(req.db).aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { scheduledTime: dateFilter } : {} },
      { $group: { _id: { date: dateFormat[period] || dateFormat.week, status: "$status" }, count: { $sum: 1 } } },
      { $sort: { "_id.date": 1 } },
      { $group: { _id: "$_id.date", statuses: { $push: { status: "$_id.status", count: "$count" } }, total: { $sum: "$count" } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: timeline });
  } catch (err) {
    logger.error("Error fetching bookings timeline:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching bookings timeline" });
  }
});

// GET /api/analytics/teacher-performance
router.get("/teacher-performance", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const teacherStats = await getTeacher(req.db).aggregate([
      {
        // Pipeline $lookup: only fetch {status} per booking — uses the
        // {teacherId,status} index and avoids loading full booking documents.
        $lookup: {
          from: "bookings",
          let: { tid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$teacherId", "$$tid"] } } },
            { $project: { _id: 0, status: 1 } },
          ],
          as: "bookings",
        },
      },
      {
        $project: {
          firstName: 1, lastName: 1, email: 1, continent: 1,
          ratePerClass: 1, earned: 1, lessonsCompleted: 1,
          totalBookings:    { $size: "$bookings" },
          completedBookings: { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "completed"] } } } },
          pendingBookings:   { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "pending"] } } } },
          acceptedBookings:  { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "accepted"] } } } },
          rejectedBookings:  { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "rejected"] } } } },
        },
      },
      {
        $addFields: {
          acceptanceRate: {
            $cond: [
              { $gt: ["$totalBookings", 0] },
              { $multiply: [{ $divide: [{ $add: ["$completedBookings", "$acceptedBookings"] }, "$totalBookings"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { lessonsCompleted: -1 } },
      { $limit: parsePagination({ limit }).limit },
    ]);

    res.json({ success: true, data: teacherStats });
  } catch (err) {
    logger.error("Error fetching teacher performance:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching teacher performance" });
  }
});

// GET /api/analytics/student-engagement
router.get("/student-engagement", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const studentStats = await getStudent(req.db).aggregate([
      {
        // Pipeline $lookup: only fetch {status, scheduledTime} — uses the
        // {studentId,status} index and avoids loading full booking documents.
        $lookup: {
          from: "bookings",
          let: { sid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$studentId", "$$sid"] } } },
            { $project: { _id: 0, status: 1, scheduledTime: 1 } },
          ],
          as: "bookings",
        },
      },
      {
        $project: {
          firstName: 1, lastName: 1, email: 1, classCredits: 1,
          totalBookings:    { $size: "$bookings" },
          completedClasses: { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "completed"] } } } },
          upcomingClasses:  { $size: { $filter: { input: "$bookings", as: "b", cond: { $eq: ["$$b.status", "accepted"] } } } },
          lastBooking: { $max: { $map: { input: "$bookings", as: "b", in: "$$b.scheduledTime" } } },
        },
      },
      {
        $addFields: {
          engagementScore: { $add: [{ $multiply: ["$completedClasses", 2] }, "$upcomingClasses"] },
        },
      },
      { $sort: { engagementScore: -1 } },
      { $limit: parsePagination({ limit }).limit },
    ]);

    res.json({ success: true, data: studentStats });
  } catch (err) {
    logger.error("Error fetching student engagement:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching student engagement" });
  }
});

// GET /api/analytics/revenue-breakdown
router.get("/revenue-breakdown", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);

    const PaymentTransaction = getPaymentTransaction(req.db);
    const matchStage = Object.keys(dateFilter).length > 0 ? [{ $match: { completedAt: dateFilter } }] : [];

    const [revenueByTeacher, summary] = await Promise.all([
      PaymentTransaction.aggregate([
        ...matchStage,
        { $group: { _id: "$teacherId", totalEarned: { $sum: "$amount" }, paidAmount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } }, pendingAmount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }, classCount: { $sum: 1 } } },
        { $lookup: { from: "teachers", localField: "_id", foreignField: "_id", as: "teacher" } },
        { $unwind: "$teacher" },
        { $project: { teacherName: { $concat: ["$teacher.firstName", " ", "$teacher.lastName"] }, totalEarned: 1, paidAmount: 1, pendingAmount: 1, classCount: 1 } },
        { $sort: { totalEarned: -1 } },
      ]),
      PaymentTransaction.aggregate([
        ...matchStage,
        { $group: { _id: null, totalRevenue: { $sum: "$amount" }, totalPaid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } }, totalPending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }, transactionCount: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || { totalRevenue: 0, totalPaid: 0, totalPending: 0, transactionCount: 0 },
        byTeacher: revenueByTeacher,
      },
    });
  } catch (err) {
    logger.error("Error fetching revenue breakdown:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching revenue breakdown" });
  }
});

// GET /api/analytics/popular-times
router.get("/popular-times", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const popularTimes = await getBooking(req.db).aggregate([
      { $match: { status: { $in: ["accepted", "completed"] } } },
      { $project: { dayOfWeek: { $dayOfWeek: "$scheduledTime" }, hour: { $hour: "$scheduledTime" } } },
      { $group: { _id: { day: "$dayOfWeek", hour: "$hour" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedTimes = popularTimes.map(slot => ({
      day:      dayNames[slot._id.day - 1],
      hour:     slot._id.hour,
      timeSlot: `${slot._id.hour}:00 - ${slot._id.hour + 1}:00`,
      count:    slot.count,
    }));

    res.json({ success: true, data: formattedTimes });
  } catch (err) {
    logger.error("Error fetching popular times:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching popular times" });
  }
});

// GET /api/analytics/booking-acceptance-rate
router.get("/booking-acceptance-rate", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const acceptanceRate = await getBooking(req.db).aggregate([
      {
        $group: {
          _id:      { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          total:    { $sum: 1 },
          accepted: { $sum: { $cond: [{ $in: ["$status", ["accepted", "completed"]] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        },
      },
      {
        $project: {
          month:    "$_id",
          total:    1,
          accepted: 1,
          rejected: 1,
          acceptanceRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $multiply: [{ $divide: ["$accepted", "$total"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { month: 1 } },
    ]);

    res.json({ success: true, data: acceptanceRate });
  } catch (err) {
    logger.error("Error fetching acceptance rate:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching acceptance rate" });
  }
});

export default router;
