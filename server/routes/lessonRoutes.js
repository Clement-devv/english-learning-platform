// server/routes/lessonRoutes.js
import express from "express";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { lessonSchema } from "../schemas/lessonSchema.js";
import { parsePagination } from "../utils/pagination.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getLesson = (db) => db.models.Lesson || db.model("Lesson", lessonSchema);

// Get ALL lessons — admin and teachers only
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query);
    const lessons = await getLesson(req.db)
      .find()
      .populate("studentId", "firstName surname email")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    res.json(lessons);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Error fetching lessons" });
  }
});

export default router;
