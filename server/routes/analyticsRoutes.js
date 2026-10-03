// server/routes/analyticsRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware }           from "../middleware/tenantMiddleware.js";
import { bookingSchema }              from "../schemas/bookingSchema.js";
import { teacherSchema }              from "../schemas/teacherSchema.js";
import { studentSchema }              from "../schemas/studentSchema.js";
import { paymentSchema }              from "../schemas/paymentSchema.js";
import { paymentTransactionSchema }   from "../schemas/paymentTransactionSchema.js";
import { quizAttemptSchema }          from "../schemas/quizAttemptSchema.js";
import { parsePagination }            from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { serverError } from '../utils/apiResponse.js';
import { getAnalyticsAccess, requireAnalyticsUnlock } from "../middleware/analyticsPinMiddleware.js";
import { sharedSnapshot } from "../utils/sharedSnapshot.js";

// Admin numbers are served from one shared snapshot per center (utils/sharedSnapshot.js):
// 50 admins watching = one computation per change window, not 50.
const pinVariant = async (req) => ((await getAnalyticsAccess(req)).unlocked ? "unlocked" : "locked");

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getPayment            = (db) => db.models.Payment            || db.model("Payment",            paymentSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getQuizAttempt        = (db) => db.models.QuizAttempt        || db.model("QuizAttempt",        quizAttemptSchema);

// Revenue = completed student payments. Teacher pay comes from
// PaymentTransaction (one per completed class): "paid" has been paid out,
// "pending" is still owed.
async function getRevenueSummary(db) {
  const [studentRevenue, teacherPay] = await Promise.all([
    getPayment(db).aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    getPaymentTransaction(db).aggregate([
      { $match: { status: { $in: ["paid", "pending"] } } },
      { $group: { _id: "$teacherId", paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } }, pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } } } },
    ]),
  ]);
  const total          = studentRevenue[0]?.total || 0;
  const teacherPaid    = teacherPay.reduce((s, t) => s + t.paid, 0);
  const teacherPending = teacherPay.reduce((s, t) => s + t.pending, 0);
  return {
    total,
    teacherPaid,
    teacherPending,
    teachersWithPending: teacherPay.filter(t => t.pending > 0).length,
    net: total - teacherPaid - teacherPending,
  };
}

// GET /api/analytics/overview
// Counts are always returned; the revenue block is null until the admin's
// analytics PIN (if set) has been entered.
router.get("/overview", verifyToken, verifyAdmin, sharedSnapshot("overview", pinVariant), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);
    const bookingFilter = Object.keys(dateFilter).length > 0 ? { scheduledTime: dateFilter } : {};

    const Teacher = getTeacher(req.db);
    const Student = getStudent(req.db);
    const Booking = getBooking(req.db);

    const { unlocked } = await getAnalyticsAccess(req);

    const [
      totalTeachers,
      activeTeachers,
      totalStudents,
      activeStudents,
      bookingStats,
      revenue,
    ] = await Promise.all([
      Teacher.countDocuments(),
      Teacher.countDocuments({ active: true }),
      Student.countDocuments(),
      Student.countDocuments({ active: true, classCredits: { $gt: 0 } }),
      Booking.aggregate([
        { $match: bookingFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      unlocked ? getRevenueSummary(req.db) : null,
    ]);

    const bookingsByStatus = { pending: 0, accepted: 0, completed: 0, missed: 0, rejected: 0, cancelled: 0 };
    bookingStats.forEach(s => { bookingsByStatus[s._id] = s.count; });

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
        revenue,
        revenueLocked: !unlocked,
      },
    });
  } catch (err) {
    logger.error("Error fetching analytics overview:", { error: err?.message });
    serverError(res, "Error fetching analytics");
  }
});

// GET /api/analytics/bookings-timeline
router.get("/bookings-timeline", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("bookings-timeline"), async (req, res) => {
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
    serverError(res, "Error fetching bookings timeline");
  }
});

// GET /api/analytics/teacher-performance
router.get("/teacher-performance", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("teacher-performance"), async (req, res) => {
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
        // Lifetime earnings from pay records — Teacher.earned is only the
        // unpaid balance (it resets to 0 when a payout is made).
        $lookup: {
          from: "paymenttransactions",
          let: { tid: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$teacherId", "$$tid"] }, { $ne: ["$status", "cancelled"] }] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ],
          as: "earnings",
        },
      },
      {
        $project: {
          firstName: 1, lastName: 1, email: 1, continent: 1,
          ratePerClass: 1, lessonsCompleted: 1,
          unpaidBalance: "$earned",
          earned: { $ifNull: [{ $arrayElemAt: ["$earnings.total", 0] }, 0] },
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
      { $sort: { completedBookings: -1, earned: -1 } },
      { $limit: parsePagination({ limit }).limit },
    ]);

    res.json({ success: true, data: teacherStats });
  } catch (err) {
    logger.error("Error fetching teacher performance:", { error: err?.message });
    serverError(res, "Error fetching teacher performance");
  }
});

// GET /api/analytics/student-engagement
router.get("/student-engagement", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("student-engagement"), async (req, res) => {
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
          upcomingClasses:  { $size: { $filter: { input: "$bookings", as: "b", cond: { $and: [{ $eq: ["$$b.status", "accepted"] }, { $gte: ["$$b.scheduledTime", "$$NOW"] }] } } } },
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
    serverError(res, "Error fetching student engagement");
  }
});

// GET /api/analytics/revenue-breakdown
router.get("/revenue-breakdown", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("revenue-breakdown"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate)   dateFilter.$lte = new Date(endDate);

    const PaymentTransaction = getPaymentTransaction(req.db);
    const Payment            = getPayment(req.db);

    // Cancelled pay records were never owed — exclude them from earnings and class counts
    const txMatchStage      = [{ $match: { status: { $ne: "cancelled" }, ...(Object.keys(dateFilter).length > 0 ? { completedAt: dateFilter } : {}) } }];
    const paymentMatchStage = Object.keys(dateFilter).length > 0 ? [{ $match: { date: dateFilter, status: "completed" } }] : [{ $match: { status: "completed" } }];

    const [revenueByTeacher, teacherSalarySummary, studentRevenueSummary] = await Promise.all([
      PaymentTransaction.aggregate([
        ...txMatchStage,
        { $group: { _id: "$teacherId", totalEarned: { $sum: "$amount" }, paidAmount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } }, pendingAmount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }, classCount: { $sum: 1 } } },
        { $lookup: { from: "teachers", localField: "_id", foreignField: "_id", as: "teacher" } },
        { $unwind: "$teacher" },
        { $project: { teacherName: { $concat: ["$teacher.firstName", " ", "$teacher.lastName"] }, totalEarned: 1, paidAmount: 1, pendingAmount: 1, classCount: 1 } },
        { $sort: { totalEarned: -1 } },
      ]),
      // Teacher salary totals (paid out vs still pending)
      PaymentTransaction.aggregate([
        ...txMatchStage,
        { $group: { _id: null, totalPaid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } }, totalPending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] } }, transactionCount: { $sum: 1 } } },
      ]),
      // Total revenue = what students actually paid
      Payment.aggregate([
        ...paymentMatchStage,
        { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
      ]),
    ]);

    const teacherSalary = teacherSalarySummary[0] || { totalPaid: 0, totalPending: 0, transactionCount: 0 };

    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue:     studentRevenueSummary[0]?.totalRevenue || 0,
          totalPaid:        teacherSalary.totalPaid,
          totalPending:     teacherSalary.totalPending,
          transactionCount: teacherSalary.transactionCount,
        },
        byTeacher: revenueByTeacher,
      },
    });
  } catch (err) {
    logger.error("Error fetching revenue breakdown:", { error: err?.message });
    serverError(res, "Error fetching revenue breakdown");
  }
});

// GET /api/analytics/popular-times
router.get("/popular-times", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("popular-times"), async (req, res) => {
  try {
    // Bucket by the admin's local timezone (IANA name), defaulting to UTC
    let timezone = "UTC";
    if (typeof req.query.tz === "string") {
      try { Intl.DateTimeFormat("en-US", { timeZone: req.query.tz }); timezone = req.query.tz; } catch { /* invalid tz — keep UTC */ }
    }

    const popularTimes = await getBooking(req.db).aggregate([
      { $match: { status: { $in: ["accepted", "completed"] } } },
      { $project: { dayOfWeek: { $dayOfWeek: { date: "$scheduledTime", timezone } }, hour: { $hour: { date: "$scheduledTime", timezone } } } },
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
    serverError(res, "Error fetching popular times");
  }
});

// GET /api/analytics/booking-acceptance-rate
router.get("/booking-acceptance-rate", verifyToken, verifyAdmin, requireAnalyticsUnlock, sharedSnapshot("booking-acceptance-rate"), async (req, res) => {
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
    serverError(res, "Error fetching acceptance rate");
  }
});

// GET /api/analytics/leaderboard — accessible to any authenticated center user
// Returns top-10 lists for: streak, completed classes, quiz average score.
router.get("/leaderboard", verifyToken, async (req, res) => {
  try {
    const Student     = getStudent(req.db);
    const Booking     = getBooking(req.db);
    const QuizAttempt = getQuizAttempt(req.db);

    const [streakTop, classesTop, quizTop] = await Promise.all([
      // Top 10 by current streak
      Student.find({ currentStreak: { $gt: 0 }, status: "active" })
        .sort({ currentStreak: -1 })
        .limit(10)
        .select("firstName lastName currentStreak longestStreak"),

      // Top 10 by completed classes (aggregate from bookings)
      Booking.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$studentId", completedClasses: { $sum: 1 } } },
        { $sort:  { completedClasses: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "students",
            let:  { sid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$sid"] } } },
              { $project: { firstName: 1, lastName: 1 } },
            ],
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $project: {
            completedClasses: 1,
            firstName: "$student.firstName",
            lastName:  "$student.lastName",
          },
        },
      ]),

      // Top 10 by average quiz percentage (minimum 1 attempt)
      QuizAttempt.aggregate([
        { $group: { _id: "$studentId", avgScore: { $avg: "$percentage" }, totalQuizzes: { $sum: 1 } } },
        { $sort:  { avgScore: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "students",
            let:  { sid: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$sid"] } } },
              { $project: { firstName: 1, lastName: 1 } },
            ],
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $project: {
            avgScore:     { $round: ["$avgScore", 1] },
            totalQuizzes: 1,
            firstName:    "$student.firstName",
            lastName:     "$student.lastName",
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: { streak: streakTop, classes: classesTop, quiz: quizTop },
    });
  } catch (err) {
    logger.error("Error fetching leaderboard:", { error: err?.message });
    serverError(res, "Error fetching leaderboard");
  }
});

export default router;
