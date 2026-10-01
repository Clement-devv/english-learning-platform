// server/routes/lessonRoutes.js
import express from "express";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { parsePagination } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { badRequest, serverError } from '../utils/apiResponse.js';
import mongoose from "mongoose";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);

// Get all completed lessons — sourced from completed bookings
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query, 500, 2000);
    // ?studentId= one student's lessons (admin Students → lesson history)
    const filter = { status: "completed" };
    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) return badRequest(res, "Invalid student");
      filter.studentId = req.query.studentId;
    }

    const bookings = await getBooking(req.db)
      .find(filter)
      .populate("studentId", "firstName lastName email")
      .populate("teacherId", "firstName lastName")
      .sort({ completedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const lessons = bookings
      .filter((b) => b.studentId)
      .map((b) => ({
        _id: b._id,
        studentId: b.studentId,
        teacher: b.teacherId
          ? `${b.teacherId.firstName} ${b.teacherId.lastName}`
          : "Unknown",
        date: b.completedAt || b.scheduledTime,
        classTitle: b.classTitle,
      }));

    res.json(lessons);
  } catch (err) {
    logger.error(err);
    serverError(res, "Error fetching lessons");
  }
});

export default router;
