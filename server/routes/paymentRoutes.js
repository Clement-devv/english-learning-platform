// server/routes/paymentRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { paymentSchema }  from "../schemas/paymentSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { parsePagination } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getPayment = (db) => db.models.Payment || db.model("Payment", paymentSchema);

// Get all payments — admin only
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // ?studentId= one student's payments (admin Students → payment history)
    const { limit, skip } = parsePagination(req.query, 50, 2000);
    const filter = {};
    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) return badRequest(res, "Invalid student");
      filter.studentId = req.query.studentId;
    }
    const payments = await getPayment(req.db)
      .find(filter)
      .populate("studentId", "firstName lastName email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(payments);
  } catch (err) {
    logger.error(err);
    serverError(res, "Error fetching payments");
  }
});

export default router;
