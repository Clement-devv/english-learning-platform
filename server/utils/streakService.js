// server/utils/streakService.js
// Authoritative streak tracking for both daily activity streaks and weekly class streaks.
//
// DAILY STREAK (currentStreak):
//   Increments when a student does ANY learning activity on a new calendar day.
//   Activities: class completion, quiz attempt, homework submission, flashcard review.
//   Logic: Duolingo-style consecutive-day streak with optional streak freeze.
//
// WEEKLY CLASS STREAK (weeklyClassStreak):
//   Increments when a student completes at least one class in a consecutive calendar week.
//   Uses ISO week numbers (Mon–Sun).
//
// Both functions are idempotent — safe to call multiple times per day/week.
// Both are fire-and-forget safe — callers should .catch() errors so they never
// block the main response.

import { studentSchema } from "../schemas/studentSchema.js";

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns midnight UTC for any date */
function toMidnightUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** ISO week string e.g. "2026-W13" */
function isoWeek(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  // Thursday of the current week determines the year
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const weekNum = Math.round(
    ((d - yearStart) / 86400000 - 3 + ((yearStart.getUTCDay() + 6) % 7)) / 7
  ) + 1;
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Previous ISO week string */
function prevIsoWeek(weekStr) {
  // Parse e.g. "2026-W13" → go back 7 days from any day in that week
  const [year, w] = weekStr.split("-W");
  const jan4 = new Date(Date.UTC(Number(year), 0, 4));
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7; // 0=Mon
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - dayOfWeek + (Number(w) - 1) * 7);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  return isoWeek(weekStart);
}

/** Keep activityDates to last 30 unique days, sorted desc */
function pruneActivityDates(dates, today) {
  const todayStr = today.toISOString().slice(0, 10);
  const unique = new Map();
  for (const d of dates) {
    const s = new Date(d).toISOString().slice(0, 10);
    if (!unique.has(s)) unique.set(s, new Date(d));
  }
  unique.set(todayStr, today);
  return [...unique.values()]
    .sort((a, b) => b - a)
    .slice(0, 30);
}

// ── recordActivity ────────────────────────────────────────────────────────────
/**
 * Call after ANY learning activity (quiz, homework, flashcard, class).
 * Updates the daily consecutive streak.
 *
 * @param {Object} db         - per-center Mongoose connection (req.db)
 * @param {string} studentId  - student _id string
 */
export async function recordActivity(db, studentId) {
  const Student = getStudent(db);
  const student = await Student.findById(studentId);
  if (!student) return;

  const today     = toMidnightUTC();
  const todayStr  = today.toISOString().slice(0, 10);
  const lastDate  = student.lastActivityDate ? toMidnightUTC(student.lastActivityDate) : null;
  const lastStr   = lastDate ? lastDate.toISOString().slice(0, 10) : null;

  // Already recorded today — idempotent, just update activityDates
  if (lastStr === todayStr) {
    student.activityDates = pruneActivityDates(student.activityDates, today);
    await student.save();
    return { incremented: false, newStreak: student.currentStreak, usedFreeze: false };
  }

  const yesterday = toMidnightUTC();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const twoDaysAgo = toMidnightUTC();
  twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

  let usedFreeze = false;

  if (lastStr === yesterdayStr) {
    // Consecutive day — extend streak
    student.currentStreak += 1;
  } else if (lastStr === twoDaysAgoStr && student.streakFreezes > 0) {
    // Missed exactly one day — burn a freeze
    student.streakFreezes  -= 1;
    student.currentStreak  += 1;
    usedFreeze = true;
    console.log(`[Streak] Freeze used for student ${studentId}. Freezes left: ${student.streakFreezes}`);
  } else {
    // Streak broken — reset
    if (student.currentStreak > 0) {
      console.log(`[Streak] Streak broken for student ${studentId}. Was ${student.currentStreak}.`);
    }
    student.currentStreak = 1;
  }

  if (student.currentStreak > student.longestStreak) {
    student.longestStreak = student.currentStreak;
  }

  student.lastActivityDate = today;
  student.activityDates    = pruneActivityDates(student.activityDates, today);

  await student.save();
  console.log(`[Streak] Student ${studentId} daily streak → ${student.currentStreak}`);
  return { incremented: true, newStreak: student.currentStreak, usedFreeze };
}

// ── recordClassCompletion ─────────────────────────────────────────────────────
/**
 * Call after a class is successfully completed (not missed).
 * Updates the weekly class streak independently of the daily streak.
 *
 * @param {Object} db         - per-center Mongoose connection (req.db)
 * @param {string} studentId  - student _id string
 */
export async function recordClassCompletion(db, studentId) {
  const Student  = getStudent(db);
  const student  = await Student.findById(studentId);
  if (!student) return;

  const thisWeek = isoWeek();
  const lastWeek = student.lastClassWeek;

  if (lastWeek === thisWeek) {
    // Already counted this week — idempotent
    return;
  }

  if (lastWeek === prevIsoWeek(thisWeek)) {
    // Consecutive week
    student.weeklyClassStreak += 1;
  } else {
    // Gap — reset
    student.weeklyClassStreak = 1;
  }

  if (student.weeklyClassStreak > student.longestWeeklyClassStreak) {
    student.longestWeeklyClassStreak = student.weeklyClassStreak;
  }

  student.lastClassWeek = thisWeek;
  await student.save();
  console.log(`[Streak] Student ${studentId} weekly class streak → ${student.weeklyClassStreak} (${thisWeek})`);
}
