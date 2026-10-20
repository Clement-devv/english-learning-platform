// server/routes/paymentTransactionRoutes.js - PAYMENT MANAGEMENT ROUTES
import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { requireAnalyticsUnlock } from "../middleware/analyticsPinMiddleware.js";
import { paymentTransactionSchema, SIGNED_AMOUNT, signedAmount } from "../schemas/paymentTransactionSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { adminSchema }              from "../schemas/adminSchema.js";
import { parsePagination }          from "../utils/pagination.js";
import { adjustTeacherEarnings }    from "../utils/classPayment.js";
import { decryptField }             from "../utils/encryption.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, notFound, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getPaymentTransaction = (db) =>
  db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getBooking  = (db) => db.models.Booking  || db.model("Booking",  bookingSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getAdmin    = (db) => db.models.Admin    || db.model("Admin",    adminSchema);

const PAYMENT_METHODS   = ["bank_transfer", "paypal", "cash", "check", "other"];
const MANUAL_TYPES      = ["manual_adjustment", "bonus", "deduction"];
const MAX_MANUAL_AMOUNT = 1_000_000;

/** Validated fields for marking transactions paid. Returns { fields } or { error }. */
function payoutFields(req) {
  const method = req.body?.paymentMethod || "bank_transfer";
  if (!PAYMENT_METHODS.includes(method)) return { error: `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}` };
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 500) : "";
  return { fields: {
    status: "paid", paidAt: new Date(), paymentMethod: method, notes,
    // Impersonation tokens carry a non-ObjectId id — don't let it break the payout
    ...(mongoose.isValidObjectId(req.user.id) ? { paidBy: req.user.id } : {}),
  } };
}

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

    // Only the teacher themself or an admin (students must not see a teacher's earnings)
    const isSelf = req.user.role === "teacher" && req.user.id === teacherId;
    if (!isSelf && req.user.role !== "admin") {
      return forbidden(res, "You can only view your own payments");
    }
    if (!mongoose.isValidObjectId(teacherId)) return forbidden(res, "Invalid teacher");

    const filter = { teacherId };
    if (typeof status === "string" && ["pending", "paid", "cancelled"].includes(status)) filter.status = status;
    // ?q= search class title / student name
    const term = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (term) {
      const rx = new RegExp(term.replace(/[.*+?^$(){}|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ classTitle: rx }, { studentName: rx }];
    }

    // ?page= (1-based) for the teacher Payments table; ?skip= still works
    let { limit, skip } = parsePagination(req.query);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    if (page) skip = (page - 1) * limit;
    const total = await getPaymentTransaction(req.db).countDocuments(filter);
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

    // Totals across ALL of the teacher's transactions — the list above is capped
    const summary = {
      totalPending: 0, totalPaid: 0, totalEarned: 0,
      pendingCount: 0, paidCount: 0
    };
    const tid = new mongoose.Types.ObjectId(String(teacherId));
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6, 1); sixMonthsAgo.setHours(0, 0, 0, 0);
    const tz = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(String(req.query.tz || "")) ? String(req.query.tz) : "UTC";
    const [rows, monthlyRows] = await Promise.all([
      getPaymentTransaction(req.db).aggregate([
        { $match: { teacherId: tid } },
        { $group: { _id: "$status", amount: { $sum: SIGNED_AMOUNT }, n: { $sum: 1 } } },
      ]),
      // Chart: last 6 months of pending/paid, by month in the teacher's timezone
      getPaymentTransaction(req.db).aggregate([
        { $match: { teacherId: tid, status: { $in: ["pending", "paid"] }, completedAt: { $gte: sixMonthsAgo } } },
        { $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$completedAt", timezone: tz } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, SIGNED_AMOUNT, 0] } },
          paid:    { $sum: { $cond: [{ $eq: ["$status", "paid"] }, SIGNED_AMOUNT, 0] } },
        } },
        { $sort: { _id: 1 } },
      ]).catch(() => []), // e.g. an unknown timezone name
    ]);
    summary.cancelledCount = 0; summary.totalCount = 0;
    rows.forEach(r => {
      if (r._id === "pending") { summary.totalPending = r.amount; summary.pendingCount = r.n; }
      else if (r._id === "paid") { summary.totalPaid = r.amount; summary.paidCount = r.n; }
      else if (r._id === "cancelled") summary.cancelledCount = r.n;
      summary.totalEarned += r.amount;
      summary.totalCount += r.n;
    });
    const monthly = monthlyRows.slice(-6).map(m => ({ key: m._id, pending: m.pending, paid: m.paid }));

    res.json({
      transactions, summary, monthly,
      pagination: { page: page || Math.floor(skip / limit) + 1, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    logger.error("Error fetching teacher payments:", { error: err?.message });
    serverError(res, "Error fetching payment transactions");
  }
});

/**
 * GET /api/payments/all
 * Get all payment transactions (Admin only)
 */
router.get("/all", verifyToken, verifyAdmin, requireAnalyticsUnlock, async (req, res) => {
  try {
    ensurePopulateModels(req.db);
    const { status, teacherId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (teacherId) filter.teacherId = teacherId;

    // ?page= (1-based) for the admin transactions table; ?skip= still works
    let { limit, skip } = parsePagination(req.query);
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    if (page) skip = (page - 1) * limit;
    const total = await getPaymentTransaction(req.db).countDocuments(filter);
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

    res.json({
      transactions,
      teacherSummary: Object.values(teacherSummary), // this page only — totals come from /summary
      pagination: { page: page || Math.floor(skip / limit) + 1, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
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
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid payment");
    const payout = payoutFields(req);
    if (payout.error) return badRequest(res, payout.error);

    // Claim it atomically: only a PENDING payment can be paid, and only once —
    // a cancelled (reversed) class can't be paid, and a double click can't pay twice.
    const transaction = await getPaymentTransaction(req.db).findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: payout.fields },
      { new: true },
    );
    if (!transaction) {
      const existing = await getPaymentTransaction(req.db).findById(req.params.id).select("status").lean();
      if (!existing) return notFound(res, "Payment transaction not found");
      return badRequest(res, existing.status === "cancelled"
        ? "This payment was cancelled (the class was reversed) — it can't be paid"
        : "This payment has already been processed");
    }

    // Teacher.earned is the unpaid balance — it drops by what was just settled
    const teacher = await adjustTeacherEarnings(req.db, transaction.teacherId, -signedAmount(transaction), 0);

    logger.info(`💳 Payment processed: $${signedAmount(transaction)} to ${teacher?.firstName || ""} ${teacher?.lastName || ""} (${transaction.teacherId})`);

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
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "Invalid teacher");
    const payout = payoutFields(req);
    if (payout.error) return badRequest(res, payout.error);
    const PaymentTransaction = getPaymentTransaction(req.db);

    // Pay exactly the transactions pending right now. A class completing during this
    // request stays pending (owed) instead of being marked paid without being counted.
    const pendingIds = (await PaymentTransaction.find({ teacherId, status: "pending" }).select("_id").lean()).map(t => t._id);
    if (pendingIds.length === 0) {
      return badRequest(res, "No pending payments for this teacher");
    }

    // paidAt is unique to this request — it identifies exactly the rows THIS call paid
    // (a single "Pay" clicked at the same moment may have taken some of them)
    await PaymentTransaction.updateMany({ _id: { $in: pendingIds }, status: "pending" }, { $set: payout.fields });
    const paidNow = await PaymentTransaction.find({ _id: { $in: pendingIds }, status: "paid", paidAt: payout.fields.paidAt })
      .select("amount type").lean();
    if (paidNow.length === 0) return badRequest(res, "No pending payments for this teacher");

    // Deductions count against the payout
    const totalAmount = Math.round(paidNow.reduce((sum, tx) => sum + signedAmount(tx), 0) * 100) / 100;

    // Teacher.earned is the unpaid balance — drop it by what was settled (atomic, never below 0)
    const teacher = await adjustTeacherEarnings(req.db, teacherId, -totalAmount, 0);

    logger.info(`💰 Bulk payment: $${totalAmount} paid to teacher ${teacherId} (${paidNow.length} transactions)`);

    res.json({
      message: "All pending payments processed successfully",
      totalAmount,
      transactionCount: paidNow.length,
      teacher: teacher
        ? { id: teacher._id, name: `${teacher.firstName} ${teacher.lastName}`, earned: teacher.earned }
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
router.get("/summary", verifyToken, verifyAdmin, requireAnalyticsUnlock, async (req, res) => {
  try {
    // Single aggregation — replaces 1 + 2N queries (was 81 DB round-trips for 40 teachers).
    // Joins teacher fields directly; only fetches {status, amount} from transactions.
    const rows = await getPaymentTransaction(req.db).aggregate([
      // Group transactions by teacher + status in one pass
      {
        $group: {
          _id: { teacherId: "$teacherId", status: "$status" },
          totalAmount: { $sum: SIGNED_AMOUNT },
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

    // Bank details are encrypted at rest; aggregate / lean reads skip the schema getter
    const summary = [...rows, ...zeroRows].map((t) => ({
      ...t,
      bankName: decryptField(t.bankName) || "", accountNumber: decryptField(t.accountNumber) || "", accountName: decryptField(t.accountName) || "",
    }));

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
    const { teacherId, type } = req.body;
    // A string amount used to be added as text ("100" + "50" → 10050)
    const amount = Math.round(Number(req.body.amount) * 100) / 100;

    if (!teacherId || !type || req.body.amount == null) {
      return badRequest(res, "Teacher, amount, and type are required");
    }
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "Invalid teacher");
    if (!MANUAL_TYPES.includes(type)) return badRequest(res, `Type must be one of: ${MANUAL_TYPES.join(", ")}`);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_MANUAL_AMOUNT) {
      return badRequest(res, `Amount must be a number between 0.01 and ${MAX_MANUAL_AMOUNT}`);
    }
    const description = typeof req.body.description === "string" ? req.body.description.trim().slice(0, 500) : "";
    const notes       = typeof req.body.notes === "string" ? req.body.notes.trim().slice(0, 500) : "";

    const teacher = await getTeacher(req.db).findById(teacherId).select("_id").lean();
    if (!teacher) {
      return notFound(res, "Teacher not found");
    }

    // No bookingId at all (not null): the unique sparse index on bookingId still
    // indexes null, so a second manual transaction would collide.
    const transaction = await getPaymentTransaction(req.db).create({
      teacherId, amount, type, status: "pending", notes,
      description: description || `Manual ${type}`,
      completedAt: new Date(),
    });

    // Deductions lower the unpaid balance, everything else raises it (atomic, never below 0)
    const updated = await adjustTeacherEarnings(req.db, teacherId, signedAmount(transaction), 0);

    res.status(201).json({ message: "Manual payment transaction created", transaction, earned: updated?.earned });
  } catch (err) {
    logger.error("Error creating manual payment:", { error: err?.message });
    serverError(res, "Error creating manual payment");
  }
});

export default router;
