// server/routes/reviewRoutes.js

import express from "express";
import Review  from "../models/Review.js";
import Booking from "../models/Booking.js";
import {
  verifyToken,
  verifyStudent,
  verifyAdmin,
  verifyAdminOrTeacher,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// ── POST /api/reviews  —  student submits a review ───────────────────────────
router.post("/", verifyToken, verifyStudent, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const studentId = req.user._id;

    if (!bookingId || !rating) {
      return res.status(400).json({ error: "bookingId and rating are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Verify the booking belongs to this student and is completed
    const booking = await Booking.findOne({ _id: bookingId, studentId, status: "completed" });
    if (!booking) {
      return res.status(404).json({ error: "Completed booking not found" });
    }

    // One review per booking (unique index handles duplicates too)
    const existing = await Review.findOne({ bookingId });
    if (existing) {
      return res.status(409).json({ error: "You already reviewed this class" });
    }

    const review = await Review.create({
      bookingId,
      studentId,
      teacherId: booking.teacherId,
      rating,
      comment: comment?.trim() ?? "",
    });

    res.status(201).json(review);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "You already reviewed this class" });
    }
    console.error("Review create error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reviews/my  —  student's own reviews (which bookings are reviewed) ──
router.get("/my", verifyToken, verifyStudent, async (req, res) => {
  try {
    const reviews = await Review.find({ studentId: req.user._id })
      .sort({ createdAt: -1 })
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName");
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reviews/teacher/:teacherId  —  teacher sees their own reviews ───
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    // Teacher can only see their own; admin can see any
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user._id.toString() === req.params.teacherId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const reviews = await Review.find({ teacherId: req.params.teacherId, flagged: false })
      .sort({ createdAt: -1 })
      .populate("studentId", "firstName surname")
      .populate("bookingId", "classTitle scheduledTime");

    // Compute aggregate stats
    const total  = reviews.length;
    const avgRating = total
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : null;
    const dist = [0, 0, 0, 0, 0]; // index 0 = 1-star … index 4 = 5-star
    reviews.forEach(r => dist[r.rating - 1]++);

    res.json({ reviews, stats: { total, avgRating, dist } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reviews  —  admin: all reviews with optional filters ─────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.teacherId) filter.teacherId = req.query.teacherId;
    if (req.query.flagged === "true") filter.flagged = true;
    if (req.query.rating)   filter.rating = Number(req.query.rating);

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .populate("studentId", "firstName surname")
      .populate("teacherId", "firstName lastName")
      .populate("bookingId", "classTitle scheduledTime");

    // Per-teacher summary
    const teacherMap = {};
    for (const r of reviews) {
      const tid = r.teacherId?._id?.toString();
      if (!tid) continue;
      if (!teacherMap[tid]) {
        teacherMap[tid] = {
          _id: tid,
          name: `${r.teacherId.firstName} ${r.teacherId.lastName}`,
          total: 0, sum: 0, flagged: 0,
        };
      }
      teacherMap[tid].total++;
      teacherMap[tid].sum += r.rating;
      if (r.flagged) teacherMap[tid].flagged++;
    }
    const teacherStats = Object.values(teacherMap).map(t => ({
      ...t,
      avgRating: t.total ? Math.round((t.sum / t.total) * 10) / 10 : null,
    }));

    res.json({ reviews, teacherStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reviews/:id/flag  —  admin flags/unflags a review ─────────────
router.patch("/:id/flag", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { flagged, flagReason = "" } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { flagged: Boolean(flagged), flagReason },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/reviews/:id  —  admin removes a review ───────────────────────
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
