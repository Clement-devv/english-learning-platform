import express from "express";
import Payment from "../models/Payment.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all payments — admin only
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("studentId", "firstName surname email")
      .sort({ date: -1 });
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching payments" });
  }
});

export default router;
