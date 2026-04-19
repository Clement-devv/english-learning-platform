// server/routes/paymentRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { paymentSchema }  from "../schemas/paymentSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { parsePagination } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getPayment = (db) => db.models.Payment || db.model("Payment", paymentSchema);

// Get all payments — admin only
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const payments = await getPayment(req.db)
      .find()
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
