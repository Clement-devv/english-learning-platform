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
// Managed students (no login) play the same four routes under /link/:token/…,
// after a name check — see "Play by link" below.
// Teachers and admins manage question sets and assignments further down.
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyStudent, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { gameLimiter, loginLimiter } from "../middleware/rateLimiter.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { questionSetSchema } from "../schemas/questionSetSchema.js";
import { gameAssignmentSchema } from "../schemas/gameAssignmentSchema.js";
import { gameSessionSchema } from "../schemas/gameSessionSchema.js";
import { gameProgressSchema } from "../schemas/gameProgressSchema.js";
import { starLedgerSchema } from "../schemas/starLedgerSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { assignmentSchema } from "../schemas/assignmentSchema.js";
import { gameLinkSchema } from "../schemas/gameLinkSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import {
  ACCESS_HEADER, issueShareLink, resolveShareLink, checkUnlock, signLinkAccess, verifyLinkAccess,
} from "../utils/shareLink.js";
import { decrypt } from "../utils/fieldEncryption.js";
import {
  CHAPTER_GATES, CHAPTER_COUNT, MIN_ANSWER_GAP_MS, SESSION_TTL_MS,
  choicesForGate, createRng, shuffle, rollReward, computeStars, chapterRating,
} from "../utils/wordSquadRules.js";
import { LIMITS, LEVELS, normalizeQuestion, questionErrors, publishErrors } from "../utils/questionRules.js";
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
const getGameLink   = (db) => db.models.GameLink       || db.model("GameLink", gameLinkSchema);
const getTeacher    = (db) => db.models.Teacher        || db.model("Teacher", teacherSchema);

const student = [verifyToken, verifyStudent, gameLimiter];
const REVIVE_ID = "revive";

/** Sanitizer errors carry statusCode 400 — answer them as such */
const fail = (res, err, what) => {
  if (err?.statusCode === 400) return badRequest(res, err.message);
  logger.error(`Word Squad ${what} failed`, { error: err?.message });
  return serverError(res, undefined, err);
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

/** Assignments this student may play right now: given to them, or to a group class they're in.
 *  Through a game link, only that link's assignment. */
async function playableFilter(req, studentId) {
  const groupIds = await getGroupClass(req.db).distinct("_id", { "enrollments.studentId": studentId });
  const now = new Date();
  return {
    active: true,
    startsAt: { $lte: now },
    $and: [
      { $or: [{ dueAt: null }, { dueAt: { $gt: now } }] },
      { $or: [{ studentIds: studentId }, { groupClassIds: { $in: groupIds } }] },
      ...(req.gameLink ? [{ _id: req.gameLink.assignmentId }] : []),
    ],
  };
}

/** Choices for one gate: the right answer plus wrong ones, shuffled, `n` long. */
function gateChoices(rng, q, n) {
  const wrong = shuffle(rng, (q.distractors || []).filter((d) => d && d !== q.answer));
  return shuffle(rng, [q.answer, ...wrong.slice(0, Math.max(1, n - 1))]);
}

// ── The student's games ─────────────────────────────────────────────────────
async function listGames(req, res) {
  try {
    const sid = req.student._id;
    const list = await getAssignment(req.db).find(await playableFilter(req, sid)).sort({ createdAt: -1 }).limit(50).lean();
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
}

// ── Start a chapter ─────────────────────────────────────────────────────────
async function startChapter(req, res) {
  try {
    const sid = req.student._id;
    const assignmentId = toObjectId(req.body?.assignmentId, "assignmentId");
    const chapter = toInt(req.body?.chapter, "chapter", { min: 0, max: CHAPTER_COUNT - 1, default: 0 });

    const assignment = await getAssignment(req.db).findOne({ _id: assignmentId, ...(await playableFilter(req, sid)) }).lean();
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
}

/** The student's own active session, with its answers loaded */
async function loadSession(req) {
  const s = await getSession(req.db).findOne({ _id: req.params.id, studentId: req.student._id }).select("+gates +revive");
  return s;
}

// ── Answer a gate ───────────────────────────────────────────────────────────
async function answerGate(req, res) {
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
}

// ── Finish a chapter ────────────────────────────────────────────────────────
async function finishChapter(req, res) {
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
}

router.get("/word-squad/assignments", ...student, listGames);
router.post("/word-squad/sessions", ...student, startChapter);
router.post("/word-squad/sessions/:id/answer", validateObjectId("id"), ...student, answerGate);
router.post("/word-squad/sessions/:id/finish", validateObjectId("id"), ...student, finishChapter);

// ═════════════════════════════════════════════════════════════════════════════
// Play by link — managed students (no login), /api/v1/games/link/:token/…
//   POST /link/:token/unlock     { studentName, teacherName } → access token
//   GET  /link/:token            (X-Share-Access) who the link is for
//   …/word-squad/*               the four play routes above, for this one game
// The token in the URL is the key and the name check gives a short-lived access
// token (utils/shareLink.js). The link ends with its game (stopped or past due),
// or when the student leaves the class. Never 401 (the app would go to a login).
// ═════════════════════════════════════════════════════════════════════════════
const LINK_UNAVAILABLE = "This game link doesn't work. Please ask your teacher for a new link.";
const LINK_KIND = "game";
const linkExpiry = () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // ends with the game, not a date

async function findGameLink(req, res) {
  getStudent(req.db); getTeacher(req.db); // register models for populate
  const r = await resolveShareLink(getGameLink(req.db), req.params.token, req.center, { expiresAt: linkExpiry });
  if (r.status !== "ok") { notFound(res, LINK_UNAVAILABLE); return null; }
  const a = await getAssignment(req.db).findOne({ _id: r.doc.assignmentId, ...(await playableFilter(req, r.doc.studentId._id)) }).select("dueAt").lean();
  if (!a) {
    const ended = await getAssignment(req.db).findById(r.doc.assignmentId).select("dueAt").lean();
    res.status(410).json({ success: false, expired: true, endedAt: ended?.dueAt || null, message: "This game has ended. Ask your teacher if you want to play again." });
    return null;
  }
  return r;
}

const linkView = (link) => ({
  studentName: link.studentId.firstName,
  teacherName: link.teacherId.displayName?.trim() || link.teacherId.firstName,
});

/** Lets the play routes run as the link's student, for the link's game only */
async function linkPlayer(req, res, next) {
  try {
    const r = await findGameLink(req, res);
    if (!r) return;
    if (!verifyLinkAccess(req.center.slug, LINK_KIND, req.get(ACCESS_HEADER), r.doc._id, r.tokenHash)) {
      return forbidden(res, "Please tell us your name to open this game.");
    }
    const st = await getStudent(req.db).findById(r.doc.studentId._id).select("firstName stars").lean();
    if (!st) return notFound(res, LINK_UNAVAILABLE);
    req.student = st;
    req.gameLink = { assignmentId: r.doc.assignmentId, view: linkView(r.doc) };
    req.user = { id: `link-${st._id}`, centerId: req.center.slug }; // rate limit per student, not per school Wi-Fi
    return next();
  } catch (err) { return fail(res, err, "game link"); }
}

router.post("/link/:token/unlock", loginLimiter, async (req, res) => {
  try {
    const r = await findGameLink(req, res);
    if (!r) return;
    const check = await checkUnlock(getGameLink(req.db), r.doc,
      toStr(req.body?.studentName, "studentName", { maxLen: 100 }),
      toStr(req.body?.teacherName, "teacherName", { maxLen: 100 }));
    if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
    return res.json({ success: true, accessToken: signLinkAccess(req.center.slug, LINK_KIND, r.doc._id, r.tokenHash, r.expiresAt), game: linkView(r.doc) });
  } catch (err) { return fail(res, err, "game link unlock"); }
});

const link = [linkPlayer, gameLimiter];
router.get("/link/:token", ...link, (req, res) => res.json({ success: true, game: req.gameLink.view }));
router.get("/link/:token/word-squad/assignments", ...link, listGames);
router.post("/link/:token/word-squad/sessions", ...link, startChapter);
router.post("/link/:token/word-squad/sessions/:id/answer", validateObjectId("id"), ...link, answerGate);
router.post("/link/:token/word-squad/sessions/:id/finish", validateObjectId("id"), ...link, finishChapter);

// ═════════════════════════════════════════════════════════════════════════════
// Teachers and admins: question sets and assignments
//   GET/POST       /sets                 list (teacher: own, admin: all) / create a draft
//   GET/PUT/DELETE /sets/:id             one set with answers / save / delete
//   POST           /sets/:id/publish     checks it, then students can be given it
//   POST           /sets/:id/unpublish   back to draft
//   POST           /sets/:id/duplicate   a draft copy
//   GET            /targets              group classes and students this person may assign to
//   GET/POST       /assignments          list / give a published set to classes or students
//   PATCH          /assignments/:id      stop / restart, due date, plays per day
//   POST           /assignments/:id/links  personal play links for its managed students
// ═════════════════════════════════════════════════════════════════════════════
const staff = [verifyToken, verifyAdminOrTeacher];
const who = (req) => (req.admin ? { role: "admin", id: req.admin._id || null } : { role: "teacher", id: req.teacher._id });
const isAdmin = (req) => !!req.admin;
/** Teachers only see and change their own sets and assignments; admins see the whole center */
const mine = (req) => (isAdmin(req) ? {} : { "createdBy.id": req.teacher._id });

const getTeacherAssignment = (db) => db.models.Assignment || db.model("Assignment", assignmentSchema);

function setSummary(s, assignmentsBySet) {
  return {
    id: s._id, title: s.title, level: s.level, status: s.status, source: s.source,
    questionCount: (s.questions || []).length, updatedAt: s.updatedAt, createdBy: s.createdBy,
    activeAssignments: assignmentsBySet.get(String(s._id)) || 0,
  };
}
/** Clean questions from the editor; 400 with per-question messages if any is wrong */
function readQuestions(raw) {
  const list = Array.isArray(raw) ? raw.slice(0, LIMITS.maxQuestions + 1) : [];
  if (list.length > LIMITS.maxQuestions) throw Object.assign(new Error(`At most ${LIMITS.maxQuestions} questions in a set`), { statusCode: 400 });
  const questions = list.map(normalizeQuestion);
  const problems = questions.map((q, i) => ({ index: i, errors: questionErrors(q) })).filter((p) => p.errors.length);
  return { questions, problems };
}

router.get("/sets", ...staff, async (req, res) => {
  try {
    const filter = { ...mine(req) };
    if (["draft", "published"].includes(req.query.status)) filter.status = req.query.status;
    const sets = await getSet(req.db).find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    const counts = await getAssignment(req.db).aggregate([
      { $match: { setId: { $in: sets.map((s) => s._id) }, active: true } },
      { $group: { _id: "$setId", n: { $sum: 1 } } },
    ]);
    const bySet = new Map(counts.map((c) => [String(c._id), c.n]));
    return ok(res, { data: sets.map((s) => setSummary(s, bySet)) });
  } catch (err) { return fail(res, err, "list sets"); }
});

router.post("/sets", ...staff, async (req, res) => {
  try {
    const title = toStr(req.body?.title, "title", { maxLen: 120, required: true });
    const level = LEVELS.includes(req.body?.level) ? req.body.level : "A1";
    const { questions, problems } = readQuestions(req.body?.questions);
    if (problems.length) return res.status(400).json({ success: false, message: "Some questions need fixing", problems });
    const set = await getSet(req.db).create({ title, level, questions, createdBy: who(req), status: "draft" });
    return created(res, { data: set });
  } catch (err) { return fail(res, err, "create set"); }
});

async function ownSet(req) {
  return getSet(req.db).findOne({ _id: req.params.id, ...mine(req) });
}

router.get("/sets/:id", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await getSet(req.db).findOne({ _id: req.params.id, ...mine(req) }).lean();
    if (!set) return notFound(res, "Question set not found");
    return ok(res, { data: set });
  } catch (err) { return fail(res, err, "get set"); }
});

router.put("/sets/:id", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await ownSet(req);
    if (!set) return notFound(res, "Question set not found");
    if (req.body?.title !== undefined) set.title = toStr(req.body.title, "title", { maxLen: 120, required: true });
    if (LEVELS.includes(req.body?.level)) set.level = req.body.level;
    if (req.body?.questions !== undefined) {
      const { questions, problems } = readQuestions(req.body.questions);
      if (problems.length) return res.status(400).json({ success: false, message: "Some questions need fixing", problems });
      set.questions = questions;
    }
    // A published set must stay playable
    if (set.status === "published") {
      const errs = publishErrors(set);
      if (errs.length) return res.status(400).json({ success: false, message: errs[0], errors: errs });
    }
    await set.save();
    return ok(res, { data: set, message: "Saved" });
  } catch (err) { return fail(res, err, "save set"); }
});

router.post("/sets/:id/publish", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await ownSet(req);
    if (!set) return notFound(res, "Question set not found");
    const errs = publishErrors(set);
    if (errs.length) return res.status(400).json({ success: false, message: errs[0], errors: errs });
    set.status = "published";
    await set.save();
    return ok(res, { data: set, message: "Published — you can give it to your students now" });
  } catch (err) { return fail(res, err, "publish set"); }
});

router.post("/sets/:id/unpublish", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await ownSet(req);
    if (!set) return notFound(res, "Question set not found");
    set.status = "draft";
    await set.save();
    return ok(res, { data: set, message: "Back to draft — students can't play it until you publish it again" });
  } catch (err) { return fail(res, err, "unpublish set"); }
});

router.post("/sets/:id/duplicate", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await getSet(req.db).findOne({ _id: req.params.id, ...mine(req) }).lean();
    if (!set) return notFound(res, "Question set not found");
    const copy = await getSet(req.db).create({
      title: `${set.title} (copy)`.slice(0, 120), level: set.level, status: "draft", createdBy: who(req),
      questions: set.questions.map(({ _id, ...q }) => q),
    });
    return created(res, { data: copy });
  } catch (err) { return fail(res, err, "duplicate set"); }
});

router.delete("/sets/:id", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const set = await ownSet(req);
    if (!set) return notFound(res, "Question set not found");
    const inUse = await getAssignment(req.db).countDocuments({ setId: set._id, active: true });
    if (inUse) return conflict(res, "Students are playing this set — stop its assignments first");
    await set.deleteOne();
    return ok(res, { message: "Deleted" });
  } catch (err) { return fail(res, err, "delete set"); }
});

/** Group classes and students this person may give a game to */
async function targetsFor(req) {
  const recent = new Date(Date.now() - 60 * 86400000);
  const gcFilter = { status: { $nin: ["cancelled", "missed"] }, scheduledTime: { $gte: recent } };
  let studentIds = null;
  if (!isAdmin(req)) {
    gcFilter.teacherId = req.teacher._id;
    studentIds = await getTeacherAssignment(req.db).distinct("studentId", { teacherId: req.teacher._id });
  }
  const groupClasses = await getGroupClass(req.db).find(gcFilter).sort({ scheduledTime: -1 }).limit(100).select("title scheduledTime enrollments.studentId").lean();
  const sFilter = { active: true, ...(studentIds ? { _id: { $in: studentIds } } : {}) };
  if (req.modeStudentIds) sFilter._id = { $in: req.modeStudentIds };
  const students = await getStudent(req.db).find(sFilter).sort({ firstName: 1 }).limit(500).select("firstName lastName").lean();
  return { groupClasses, students };
}

router.get("/targets", ...staff, async (req, res) => {
  try {
    const { groupClasses, students } = await targetsFor(req);
    return ok(res, {
      data: {
        groupClasses: groupClasses.map((g) => ({ id: g._id, title: g.title, scheduledTime: g.scheduledTime, students: (g.enrollments || []).length })),
        students: students.map((s) => ({ id: s._id, name: `${s.firstName} ${s.lastName || ""}`.trim() })),
      },
    });
  } catch (err) { return fail(res, err, "targets"); }
});

router.get("/assignments", ...staff, async (req, res) => {
  try {
    const list = await getAssignment(req.db).find(mine(req)).sort({ createdAt: -1 }).limit(200).lean();
    const sets = await getSet(req.db).find({ _id: { $in: list.map((a) => a.setId) } }).select("title status").lean();
    const setById = new Map(sets.map((s) => [String(s._id), s]));
    const players = await getProgress(req.db).aggregate([
      { $match: { assignmentId: { $in: list.map((a) => a._id) } } },
      { $group: { _id: "$assignmentId", n: { $sum: 1 } } },
    ]);
    const playersBy = new Map(players.map((p) => [String(p._id), p.n]));
    return ok(res, {
      data: list.map((a) => ({
        id: a._id, setId: a.setId, setTitle: setById.get(String(a.setId))?.title || "(deleted set)",
        setStatus: setById.get(String(a.setId))?.status || "deleted",
        groupClasses: a.groupClassIds.length, students: a.studentIds.length, chapters: a.chapters,
        startsAt: a.startsAt, dueAt: a.dueAt, maxPlaysPerDay: a.maxPlaysPerDay, active: a.active,
        players: playersBy.get(String(a._id)) || 0, createdAt: a.createdAt,
      })),
    });
  } catch (err) { return fail(res, err, "list assignments"); }
});

router.post("/assignments", ...staff, async (req, res) => {
  try {
    const b = req.body || {};
    const setId = toObjectId(b.setId, "setId");
    const set = await getSet(req.db).findOne({ _id: setId, ...mine(req) }).lean();
    if (!set) return notFound(res, "Question set not found");
    if (set.status !== "published") return badRequest(res, "Publish the set before giving it to students");

    // Only group classes and students within this person's reach
    const { groupClasses, students } = await targetsFor(req);
    const okGc = new Set(groupClasses.map((g) => String(g._id)));
    const okSt = new Set(students.map((s) => String(s._id)));
    const groupClassIds = [...new Set((Array.isArray(b.groupClassIds) ? b.groupClassIds : []).map(String))];
    const studentIds = [...new Set((Array.isArray(b.studentIds) ? b.studentIds : []).map(String))];
    if (!groupClassIds.length && !studentIds.length) return badRequest(res, "Choose at least one group class or student");
    if (groupClassIds.some((id) => !okGc.has(id)) || studentIds.some((id) => !okSt.has(id))) {
      return forbidden(res, "You can only give games to your own group classes and students");
    }
    const startsAt = b.startsAt ? new Date(b.startsAt) : new Date();
    const dueAt = b.dueAt ? new Date(b.dueAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (dueAt && Number.isNaN(dueAt.getTime()))) return badRequest(res, "Invalid date");
    if (dueAt && dueAt <= startsAt) return badRequest(res, "The due date must be after the start");

    const assignment = await getAssignment(req.db).create({
      setId, groupClassIds, studentIds, createdBy: who(req), startsAt, dueAt,
      chapters: toInt(b.chapters, "chapters", { min: 1, max: CHAPTER_COUNT, default: CHAPTER_COUNT }),
      maxPlaysPerDay: toInt(b.maxPlaysPerDay, "maxPlaysPerDay", { min: 1, max: 20, default: 3 }),
    });
    return created(res, { data: assignment, message: "Given to your students" });
  } catch (err) { return fail(res, err, "assign"); }
});

router.patch("/assignments/:id", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const a = await getAssignment(req.db).findOne({ _id: req.params.id, ...mine(req) });
    if (!a) return notFound(res, "Assignment not found");
    const b = req.body || {};
    if (typeof b.active === "boolean") a.active = b.active;
    if (b.dueAt !== undefined) {
      const dueAt = b.dueAt ? new Date(b.dueAt) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) return badRequest(res, "Invalid date");
      a.dueAt = dueAt;
    }
    if (b.maxPlaysPerDay !== undefined) a.maxPlaysPerDay = toInt(b.maxPlaysPerDay, "maxPlaysPerDay", { min: 1, max: 20 });
    await a.save();
    return ok(res, { data: a, message: "Saved" });
  } catch (err) { return fail(res, err, "update assignment"); }
});

// POST /assignments/:id/links — personal play links for the game's managed
// (no-login) students: makes the missing ones, returns them all. Students who
// log in use the game's own address instead (the teacher's screen builds it).
router.post("/assignments/:id/links", validateObjectId("id"), ...staff, async (req, res) => {
  try {
    const a = await getAssignment(req.db).findOne({ _id: req.params.id, ...mine(req) }).lean();
    if (!a) return notFound(res, "Assignment not found");
    const classes = await getGroupClass(req.db).find({ _id: { $in: a.groupClassIds } }).select("enrollments.studentId").lean();
    const ids = [...a.studentIds, ...classes.flatMap((g) => (g.enrollments || []).map((e) => e.studentId))];
    const managed = await getStudent(req.db).find({ _id: { $in: ids }, isManaged: true }).sort({ firstName: 1 }).limit(500).select("firstName lastName").lean();

    // The teacher whose name the student confirms: whoever gave the game, or
    // (for an admin's game) the student's own teacher
    const teacherFor = new Map();
    if (a.createdBy?.role === "teacher") managed.forEach((s) => teacherFor.set(String(s._id), a.createdBy.id));
    else {
      const pairs = await getTeacherAssignment(req.db).find({ studentId: { $in: managed.map((s) => s._id) } }).sort({ createdAt: 1 }).select("studentId teacherId").lean();
      pairs.forEach((p) => { if (!teacherFor.has(String(p.studentId))) teacherFor.set(String(p.studentId), p.teacherId); });
    }

    const L = getGameLink(req.db);
    const existing = await L.find({ assignmentId: a._id, studentId: { $in: managed.map((s) => s._id) } }).select("studentId +shareLink.tokenEnc").lean();
    const tokenFor = new Map();
    existing.forEach((l) => { try { tokenFor.set(String(l.studentId), decrypt(l.shareLink.tokenEnc)); } catch { /* replaced below */ } });
    for (const s of managed) {
      const teacherId = teacherFor.get(String(s._id));
      if (tokenFor.has(String(s._id)) || !teacherId) continue;
      const doc = new L({ assignmentId: a._id, studentId: s._id, teacherId });
      const token = issueShareLink(doc);
      await L.updateOne({ assignmentId: a._id, studentId: s._id }, { $set: { teacherId, shareLink: doc.shareLink } }, { upsert: true });
      tokenFor.set(String(s._id), token);
    }

    return ok(res, {
      data: managed.map((s) => ({
        studentId: s._id,
        name: `${s.firstName} ${s.lastName || ""}`.trim(),
        token: tokenFor.get(String(s._id)) || null, // null: no teacher to check the name against
      })),
    });
  } catch (err) { return fail(res, err, "game links"); }
});

export default router;
