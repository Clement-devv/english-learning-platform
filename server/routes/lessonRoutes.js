import express from "express";
import Lesson from "../models/Lesson.js";

const router = express.Router();

// Get ALL lessons across all students
router.get("/", async (req, res) => {
  try {
    const lessons = await Lesson.find()
      .populate("studentId", "firstName surname email")
      .sort({ date: -1 });
    res.json(lessons);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching lessons" });
  }
});

export default router;