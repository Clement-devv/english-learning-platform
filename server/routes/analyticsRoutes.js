// server/routes/analyticsRoutes.js - ANALYTICS DASHBOARD API
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Get high-level platform statistics
 */
router.get("/overview", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    const bookingFilter = Object.keys(dateFilter).length > 0 
      ? { scheduledTime: dateFilter } 
      : {};

    // Parallel queries for better performance
    const [
      totalTeachers,
      activeTeachers,
      totalStudents,
      activeStudents,
      bookingStats,
      revenueStats,
      pendingPayments
    ] = await Promise.all([
      Teacher.countDocuments(),
      Teacher.countDocuments({ active: true }),
      Student.countDocuments(),
      Student.countDocuments({ active: true, noOfClasses: { $gt: 0 } }),
      
      // Booking statistics
      Booking.aggregate([
        { $match: bookingFilter },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Revenue statistics
      PaymentTransaction.aggregate([
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" }
          }
        }
      ]),
      
      // Pending payments
      Teacher.aggregate([
        { $match: { earned: { $gt: 0 } } },
        {
          $group: {
            _id: null,
            totalPending: { $sum: "$earned" },
            teachersWithPending: { $sum: 1 }
          }
        }
      ])
    ]);

    // Format booking stats
    const bookingsByStatus = {
      pending: 0,
      accepted: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0
    };
    bookingStats.forEach(stat => {
      bookingsByStatus[stat._id] = stat.count;
    });

    // Format revenue stats
    const revenue = {
      paid: 0,
      pending: 0
    };
    revenueStats.forEach(stat => {
      revenue[stat._id] = stat.total;
    });

    // Add pending teacher earnings to revenue
    if (pendingPayments.length > 0) {
      revenue.pending += pendingPayments[0].totalPending || 0;
    }

    res.json({
      success: true,
      data: {
        users: {
          teachers: {
            total: totalTeachers,
            active: activeTeachers
          },
          students: {
            total: totalStudents,
            active: activeStudents
          }
        },
        bookings: {
          total: Object.values(bookingsByStatus).reduce((a, b) => a + b, 0),
          byStatus: bookingsByStatus
        },
        revenue: {
          total: revenue.paid + revenue.pending,
          paid: revenue.paid,
          pending: revenue.pending,
          teachersWithPending: pendingPayments[0]?.teachersWithPending || 0
        }
      }
    });

  } catch (err) {
    console.error("❌ Error fetching analytics overview:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching analytics"
    });
  }
});

/**
 * GET /api/analytics/bookings-timeline
 * Get booking trends over time
 */
router.get("/bookings-timeline", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { period = "week", startDate, endDate } = req.query;
    
    // Determine grouping format
    const dateFormat = {
      day: { $dateToString: { format: "%Y-%m-%d", date: "$scheduledTime" } },
      week: { $dateToString: { format: "%Y-W%U", date: "$scheduledTime" } },
      month: { $dateToString: { format: "%Y-%m", date: "$scheduledTime" } },
      year: { $dateToString: { format: "%Y", date: "$scheduledTime" } }
    };

    // Date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const timeline = await Booking.aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { scheduledTime: dateFilter } : {} },
      {
        $group: {
          _id: {
            date: dateFormat[period] || dateFormat.week,
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.date": 1 } },
      {
        $group: {
          _id: "$_id.date",
          statuses: {
            $push: {
              status: "$_id.status",
              count: "$count"
            }
          },
          total: { $sum: "$count" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: timeline
    });

  } catch (err) {
    console.error("❌ Error fetching bookings timeline:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings timeline"
    });
  }
});

/**
 * GET /api/analytics/teacher-performance
 * Get teacher performance metrics
 */
router.get("/teacher-performance", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const teacherStats = await Teacher.aggregate([
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "teacherId",
          as: "bookings"
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          continent: 1,
          ratePerClass: 1,
          earned: 1,
          lessonsCompleted: 1,
          totalBookings: { $size: "$bookings" },
          completedBookings: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "completed"] }
              }
            }
          },
          pendingBookings: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "pending"] }
              }
            }
          },
          acceptedBookings: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "accepted"] }
              }
            }
          },
          rejectedBookings: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "rejected"] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          acceptanceRate: {
            $cond: [
              { $gt: ["$totalBookings", 0] },
              {
                $multiply: [
                  {
                    $divide: [
                      { $add: ["$completedBookings", "$acceptedBookings"] },
                      "$totalBookings"
                    ]
                  },
                  100
                ]
              },
              0
            ]
          }
        }
      },
      { $sort: { lessonsCompleted: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: teacherStats
    });

  } catch (err) {
    console.error("❌ Error fetching teacher performance:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching teacher performance"
    });
  }
});

/**
 * GET /api/analytics/student-engagement
 * Get student engagement metrics
 */
router.get("/student-engagement", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const studentStats = await Student.aggregate([
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "studentId",
          as: "bookings"
        }
      },
      {
        $project: {
          firstName: 1,
          surname: 1,
          email: 1,
          noOfClasses: 1,
          totalBookings: { $size: "$bookings" },
          completedClasses: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "completed"] }
              }
            }
          },
          upcomingClasses: {
            $size: {
              $filter: {
                input: "$bookings",
                as: "booking",
                cond: { $eq: ["$$booking.status", "accepted"] }
              }
            }
          },
          lastBooking: {
            $max: {
              $map: {
                input: "$bookings",
                as: "booking",
                in: "$$booking.scheduledTime"
              }
            }
          }
        }
      },
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $multiply: ["$completedClasses", 2] },
              "$upcomingClasses"
            ]
          }
        }
      },
      { $sort: { engagementScore: -1 } },
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: studentStats
    });

  } catch (err) {
    console.error("❌ Error fetching student engagement:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching student engagement"
    });
  }
});

/**
 * GET /api/analytics/revenue-breakdown
 * Get detailed revenue breakdown
 */
router.get("/revenue-breakdown", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Date filter
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const revenueByTeacher = await PaymentTransaction.aggregate([
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { completedAt: dateFilter } }] : []),
      {
        $group: {
          _id: "$teacherId",
          totalEarned: { $sum: "$amount" },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0]
            }
          },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0]
            }
          },
          classCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "teachers",
          localField: "_id",
          foreignField: "_id",
          as: "teacher"
        }
      },
      {
        $unwind: "$teacher"
      },
      {
        $project: {
          teacherName: {
            $concat: ["$teacher.firstName", " ", "$teacher.lastName"]
          },
          totalEarned: 1,
          paidAmount: 1,
          pendingAmount: 1,
          classCount: 1
        }
      },
      { $sort: { totalEarned: -1 } }
    ]);

    const summary = await PaymentTransaction.aggregate([
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: { completedAt: dateFilter } }] : []),
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0]
            }
          },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalRevenue: 0,
          totalPaid: 0,
          totalPending: 0,
          transactionCount: 0
        },
        byTeacher: revenueByTeacher
      }
    });

  } catch (err) {
    console.error("❌ Error fetching revenue breakdown:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching revenue breakdown"
    });
  }
});

/**
 * GET /api/analytics/popular-times
 * Get most popular booking times
 */
router.get("/popular-times", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const popularTimes = await Booking.aggregate([
      {
        $match: {
          status: { $in: ["accepted", "completed"] }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$scheduledTime" },
          hour: { $hour: "$scheduledTime" }
        }
      },
      {
        $group: {
          _id: {
            day: "$dayOfWeek",
            hour: "$hour"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // Convert day numbers to names
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedTimes = popularTimes.map(slot => ({
      day: dayNames[slot._id.day - 1],
      hour: slot._id.hour,
      timeSlot: `${slot._id.hour}:00 - ${slot._id.hour + 1}:00`,
      count: slot.count
    }));

    res.json({
      success: true,
      data: formattedTimes
    });

  } catch (err) {
    console.error("❌ Error fetching popular times:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching popular times"
    });
  }
});

/**
 * GET /api/analytics/booking-acceptance-rate
 * Get booking acceptance rate over time
 */
router.get("/booking-acceptance-rate", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const acceptanceRate = await Booking.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" }
          },
          total: { $sum: 1 },
          accepted: {
            $sum: {
              $cond: [{ $in: ["$status", ["accepted", "completed"]] }, 1, 0]
            }
          },
          rejected: {
            $sum: {
              $cond: [{ $eq: ["$status", "rejected"] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          month: "$_id",
          total: 1,
          accepted: 1,
          rejected: 1,
          acceptanceRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $multiply: [{ $divide: ["$accepted", "$total"] }, 100] },
              0
            ]
          }
        }
      },
      { $sort: { month: 1 } }
    ]);

    res.json({
      success: true,
      data: acceptanceRate
    });

  } catch (err) {
    console.error("❌ Error fetching acceptance rate:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching acceptance rate"
    });
  }
});

export default router;