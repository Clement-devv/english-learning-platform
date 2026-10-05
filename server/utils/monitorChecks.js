// server/utils/monitorChecks.js
// The App Health checks. Once a minute (first server worker only):
//   1. Read the last hour of events (utils/monitor.js) — one indexed query.
//   2. Every 10 minutes, look inside each center for booking/class problems:
//      requests nobody answered for 24h, classes nobody joined.
//   3. Turn it all into green / amber / red checks, saved to MonitorState "status"
//      so every worker (and the dashboard) reads the same answer.
//   4. A check that's red twice in a row opens an alert → email + WhatsApp.
//      It's re-sent every 6 hours while still red (unless acknowledged) and a
//      "fixed" message goes out when it recovers.
import mongoose from "mongoose";
import Center from "../models/master/Center.js";
import MonitorEvent from "../models/master/MonitorEvent.js";
import MonitorAlert from "../models/master/MonitorAlert.js";
import MonitorState from "../models/master/MonitorState.js";
import { getDb } from "../config/dbManager.js";
import redisClient from "../config/redis.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { emailHealth } from "../emails/core.js";
import { jobsSnapshot } from "./monitor.js";
import { notifySuperAdmin } from "./alertNotifier.js";
import logger from "./logger.js";

const CHECK_EVERY_MS = 60_000;
const SCAN_EVERY_MS = 10 * 60_000;
const RENOTIFY_MS = 6 * 60 * 60_000;
const FAILS_BEFORE_ALERT = 2;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const RANK = { ok: 0, warn: 1, fail: 2 };
const worst = (...s) => s.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : /(s|sh|ch)$/.test(w) ? "es" : "s"}`;
const name = (p) => p ? (`${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unnamed") : "Unknown";

// ── Inside each center (every 10 min) ─────────────────────────────────────────
let lastScan = null;

async function scanCenter(center, now) {
  const started = Date.now();
  const db = await getDb(center.slug);
  const Booking = db.models.Booking || db.model("Booking", bookingSchema);
  const Teacher = db.models.Teacher || db.model("Teacher", teacherSchema);
  const Student = db.models.Student || db.model("Student", studentSchema);

  const [unanswered, expired, missed] = await Promise.all([
    // Requests still waiting for the teacher after 24h (class still ahead)
    Booking.find({ status: "pending", createdAt: { $lt: new Date(now - DAY) }, scheduledTime: { $gt: new Date(now) } })
      .select("teacherId studentId scheduledTime createdAt").limit(300).lean(),
    // Requests the teacher never answered before the class time passed (last 7 days)
    Booking.countDocuments({ status: "pending", scheduledTime: { $lt: new Date(now), $gt: new Date(now - 7 * DAY) } }),
    // Classes nobody (or one side) joined in the last 7 days
    Booking.find({ status: "missed", scheduledTime: { $gt: new Date(now - 7 * DAY) } })
      .select("teacherId studentId scheduledTime missedReason").limit(1000).lean(),
  ]);

  const count = (list, key) => {
    const m = new Map();
    for (const b of list) { const id = b[key] && String(b[key]); if (id) m.set(id, (m.get(id) || 0) + 1); }
    return m;
  };
  const teacherNoShow = missed.filter(b => /^(Teacher did not|Neither)/.test(b.missedReason || ""));
  const studentNoShow = missed.filter(b => /^(Student did not|Neither)/.test(b.missedReason || ""));
  const slowTeachers = [...count(unanswered, "teacherId")].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const absentTeachers = [...count(teacherNoShow, "teacherId")].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const absentStudents = [...count(studentNoShow, "studentId")].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const tIds = [...new Set([...slowTeachers, ...absentTeachers].map(([id]) => id))];
  const sIds = absentStudents.map(([id]) => id);
  const [teachers, students] = await Promise.all([
    tIds.length ? Teacher.find({ _id: { $in: tIds } }).select("firstName lastName teacherCode").lean() : [],
    sIds.length ? Student.find({ _id: { $in: sIds } }).select("firstName lastName studentId isManaged").lean() : [],
  ]);
  const tMap = new Map(teachers.map(t => [String(t._id), t]));
  const sMap = new Map(students.map(s => [String(s._id), s]));
  const person = (role, id, p) => ({ role, id, name: name(p), code: role === "teacher" ? p?.teacherCode || null : p?.studentId || null });

  return {
    slug: center.slug, centerName: center.centerName, ok: true, ms: Date.now() - started,
    unanswered: unanswered.length, expired,
    missed24h: missed.filter(b => new Date(b.scheduledTime).getTime() > now - DAY).length,
    missed7d: missed.length,
    people: [
      ...slowTeachers.map(([id, n]) => ({ ...person("teacher", id, tMap.get(id)), issue: "unanswered-requests", count: n, text: `${plural(n, "class request")} waiting over 24h for an answer` })),
      ...absentTeachers.map(([id, n]) => ({ ...person("teacher", id, tMap.get(id)), issue: "teacher-no-show", count: n, text: `Didn't join ${plural(n, "class")} in the last 7 days` })),
      ...absentStudents.map(([id, n]) => ({ ...person("student", id, sMap.get(id)), issue: "student-no-show", count: n, text: `Missed ${plural(n, "class")} in the last 7 days` })),
    ],
  };
}

async function scanCenters(now) {
  const centers = await Center.find({ status: "active" }).select("slug centerName").lean();
  const results = [];
  for (let i = 0; i < centers.length; i += 10) {
    const batch = centers.slice(i, i + 10);
    const settled = await Promise.allSettled(batch.map(c => scanCenter(c, now)));
    settled.forEach((r, j) => results.push(r.status === "fulfilled" ? r.value
      : { slug: batch[j].slug, centerName: batch[j].centerName, ok: false, error: String(r.reason?.message || r.reason).slice(0, 200), people: [] }));
  }
  lastScan = { at: new Date(now), centers: results };
  return lastScan;
}

// ── Event totals for one kind ─────────────────────────────────────────────────
function totals(rows, kind, actions) {
  const t = { total: 0, ok: 0, user: 0, system: 0, locked: 0, wrong: 0, byAction: {} };
  for (const r of rows) {
    if (r._id.kind !== kind || (actions && !actions.includes(r._id.action))) continue;
    const a = (t.byAction[r._id.action] ||= { total: 0, failed: 0, system: 0 });
    t.total += r.n; a.total += r.n;
    if (r._id.ok) { t.ok += r.n; continue; }
    a.failed += r.n;
    if (r._id.status >= 500) { t.system += r.n; a.system += r.n; }
    else {
      t.user += r.n;
      if (r._id.status === 429) t.locked += r.n;
      if (r._id.status === 401) t.wrong += r.n;
    }
  }
  return t;
}

/** "Class reminder — 3 failed (sunshine): Resend: daily quota exceeded" */
function failureLines(fails, kind, max = 5) {
  const groups = new Map();
  for (const f of fails) {
    if (f.kind !== kind) continue;
    const k = `${f.action}|${f.msg}`;
    const g = groups.get(k) || { action: f.action, msg: f.msg, n: 0, centers: new Set(), status: f.status };
    g.n++; if (f.center) g.centers.add(f.center);
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => b.n - a.n).slice(0, max).map(g =>
    `${g.action} — ${g.n} failed${g.status ? ` (HTTP ${g.status})` : ""}${g.centers.size ? ` · ${[...g.centers].slice(0, 3).join(", ")}${g.centers.size > 3 ? "…" : ""}` : ""}${g.msg ? `: ${g.msg}` : ""}`);
}

/** Generic "this feature worked / failed" check. */
function actionCheck(key, title, t, fails, kind, { failAt = 3, extra = [], extraStatus = "ok", noun = "action" } = {}) {
  let status = t.system >= failAt ? "fail" : t.system >= 1 ? "warn" : "ok";
  status = worst(status, extraStatus);
  const parts = [`${plural(t.total, noun)} in the last hour`];
  if (t.system) parts.push(`${t.system} failed on our side`);
  if (t.user) parts.push(`${t.user} refused (user problem)`);
  return { key, title, status, summary: parts.join(" · "), details: [...extra, ...failureLines(fails, kind)], numbers: { total: t.total, system: t.system, user: t.user } };
}

// ── The run ───────────────────────────────────────────────────────────────────
const failStreak = new Map();
let running = false;
// Jobs and alerts live on the worker that runs the schedulers. A "run now"
// that lands on another worker reuses the last jobs result and sends no alerts.
let schedulerWorker = false;

export async function runChecks({ forceScan = false } = {}) {
  if (running || mongoose.connection.readyState !== 1) return null;
  running = true;
  const now = Date.now();
  try {
    // Master DB round trip
    let dbMs = null, dbError = null;
    try { const t0 = Date.now(); await mongoose.connection.db.admin().ping(); dbMs = Date.now() - t0; }
    catch (err) { dbError = err?.message || "ping failed"; }
    let redis = "not used";
    if (redisClient) {
      try { const t0 = Date.now(); await redisClient.ping(); redis = `${Date.now() - t0}ms`; }
      catch (err) { redis = `down: ${err?.message}`; }
    }

    const since = new Date(now - HOUR);
    const [rows, fails, recentServerErrors] = await Promise.all([
      MonitorEvent.aggregate([
        { $match: { at: { $gte: since } } },
        { $group: { _id: { kind: "$kind", action: "$action", ok: "$ok", status: "$status" }, n: { $sum: 1 } } },
      ]),
      MonitorEvent.find({ ok: false, at: { $gte: since } }).sort({ at: -1 }).limit(300)
        .select("kind action msg center status").lean(),
      MonitorEvent.countDocuments({ status: { $gte: 500 }, at: { $gte: new Date(now - 15 * 60_000) } }),
    ]);

    const scan = (forceScan || !lastScan || now - lastScan.at.getTime() >= SCAN_EVERY_MS) ? await scanCenters(now) : lastScan;
    const centersDown = scan.centers.filter(c => !c.ok);
    const sum = (k) => scan.centers.reduce((a, c) => a + (c[k] || 0), 0);
    const checks = [];

    // 1. Emails
    {
      const t = totals(rows, "email");
      const failed = t.total - t.ok;
      let status = failed >= 5 || (failed >= 2 && failed / Math.max(t.total, 1) >= 0.2) ? "fail" : failed >= 1 ? "warn" : "ok";
      const details = failureLines(fails, "email");
      if (emailHealth.configured === false) { status = "fail"; details.unshift(`Email service not working: ${emailHealth.detail || "not configured"}`); }
      checks.push({ key: "email", title: "Emails", status,
        summary: `${t.ok} sent · ${failed} failed in the last hour${emailHealth.provider ? ` · via ${emailHealth.provider}` : ""}`,
        details, numbers: { sent: t.ok, failed } });
    }

    // 2. Logins
    {
      const t = totals(rows, "login");
      const loginT = totals(rows, "login", ["login", "login-2fa"]);
      let status = t.system >= 3 ? "fail" : (t.system >= 1 || t.locked >= 3 || (loginT.wrong >= 20 && loginT.wrong / Math.max(loginT.total, 1) >= 0.6)) ? "warn" : "ok";
      const extra = [];
      if (t.locked) extra.push(`${plural(t.locked, "attempt")} blocked for too many tries`);
      if (loginT.wrong >= 20) extra.push(`${loginT.wrong} wrong-password attempts — could be someone guessing passwords`);
      checks.push({ key: "logins", title: "Logins", status,
        summary: `${loginT.ok} signed in · ${loginT.wrong} wrong password · ${t.locked} locked out · ${t.system} server errors (last hour)`,
        details: [...extra, ...failureLines(fails.filter(f => f.status >= 500 || f.status === 429), "login")], numbers: { ok: loginT.ok, wrong: loginT.wrong, locked: t.locked, system: t.system } });
    }

    // 3. Bookings
    {
      const t = totals(rows, "booking");
      const unanswered = sum("unanswered"), expired = sum("expired");
      const extra = [];
      for (const c of scan.centers) {
        if (c.unanswered) extra.push(`${c.centerName}: ${plural(c.unanswered, "request")} unanswered for over 24h`);
        if (c.expired) extra.push(`${c.centerName}: ${plural(c.expired, "request")} never answered before class time (7 days)`);
      }
      const check = actionCheck("bookings", "Bookings", t, fails, "booking", { extra: extra.slice(0, 6), extraStatus: unanswered || expired ? "warn" : "ok", noun: "booking action" });
      check.summary += ` · ${unanswered} waiting > 24h`;
      check.numbers.unanswered = unanswered;
      checks.push(check);
    }

    // 4. Classes (joining, attendance, completing)
    {
      const t = totals(rows, "class");
      const missed24 = sum("missed24h");
      const joinT = totals(rows, "class", ["class-join", "class-open"]);
      const extra = scan.centers.filter(c => c.missed24h).map(c => `${c.centerName}: ${plural(c.missed24h, "class")} nobody fully attended (24h)`);
      const check = actionCheck("classes", "Classes", t, fails, "class", { failAt: 2, extra: extra.slice(0, 6), extraStatus: missed24 >= 3 ? "warn" : "ok", noun: "class action" });
      check.summary = `${joinT.ok} joins · ${joinT.system} join errors · ${missed24} missed classes (24h)`;
      check.numbers.missed24h = missed24;
      checks.push(check);
    }

    // 5. Homework, quizzes, class summaries
    checks.push(actionCheck("learning", "Homework & quizzes", totals(rows, "learning"), fails, "learning", { noun: "submission" }));

    // 6. Payments
    checks.push(actionCheck("payments", "Payments", totals(rows, "payment"), fails, "payment", { failAt: 2, noun: "payment action" }));

    // 7. Background jobs (reminders, reports, missed-class sweep…)
    if (!schedulerWorker) {
      const prev = await MonitorState.findById("status").select("checks").lean();
      const jobsCheck = prev?.checks?.find(c => c.key === "jobs");
      if (jobsCheck) checks.push(jobsCheck);
    } else {
      const { startedAt, jobs } = jobsSnapshot();
      const stale = [], erroring = [];
      for (const j of jobs) {
        if (!j.everyMs) continue;
        const limit = 3 * j.everyMs + 2 * 60_000;
        const last = j.lastRun ? new Date(j.lastRun).getTime() : startedAt;
        if (now - last > limit) stale.push(`${j.name}${j.center ? ` (${j.center})` : ""} hasn't run since ${j.lastRun ? new Date(j.lastRun).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "the server started"}`);
        if (j.lastErrorAt && now - new Date(j.lastErrorAt).getTime() < HOUR) erroring.push(`${j.name}${j.center ? ` (${j.center})` : ""}: ${j.lastError}`);
      }
      const status = stale.length ? "fail" : erroring.length ? "warn" : "ok";
      checks.push({ key: "jobs", title: "Background jobs", status,
        summary: jobs.length ? `${jobs.length} jobs · ${stale.length} stopped · ${erroring.length} with errors` : "No jobs registered on this server",
        details: [...stale, ...erroring].slice(0, 10), numbers: { jobs: jobs.length, stopped: stale.length, erroring: erroring.length } });
    }

    // 8. Databases
    {
      const status = dbError || centersDown.length ? "fail" : (dbMs > 800 || /^down/.test(redis)) ? "warn" : "ok";
      checks.push({ key: "database", title: "Databases", status,
        summary: dbError ? `Main database unreachable: ${dbError}` : `Main DB ${dbMs}ms · ${scan.centers.length - centersDown.length}/${scan.centers.length} center DBs OK · Redis ${redis}`,
        details: centersDown.map(c => `${c.centerName}: ${c.error}`), numbers: { dbMs, centersDown: centersDown.length } });
    }

    // 9. Errors (server crashes and pages crashing in browsers)
    {
      const crashes = totals(rows, "client", ["crash"]);
      const status = recentServerErrors >= 15 || crashes.total >= 20 ? "fail" : recentServerErrors >= 3 || crashes.total >= 3 ? "warn" : "ok";
      checks.push({ key: "errors", title: "Errors", status,
        summary: `${plural(recentServerErrors, "server error")} (15 min) · ${crashes.total} page crash${crashes.total === 1 ? "" : "es"} (1 hour)`,
        details: [...failureLines(fails, "request", 4), ...failureLines(fails, "client", 4)], numbers: { server15m: recentServerErrors, crashes: crashes.total } });
    }

    const overall = worst(...checks.map(c => c.status));
    await MonitorState.updateOne({ _id: "status" }, {
      $set: {
        computedAt: new Date(now), overall, checks,
        scan: { at: scan.at, centers: scan.centers.map(({ people, ...rest }) => rest), people: scan.centers.flatMap(c => (c.people || []).map(p => ({ ...p, center: c.slug, centerName: c.centerName }))) },
      },
    }, { upsert: true });

    if (schedulerWorker) await processAlerts(checks, now);
    return { overall, checks };
  } catch (err) {
    logger.error("App Health checks failed", { error: err?.message });
    return null;
  } finally {
    running = false;
  }
}

async function processAlerts(checks, now) {
  const open = await MonitorAlert.find({ status: "open" });
  const openByKey = new Map(open.map(a => [a.key, a]));

  for (const c of checks) {
    const streak = c.status === "fail" ? (failStreak.get(c.key) || 0) + 1 : 0;
    failStreak.set(c.key, streak);
    const alert = openByKey.get(c.key);

    if (c.status === "fail") {
      if (!alert && streak >= FAILS_BEFORE_ALERT) {
        const a = await MonitorAlert.create({ key: c.key, title: c.title, message: c.summary, details: c.details });
        const delivery = await notifySuperAdmin({ level: "fail", title: c.title, message: c.summary, details: c.details });
        await MonitorAlert.updateOne({ _id: a._id }, { $set: { delivery, lastNotifiedAt: new Date() }, $inc: { notifyCount: 1 } });
      } else if (alert) {
        const due = !alert.acknowledgedAt && now - new Date(alert.lastNotifiedAt || alert.openedAt).getTime() >= RENOTIFY_MS;
        const set = { message: c.summary, details: c.details };
        if (due) {
          set.delivery = await notifySuperAdmin({ level: "reminder", title: c.title, message: c.summary, details: c.details });
          set.lastNotifiedAt = new Date();
        }
        await MonitorAlert.updateOne({ _id: alert._id }, { $set: set, ...(due && { $inc: { notifyCount: 1 } }) });
      }
    } else if (alert) {
      await MonitorAlert.updateOne({ _id: alert._id }, { $set: { status: "resolved", resolvedAt: new Date() } });
      if (alert.notifyCount > 0) {
        await notifySuperAdmin({ level: "resolved", title: c.title, message: `Back to normal. ${c.summary}` }).catch(() => {});
      }
    }
  }
}

export function startMonitorChecks() {
  schedulerWorker = true;
  setTimeout(() => runChecks({ forceScan: true }), 20_000).unref();
  setInterval(() => runChecks(), CHECK_EVERY_MS).unref();
  logger.info("🩺 App Health checks started (every 60s)");
}
