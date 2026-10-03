import express       from "express";
import multer         from "multer";
import { PDFParse }   from "pdf-parse";
import Anthropic      from "@anthropic-ai/sdk";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware }  from "../middleware/tenantMiddleware.js";
import { quizSchema }        from "../schemas/quizSchema.js";
import { quizAttemptSchema } from "../schemas/quizAttemptSchema.js";
import { studentSchema }     from "../schemas/studentSchema.js";
import { teacherSchema }     from "../schemas/teacherSchema.js";
import {
  sendQuizAssigned,
  sendQuizCompleted,
} from "../utils/emailService.js";
import { callGemini, extractJSONArray } from "../utils/geminiHelper.js";
import { recordActivity } from "../utils/streakService.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';
import { validateObjectId, wrapUpload } from '../middleware/validateObjectId.js';
import { toStr, toObjectId, toInt, toArray } from '../utils/inputSanitizer.js';
import { pushToUser, pushToAllAdmins } from '../utils/webPushService.js';
import { loginLimiter } from '../middleware/rateLimiter.js';
import { readPaging, pageMeta, statusCounts, oid, todoFirstIds, inOrder } from "../utils/paging.js";
import {
  issueShareLink, withShareInfo, resolveShareLink, checkUnlock, linkExpiresAt,
  signLinkAccess, verifyLinkAccess, ACCESS_HEADER,
} from '../utils/shareLink.js';

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
router.use(tenantMiddleware);

const getQuiz        = (db) => db.models.Quiz        || db.model("Quiz",        quizSchema);
const getQuizAttempt = (db) => db.models.QuizAttempt || db.model("QuizAttempt", quizAttemptSchema);
const getStudent     = (db) => db.models.Student     || db.model("Student",     studentSchema);
const getTeacher     = (db) => db.models.Teacher     || db.model("Teacher",     teacherSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
// Strip correctIndex from questions before sending to student
const QUIZ_STATUSES = ["assigned", "attempted"];

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
    if (typeof q.question === "string" && q.question.length > 10_000)
      return `Question ${i + 1}: question text is too long`;
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 4) {
      return `Question ${i + 1}: must have 2–4 options`;
    }
    for (const opt of q.options) {
      if (!opt?.text?.trim()) return `Question ${i + 1}: all options must have text`;
      if (typeof opt.text === "string" && opt.text.length > 5_000)
        return `Question ${i + 1}: option text is too long`;
    }
    if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      return `Question ${i + 1}: correctIndex must point to a valid option`;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public share-link routes — /api/v1/quiz/link/:token/...  (managed students)
// No login: the unguessable token is the key; the name check issues a short-
// lived access token (X-Share-Access). See utils/shareLink.js.
//
// Timing is server-side: POST /start stamps linkStartedAt once, so reloading
// can't restart the clock. Questions are only sent after start, and correct
// answers only after submit. Never returns 401 (the app's auth interceptor
// would redirect to a login page).
// ─────────────────────────────────────────────────────────────────────────────
const QUIZ_LINK_UNAVAILABLE = "This quiz link is invalid or has been removed. Please ask the teacher for a new link.";
const SUBMIT_GRACE_MS = 30 * 1000;        // network/clock slack before an attempt counts as over time
const LINK_GRACE_MS   = 2 * 60 * 1000;    // an in-progress quiz can still be submitted just after the link expires

const quizEndsAt = (quiz) => quiz.linkStartedAt
  ? new Date(quiz.linkStartedAt.getTime() + quiz.timeLimit * 60 * 1000)
  : null;

async function findQuizByLink(req, res) {
  getStudent(req.db); getTeacher(req.db); // register models for populate
  const r = await resolveShareLink(getQuiz(req.db), req.params.token, req.center, {
    // A quiz already under way can still be finished right after the due date ends
    graceUntil: (q) => (q.linkStartedAt && q.status !== "attempted")
      ? new Date(quizEndsAt(q).getTime() + LINK_GRACE_MS) : null,
  });
  if (r.status === "invalid") { notFound(res, QUIZ_LINK_UNAVAILABLE); return null; }
  if (r.status === "expired") {
    res.status(410).json({ success: false, expired: true, message: "This quiz link has expired — the due date has passed." });
    return null;
  }
  return { quiz: r.doc, tokenHash: r.tokenHash, expiresAt: r.expiresAt };
}

async function requireQuizLinkAccess(req, res) {
  const found = await findQuizByLink(req, res);
  if (!found) return null;
  if (!verifyLinkAccess(req.center.slug, "quiz", req.get(ACCESS_HEADER), found.quiz._id, found.tokenHash)) {
    forbidden(res, "Please confirm your name to open this quiz.");
    return null;
  }
  return found;
}

// What the student sees. Questions only once started; answers only once submitted.
function quizLinkView(quiz, attempt, expiresAt, centerName) {
  const status = attempt ? "done" : quiz.linkStartedAt ? "in_progress" : "ready";
  const questions = quiz.questions.map(q => q.toObject ? q.toObject() : q);
  return {
    title:         quiz.title,
    instructions:  quiz.instructions,
    timeLimit:     quiz.timeLimit,
    dueDate:       quiz.dueDate,
    expiresAt,
    questionCount: questions.length,
    studentName:   quiz.studentId.firstName,
    teacherName:   quiz.teacherId.displayName?.trim() || quiz.teacherId.firstName,
    centerName:    centerName || "",
    status,
    startedAt:     quiz.linkStartedAt,
    endsAt:        quizEndsAt(quiz),
    serverNow:     new Date(),
    questions: status === "in_progress"
      ? questions.map(({ question, options }) => ({ question, options }))
      : status === "done"
        ? questions.map(({ question, options, correctIndex, explanation }) => ({ question, options, correctIndex, explanation }))
        : undefined,
    result: attempt ? {
      score: attempt.score, totalQuestions: attempt.totalQuestions, percentage: attempt.percentage,
      answers: attempt.answers, timeTaken: attempt.timeTaken, submittedAt: attempt.submittedAt, overTime: attempt.overTime,
    } : null,
  };
}

const findAttempt = (req, quiz) => getQuizAttempt(req.db).findOne({ quizId: quiz._id }).lean();

// POST /link/:token/unlock  { studentName, teacherName }
router.post("/link/:token/unlock", loginLimiter, async (req, res) => {
  try {
    const found = await findQuizByLink(req, res);
    if (!found) return;
    const { quiz, tokenHash, expiresAt } = found;

    const check = await checkUnlock(getQuiz(req.db), quiz,
      toStr(req.body.studentName, "studentName", { maxLen: 100 }),
      toStr(req.body.teacherName, "teacherName", { maxLen: 100 }));
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });

    res.json({
      success: true,
      accessToken: signLinkAccess(req.center.slug, "quiz", quiz._id, tokenHash, expiresAt),
      quiz: quizLinkView(quiz, await findAttempt(req, quiz), expiresAt, req.center?.centerName),
    });
  } catch (err) {
    if (err.statusCode === 400) return badRequest(res, err.message);
    logger.error("Quiz link unlock error:", { error: err?.message });
    serverError(res);
  }
});

// GET /link/:token  (X-Share-Access)
router.get("/link/:token", async (req, res) => {
  try {
    const found = await requireQuizLinkAccess(req, res);
    if (!found) return;
    res.json({ success: true, quiz: quizLinkView(found.quiz, await findAttempt(req, found.quiz), found.expiresAt, req.center?.centerName) });
  } catch (err) {
    logger.error("Quiz link view error:", { error: err?.message });
    serverError(res);
  }
});

// POST /link/:token/start  (X-Share-Access) — starts the clock (once)
router.post("/link/:token/start", async (req, res) => {
  try {
    const found = await requireQuizLinkAccess(req, res);
    if (!found) return;
    const { quiz } = found;
    if (quiz.status === "attempted") return badRequest(res, "This quiz has already been finished.");

    if (!quiz.linkStartedAt) {
      // Atomic: only the first start wins, so two tabs can't get two clocks
      await getQuiz(req.db).updateOne({ _id: quiz._id, linkStartedAt: null }, { $set: { linkStartedAt: new Date() } });
      quiz.linkStartedAt = (await getQuiz(req.db).findById(quiz._id).select("linkStartedAt").lean()).linkStartedAt;
    }
    res.json({ success: true, quiz: quizLinkView(quiz, null, found.expiresAt, req.center?.centerName) });
  } catch (err) {
    logger.error("Quiz link start error:", { error: err?.message });
    serverError(res);
  }
});

// POST /link/:token/submit  (X-Share-Access)  { answers: number[] }  (-1 = skipped)
router.post("/link/:token/submit", async (req, res) => {
  try {
    const found = await requireQuizLinkAccess(req, res);
    if (!found) return;
    const { quiz, expiresAt } = found;
    if (quiz.status === "attempted") return badRequest(res, "This quiz has already been finished.");
    if (!quiz.linkStartedAt) return badRequest(res, "Please press Start before answering.");

    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length !== quiz.questions.length)
      return badRequest(res, "Answers don't match the questions — please reload the page.");
    const clean = answers.map((a, i) => {
      const n = Number.isInteger(a) ? a : parseInt(a, 10);
      return Number.isInteger(n) && n >= 0 && n < quiz.questions[i].options.length ? n : -1;
    });

    // Scored on the server only
    const score = clean.reduce((s, a, i) => s + (a === quiz.questions[i].correctIndex ? 1 : 0), 0);
    const totalQuestions = quiz.questions.length;
    const elapsedMs = Date.now() - quiz.linkStartedAt.getTime();

    let attempt;
    try {
      attempt = await getQuizAttempt(req.db).create({
        quizId: quiz._id, studentId: quiz.studentId._id, teacherId: quiz.teacherId._id,
        answers: clean, score, totalQuestions,
        percentage:  Math.round((score / totalQuestions) * 100),
        startedAt:   quiz.linkStartedAt,
        submittedAt: new Date(),
        timeTaken:   Math.round(elapsedMs / 1000),
        via:         "link",
        overTime:    elapsedMs > quiz.timeLimit * 60 * 1000 + SUBMIT_GRACE_MS,
      });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ success: false, message: "This quiz has already been finished." });
      throw e;
    }

    await getQuiz(req.db).updateOne({ _id: quiz._id }, { $set: { status: "attempted" } });
    quiz.status = "attempted";

    Promise.all([getTeacher(req.db).findById(quiz.teacherId._id), getStudent(req.db).findById(quiz.studentId._id)])
      .then(([teacherDoc, studentDoc]) => {
        if (teacherDoc && studentDoc) sendQuizCompleted(teacherDoc, studentDoc, quiz, attempt, req.center?.centerName || "", req.center)
          .catch(e => logger.warn("sendQuizCompleted failed:", { error: e?.message }));
      }).catch(() => {});

    res.json({ success: true, quiz: quizLinkView(quiz, attempt, expiresAt, req.center?.centerName) });
  } catch (err) {
    logger.error("Quiz link submit error:", { error: err?.message });
    serverError(res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/:id/share-link   — create or replace the link (teacher)
// DELETE /api/quiz/:id/share-link — remove it (link stops working at once)
// ─────────────────────────────────────────────────────────────────────────────
async function loadOwnQuiz(req, res) {
  if (req.user.role !== "teacher") { forbidden(res, "Teachers only"); return null; }
  getStudent(req.db);
  const quiz = await getQuiz(req.db).findById(req.params.id)
    .select("+shareLink.tokenEnc")
    .populate("studentId", "firstName lastName email isManaged");
  if (!quiz) { notFound(res, "Quiz not found"); return null; }
  if (quiz.teacherId.toString() !== req.user.id) { forbidden(res, "Access denied"); return null; }
  return quiz;
}

router.post("/:id/share-link", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const quiz = await loadOwnQuiz(req, res);
    if (!quiz) return;
    if (!quiz.studentId?.isManaged)
      return badRequest(res, "Share links are only for managed students — this student uses the app.");
    if (quiz.status === "attempted") return badRequest(res, "This quiz has already been finished.");
    if (Date.now() > linkExpiresAt(quiz.dueDate, req.center?.timezone).getTime())
      return badRequest(res, "The due date has passed, so a new link would already be expired.");

    issueShareLink(quiz);
    await quiz.save();
    res.json({ success: true, quiz: withShareInfo(quiz, req.center) });
  } catch (err) {
    logger.error("Create quiz share link error:", { error: err?.message });
    serverError(res);
  }
});

router.delete("/:id/share-link", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const quiz = await loadOwnQuiz(req, res);
    if (!quiz) return;
    await getQuiz(req.db).updateOne({ _id: quiz._id }, { $unset: { shareLink: 1 } });
    res.json({ success: true, message: "Link deleted — it no longer works." });
  } catch (err) {
    logger.error("Delete quiz share link error:", { error: err?.message });
    serverError(res);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz  — teacher creates a quiz
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    // Validate and coerce all string/id fields up front.
    // toStr/toObjectId/toInt throw { statusCode: 400 } on bad input —
    // the global errorHandler maps these to clean 400 JSON responses.
    const studentId    = toObjectId(req.body.studentId, "studentId");
    const title        = toStr(req.body.title,        "title",        { required: true, maxLen: 10_000 });
    const instructions = toStr(req.body.instructions, "instructions", { maxLen: 50_000 });
    const timeLimitNum = toInt(req.body.timeLimit, "timeLimit", { min: 1, max: 300 });
    const { dueDate }  = req.body;
    if (!dueDate) return badRequest(res, "dueDate is required");

    const questions = toArray(req.body.questions, "questions", { minLen: 1, maxLen: 50 });
    const qError = validateQuestions(questions);
    if (qError) return res.status(400).json({ message: qError });

    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, "Student not found");

    const quiz = new (getQuiz(req.db))({
      teacherId:    req.user.id,
      studentId,
      title:        title.slice(0, 200),
      instructions: instructions.slice(0, 2000),
      timeLimit:    timeLimitNum,
      dueDate:      new Date(dueDate),
      questions:    questions.map(q => ({
        question:     toStr(q.question, "question", { required: true }).slice(0, 1000),
        options:      toArray(q.options, "options", { minLen: 2, maxLen: 4 })
                        .map(o => ({ text: toStr(o.text, "option text", { required: true }).slice(0, 500) })),
        correctIndex: q.correctIndex,
        explanation:  toStr(q.explanation, "explanation").slice(0, 500),
      })),
    });
    // Managed students have no login — they get the quiz through a share link
    if (student.isManaged) issueShareLink(quiz);
    await quiz.save();

    // Email student about new quiz (non-blocking)
    getStudent(req.db).findById(studentId).then(studentDoc => {
      if (studentDoc) {
        getTeacher(req.db).findById(req.user.id).then(teacherDoc => {
          if (teacherDoc) sendQuizAssigned(studentDoc, teacherDoc, quiz, req.center?.centerName || "", req.center).catch(e => logger.warn("sendQuizAssigned failed:", { error: e?.message }));
        }).catch(e => logger.warn("Teacher lookup for quiz email failed:", { error: e?.message }));
      }
    }).catch(e => logger.warn("Student lookup for quiz email failed:", { error: e?.message }));

    // Push real-time update + device notification to student
    try {
      const io = req.app.get('io');
      io.to(`student-room:${req.center.slug}:${studentId}`).emit('quiz-assigned', {
        title: '📝 New Quiz!',
        message: `Your teacher assigned: "${title.slice(0, 60)}"`,
        quizId: quiz._id,
        dueDate,
      });
      pushToUser(req.db, 'student', studentId, { title: '📝 New Quiz!', body: `Your teacher assigned: "${title.slice(0, 60)}"`, icon: '/icons/icon.svg', data: { url: '/student/dashboard?tab=quiz' } });
    } catch (_) {}

    res.status(201).json({ success: true, quiz: withShareInfo(quiz, req.center) });
  } catch (err) {
    logger.error("Create quiz error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/my  — teacher: list all their quizzes + attempt summary
// ─────────────────────────────────────────────────────────────────────────────
router.get("/my", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    // ?status=assigned|attempted  ?page  ?limit — counts always included (badges poll with ?limit=1)
    const Quiz = getQuiz(req.db);
    const status = QUIZ_STATUSES.includes(req.query.status) ? req.query.status : null;
    const counts = await statusCounts(Quiz, { teacherId: oid(req.user.id) }, QUIZ_STATUSES);
    const { page: want, limit } = readPaging(req.query);
    const pagination = pageMeta(want, limit, status ? counts[status] : counts.all);
    const quizzes = await Quiz.find({ teacherId: req.user.id, ...(status ? { status } : {}) })
      .select("+shareLink.tokenEnc")
      .populate("studentId", "firstName lastName email isManaged")
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * limit)
      .limit(limit);

    // Attach attempt data to each quiz
    const quizIds    = quizzes.map(q => q._id);
    const attempts   = await getQuizAttempt(req.db).find({ quizId: { $in: quizIds } });
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.quizId.toString()] = a; });

    const result = quizzes.map(q => ({
      ...withShareInfo(q, req.center),
      attempt: attemptMap[q._id.toString()] || null,
    }));

    res.json({ success: true, quizzes: result, pagination, counts });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/assigned  — student: list their quizzes (no correctIndex)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/assigned", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const Quiz = getQuiz(req.db);
    const status = QUIZ_STATUSES.includes(req.query.status) ? req.query.status : null;
    const mine = { studentId: oid(req.user.id) };
    const counts = await statusCounts(Quiz, mine, QUIZ_STATUSES);
    const { page: want, limit } = readPaging(req.query);
    const pagination = pageMeta(want, limit, status ? counts[status] : counts.all);
    // To-do first (soonest due), then the rest (most recent first)
    const ids = await todoFirstIds(Quiz, { ...mine, ...(status ? { status } : {}) }, "assigned", pagination);
    const quizzes = inOrder(await Quiz.find({ _id: { $in: ids } }).populate("teacherId", "firstName lastName"), ids);

    // Header stats across ALL the student's quizzes, not just this page
    const [next, avg] = await Promise.all([
      Quiz.findOne({ ...mine, status: "assigned" }).sort({ dueDate: 1, _id: 1 }).populate("teacherId", "firstName lastName"),
      getQuizAttempt(req.db).aggregate([
        { $match: { ...mine, percentage: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: "$percentage" } } },
      ]),
    ]);
    const stats = { nextQuiz: next ? sanitiseForStudent(next) : null, avgScore: avg[0] ? Math.round(avg[0].avg) : null };

    // Attach attempt if it exists (so student can see their score)
    const quizIds  = quizzes.map(q => q._id);
    const attempts = await getQuizAttempt(req.db).find({ studentId: req.user.id, quizId: { $in: quizIds } });
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

    res.json({ success: true, quizzes: result, pagination, counts, stats });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/:id/attempt  — student submits answers
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/attempt", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const quiz = await getQuiz(req.db).findById(req.params.id);
    if (!quiz) return notFound(res, "Quiz not found");
    if (quiz.studentId.toString() !== req.user.id) return forbidden(res, "Access denied");
    if (quiz.status === "attempted") return badRequest(res, "You have already attempted this quiz");

    const { answers, startedAt, timeTaken } = req.body;

    if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
      return badRequest(res, "answers array length must match question count");
    }

    // Score calculation (server-side only)
    let score = 0;
    for (let i = 0; i < quiz.questions.length; i++) {
      if (parseInt(answers[i], 10) === quiz.questions[i].correctIndex) score++;
    }

    const totalQuestions = quiz.questions.length;
    const percentage     = Math.round((score / totalQuestions) * 100);

    const attempt = await getQuizAttempt(req.db).create({
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

    // Streak — await so we can include result in response
    let streakResult = null;
    try { streakResult = await recordActivity(req.db, req.user.id); } catch (_) {}

    // Email teacher about completion (non-blocking)
    Promise.all([
      getTeacher(req.db).findById(quiz.teacherId),
      getStudent(req.db).findById(req.user.id),
    ]).then(([teacherDoc, studentDoc]) => {
      if (teacherDoc && studentDoc) sendQuizCompleted(teacherDoc, studentDoc, quiz, attempt, req.center?.centerName || "", req.center).catch(e => logger.warn("sendQuizCompleted failed:", { error: e?.message }));
    }).catch(e => logger.warn("User lookup for quiz completion email failed:", { error: e?.message }));

    // Return full quiz (with correct answers revealed) + attempt + streak
    const fullQuiz = quiz.toObject();
    res.json({ success: true, attempt, quiz: fullQuiz, streak: streakResult });
  } catch (err) {
    logger.error("Submit attempt error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/quiz/:id  — teacher deletes a quiz (only if not yet attempted)
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const quiz = await getQuiz(req.db).findById(req.params.id);
    if (!quiz) return notFound(res, "Quiz not found");
    if (quiz.teacherId.toString() !== req.user.id) return forbidden(res, "Access denied");
    if (quiz.status === "attempted") return badRequest(res, "Cannot delete a quiz that has been attempted");

    await quiz.deleteOne();
    res.json({ success: true, message: "Quiz deleted" });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/quiz/generate  — teacher generates MCQ questions via Gemini AI
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

    const { topic, count = 10, difficulty = "intermediate" } = req.body;

    if (!topic?.trim()) return badRequest(res, "Topic is required");

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey.startsWith("CHANGE_ME")) {
      return res.status(503).json({ message: "AI quiz generation is not configured — GEMINI_API_KEY is missing or not set." });
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
    logger.error("Quiz generate error:", { error: err?.message });
    serverError(res, err.message);
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
      if (req.user.role !== "teacher") return forbidden(res, "Teachers only");

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
          return badRequest(res, "Could not read PDF — try copying and pasting the text instead");
        }
      }

      if (!notesText || notesText.length < 50) {
        return badRequest(res, "Please provide lesson notes (at least 50 characters) or upload a PDF");
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
      logger.error("Generate-from-notes error:", { error: err?.message });
      // Multer file type error
      if (err.message === "Only PDF files are allowed") {
        return res.status(400).json({ message: err.message });
      }
      serverError(res, err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/quiz/ai-models  — lists Gemini models available for your API key
// Remove this route once you've confirmed which models work
// ─────────────────────────────────────────────────────────────────────────────
router.get("/ai-models", verifyToken, async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("CHANGE_ME")) return res.status(503).json({ message: "GEMINI_API_KEY not set" });
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
    serverError(res, err.message);
  }
});

export default router;

