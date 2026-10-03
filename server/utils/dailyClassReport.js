// server/utils/dailyClassReport.js
// Daily completed-classes report for admins (the admin "Class Report" tab, its
// PDF download, and the email sent every day after midnight in the school's
// time zone).
//
// A report covers one LOCAL day (00:00 → 24:00 in the school's time zone):
//   1. Completed classes   — grouped by teacher (A→Z by first name), then time
//   2. Not completed       — same grouping, with the reason
// Classes from EARLIER days whose outcome changed on this day (a parent
// dispute upheld, an admin penalty, a dispute won by the teacher…) are listed
// in the section matching their NEW outcome, marked as a change with the
// original class date — red when a completed class became not completed.

import PDFDocument from "pdfkit";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { groupClassSchema } from "../schemas/groupClassSchema.js";

const getBooking    = (db) => db.models.Booking    || db.model("Booking",    bookingSchema);
const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);

// ── Time zone helpers ─────────────────────────────────────────────────────────

/** A valid IANA time zone, or "UTC" */
export function safeTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz || "UTC" });
    return tz || "UTC";
  } catch {
    return "UTC";
  }
}

/** Milliseconds the zone is ahead of UTC at that instant */
function tzOffsetMs(date, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).map(p => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of local midnight for YYYY-MM-DD in tz (DST-safe) */
function localMidnight(y, m, d, tz) {
  const guess = Date.UTC(y, m - 1, d);
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz); // second pass handles DST edges
  return new Date(t);
}

/** { start, end } covering the whole local day YYYY-MM-DD */
export function localDayRange(dateStr, tz) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return {
    start: localMidnight(y, m, d, tz),
    end:   localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz),
  };
}

/** YYYY-MM-DD of an instant in tz */
export function localDateStr(date, tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Yesterday's local date (YYYY-MM-DD) in tz */
export function yesterdayInZone(tz, now = new Date()) {
  const [y, m, d] = localDateStr(now, tz).split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

export const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));

const fmtTime = (date, tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const fmtDay  = (date, tz) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
const fmtDayLong = (dateStr) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateStr}T12:00:00Z`));

// ── Report data ───────────────────────────────────────────────────────────────

const SOURCE_LABEL = { admin: "Admin", dispute: "Dispute decision", parent: "Parent report", system: "System" };
const fullName = (p) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "") || "Unknown";

/** Why a class did not count as completed */
function notCompletedReason(b, now) {
  if (b.status === "completed" && b.adminRejected) return `Completion removed${b.adminRejectedReason ? `: ${b.adminRejectedReason}` : ""}`;
  if (b.status === "missed")    return b.missedReason ? `Missed: ${b.missedReason}` : "Missed — attendance requirement not met";
  if (b.status === "cancelled") return `Cancelled${b.notes ? `: ${b.notes}` : ""}`;
  if (b.status === "rejected")  return b.rejectionReason || "Logged class not approved";
  if (b.status === "pending_confirmation") return "Awaiting confirmation / approval";
  if (b.status === "accepted" && new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000 < now) return "No result recorded";
  return b.status;
}

function toRow(b, tz, change, now) {
  const completed = b.status === "completed" && !b.adminRejected;
  return {
    id:          String(b._id),
    time:        b.scheduledTime,
    timeLabel:   fmtTime(b.scheduledTime, tz),
    classDate:   fmtDay(b.scheduledTime, tz),
    classTitle:  b.classTitle || "Class",
    duration:    b.duration || 60,
    teacherId:   String(b.teacherId?._id || b.teacherId || ""),
    teacherFirst: b.teacherId?.firstName || "",
    teacherLast:  b.teacherId?.lastName  || "",
    teacherName: fullName(b.teacherId),
    studentName: fullName(b.studentId),
    studentFirst: b.studentId?.firstName || "",
    summary:     completed ? (b.classSummary?.text || "") : "",   // teacher's class summary (copy for parent)
    outcome:     completed ? "completed" : "not_completed",
    reason:      completed ? "" : notCompletedReason(b, now),
    note:        completed && b.disputeStatus === "pending" ? "Dispute open — awaiting admin decision" : "",
    platform:    b.loggedByTeacher ? `Logged by teacher (${b.offline?.platform || "external"})` : "",
    change: change ? {
      to:        change.to,
      at:        change.at,
      atLabel:   `${fmtDay(change.at, tz)} ${fmtTime(change.at, tz)}`,
      source:    SOURCE_LABEL[change.source] || "System",
      reason:    change.reason || "",
      pastClass: new Date(b.scheduledTime) < change.windowStart,
    } : null,
  };
}

/** A group class as a report row (students listed, absentees named) */
function groupClassToRow(gc, tz, now) {
  const enrolled = gc.enrollments || [];
  const names = (list) => list.map(e => fullName(e.studentId)).join(", ");
  const attended = enrolled.filter(e => e.attendance === "attended");
  const absent   = enrolled.filter(e => e.attendance === "absent");
  const unmarked = enrolled.filter(e => e.attendance !== "attended" && e.attendance !== "absent");

  const completed = gc.status === "completed";
  let reason = "";
  if (!completed) {
    if (gc.status === "cancelled") reason = `Cancelled${gc.cancelReason ? `: ${gc.cancelReason}` : ""}`;
    else if (new Date(gc.scheduledTime).getTime() + (gc.duration || 60) * 60000 < now) reason = "No result recorded";
    else reason = gc.status;
  }

  const studentName = enrolled.length === 0
    ? "Group class · no students enrolled"
    : completed && (attended.length || absent.length)
      ? `Group class · ${attended.length} of ${enrolled.length} attended${attended.length ? `: ${names(attended)}` : ""}`
      : `Group class · ${enrolled.length} student${enrolled.length !== 1 ? "s" : ""}: ${names(enrolled)}`;
  const note = completed
    ? [absent.length ? `Absent: ${names(absent)}` : "", unmarked.length ? `Attendance not marked: ${names(unmarked)}` : ""].filter(Boolean).join(" · ")
    : "";

  return {
    id:          `g-${gc._id}`,
    kind:        "group",
    time:        gc.scheduledTime,
    timeLabel:   fmtTime(gc.scheduledTime, tz),
    classDate:   fmtDay(gc.scheduledTime, tz),
    classTitle:  `${gc.title || "Group class"}${gc.level ? ` (${gc.level})` : ""}`,
    duration:    gc.duration || 60,
    teacherId:   String(gc.teacherId?._id || gc.teacherId || ""),
    teacherFirst: gc.teacherId?.firstName || "",
    teacherLast:  gc.teacherId?.lastName  || "",
    teacherName: fullName(gc.teacherId),
    studentName,
    studentFirst: studentName,
    summary:     gc.status === "completed" ? (gc.classSummary?.text || "") : "",   // teacher's class summary (copy for parent)
    outcome:     completed ? "completed" : "not_completed",
    reason,
    note,
    platform:    "",
    change:      null,
  };
}

/** Group rows by teacher — A→Z by first name, then last name — then by time */
function groupByTeacher(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.teacherId)) map.set(r.teacherId, { teacherId: r.teacherId, teacherName: r.teacherName, first: r.teacherFirst, last: r.teacherLast, rows: [] });
    map.get(r.teacherId).rows.push(r);
  }
  const cmp = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return [...map.values()]
    .sort((a, b) => cmp(a.first, b.first) || cmp(a.last, b.last))
    .map(g => ({ ...g, rows: g.rows.sort((x, y) => new Date(x.time) - new Date(y.time)) }));
}

/**
 * Build the report for one local day.
 * @param {object} db         center connection
 * @param {object} opts
 * @param {string} opts.date  YYYY-MM-DD (local to tz)
 * @param {string} opts.tz    IANA time zone of the school
 */
export async function buildDailyClassReport(db, { date, tz }) {
  tz = safeTimeZone(tz);
  const { start, end } = localDayRange(date, tz);
  const now = Date.now();
  getTeacher(db); getStudent(db);
  const Booking = getBooking(db);
  const pop = (q) => q.populate("teacherId", "firstName lastName").populate("studentId", "firstName lastName").lean();

  const [dayClasses, changedEarlier, groupClasses] = await Promise.all([
    pop(Booking.find({
      scheduledTime: { $gte: start, $lt: end },
      $or: [
        { status: { $in: ["completed", "missed", "cancelled", "pending_confirmation", "accepted"] } },
        { status: "rejected", loggedByTeacher: true },
      ],
    })),
    // Earlier classes whose outcome changed during this day
    pop(Booking.find({
      scheduledTime: { $lt: start },
      outcomeChanges: { $elemMatch: { at: { $gte: start, $lt: end } } },
    })),
    // Group classes held this day (one teacher, several students)
    getGroupClass(db).find({ scheduledTime: { $gte: start, $lt: end } })
      .populate("teacherId", "firstName lastName")
      .populate("enrollments.studentId", "firstName lastName")
      .lean(),
  ]);

  const lastChangeInDay = (b) => {
    const inDay = (b.outcomeChanges || []).filter(c => new Date(c.at) >= start && new Date(c.at) < end);
    const last = inDay.sort((a, c) => new Date(a.at) - new Date(c.at)).pop();
    return last ? { ...last, windowStart: start } : null;
  };

  const rows = [];
  for (const b of dayClasses) {
    // Upcoming / not yet finished classes are not part of a day report
    if (b.status === "accepted" && new Date(b.scheduledTime).getTime() + (b.duration || 60) * 60000 > now) continue;
    rows.push(toRow(b, tz, lastChangeInDay(b), now));
  }
  for (const b of changedEarlier) rows.push(toRow(b, tz, lastChangeInDay(b), now));
  for (const gc of groupClasses) {
    // Still open for enrolment / not finished yet → not part of the day's results
    const ended = new Date(gc.scheduledTime).getTime() + (gc.duration || 60) * 60000 <= now;
    if (!ended && !["completed", "cancelled"].includes(gc.status)) continue;
    rows.push(groupClassToRow(gc, tz, now));
  }

  const completed    = rows.filter(r => r.outcome === "completed");
  const notCompleted = rows.filter(r => r.outcome === "not_completed");

  return {
    date, tz,
    dateLabel: fmtDayLong(date),
    start, end,
    counts: {
      completed:      completed.filter(r => !r.change?.pastClass).length,
      notCompleted:   notCompleted.filter(r => !r.change?.pastClass).length,
      changedToCompleted:    rows.filter(r => r.change?.pastClass && r.change.to === "completed").length,
      changedToNotCompleted: rows.filter(r => r.change?.pastClass && r.change.to === "not_completed").length,
      teachers: new Set(rows.map(r => r.teacherId)).size,
    },
    completed:    groupByTeacher(completed),
    notCompleted: groupByTeacher(notCompleted),
  };
}

/** Counts for a set of teacher groups (same meaning as report.counts) */
function countGroups(completed, notCompleted) {
  const rows = [...completed, ...notCompleted].flatMap(g => g.rows);
  const past = (r) => r.change?.pastClass;
  return {
    completed:             completed.flatMap(g => g.rows).filter(r => !past(r)).length,
    notCompleted:          notCompleted.flatMap(g => g.rows).filter(r => !past(r)).length,
    changedToCompleted:    rows.filter(r => past(r) && r.change.to === "completed").length,
    changedToNotCompleted: rows.filter(r => past(r) && r.change.to === "not_completed").length,
    teachers:              new Set(rows.map(r => r.teacherId)).size,
  };
}

/** Teachers who appear in a report (with any class or change that day) */
export function teachersInReport(report) {
  const map = new Map();
  for (const g of [...report.completed, ...report.notCompleted]) map.set(g.teacherId, g.teacherName);
  return [...map.entries()].map(([teacherId, teacherName]) => ({ teacherId, teacherName }));
}

/** The same report narrowed to one teacher's classes */
export function reportForTeacher(report, teacherId) {
  const keep = (groups) => groups.filter(g => String(g.teacherId) === String(teacherId));
  const completed = keep(report.completed);
  const notCompleted = keep(report.notCompleted);
  return { ...report, completed, notCompleted, counts: countGroups(completed, notCompleted) };
}

// ── PDF ───────────────────────────────────────────────────────────────────────

const A4_W = 595.28, A4_H = 841.89, M = 40;
// Widths add up to the printable A4 width (595 − 2 × 40 margin = 515)
const COLS = [
  { key: "timeLabel",   label: "Time",       w: 42 },
  { key: "teacherName", label: "Teacher",    w: 88 },
  { key: "studentName", label: "Student(s)", w: 112 },
  { key: "classTitle",  label: "Class",      w: 110 },
  { key: "duration",    label: "Min",        w: 28 },
  { key: "detail",      label: "Notes",      w: 135 },
];

/** Text describing an outcome change, e.g. for the red/green marker line */
export function changeText(row) {
  const c = row.change;
  if (!c) return "";
  const past = c.pastClass ? ` (class held ${row.classDate})` : "";
  return c.to === "not_completed"
    ? `CHANGED: was completed, turned NOT COMPLETED on ${c.atLabel}${past} — ${c.source}${c.reason ? `: ${c.reason}` : ""}`
    : `CHANGED: was not completed, turned COMPLETED on ${c.atLabel}${past} — ${c.source}${c.reason ? `: ${c.reason}` : ""}${c.pastClass ? " (dispute of a past date)" : ""}`;
}

/**
 * Render the report as a PDF Buffer.
 * @param {object} [opts]
 * @param {string} [opts.title]      heading, e.g. "Your classes — Alice Brown" (teacher copy)
 * @param {boolean} [opts.forTeacher] teacher copy: show total classes instead of teacher count
 */
export function renderDailyClassReportPdf(report, centerName = "", opts = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M, bufferPages: true });
    const chunks = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bottom = A4_H - M - 20;
    let y;

    // Header
    doc.rect(0, 0, A4_W, 92).fill("#4f46e5");
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(18).text(centerName || "Daily class report", M, 22, { width: A4_W - M * 2 });
    doc.font("Helvetica").fontSize(11).text(`${opts.title || "Completed classes report"} — ${report.dateLabel}`, M, 48);
    doc.fontSize(8.5).fillColor("#e0e7ff").text(`12:00 AM – 11:59 PM, time zone ${report.tz} · generated ${new Date().toUTCString()}`, M, 66);
    y = 108;

    // Summary
    const c = report.counts;
    const boxes = [
      ["Completed", c.completed, "#059669"],
      ["Not completed", c.notCompleted, "#dc2626"],
      ["Earlier classes changed", c.changedToCompleted + c.changedToNotCompleted, "#b45309"],
      opts.forTeacher
        ? ["Total classes", c.completed + c.notCompleted, "#4f46e5"]
        : ["Teachers", c.teachers, "#4f46e5"],
    ];
    const bw = (A4_W - M * 2 - 30) / 4;
    boxes.forEach(([label, val, color], i) => {
      const x = M + i * (bw + 10);
      doc.roundedRect(x, y, bw, 46, 6).fill("#f8fafc");
      doc.fillColor(color).font("Helvetica-Bold").fontSize(18).text(String(val), x + 10, y + 6, { width: bw - 20 });
      doc.fillColor("#475569").font("Helvetica").fontSize(8).text(label, x + 10, y + 30, { width: bw - 20 });
    });
    y += 64;

    const ensure = (h) => {
      if (y + h > bottom) { doc.addPage(); y = M; return true; }
      return false;
    };

    const tableHeader = () => {
      let x = M;
      doc.rect(M, y, A4_W - M * 2, 18).fill("#eef2ff");
      doc.fillColor("#3730a3").font("Helvetica-Bold").fontSize(8);
      for (const col of COLS) { doc.text(col.label, x + 4, y + 5, { width: col.w - 8 }); x += col.w; }
      y += 18;
    };

    const section = (title, color, groups, emptyText) => {
      ensure(40);
      doc.fillColor(color).font("Helvetica-Bold").fontSize(13).text(title, M, y);
      y += 20;
      if (!groups.length) {
        doc.fillColor("#94a3b8").font("Helvetica-Oblique").fontSize(9).text(emptyText, M, y);
        y += 22;
        return;
      }
      for (const g of groups) {
        ensure(60);
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(10.5)
          .text(`${g.teacherName}  ·  ${g.rows.length} class${g.rows.length !== 1 ? "es" : ""}`, M, y);
        y += 15;
        tableHeader();
        g.rows.forEach((r, i) => {
          const detail = [r.reason, r.note, r.platform].filter(Boolean).join(" · ") || (r.outcome === "completed" ? "Completed" : "");
          const cells = { ...r, duration: String(r.duration), detail };
          doc.font("Helvetica").fontSize(8.5);
          const rowH = Math.max(18, ...COLS.map(col => doc.heightOfString(String(cells[col.key] ?? ""), { width: col.w - 8 }) + 8));
          const changeLine = changeText(r);
          const changeH = changeLine ? doc.heightOfString(changeLine, { width: A4_W - M * 2 - 16 }) + 8 : 0;
          if (ensure(rowH + changeH)) tableHeader();

          if (i % 2 === 1) doc.rect(M, y, A4_W - M * 2, rowH + changeH).fill("#f8fafc");
          if (r.change) {
            const mark = r.change.to === "not_completed" ? "#dc2626" : "#059669";
            doc.rect(M, y, 3, rowH + changeH).fill(mark); // coloured marker bar
          }
          let x = M;
          doc.fillColor("#1e293b").font("Helvetica").fontSize(8.5);
          for (const col of COLS) { doc.text(String(cells[col.key] ?? ""), x + 4, y + 4, { width: col.w - 8 }); x += col.w; }
          y += rowH;
          if (changeLine) {
            doc.fillColor(r.change.to === "not_completed" ? "#dc2626" : "#047857").font("Helvetica-Bold").fontSize(8)
              .text(changeLine, M + 8, y + 2, { width: A4_W - M * 2 - 16 });
            y += changeH;
          }
          doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(M, y).lineTo(A4_W - M, y).stroke();
        });
        y += 12;
      }
    };

    section("Completed classes", "#059669", report.completed, "No completed classes on this day.");
    y += 6;
    section("Not completed", "#dc2626", report.notCompleted, "No unsuccessful classes on this day.");

    // Footer: page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // footer sits in the margin — don't trigger a new page
      doc.fillColor("#94a3b8").font("Helvetica").fontSize(8)
        .text(`${centerName ? `${centerName} · ` : ""}${report.dateLabel} · page ${i + 1} of ${range.count}`, M, A4_H - M + 6, { width: A4_W - M * 2, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
