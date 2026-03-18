// server/routes/vocabRoutes.js
import express from "express";
import VocabList     from "../models/VocabList.js";
import VocabProgress from "../models/VocabProgress.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── SM-2 algorithm ────────────────────────────────────────────────────────────
// quality: 0=forgot, 1=hard, 2=good, 3=easy
function sm2(quality, repetitions, interval, easeFactor) {
  if (quality < 2) {
    return { repetitions: 0, interval: 1, easeFactor };
  }
  let newInterval;
  if (repetitions === 0)      newInterval = 1;
  else if (repetitions === 1) newInterval = 6;
  else                        newInterval = Math.round(interval * easeFactor);

  const newEase = Math.max(
    1.3,
    easeFactor + 0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)
  );
  return { repetitions: repetitions + 1, interval: newInterval, easeFactor: newEase };
}

// ── TEACHER ROUTES ────────────────────────────────────────────────────────────

// GET /api/vocab/lists  —  teacher: my lists; student: assigned lists
router.get("/lists", verifyToken, async (req, res) => {
  try {
    const { id: userId, role } = req.user;

    if (role === "teacher") {
      const lists = await VocabList.find({ teacherId: userId })
        .populate("assignedTo.studentId", "firstName surname email")
        .sort({ createdAt: -1 });
      return res.json({ success: true, lists });
    }

    if (role === "student") {
      const lists = await VocabList.find({ "assignedTo.studentId": userId })
        .select("title description words teacherId assignedTo")
        .populate("teacherId", "firstName lastName")
        .sort({ createdAt: -1 });

      // For each list, attach progress summary
      const withProgress = await Promise.all(lists.map(async (list) => {
        const prog = await VocabProgress.find({ studentId: userId, listId: list._id });
        const dueNow = prog.filter(p => new Date(p.nextReviewDate) <= new Date()).length;
        const mastered = prog.filter(p => p.repetitions >= 3).length;
        return { ...list.toObject(), _dueCount: dueNow, _masteredCount: mastered, _totalProgress: prog.length };
      }));

      return res.json({ success: true, lists: withProgress });
    }

    res.status(403).json({ success: false, message: "Access denied" });
  } catch (err) {
    console.error("GET /vocab/lists:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/vocab/lists  —  teacher creates a list
router.post("/lists", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const { title, description, words } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Title is required" });
    if (!Array.isArray(words) || words.length === 0)
      return res.status(400).json({ success: false, message: "At least one word is required" });

    const list = await VocabList.create({ title: title.trim(), description: description?.trim() || "", teacherId, words });
    res.status(201).json({ success: true, list });
  } catch (err) {
    console.error("POST /vocab/lists:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/vocab/lists/:id  —  teacher updates list
router.put("/lists/:id", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const list = await VocabList.findOne({ _id: req.params.id, teacherId });
    if (!list) return res.status(404).json({ success: false, message: "List not found" });

    const { title, description, words } = req.body;
    if (title)       list.title       = title.trim();
    if (description !== undefined) list.description = description.trim();
    if (words)       list.words       = words;

    await list.save();
    res.json({ success: true, list });
  } catch (err) {
    console.error("PUT /vocab/lists/:id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/vocab/lists/:id  —  teacher deletes list
router.delete("/lists/:id", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const list = await VocabList.findOneAndDelete({ _id: req.params.id, teacherId });
    if (!list) return res.status(404).json({ success: false, message: "List not found" });

    // Clean up progress records
    await VocabProgress.deleteMany({ listId: req.params.id });
    res.json({ success: true, message: "List deleted" });
  } catch (err) {
    console.error("DELETE /vocab/lists/:id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/vocab/lists/:id/assign  —  teacher assigns list to students
router.post("/lists/:id/assign", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const list = await VocabList.findOne({ _id: req.params.id, teacherId });
    if (!list) return res.status(404).json({ success: false, message: "List not found" });

    const { studentIds, dueDate } = req.body; // studentIds: string[]
    if (!Array.isArray(studentIds) || studentIds.length === 0)
      return res.status(400).json({ success: false, message: "Provide at least one studentId" });

    for (const sid of studentIds) {
      const already = list.assignedTo.some(a => a.studentId.toString() === sid);
      if (!already) {
        list.assignedTo.push({ studentId: sid, dueDate: dueDate ? new Date(dueDate) : undefined });
      }
    }
    await list.save();

    const updated = await VocabList.findById(list._id)
      .populate("assignedTo.studentId", "firstName surname email");
    res.json({ success: true, list: updated });
  } catch (err) {
    console.error("POST /vocab/lists/:id/assign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/vocab/lists/:id/assign/:studentId  —  unassign a student
router.delete("/lists/:id/assign/:studentId", verifyToken, async (req, res) => {
  try {
    const { role, id: teacherId } = req.user;
    if (role !== "teacher") return res.status(403).json({ success: false, message: "Teachers only" });

    const list = await VocabList.findOne({ _id: req.params.id, teacherId });
    if (!list) return res.status(404).json({ success: false, message: "List not found" });

    list.assignedTo = list.assignedTo.filter(a => a.studentId.toString() !== req.params.studentId);
    await list.save();
    res.json({ success: true, message: "Student unassigned" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── STUDENT ROUTES ────────────────────────────────────────────────────────────

// GET /api/vocab/due  —  get all cards due today for the student
router.get("/due", verifyToken, async (req, res) => {
  try {
    const { id: studentId, role } = req.user;
    if (role !== "student") return res.status(403).json({ success: false, message: "Students only" });

    // Get all lists assigned to this student
    const lists = await VocabList.find({ "assignedTo.studentId": studentId });
    if (lists.length === 0) return res.json({ success: true, cards: [] });

    const now = new Date();
    const cards = [];

    for (const list of lists) {
      for (const word of list.words) {
        // Find existing progress or treat as new (due now)
        const prog = await VocabProgress.findOne({ studentId, listId: list._id, wordId: word._id });
        const isDue = !prog || new Date(prog.nextReviewDate) <= now;
        if (isDue) {
          cards.push({
            listId:     list._id,
            listTitle:  list.title,
            wordId:     word._id,
            word:       word.word,
            definition: word.definition,
            example:    word.example,
            // progress info for display
            repetitions: prog?.repetitions || 0,
            interval:    prog?.interval    || 1,
          });
        }
      }
    }

    res.json({ success: true, cards });
  } catch (err) {
    console.error("GET /vocab/due:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/vocab/review  —  student submits a review result
router.post("/review", verifyToken, async (req, res) => {
  try {
    const { id: studentId, role } = req.user;
    if (role !== "student") return res.status(403).json({ success: false, message: "Students only" });

    const { listId, wordId, quality } = req.body; // quality: 0-3
    if (quality === undefined || quality < 0 || quality > 3)
      return res.status(400).json({ success: false, message: "quality must be 0-3" });

    // Get or create progress record
    let prog = await VocabProgress.findOne({ studentId, listId, wordId });
    if (!prog) {
      prog = new VocabProgress({ studentId, listId, wordId });
    }

    // Apply SM-2
    const result = sm2(quality, prog.repetitions, prog.interval, prog.easeFactor);
    prog.repetitions    = result.repetitions;
    prog.interval       = result.interval;
    prog.easeFactor     = result.easeFactor;
    prog.lastReviewedAt = new Date();
    prog.nextReviewDate = new Date(Date.now() + result.interval * 24 * 60 * 60 * 1000);

    await prog.save();
    res.json({ success: true, nextReviewDate: prog.nextReviewDate, interval: prog.interval });
  } catch (err) {
    console.error("POST /vocab/review:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/vocab/stats  —  per-list progress stats for the student
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const { id: studentId, role } = req.user;
    if (role !== "student") return res.status(403).json({ success: false, message: "Students only" });

    const lists = await VocabList.find({ "assignedTo.studentId": studentId })
      .select("title words");
    const now = new Date();

    const stats = await Promise.all(lists.map(async (list) => {
      const prog = await VocabProgress.find({ studentId, listId: list._id });
      return {
        listId:    list._id,
        title:     list.title,
        total:     list.words.length,
        seen:      prog.length,
        mastered:  prog.filter(p => p.repetitions >= 3).length,
        due:       prog.filter(p => new Date(p.nextReviewDate) <= now).length,
        newCards:  list.words.length - prog.length,
      };
    }));

    res.json({ success: true, stats });
  } catch (err) {
    console.error("GET /vocab/stats:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
