// server/routes/gameRoutes.js
// Word Squad play API (mounted at /api/v1/games). Small on purpose: one short
// request per Word Gate. The server holds the right answers, checks every
// answer (once each, in gate order, at a believable pace) and works out the
// stars itself; the game only reports a few numbers that can add a capped bonus.
//
//   GET  /word-squad/assignments            the student's games, progress and star total
//   POST /word-squad/sessions               { assignmentId, chapter } → gates without answers
//   POST /word-squad/sessions/:id/answer    { gateId, choice } → { correct, correctAnswer }
//   POST /word-squad/sessions/:id/finish    { won, bugsPopped, … } → stars, rating, review
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyStudent } from "../middleware/authMiddleware.js";
import { gameLimiter } from "../middleware/rateLimiter.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { questionSetSchema } from "../schemas/questionSetSchema.js";
import { gameAssignmentSchema } from "../schemas/gameAssignmentSchema.js";
import { gameSessionSchema } from "../schemas/gameSessionSchema.js";
import { gameProgressSchema } from "../schemas/gameProgressSchema.js";
import { starLedgerSchema } from "../schemas/starLedgerSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import {
  CHAPTER_GATES, CHAPTER_COUNT, MIN_ANSWER_GAP_MS, SESSION_TTL_MS,
  choicesForGate, createRng, shuffle, rollReward, computeStars, chapterRating,
} from "../utils/wordSquadRules.js";
import { recordActivity } from "../utils/streakService.js";
import { ok, created, badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";
import { toObjectId, toInt, toStr } from "../utils/inputSanitizer.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getSet        = (db) => db.models.QuestionSet    || db.model("QuestionSet", questionSetSchema);
const getAssignment = (db) => db.models.GameAssignment || db.model("GameAssignment", gameAssignmentSchema);
const getSession    = (db) => db.models.GameSession    || db.model("GameSession", gameSessionSchema);
const getProgress   = (db) => db.models.GameProgress   || db.model("GameProgress", gameProgressSchema);
const getLedger     = (db) => db.models.StarLedger     || db.model("StarLedger", starLedgerSchema);
const getGroupClass = (db) => db.models.GroupClass     || db.model("GroupClass", groupClassSchema);
const getStudent    = (db) => db.models.Student        || db.model("Student", studentSchema);

const student = [verifyToken, verifyStudent, gameLimiter];
const REVIVE_ID = "revive";

/** Sanitizer errors carry statusCode 400 — answer them as such */
const fail = (res, err, what) => {
  if (err?.statusCode === 400) return badRequest(res, err.message);
  logger.error(`Word Squad ${what} failed`, { error: err?.message });
  return serverError(res, undefined, err);
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** Assignments this student may play right now: given to them, or to a group class they're in. */
async function playableFilter(db, studentId) {
  const groupIds = await getGroupClass(db).distinct("_id", { "enrollments.studentId": studentId });
  const now = new Date();
  return {
    active: true,
    startsAt: { $lte: now },
    $and: [
      { $or: [{ dueAt: null }, { dueAt: { $gt: now } }] },
      { $or: [{ studentIds: studentId }, { groupClassIds: { $in: groupIds } }] },
    ],
  };
}

/** Choices for one gate: the right answer plus wrong ones, shuffled, `n` long. */
function gateChoices(rng, q, n) {
  const wrong = shuffle(rng, (q.distractors || []).filter((d) => d && d !== q.answer));
  return shuffle(rng, [q.answer, ...wrong.slice(0, Math.max(1, n - 1))]);
}

// ── The student's games ─────────────────────────────────────────────────────
router.get("/word-squad/assignments", ...student, async (req, res) => {
  try {
    const sid = req.student._id;
    const list = await getAssignment(req.db).find(await playableFilter(req.db, sid)).sort({ createdAt: -1 }).limit(50).lean();
    const sets = await getSet(req.db).find({ _id: { $in: list.map((a) => a.setId) }, status: "published" }).select("title level").lean();
    const setById = new Map(sets.map((s) => [String(s._id), s]));
    const progress = await getProgress(req.db).find({ studentId: sid, assignmentId: { $in: list.map((a) => a._id) } }).lean();
    const progById = new Map(progress.map((p) => [String(p.assignmentId), p]));
    const today = await getSession(req.db).aggregate([
      { $match: { studentId: sid, assignmentId: { $in: list.map((a) => a._id) }, countsForStars: true, createdAt: { $gte: startOfToday() } } },
      { $group: { _id: "$assignmentId", n: { $sum: 1 } } },
    ]);
    const todayById = new Map(today.map((t) => [String(t._id), t.n]));
    const assignments = list
      .filter((a) => setById.has(String(a.setId)))
      .map((a) => {
        const p = progById.get(String(a._id));
        return {
          id: a._id,
          title: setById.get(String(a.setId)).title,
          level: setById.get(String(a.setId)).level,
          chapters: a.chapters,
          dueAt: a.dueAt,
          maxPlaysPerDay: a.maxPlaysPerDay,
          playsToday: todayById.get(String(a._id)) || 0,
          progress: { unlocked: p?.unlocked ?? 0, ratings: p?.ratings ?? [0, 0, 0], bestStars: p?.bestStars ?? [0, 0, 0], plays: p?.plays ?? 0 },
        };
      });
    return ok(res, { data: { assignments, stars: req.student.stars || 0 } });
  } catch (err) {
    return fail(res, err, "assignments");
  }
});

// ── Start a chapter ─────────────────────────────────────────────────────────
router.post("/word-squad/sessions", ...student, async (req, res) => {
  try {
    const sid = req.student._id;
    const assignmentId = toObjectId(req.body?.assignmentId, "assignmentId");
    const chapter = toInt(req.body?.chapter, "chapter", { min: 0, max: CHAPTER_COUNT - 1, default: 0 });

    const assignment = await getAssignment(req.db).findOne({ _id: assignmentId, ...(await playableFilter(req.db, sid)) }).lean();
    if (!assignment) return notFound(res, "This game isn't assigned to you (or it has ended)");
    const set = await getSet(req.db).findOne({ _id: assignment.setId, status: "published" }).lean();
    const questions = (set?.questions || []).filter((q) => q.prompt && q.answer && (q.distractors || []).some((d) => d && d !== q.answer));
    if (!questions.length) return badRequest(res, "This question set has no playable questions yet");

    const progress = await getProgress(req.db).findOne({ studentId: sid, assignmentId }).lean();
    const maxChapter = Math.min((assignment.chapters || CHAPTER_COUNT) - 1, progress?.unlocked ?? 0);
    if (chapter > maxChapter) return forbidden(res, "Finish the chapter before to unlock this one");

    const playsToday = await getSession(req.db).countDocuments({ studentId: sid, assignmentId, countsForStars: true, createdAt: { $gte: startOfToday() } });
    const countsForStars = playsToday < (assignment.maxPlaysPerDay || 3);

    // Gates: the chapter's gates + one during the boss fight, then a spare for the revive
    const seed = Math.floor(Math.random() * 1e9);
    const rng = createRng(seed);
    const pool = shuffle(rng, questions);
    const count = CHAPTER_GATES[chapter] + 1;
    const gates = [];
    for (let i = 0; i < count; i++) {
      const q = pool[i % pool.length];
      const n = i === count - 1 ? 3 : choicesForGate(chapter, i);
      gates.push({ gateId: String(i), questionId: q._id, prompt: q.prompt, choices: gateChoices(rng, q, n), answer: q.answer, reward: rollReward(rng) });
    }
    const rq = pool[count % pool.length];
    const revive = { gateId: REVIVE_ID, questionId: rq._id, prompt: rq.prompt, choices: gateChoices(rng, rq, 3), answer: rq.answer };

    const session = await getSession(req.db).create({
      studentId: sid, assignmentId, setId: set._id, chapter, seed, gates, revive, countsForStars,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });

    return created(res, {
      data: {
        sessionId: session._id,
        seed,
        chapter,
        countsForStars,
        gates: gates.map(({ gateId, prompt, choices, reward }) => ({ gateId, prompt, choices, reward })),
        revive: { gateId: revive.gateId, prompt: revive.prompt, choices: revive.choices },
      },
    });
  } catch (err) {
    return fail(res, err, "start");
  }
});

/** The student's own active session, with its answers loaded */
async function loadSession(req) {
  const s = await getSession(req.db).findOne({ _id: req.params.id, studentId: req.student._id }).select("+gates +revive");
  return s;
}

// ── Answer a gate ───────────────────────────────────────────────────────────
router.post("/word-squad/sessions/:id/answer", validateObjectId("id"), ...student, async (req, res) => {
  try {
    const gateId = toStr(req.body?.gateId, "gateId", { maxLen: 20, required: true });
    const choice = toStr(req.body?.choice, "choice", { maxLen: 40, required: true });
    const s = await loadSession(req);
    if (!s) return notFound(res, "Game not found");
    if (s.status !== "active") return conflict(res, "This game is already finished");
    if (s.expiresAt < new Date()) return conflict(res, "This game has timed out — start the chapter again");

    if (gateId === REVIVE_ID) {
      if (!s.revive || s.revive.answeredAt) return conflict(res, "The bonus question was already answered");
      if (!s.revive.choices.includes(choice)) return badRequest(res, "That word isn't one of the choices");
      const correct = choice === s.revive.answer;
      const done = await getSession(req.db).updateOne(
        { _id: s._id, status: "active", "revive.answeredAt": null },
        { $set: { "revive.choice": choice, "revive.correct": correct, "revive.answeredAt": new Date() } },
      );
      if (!done.modifiedCount) return conflict(res, "The bonus question was already answered");
      return ok(res, { data: { correct, correctAnswer: s.revive.answer } });
    }

    const i = s.gates.findIndex((g) => g.gateId === gateId);
    if (i < 0) return badRequest(res, "Unknown gate");
    const gate = s.gates[i];
    if (gate.answeredAt) return conflict(res, "This gate was already answered");
    // In gate order: no going back to a gate after a later one was answered
    const lastAnswered = s.gates.reduce((m, g, k) => (g.answeredAt ? k : m), -1);
    if (i < lastAnswered) return conflict(res, "Gates are answered in order");
    // At a believable pace: gates are several seconds apart in the game
    const since = Date.now() - new Date(s.lastAnswerAt || s.createdAt).getTime();
    if (since < MIN_ANSWER_GAP_MS) return res.status(429).json({ success: false, message: "Too fast — gates are a few seconds apart" });
    if (!gate.choices.includes(choice)) return badRequest(res, "That word isn't one of the choices");

    const correct = choice === gate.answer;
    const now = new Date();
    // Atomic: only if this gate is still open and nobody answered in between
    const done = await getSession(req.db).updateOne(
      { _id: s._id, status: "active", [`gates.${i}.answeredAt`]: null, lastAnswerAt: s.lastAnswerAt },
      {
        $set: { [`gates.${i}.choice`]: choice, [`gates.${i}.correct`]: correct, [`gates.${i}.answeredAt`]: now, lastAnswerAt: now },
        $inc: { answered: 1, right: correct ? 1 : 0 },
      },
    );
    if (!done.modifiedCount) return conflict(res, "This gate was already answered");
    return ok(res, { data: { correct, correctAnswer: gate.answer } });
  } catch (err) {
    return fail(res, err, "answer");
  }
});

// ── Finish a chapter ────────────────────────────────────────────────────────
router.post("/word-squad/sessions/:id/finish", validateObjectId("id"), ...student, async (req, res) => {
  try {
    const b = req.body || {};
    const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const reported = {
      bugsPopped: num(b.bugsPopped, 5000), bestCombo: num(b.bestCombo, 500), squadSize: num(b.squadSize, 150),
      coins: num(b.coins, 500), spells: num(b.spells, 10), bossHits: num(b.bossHits, 100),
      bossBeaten: b.bossBeaten === true, won: b.won === true,
    };
    const s = await loadSession(req);
    if (!s) return notFound(res, "Game not found");
    if (s.status !== "active") return conflict(res, "This game is already finished");

    // Right and total come from the server's own checks. Gates skipped before the
    // last answered one count as missed, so skipping hard ones doesn't help.
    const right = s.gates.filter((g) => g.correct === true).length;
    const lastAnswered = s.gates.reduce((m, g, k) => (g.answeredAt ? k : m), -1);
    const total = lastAnswered + 1;
    const playedMs = Date.now() - new Date(s.createdAt).getTime();
    // A win is only believable after reaching the boss (all regular gates) and real play time
    const won = reported.won && total >= s.gates.length - 1 && playedMs > 60 * 1000;
    const bossBeaten = reported.bossBeaten && won;
    const inTime = s.expiresAt.getTime() + SESSION_TTL_MS > Date.now(); // a little grace after the play window
    const stars = s.countsForStars && inTime
      ? computeStars({ ...reported, right, total, bossBeaten })
      : { base: 0, bonus: 0, boss: 0, total: 0 };
    const rating = chapterRating({ won, right, total, bossHits: reported.bossHits, bestCombo: reported.bestCombo });

    const finished = await getSession(req.db).findOneAndUpdate(
      { _id: s._id, status: "active" },
      { $set: { status: "finished", finishedAt: new Date(), stats: reported, right, answered: total, starsAwarded: stars.total, rating: rating.count } },
      { new: true },
    );
    if (!finished) return conflict(res, "This game is already finished");

    // Pay the stars once (the ledger row is unique per session)
    let totalStars = req.student.stars || 0;
    if (stars.total > 0) {
      try {
        await getLedger(req.db).create({ studentId: s.studentId, amount: stars.total, source: "word-squad", sessionId: s._id });
        const st = await getStudent(req.db).findOneAndUpdate({ _id: s.studentId }, { $inc: { stars: stars.total } }, { new: true }).select("stars").lean();
        totalStars = st?.stars ?? totalStars + stars.total;
      } catch (err) {
        if (err?.code !== 11000) throw err; // already paid
      }
    }

    // Progress carries over between devices
    const assignment = await getAssignment(req.db).findById(s.assignmentId).select("chapters").lean();
    const P = getProgress(req.db);
    const prev = await P.findOne({ studentId: s.studentId, assignmentId: s.assignmentId }).lean();
    const ratings = [...(prev?.ratings || [0, 0, 0])];
    const bestStars = [...(prev?.bestStars || [0, 0, 0])];
    ratings[s.chapter] = Math.max(ratings[s.chapter] || 0, rating.count);
    bestStars[s.chapter] = Math.max(bestStars[s.chapter] || 0, stars.total);
    const lastChapter = Math.min(CHAPTER_COUNT, assignment?.chapters || CHAPTER_COUNT) - 1;
    const unlocked = Math.max(prev?.unlocked ?? 0, won ? Math.min(s.chapter + 1, lastChapter) : 0);
    const progress = await P.findOneAndUpdate(
      { studentId: s.studentId, assignmentId: s.assignmentId },
      { $set: { ratings, bestStars, unlocked, lastPlayedAt: new Date() }, $inc: { plays: 1 } },
      { new: true, upsert: true },
    ).lean();

    recordActivity(req.db, s.studentId).catch(() => {}); // a game counts toward the daily streak

    const review = s.gates.filter((g) => g.answeredAt && !g.correct).map((g) => ({ prompt: g.prompt, answer: g.answer, chose: g.choice }));
    return ok(res, {
      data: {
        starsAwarded: stars.total,
        stars,
        rating,
        right,
        total,
        countsForStars: s.countsForStars,
        totalStars,
        review,
        progress: { unlocked: progress.unlocked, ratings: progress.ratings, bestStars: progress.bestStars },
      },
    });
  } catch (err) {
    return fail(res, err, "finish");
  }
});

export default router;
