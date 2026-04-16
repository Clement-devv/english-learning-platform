// server/routes/reportRoutes.js
// Admin / teacher can preview or manually send a progress report for any student.
//
// GET  /api/reports/preview/:studentId?period=monthly&month=2026-02
//      → streams the PDF directly (opens in browser / downloads)
//
// POST /api/reports/send/:studentId?period=monthly&month=2026-02
//      → generates PDF and emails it to the student immediately

import express from "express";
import { verifyToken, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { generateProgressReport } from "../utils/progressReportGenerator.js";
import { sendProgressReport }     from "../utils/emailService.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);

// ── Parse date window from query params ───────────────────────────────────────
function parseDateRange(period, query) {
  const now = new Date();

  if (period === "weekly") {
    if (query.week) {
      const [yr, wStr] = query.week.split("-W");
      const week  = parseInt(wStr, 10);
      const year  = parseInt(yr, 10);
      const jan4  = new Date(year, 0, 4);
      const monday = new Date(jan4.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { from: monday, to: sunday };
    }
    const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  if (query.month) {
    const [yr, mo] = query.month.split("-").map(Number);
    return {
      from: new Date(yr, mo - 1, 1),
      to:   new Date(yr, mo,     1),
    };
  }
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to:   new Date(now.getFullYear(), now.getMonth(),     1),
  };
}

// ── Primary teacher helper ────────────────────────────────────────────────────
async function primaryTeacher(studentId, db) {
  const last = await getBooking(db).findOne({ studentId, status: "completed" })
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
      const student = await getStudent(req.db).findById(req.params.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });

      const period  = req.query.period === "weekly" ? "weekly" : "monthly";
      const { from, to } = parseDateRange(period, req.query);
      const teacher = await primaryTeacher(student._id, req.db);
      const pdf     = await generateProgressReport(req.db, student, teacher, from, to, period);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="progress-${student._id}-${from.toISOString().slice(0, 10)}.pdf"`
      );
      res.send(pdf);
    } catch (err) {
      logger.error("Report preview error:", { error: err?.message });
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
      const student = await getStudent(req.db).findById(req.params.studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      if (!student.email) return res.status(400).json({ error: "Student has no email address" });

      const period  = req.query.period === "weekly" ? "weekly" : "monthly";
      const { from, to } = parseDateRange(period, req.query);
      const teacher = await primaryTeacher(student._id, req.db);
      const pdf     = await generateProgressReport(req.db, student, teacher, from, to, period);
      const result  = await sendProgressReport(student, pdf, period, from, to);

      if (result.success) {
        res.json({ ok: true, message: `Report emailed to ${student.email}` });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (err) {
      logger.error("Report send error:", { error: err?.message });
      res.status(500).json({ error: err.message });
    }
  }
);

export default router;
