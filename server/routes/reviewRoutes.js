// server/routes/reviewRoutes.js

import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyStudent, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { reviewSchema }  from "../schemas/reviewSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getReview  = (db) => db.models.Review  || db.model("Review",  reviewSchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

// ── POST /api/reviews  —  student submits a review ───────────────────────────
router.post("/", verifyToken, verifyStudent, async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const studentId = req.user.id;

    if (!bookingId || !rating) {
      return res.status(400).json({ error: "bookingId and rating are required" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const booking = await getBooking(req.db).findOne({ _id: bookingId, studentId, status: "completed" });
    if (!booking) {
      return notFound(res, "Completed booking not found");
    }

    const existing = await getReview(req.db).findOne({ bookingId });
    if (existing) {
      return conflict(res, "You already reviewed this class");
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
      return conflict(res, "You already reviewed this class");
    }
    logger.error("Review create error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ── GET /api/reviews/my  —  student's own reviews (which bookings are reviewed) ──
router.get("/my", verifyToken, verifyStudent, async (req, res) => {
  try {
    const reviews = await getReview(req.db).find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("bookingId", "classTitle scheduledTime")
      .populate("teacherId", "firstName lastName");
    res.json(reviews);
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/reviews/my-trends  —  teacher sees their rating trend over time ──
// Weekly averages (last 12 weeks), top-rated individual classes, low-rated feedback.
router.get("/my-trends", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return forbidden(res, "Access denied");
    }
    const teacherId = req.user.id;

    const reviews = await getReview(req.db)
      .find({ teacherId, flagged: false })
      .sort({ createdAt: -1 })
      .populate("bookingId", "classTitle scheduledTime")
      .populate("studentId", "firstName");

    // ISO week helper
    function isoWeekKey(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const day = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    }

    // Weekly averages
    const weekMap = {};
    reviews.forEach(r => {
      const key = isoWeekKey(new Date(r.createdAt));
      if (!weekMap[key]) weekMap[key] = { week: key, sum: 0, count: 0 };
      weekMap[key].sum   += r.rating;
      weekMap[key].count += 1;
    });
    const weeklyTrend = Object.values(weekMap)
      .map(w => ({
        week:        w.week,
        avgRating:   Math.round((w.sum / w.count) * 10) / 10,
        reviewCount: w.count,
      }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12);

    // Best-rated classes: top 5 individual reviews that have a booking title
    const bestClasses = [...reviews]
      .filter(r => r.bookingId?.classTitle)
      .sort((a, b) => b.rating - a.rating || new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(r => ({
        classTitle:    r.bookingId.classTitle,
        scheduledTime: r.bookingId.scheduledTime,
        rating:        r.rating,
        comment:       r.comment || "",
        studentName:   r.studentId?.firstName ?? "Student",
      }));

    // Low-rated feedback: reviews ≤2 stars that have a comment
    const lowRated = reviews
      .filter(r => r.rating <= 2 && r.comment)
      .slice(0, 10)
      .map(r => ({
        rating:     r.rating,
        comment:    r.comment,
        classTitle: r.bookingId?.classTitle ?? "Class",
        date:       r.createdAt,
      }));

    res.json({
      success: true,
      data: {
        totalReviews: reviews.length,
        weeklyTrend,
        bestClasses,
        lowRated,
      },
    });
  } catch (err) {
    logger.error("Error fetching teacher rating trends:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ── GET /api/reviews/teacher/:teacherId  —  teacher sees their own reviews ───
router.get("/teacher/:teacherId", verifyToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";
    const isOwner = req.user.id.toString() === req.params.teacherId;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!mongoose.isValidObjectId(req.params.teacherId)) return badRequest(res, "Invalid teacher");
    const Review = getReview(req.db);
    const base = { teacherId: new mongoose.Types.ObjectId(String(req.params.teacherId)), flagged: false };

    // Stats always cover ALL of the teacher's (unflagged) reviews
    const distRows = await Review.aggregate([{ $match: base }, { $group: { _id: "$rating", n: { $sum: 1 } } }]);
    const dist = [0, 0, 0, 0, 0];
    let total = 0, sum = 0;
    distRows.forEach(r => { if (r._id >= 1 && r._id <= 5) { dist[r._id - 1] = r.n; total += r.n; sum += r._id * r.n; } });
    const avgRating = total ? Math.round((sum / total) * 10) / 10 : null;

    // ?rating=1..5 filter, ?page=&limit= one page (no ?page → newest 500, as before but bounded)
    const filter = { ...base };
    const rating = parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) filter.rating = rating;
    const paged = req.query.page !== undefined;
    const limit = paged ? Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50) : 500;
    const matching = rating >= 1 && rating <= 5 ? dist[rating - 1] : total;
    const totalPages = Math.max(1, Math.ceil(matching / limit));
    const page = paged ? Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), totalPages) : 1;

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("studentId", "firstName lastName")
      .populate("bookingId", "classTitle scheduledTime");

    res.json({ reviews, stats: { total, avgRating, dist }, pagination: { page, limit, total: matching, totalPages } });
  } catch (err) {
    serverError(res, err.message);
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
    serverError(res, err.message);
  }
});

// ── GET /api/reviews  —  admin: all reviews with optional filters ─────────────
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Review = getReview(req.db);
    const filter = {};
    if (req.query.teacherId) {
      if (!mongoose.isValidObjectId(req.query.teacherId)) return badRequest(res, "Invalid teacher");
      filter.teacherId = new mongoose.Types.ObjectId(String(req.query.teacherId));
    }
    if (req.query.flagged === "true") filter.flagged = true;
    const rating = parseInt(req.query.rating, 10);
    if (rating >= 1 && rating <= 5) filter.rating = rating;

    // Per-teacher stats and overall totals always cover ALL reviews
    const [teacherRows, totalsRow] = await Promise.all([
      Review.aggregate([
        { $group: { _id: "$teacherId", total: { $sum: 1 }, sum: { $sum: "$rating" }, flagged: { $sum: { $cond: ["$flagged", 1, 0] } } } },
        { $lookup: { from: getTeacher(req.db).collection.name, localField: "_id", foreignField: "_id", as: "t",
                     pipeline: [{ $project: { firstName: 1, lastName: 1 } }] } },
        { $match: { "t.0": { $exists: true } } },
        { $sort: { total: -1 } },
      ]),
      Review.aggregate([{ $group: { _id: null, total: { $sum: 1 }, flagged: { $sum: { $cond: ["$flagged", 1, 0] } }, avg: { $avg: "$rating" } } }]),
    ]);
    const teacherStats = teacherRows.map(t => ({
      _id: String(t._id),
      name: `${t.t[0].firstName} ${t.t[0].lastName}`,
      total: t.total, sum: t.sum, flagged: t.flagged,
      avgRating: t.total ? Math.round((t.sum / t.total) * 10) / 10 : null,
    }));
    const tr = totalsRow[0] || { total: 0, flagged: 0, avg: null };
    const totals = { total: tr.total, flagged: tr.flagged, avgRating: tr.avg == null ? null : Math.round(tr.avg * 10) / 10 };

    // ?page= & ?sort=newest|oldest|highest|lowest|flagged — one page of reviews
    const SORTS = {
      newest:  { createdAt: -1, _id: -1 },
      oldest:  { createdAt: 1, _id: 1 },
      highest: { rating: -1, createdAt: -1 },
      lowest:  { rating: 1, createdAt: -1 },
      flagged: { flagged: -1, createdAt: -1 },
    };
    const sort = SORTS[req.query.sort] || SORTS.newest;
    const paged = req.query.page !== undefined;
    const limit = paged ? Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50) : 500;
    const total = await Review.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = paged ? Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), totalPages) : 1;

    const reviews = await Review.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("studentId", "firstName lastName")
      .populate("teacherId", "firstName lastName")
      .populate("bookingId", "classTitle scheduledTime");

    res.json({ reviews, teacherStats, totals, pagination: { page, limit, total, totalPages } });
  } catch (err) {
    serverError(res, err.message);
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
    if (!review) return notFound(res, "Review not found");
    res.json(review);
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── DELETE /api/reviews/:id  —  admin removes a review ───────────────────────
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const review = await getReview(req.db).findByIdAndDelete(req.params.id);
    if (!review) return notFound(res, "Review not found");
    res.json({ ok: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
