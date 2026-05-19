// server/routes/paymentTransactionRoutes.js - PAYMENT MANAGEMENT ROUTES
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { adminSchema }              from "../schemas/adminSchema.js";
import { parsePagination }          from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getPaymentTransaction = (db) =>
  db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getBooking  = (db) => db.models.Booking  || db.model("Booking",  bookingSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getAdmin    = (db) => db.models.Admin    || db.model("Admin",    adminSchema);

// Ensure all ref models are registered on the connection before any populate call.
const ensurePopulateModels = (db) => {
  getBooking(db); getStudent(db); getAdmin(db); getTeacher(db);
};

/**
 * GET /api/payments/teacher/:teacherId
 * Get all payment transactions for a specific teacher
 */
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    ensurePopulateModels(req.db);
    const { teacherId } = req.params;
    const { status } = req.query;

    if (req.user.role === "teacher" && req.user.id !== teacherId) {
      return forbidden(res, "You can only view your own payments");
    }

    const filter = { teacherId };
    if (status) filter.status = status;

    const { limit, skip } = parsePagination(req.query);
    const transactions = await getPaymentTransaction(req.db).find(filter)
      .populate("bookingId", "classTitle scheduledTime duration studentId")
      .populate({ path: "studentId", select: "firstName lastName" })
      .populate("paidBy", "firstName lastName")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Back-fill studentName for old records that were saved without it
    transactions.forEach(tx => {
      if (!tx.studentName) {
        const s = tx.studentId;
        if (s && (s.firstName || s.lastName)) {
          tx.studentName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
        }
      }
    });

    const summary = {
      totalPending: 0, totalPaid: 0, totalEarned: 0,
      pendingCount: 0, paidCount: 0
    };

    transactions.forEach(tx => {
      if (tx.status === "pending") { summary.totalPending += tx.amount; summary.pendingCount++; }
      else if (tx.status === "paid") { summary.totalPaid += tx.amount; summary.paidCount++; }
      summary.totalEarned += tx.amount;
    });

    res.json({ transactions, summary });
  } catch (err) {
    logger.error("Error fetching teacher payments:", { error: err?.message });
    serverError(res, "Error fetching payment transactions");
  }
});

/**
 * GET /api/payments/all
 * Get all payment transactions (Admin only)
 */
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    ensurePopulateModels(req.db);
    const { status, teacherId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (teacherId) filter.teacherId = teacherId;

    const { limit, skip } = parsePagination(req.query);
    const transactions = await getPaymentTransaction(req.db).find(filter)
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("paidBy", "firstName lastName")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const teacherSummary = {};

    transactions.forEach(tx => {
      const tid = tx.teacherId._id.toString();
      if (!teacherSummary[tid]) {
        teacherSummary[tid] = {
          teacherId: tx.teacherId._id,
          teacherName: `${tx.teacherId.firstName} ${tx.teacherId.lastName}`,
          totalPending: 0, totalPaid: 0, pendingCount: 0, paidCount: 0
        };
      }
      if (tx.status === "pending") { teacherSummary[tid].totalPending += tx.amount; teacherSummary[tid].pendingCount++; }
      else if (tx.status === "paid") { teacherSummary[tid].totalPaid += tx.amount; teacherSummary[tid].paidCount++; }
    });

    res.json({ transactions, teacherSummary: Object.values(teacherSummary) });
  } catch (err) {
    logger.error("Error fetching all payments:", { error: err?.message });
    serverError(res, "Error fetching payment transactions");
  }
});

/**
 * PATCH /api/payments/:id/pay
 * Mark a payment transaction as paid (Admin only)
 */
router.patch("/:id/pay", verifyToken, verifyAdmin, async (req, res) => {
  try {
    ensurePopulateModels(req.db);
    const { paymentMethod, notes } = req.body;

    const transaction = await getPaymentTransaction(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email earned lessonsCompleted");

    if (!transaction) {
      return notFound(res, "Payment transaction not found");
    }

    if (transaction.status === "paid") {
      return badRequest(res, "This payment has already been processed");
    }

    transaction.status = "paid";
    transaction.paidAt = new Date();
    transaction.paidBy = req.user.id;
    transaction.paymentMethod = paymentMethod || "bank_transfer";
    transaction.notes = notes || "";
    await transaction.save();

    logger.info(`💳 Payment processed: $${transaction.amount} paid to ${transaction.teacherId.firstName} ${transaction.teacherId.lastName}`);

    const updatedTransaction = await getPaymentTransaction(req.db).findById(transaction._id)
      .populate("teacherId", "firstName lastName email")
      .populate("bookingId", "classTitle scheduledTime")
      .populate("paidBy", "firstName lastName");

    res.json({ message: "Payment processed successfully", transaction: updatedTransaction });
  } catch (err) {
    logger.error("Error processing payment:", { error: err?.message });
    serverError(res, "Error processing payment");
  }
});

/**
 * PATCH /api/payments/teacher/:teacherId/pay-all
 * Pay all pending payments for a teacher and reset their earnings (Admin only)
 */
router.patch("/teacher/:teacherId/pay-all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { paymentMethod, notes } = req.body;

    const pendingTransactions = await getPaymentTransaction(req.db).find({
      teacherId, status: "pending",
    });

    if (pendingTransactions.length === 0) {
      return badRequest(res, "No pending payments for this teacher");
    }

    const totalAmount = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    await getPaymentTransaction(req.db).updateMany(
      { teacherId, status: "pending" },
      { $set: { status: "paid", paidAt: new Date(), paidBy: req.user.id,
                paymentMethod: paymentMethod || "bank_transfer", notes: notes || "" } }
    );

    const teacher = await getTeacher(req.db).findById(teacherId);
    if (teacher) {
      teacher.earned = 0;
      await teacher.save();
    }

    logger.info(`💰 Bulk payment: $${totalAmount} paid to teacher ${teacherId} (${pendingTransactions.length} transactions)`);

    res.json({
      message: "All pending payments processed successfully",
      totalAmount,
      transactionCount: pendingTransactions.length,
      teacher: teacher
        ? { id: teacher._id, name: `${teacher.firstName} ${teacher.lastName}`, earned: 0 }
        : null,
    });
  } catch (err) {
    logger.error("Error processing bulk payment:", { error: err?.message });
    serverError(res, "Error processing bulk payment");
  }
});

/**
 * GET /api/payments/summary
 * Get payment summary for all teachers (Admin only)
 */
router.get("/summary", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Single aggregation — replaces 1 + 2N queries (was 81 DB round-trips for 40 teachers).
    // Joins teacher fields directly; only fetches {status, amount} from transactions.
    const rows = await getPaymentTransaction(req.db).aggregate([
      // Group transactions by teacher + status in one pass
      {
        $group: {
          _id: { teacherId: "$teacherId", status: "$status" },
          totalAmount: { $sum: "$amount" },
          count:       { $sum: 1 },
        },
      },
      // Pivot pending vs paid into a single doc per teacher
      {
        $group: {
          _id: "$_id.teacherId",
          pendingAmount: { $sum: { $cond: [{ $eq: ["$_id.status", "pending"] }, "$totalAmount", 0] } },
          paidAmount:    { $sum: { $cond: [{ $eq: ["$_id.status", "paid"]    }, "$totalAmount", 0] } },
          pendingCount:  { $sum: { $cond: [{ $eq: ["$_id.status", "pending"] }, "$count",       0] } },
          paidCount:     { $sum: { $cond: [{ $eq: ["$_id.status", "paid"]    }, "$count",       0] } },
        },
      },
      // Join teacher profile (active teachers only)
      {
        $lookup: {
          from: "teachers",
          let: { tid: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$tid"] }, { $eq: ["$active", true] }] } } },
            { $project: { firstName: 1, lastName: 1, email: 1, ratePerClass: 1,
                          earned: 1, lessonsCompleted: 1,
                          bankName: 1, accountNumber: 1, accountName: 1 } },
          ],
          as: "teacher",
        },
      },
      { $unwind: "$teacher" }, // drops rows whose teacher is inactive / deleted
      // Shape to match original response
      {
        $project: {
          _id: 0,
          teacherId:       "$_id",
          teacherName:     { $concat: ["$teacher.firstName", " ", "$teacher.lastName"] },
          email:           "$teacher.email",
          ratePerClass:    "$teacher.ratePerClass",
          currentEarned:   "$teacher.earned",
          lessonsCompleted:"$teacher.lessonsCompleted",
          pendingAmount:   1,
          paidAmount:      1,
          pendingCount:    1,
          paidCount:       1,
          totalEarnings:   { $add: ["$pendingAmount", "$paidAmount"] },
          bankName:        { $ifNull: ["$teacher.bankName",      ""] },
          accountNumber:   { $ifNull: ["$teacher.accountNumber", ""] },
          accountName:     { $ifNull: ["$teacher.accountName",   ""] },
        },
      },
      { $sort: { teacherName: 1 } },
    ]);

    // Include active teachers with zero transactions (left-join style)
    const teacherIdsInTx = new Set(rows.map(r => r.teacherId.toString()));
    const zeroTxTeachers = await getTeacher(req.db)
      .find({ active: true, _id: { $nin: Array.from(teacherIdsInTx) } })
      .select("firstName lastName email ratePerClass earned lessonsCompleted bankName accountNumber accountName")
      .lean();
    const zeroRows = zeroTxTeachers.map(t => ({
      teacherId: t._id, teacherName: `${t.firstName} ${t.lastName}`,
      email: t.email, ratePerClass: t.ratePerClass,
      currentEarned: t.earned, lessonsCompleted: t.lessonsCompleted,
      pendingAmount: 0, paidAmount: 0, pendingCount: 0, paidCount: 0,
      totalEarnings: 0,
      bankName: t.bankName || "", accountNumber: t.accountNumber || "", accountName: t.accountName || "",
    }));

    const summary = [...rows, ...zeroRows];

    const overallTotals = {
      totalPending:  summary.reduce((sum, t) => sum + t.pendingAmount, 0),
      totalPaid:     summary.reduce((sum, t) => sum + t.paidAmount,    0),
      totalTeachers: summary.length,
      totalLessons:  summary.reduce((sum, t) => sum + (t.lessonsCompleted || 0), 0),
    };

    res.json({ teachers: summary, totals: overallTotals });
  } catch (err) {
    logger.error("Error fetching payment summary:", { error: err?.message });
    serverError(res, "Error fetching payment summary");
  }
});

/**
 * POST /api/payments/manual
 * Create a manual payment transaction (Admin only)
 * For bonuses, adjustments, or corrections
 */
router.post("/manual", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId, amount, type, description, notes } = req.body;

    if (!teacherId || !amount || !type) {
      return badRequest(res, "Teacher, amount, and type are required");
    }

    const teacher = await getTeacher(req.db).findById(teacherId);
    if (!teacher) {
      return notFound(res, "Teacher not found");
    }

    const PaymentTransaction = getPaymentTransaction(req.db);
    const transaction = new PaymentTransaction({
      teacherId,
      bookingId: null,
      amount,
      type,
      status: "pending",
      description: description || `Manual ${type}`,
      completedAt: new Date()
    });

    await transaction.save();

    if (type === "deduction") {
      teacher.earned = Math.max(0, (teacher.earned || 0) - amount);
    } else {
      teacher.earned = (teacher.earned || 0) + amount;
    }
    await teacher.save();

    res.status(201).json({ message: "Manual payment transaction created", transaction });
  } catch (err) {
    logger.error("Error creating manual payment:", { error: err?.message });
    serverError(res, "Error creating manual payment");
  }
});

export default router;
