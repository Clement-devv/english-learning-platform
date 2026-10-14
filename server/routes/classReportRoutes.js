// server/routes/classReportRoutes.js
// Admin "Class Report" tab: completed / not-completed classes for one day in
// the school's time zone, grouped by teacher, plus PDF download and "email me
// this report". The same report is emailed automatically every day
// (utils/dailyClassReportScheduler.js).
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import { verifyAdminOrSubAdmin, isSubAdmin } from "../middleware/staffAccess.js";
import {
  buildDailyClassReport as buildFullReport, reportForTeachers, renderDailyClassReportPdf,
  safeTimeZone, isDateStr, localDateStr,
} from "../utils/dailyClassReport.js";
import { sendDailyClassReportEmail } from "../utils/emailService.js";
import { badRequest, serverError } from "../utils/apiResponse.js";
import logger from "../utils/logger.js";

const router = express.Router();
// Admins, and sub-admins with "Class report" — who see only their own teachers
router.use(tenantMiddleware, verifyToken, verifyAdminOrSubAdmin("canViewClassReport"));

async function buildDailyClassReport(db, opts, req) {
  const report = await buildFullReport(db, opts);
  return isSubAdmin(req) ? reportForTeachers(report, req.teacherScope) : report;
}

// The requested day (default: today in the school's time zone)
function resolveDay(req) {
  const tz   = safeTimeZone(req.center?.timezone);
  const date = req.query.date || req.body?.date || localDateStr(new Date(), tz);
  return { tz, date };
}

// GET /api/v1/admin/class-report?date=YYYY-MM-DD
router.get("/", async (req, res) => {
  try {
    const { tz, date } = resolveDay(req);
    if (!isDateStr(date)) return badRequest(res, "date must be YYYY-MM-DD");
    const report = await buildDailyClassReport(req.db, { date, tz }, req);
    res.json({ success: true, data: { ...report, today: localDateStr(new Date(), tz) } });
  } catch (err) {
    logger.error("Class report error:", { error: err?.message });
    serverError(res, "Could not build the class report");
  }
});

// GET /api/v1/admin/class-report/pdf?date=YYYY-MM-DD
router.get("/pdf", async (req, res) => {
  try {
    const { tz, date } = resolveDay(req);
    if (!isDateStr(date)) return badRequest(res, "date must be YYYY-MM-DD");
    const report = await buildDailyClassReport(req.db, { date, tz }, req);
    const pdf    = await renderDailyClassReportPdf(report, req.center?.centerName || "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Class_Report_${date}.pdf"`);
    res.send(pdf);
  } catch (err) {
    logger.error("Class report PDF error:", { error: err?.message });
    serverError(res, "Could not create the PDF");
  }
});

// POST /api/v1/admin/class-report/email { date } — send it to me now
router.post("/email", async (req, res) => {
  try {
    const { tz, date } = resolveDay(req);
    if (!isDateStr(date)) return badRequest(res, "date must be YYYY-MM-DD");
    const to = req.admin?.email || req.subAdmin?.email;
    if (!to) return badRequest(res, "Your account has no email address");
    const report = await buildDailyClassReport(req.db, { date, tz }, req);
    const pdfBuffer = await renderDailyClassReportPdf(report, req.center?.centerName || "");
    const result = await sendDailyClassReportEmail({ to, report, pdfBuffer, centerName: req.center?.centerName || "" });
    if (result && result.success === false) return serverError(res, "The email could not be sent");
    res.json({ success: true, message: `Report sent to ${to}` });
  } catch (err) {
    logger.error("Class report email error:", { error: err?.message });
    serverError(res, "Could not send the report");
  }
});

export default router;
