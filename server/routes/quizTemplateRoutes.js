import express        from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware }    from "../middleware/tenantMiddleware.js";
import { quizTemplateSchema }  from "../schemas/quizTemplateSchema.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getQuizTemplate = (db) => db.models.QuizTemplate || db.model("QuizTemplate", quizTemplateSchema);

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50)
    return "Template must have 1–50 questions";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question?.trim()) return `Question ${i + 1}: question text required`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4)
      return `Question ${i + 1}: must have 2–4 options`;
    for (const o of q.options) if (!o?.text?.trim()) return `Question ${i + 1}: all options need text`;
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length)
      return `Question ${i + 1}: correctIndex out of range`;
  }
  return null;
}

// POST /api/quiz-templates  — save a new template
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const { name, instructions, timeLimit, questions } = req.body;
    if (!name?.trim()) return badRequest(res, "Template name is required");

    const err = validateQuestions(questions);
    if (err) return res.status(400).json({ message: err });

    const tmpl = await getQuizTemplate(req.db).create({
      teacherId:    req.user.id,
      name:         name.trim().slice(0, 200),
      instructions: (instructions || "").trim().slice(0, 2000),
      timeLimit:    Math.min(Math.max(parseInt(timeLimit, 10) || 15, 1), 300),
      questions:    questions.map(q => ({
        question:     q.question.trim().slice(0, 1000),
        options:      q.options.map(o => ({ text: o.text.trim().slice(0, 500) })),
        correctIndex: q.correctIndex,
        explanation:  (q.explanation || "").trim().slice(0, 500),
      })),
    });

    res.status(201).json({ success: true, template: tmpl });
  } catch (err) {
    serverError(res, err.message);
  }
});

// GET /api/quiz-templates  — list teacher's templates
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const templates = await getQuizTemplate(req.db).find({ teacherId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, templates });
  } catch (err) {
    serverError(res, err.message);
  }
});

// PATCH /api/quiz-templates/:id/use  — increment usage count
router.patch("/:id/use", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const tmpl = await getQuizTemplate(req.db).findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user.id },
      { $inc: { usageCount: 1 } },
      { new: true }
    );
    if (!tmpl) return notFound(res, "Template not found");
    res.json({ success: true, template: tmpl });
  } catch (err) {
    serverError(res, err.message);
  }
});

// DELETE /api/quiz-templates/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");
    const tmpl = await getQuizTemplate(req.db).findOne({ _id: req.params.id, teacherId: req.user.id });
    if (!tmpl) return notFound(res, "Template not found");
    await tmpl.deleteOne();
    res.json({ success: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;
