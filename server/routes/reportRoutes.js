// server/routes/reportRoutes.js
// Admin / teacher can preview or manually send a progress report for any student.
//
// GET  /api/reports/preview/:studentId?period=monthly&month=2026-02
//      → streams the PDF directly (opens in browser / downloads)
//
// POST /api/reports/send/:studentId?period=monthly&month=2026-02
//      → generates PDF and emails it to the student immediately

import express  from "express";
import Student  from "../models/Student.js";
import Teacher  from "../models/Teacher.js";
import Booking  from "../models/Booking.js";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { generateProgressReport }  from "../utils/progressReportGenerator.js";
import { sendProgressReport }      from "../utils/emailService.js";

const router = express.Router();

// ── Parse date window from query params ───────────────────────────────────────
// period = "weekly"  → needs ?week=2026-W10  (ISO week) or defaults to last 7 days
// period = "monthly" → needs ?month=2026-02  or defaults to last month
function parseDateRange(period, query) {
  const now = new Date();

  if (period === "weekly") {
    if (query.week) {
      // parse "2026-W10" → Monday of that week
      const [yr, wStr] = query.week.split("-W");
      const week  = parseInt(wStr, 10);
      const year  = parseInt(yr, 10);
      // Jan 4 is always in week 1 (ISO 8601)
      const jan4  = new Date(year, 0, 4);
      const monday = new Date(jan4.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // back to Monday
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { from: monday, to: sunday };
    }
    // default: last 7 days
    const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  // monthly
  if (query.month) {
    const [yr, mo] = query.month.split("-").map(Number);
    return {
      from: new Date(yr, mo - 1, 1),
      to:   new Date(yr, mo,     1),
    };
  }
  // default: last month
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth(),     1),
  };
}

// ── Primary teacher helper ────────────────────────────────────────────────────
async function primaryTeacher(studentId) {
  const last = await Booking.findOne({ studentId, status: "completed" })
    .sort({ scheduledTime: -1 })
    .populate("teacherId", "firstName lastName");
  return last?.teacherId ?? null;
}

// ── GET /api/reports/preview/:studentId ──────────────────────────────────────
router.get(
  "/preview/:studentId",
  verifyToken,
  verifyAdminOrTeacher,
  async (req, res) => {
    try {
      const student = await Student.findById(req.params.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const period  = req.query.period === "weekly" ? "weekly" : "monthly";
      const { from, to } = parseDateRange(period, req.query);
      const teacher = await primaryTeacher(student._id);
      const pdf     = await generateProgressReport(student, teacher, from, to, period);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="progress-${student._id}-${from.toISOString().slice(0, 10)}.pdf"`
      );
      res.send(pdf);
    } catch (err) {
      console.error("Report preview error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ── POST /api/reports/send/:studentId ────────────────────────────────────────
router.post(
  "/send/:studentId",
  verifyToken,
  verifyAdminOrTeacher,
  async (req, res) => {
    try {
      const student = await Student.findById(req.params.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      if (!student.email) return res.status(400).json({ error: "Student has no email address" });

      const period  = req.query.period === "weekly" ? "weekly" : "monthly";
      const { from, to } = parseDateRange(period, req.query);
      const teacher = await primaryTeacher(student._id);
      const pdf     = await generateProgressReport(student, teacher, from, to, period);
      const result  = await sendProgressReport(student, pdf, period, from, to);

      if (result.success) {
        res.json({ ok: true, message: `Report emailed to ${student.email}` });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err) {
      console.error("Report send error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
