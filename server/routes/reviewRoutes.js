// server/routes/reviewRoutes.js

import express from "express";
import { verifyToken, verifyStudent, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { reviewSchema }  from "../schemas/reviewSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getReview  = (db) => db.models.Review  || db.model("Review",  reviewSchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);

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

    const booking = await getBooking(req.db).findOne({ _id: bookingId, studentId, status: "completed" });
    if (!booking) {
      return res.status(404).json({ error: "Completed booking not found" });
    }

    const existing = await getReview(req.db).findOne({ bookingId });
    if (existing) {
      return res.status(409).json({ error: "You already reviewed this class" });
    }

    const review = await getReview(req.db).create({
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
    const reviews = await getReview(req.db).find({ studentId: req.user._id })
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
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user._id.toString() === req.params.teacherId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const reviews = await getReview(req.db).find({ teacherId: req.params.teacherId, flagged: false })
      .sort({ createdAt: -1 })
      .populate("studentId", "firstName surname")
      .populate("bookingId", "classTitle scheduledTime");

    const total  = reviews.length;
    const avgRating = total
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
      : null;
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach(r => dist[r.rating - 1]++);

    res.json({ reviews, stats: { total, avgRating, dist } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reviews/stats  —  lightweight per-teacher rating summary ────────
// Returns Bayesian-corrected scores alongside simple averages.
// Strategy: Bayesian average (used by IMDb/Amazon) prevents a teacher with
// 1 five-star from ranking above one with 50 four-stars.
// Formula: bayes = (v*R + m*C) / (v+m)
//   v = teacher's review count, R = teacher's mean, m = min threshold, C = global mean
router.get("/stats", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const raw = await getReview(req.db).aggregate([
      { $match: { flagged: false } },
      { $group: { _id: "$teacherId", totalRatings: { $sum: 1 }, sumRating: { $sum: "$rating" } } },
    ]);
    if (!raw.length) return res.json([]);

    // Global mean across all reviews
    const totalSum   = raw.reduce((s, r) => s + r.sumRating, 0);
    const totalCount = raw.reduce((s, r) => s + r.totalRatings, 0);
    const C = totalCount ? totalSum / totalCount : 0;
    const m = 5; // minimum-votes prior weight

    const stats = raw.map((r) => {
      const avg   = Math.round((r.sumRating / r.totalRatings) * 10) / 10;
      const bayes = Math.round(((r.totalRatings * avg + m * C) / (r.totalRatings + m)) * 10) / 10;
      return { teacherId: r._id, totalRatings: r.totalRatings, avgRating: avg, bayesianScore: bayes };
    });

    res.json(stats);
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

    const reviews = await getReview(req.db).find(filter)
      .sort({ createdAt: -1 })
      .populate("studentId", "firstName surname")
      .populate("teacherId", "firstName lastName")
      .populate("bookingId", "classTitle scheduledTime");

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
    const review = await getReview(req.db).findByIdAndUpdate(
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
    const review = await getReview(req.db).findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
