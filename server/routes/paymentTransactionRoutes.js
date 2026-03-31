// server/routes/paymentTransactionRoutes.js - PAYMENT MANAGEMENT ROUTES
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getPaymentTransaction = (db) =>
  db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

/**
 * GET /api/payments/teacher/:teacherId
 * Get all payment transactions for a specific teacher
 */
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { status } = req.query;

    if (req.user.role === "teacher" && req.user.id !== teacherId) {
      return res.status(403).json({ message: "You can only view your own payments" });
    }

    const filter = { teacherId };
    if (status) filter.status = status;

    const transactions = await getPaymentTransaction(req.db).find(filter)
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("paidBy", "firstName lastName")
      .sort({ completedAt: -1 });

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
    console.error("Error fetching teacher payments:", err);
    res.status(500).json({ message: "Error fetching payment transactions" });
  }
});

/**
 * GET /api/payments/all
 * Get all payment transactions (Admin only)
 */
router.get("/all", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status, teacherId } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (teacherId) filter.teacherId = teacherId;

    const transactions = await getPaymentTransaction(req.db).find(filter)
      .populate("teacherId", "firstName lastName email ratePerClass")
      .populate("bookingId", "classTitle scheduledTime duration")
      .populate("paidBy", "firstName lastName")
      .sort({ completedAt: -1 });

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
    console.error("Error fetching all payments:", err);
    res.status(500).json({ message: "Error fetching payment transactions" });
  }
});

/**
 * PATCH /api/payments/:id/pay
 * Mark a payment transaction as paid (Admin only)
 */
router.patch("/:id/pay", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { paymentMethod, notes } = req.body;

    const transaction = await getPaymentTransaction(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email earned lessonsCompleted");

    if (!transaction) {
      return res.status(404).json({ message: "Payment transaction not found" });
    }

    if (transaction.status === "paid") {
      return res.status(400).json({ message: "This payment has already been processed" });
    }

    transaction.status = "paid";
    transaction.paidAt = new Date();
    transaction.paidBy = req.user.id;
    transaction.paymentMethod = paymentMethod || "bank_transfer";
    transaction.notes = notes || "";
    await transaction.save();

    console.log(`💳 Payment processed: $${transaction.amount} paid to ${transaction.teacherId.firstName} ${transaction.teacherId.lastName}`);

    const updatedTransaction = await getPaymentTransaction(req.db).findById(transaction._id)
      .populate("teacherId", "firstName lastName email")
      .populate("bookingId", "classTitle scheduledTime")
      .populate("paidBy", "firstName lastName");

    res.json({ message: "Payment processed successfully", transaction: updatedTransaction });
  } catch (err) {
    console.error("Error processing payment:", err);
    res.status(500).json({ message: "Error processing payment" });
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
      return res.status(400).json({ message: "No pending payments for this teacher" });
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

    console.log(`💰 Bulk payment: $${totalAmount} paid to teacher ${teacherId} (${pendingTransactions.length} transactions)`);

    res.json({
      message: "All pending payments processed successfully",
      totalAmount,
      transactionCount: pendingTransactions.length,
      teacher: teacher
        ? { id: teacher._id, name: `${teacher.firstName} ${teacher.lastName}`, earned: 0 }
        : null,
    });
  } catch (err) {
    console.error("Error processing bulk payment:", err);
    res.status(500).json({ message: "Error processing bulk payment" });
  }
});

/**
 * GET /api/payments/summary
 * Get payment summary for all teachers (Admin only)
 */
router.get("/summary", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teachers = await getTeacher(req.db).find({ active: true })
      .select("firstName lastName email ratePerClass earned lessonsCompleted bankName accountNumber accountName");

    const summaryPromises = teachers.map(async (teacher) => {
      const PaymentTransaction = getPaymentTransaction(req.db);
      const [pendingTransactions, paidTransactions] = await Promise.all([
        PaymentTransaction.find({ teacherId: teacher._id, status: "pending" }),
        PaymentTransaction.find({ teacherId: teacher._id, status: "paid" }),
      ]);

      const totalPending = pendingTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalPaid    = paidTransactions.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        teacherId: teacher._id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        ratePerClass: teacher.ratePerClass,
        currentEarned: teacher.earned,
        lessonsCompleted: teacher.lessonsCompleted,
        pendingAmount: totalPending,
        paidAmount: totalPaid,
        pendingCount: pendingTransactions.length,
        paidCount: paidTransactions.length,
        totalEarnings: totalPending + totalPaid,
        bankName:      teacher.bankName      || "",
        accountNumber: teacher.accountNumber || "",
        accountName:   teacher.accountName   || "",
      };
    });

    const summary = await Promise.all(summaryPromises);

    const overallTotals = {
      totalPending: summary.reduce((sum, t) => sum + t.pendingAmount, 0),
      totalPaid:    summary.reduce((sum, t) => sum + t.paidAmount, 0),
      totalTeachers: summary.length,
      totalLessons:  summary.reduce((sum, t) => sum + t.lessonsCompleted, 0)
    };

    res.json({ teachers: summary, totals: overallTotals });
  } catch (err) {
    console.error("Error fetching payment summary:", err);
    res.status(500).json({ message: "Error fetching payment summary" });
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
      return res.status(400).json({ message: "Teacher, amount, and type are required" });
    }

    const teacher = await getTeacher(req.db).findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
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
    console.error("Error creating manual payment:", err);
    res.status(500).json({ message: "Error creating manual payment" });
  }
});

export default router;
