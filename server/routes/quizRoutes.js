import express       from "express";
import multer         from "multer";
import { PDFParse }   from "pdf-parse";
import Anthropic      from "@anthropic-ai/sdk";
import { verifyToken } from "../middleware/authMiddleware.js";
import Quiz            from "../models/Quiz.js";
import QuizAttempt     from "../models/QuizAttempt.js";
import Student         from "../models/Student.js";
import Teacher         from "../models/Teacher.js";
import {
  sendQuizAssigned,
  sendQuizCompleted,
} from "../utils/emailService.js";
import { callGemini, extractJSONArray } from "../utils/geminiHelper.js";

// Multer — memory storage (no disk writes, PDF buffer passed straight to pdf-parse)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
// Strip correctIndex from questions before sending to student
function sanitiseForStudent(quiz) {
  const obj = quiz.toObject ? quiz.toObject() : { ...quiz };
  obj.questions = (obj.questions || []).map(({ correctIndex, explanation, ...rest }) => rest);
  return obj;
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 50) {
    return "Quiz must have 1–50 questions";
  }
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question?.trim()) return `Question ${i + 1}: question text is required`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      return `Question ${i + 1}: must have 2–4 options`;
    }
    for (const opt of q.options) {
      if (!opt?.text?.trim()) return `Question ${i + 1}: all options must have text`;
    }
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return `Question ${i + 1}: correctIndex must point to a valid option`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz  — teacher creates a quiz
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const { studentId, title, instructions, timeLimit, dueDate, questions } = req.body;

    if (!studentId || !title?.trim() || !timeLimit || !dueDate) {
      return res.status(400).json({ message: "studentId, title, timeLimit, and dueDate are required" });
    }

    const qError = validateQuestions(questions);
    if (qError) return res.status(400).json({ message: qError });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const timeLimitNum = parseInt(timeLimit, 10);
    if (isNaN(timeLimitNum) || timeLimitNum < 1 || timeLimitNum > 300) {
      return res.status(400).json({ message: "Time limit must be 1–300 minutes" });
    }

    const quiz = await Quiz.create({
      teacherId:    req.user.id,
      studentId,
      title:        title.trim().slice(0, 200),
      instructions: (instructions || "").trim().slice(0, 2000),
      timeLimit:    timeLimitNum,
      dueDate:      new Date(dueDate),
      questions:    questions.map(q => ({
        question:     q.question.trim().slice(0, 1000),
        options:      q.options.map(o => ({ text: o.text.trim().slice(0, 500) })),
        correctIndex: q.correctIndex,
        explanation:  (q.explanation || "").trim().slice(0, 500),
      })),
    });

    // Email student about new quiz (non-blocking)
    Student.findById(studentId).then(studentDoc => {
      if (studentDoc) {
        Teacher.findById(req.user.id).then(teacherDoc => {
          if (teacherDoc) sendQuizAssigned(studentDoc, teacherDoc, quiz).catch(() => {});
        }).catch(() => {});
      }
    }).catch(() => {});

    res.status(201).json({ success: true, quiz });
  } catch (err) {
    console.error("Create quiz error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/my  — teacher: list all their quizzes + attempt summary
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const quizzes = await Quiz.find({ teacherId: req.user.id })
      .populate("studentId", "firstName surname email")
      .sort({ createdAt: -1 });

    // Attach attempt data to each quiz
    const quizIds    = quizzes.map(q => q._id);
    const attempts   = await QuizAttempt.find({ quizId: { $in: quizIds } });
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.quizId.toString()] = a; });

    const result = quizzes.map(q => ({
      ...q.toObject(),
      attempt: attemptMap[q._id.toString()] || null,
    }));

    res.json({ success: true, quizzes: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/assigned  — student: list their quizzes (no correctIndex)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });

    const quizzes = await Quiz.find({ studentId: req.user.id })
      .populate("teacherId", "firstName lastName")
      .sort({ dueDate: 1 });

    // Attach attempt if it exists (so student can see their score)
    const quizIds  = quizzes.map(q => q._id);
    const attempts = await QuizAttempt.find({ studentId: req.user.id, quizId: { $in: quizIds } });
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.quizId.toString()] = a; });

    const result = quizzes.map(q => {
      const safe    = sanitiseForStudent(q);
      const attempt = attemptMap[q._id.toString()] || null;

      // If attempted, reveal correctIndex for review
      if (attempt) {
        safe.questions = q.toObject().questions.map(({ correctIndex, explanation, ...rest }) => ({
          ...rest, correctIndex, explanation,
        }));
      }

      safe.attempt = attempt;
      return safe;
    });

    res.json({ success: true, quizzes: result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/:id/attempt  — student submits answers
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/attempt", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Students only" });

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.studentId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
    if (quiz.status === "attempted") return res.status(400).json({ message: "You have already attempted this quiz" });

    const { answers, startedAt, timeTaken } = req.body;

    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return res.status(400).json({ message: "answers array length must match question count" });
    }

    // Score calculation (server-side only)
    let score = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      if (parseInt(answers[i], 10) === quiz.questions[i].correctIndex) score++;
    }

    const totalQuestions = quiz.questions.length;
    const percentage     = Math.round((score / totalQuestions) * 100);

    const attempt = await QuizAttempt.create({
      quizId:         quiz._id,
      studentId:      req.user.id,
      teacherId:      quiz.teacherId,
      answers:        answers.map(a => parseInt(a, 10)),
      score,
      totalQuestions,
      percentage,
      startedAt:      startedAt ? new Date(startedAt) : undefined,
      submittedAt:    new Date(),
      timeTaken:      typeof timeTaken === "number" ? timeTaken : undefined,
    });

    // Mark quiz as attempted
    quiz.status = "attempted";
    await quiz.save();

    // Email teacher about completion (non-blocking)
    Promise.all([
      Teacher.findById(quiz.teacherId),
      Student.findById(req.user.id),
    ]).then(([teacherDoc, studentDoc]) => {
      if (teacherDoc && studentDoc) sendQuizCompleted(teacherDoc, studentDoc, quiz, attempt).catch(() => {});
    }).catch(() => {});

    // Return full quiz (with correct answers revealed) + attempt
    const fullQuiz = quiz.toObject();
    res.json({ success: true, attempt, quiz: fullQuiz });
  } catch (err) {
    console.error("Submit attempt error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/quiz/:id  — teacher deletes a quiz (only if not yet attempted)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (quiz.teacherId.toString() !== req.user.id) return res.status(403).json({ message: "Access denied" });
    if (quiz.status === "attempted") return res.status(400).json({ message: "Cannot delete a quiz that has been attempted" });

    await quiz.deleteOne();
    res.json({ success: true, message: "Quiz deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/generate  — teacher generates MCQ questions via Gemini AI
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

    const { topic, count = 10, difficulty = "intermediate" } = req.body;

    if (!topic?.trim()) return res.status(400).json({ message: "Topic is required" });

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ message: "AI generation is not configured on this server" });
    }

    const safeCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 20);
    const safeDiff  = ["beginner", "intermediate", "advanced"].includes(difficulty) ? difficulty : "intermediate";

    const prompt = `You are an English language teacher creating a quiz. Generate exactly ${safeCount} multiple-choice questions for a ${safeDiff}-level English student on this topic: "${topic.trim()}".

Rules:
- Questions must be clear, unambiguous, and directly test the topic
- Each question has exactly 4 answer options
- Exactly one option is correct (indicated by correctIndex, zero-based)
- Explanations must be short, educational, and explain WHY the answer is correct
- Language complexity must match the ${safeDiff} level
- Do NOT include numbering, markdown, or any text outside the JSON

Return ONLY a valid JSON array in this exact format:
[
  {
    "question": "Which sentence uses the past simple correctly?",
    "options": [
      {"text": "She go to school yesterday."},
      {"text": "She went to school yesterday."},
      {"text": "She goes to school yesterday."},
      {"text": "She going to school yesterday."}
    ],
    "correctIndex": 1,
    "explanation": "'Went' is the past simple form of 'go', used for completed actions in the past."
  }
]`;

    const raw       = await callGemini(prompt, { temperature: 0.7, maxOutputTokens: 8192 });
    const questions = extractJSONArray(raw);

    if (questions.length === 0) {
      throw new Error("AI returned no questions — please try again");
    }

    // Validate and sanitise each question
    const valid = questions
      .filter(q =>
        typeof q.question === "string" && q.question.trim() &&
        Array.isArray(q.options) && q.options.length >= 2 &&
        typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < q.options.length
      )
      .map(q => ({
        question:     q.question.trim().slice(0, 1000),
        options:      q.options.slice(0, 4).map(o => ({ text: (o.text || "").trim().slice(0, 500) })),
        correctIndex: q.correctIndex,
        explanation:  (q.explanation || "").trim().slice(0, 500),
      }));

    if (valid.length === 0) throw new Error("AI questions failed validation — please try again");

    res.json({ success: true, questions: valid, generated: valid.length });

  } catch (err) {
    console.error("Quiz generate error:", err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/generate-from-notes  — Claude Sonnet reads lesson notes / PDF
//   Accepts:  multipart/form-data  { notes?: string, count?: number, file?: PDF }
//          OR application/json     { notes: string, count?: number }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/generate-from-notes",
  verifyToken,
  upload.single("file"),          // optional PDF upload field named "file"
  async (req, res) => {
    try {
      if (req.user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(503).json({ message: "Claude AI is not configured on this server" });
      }

      // ── Extract notes text ────────────────────────────────────────────────
      let notesText = (req.body.notes || "").trim();

      // If a PDF was uploaded, parse it and append its text
      if (req.file) {
        try {
          const parser  = new PDFParse({ data: req.file.buffer, verbosity: 0 });
          const parsed  = await parser.getText();
          const pdfText = parsed.text?.trim();
          await parser.destroy();
          if (pdfText) notesText = notesText ? `${notesText}\n\n${pdfText}` : pdfText;
        } catch (pdfErr) {
          return res.status(400).json({ message: "Could not read PDF — try copying and pasting the text instead" });
        }
      }

      if (!notesText || notesText.length < 50) {
        return res.status(400).json({ message: "Please provide lesson notes (at least 50 characters) or upload a PDF" });
      }

      const safeCount = Math.min(Math.max(parseInt(req.body.count, 10) || 10, 1), 20);

      // Truncate very long notes to avoid excessive token use (~6000 words max)
      const truncated = notesText.slice(0, 24000);

      // ── Call Claude Sonnet ────────────────────────────────────────────────
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const prompt = `You are an expert English language teacher. A teacher has provided their lesson notes below. Your job is to create exactly ${safeCount} high-quality multiple-choice quiz questions that test what was specifically taught in these notes.

Rules:
- Questions must be based ONLY on content in the notes — do not add outside knowledge
- Each question must have exactly 4 answer options
- Exactly one option is correct (correctIndex is zero-based)
- Wrong options (distractors) should be plausible but clearly wrong to a student who studied the notes
- Explanations must reference the lesson content and explain WHY the answer is correct
- Questions should range from recall to application — not all should be simple definitions
- Do NOT include numbering, markdown, or any text outside the JSON array

Lesson Notes:
---
${truncated}
---

Return ONLY a valid JSON array:
[
  {
    "question": "Question text here",
    "options": [
      {"text": "Option A"},
      {"text": "Option B"},
      {"text": "Option C"},
      {"text": "Option D"}
    ],
    "correctIndex": 1,
    "explanation": "Explanation referencing the lesson content."
  }
]`;

      const response = await client.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 4096,
        messages:   [{ role: "user", content: prompt }],
      });

      const raw = response.content[0]?.text;
      if (!raw) throw new Error("Claude returned an empty response");

      // ── Parse and validate ────────────────────────────────────────────────
      let questions = [];
      try {
        const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const start   = cleaned.indexOf("[");
        const end     = cleaned.lastIndexOf("]");
        if (start !== -1 && end !== -1) questions = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        throw new Error("AI returned invalid JSON — please try again");
      }

      const valid = (Array.isArray(questions) ? questions : [])
        .filter(q =>
          typeof q.question === "string" && q.question.trim() &&
          Array.isArray(q.options) && q.options.length >= 2 &&
          typeof q.correctIndex === "number" &&
          q.correctIndex >= 0 && q.correctIndex < q.options.length
        )
        .map(q => ({
          question:     q.question.trim().slice(0, 1000),
          options:      q.options.slice(0, 4).map(o => ({ text: (o.text || "").trim().slice(0, 500) })),
          correctIndex: q.correctIndex,
          explanation:  (q.explanation || "").trim().slice(0, 500),
        }));

      if (valid.length === 0) throw new Error("AI questions failed validation — please try again");

      res.json({ success: true, questions: valid, generated: valid.length });

    } catch (err) {
      console.error("Generate-from-notes error:", err.message);
      // Multer file type error
      if (err.message === "Only PDF files are allowed") {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/ai-models  — lists Gemini models available for your API key
// Remove this route once you've confirmed which models work
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ai-models", verifyToken, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ message: "GEMINI_API_KEY not set" });
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    const models = (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => ({ name: m.name, displayName: m.displayName }));

    res.json({ success: true, models });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

