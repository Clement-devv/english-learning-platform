import express from "express";
import Payment from "../models/Payment.js";

const router = express.Router();

router.get("/", async (req, res) => {
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