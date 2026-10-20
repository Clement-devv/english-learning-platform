// server/routes/adminLessonRoutes.js
// Admin-only routes for marking/unmarking lessons
// Register with: app.use("/api/admin/lessons", adminLessonRoutes)

import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { esc } from "../emails/layout.js";
import { isManagedEmail } from "../utils/managedStudent.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { sendEmail } from "../utils/emailService.js";
import { sendLessonMarkedEmails as sendMarked, sendLessonUnmarkedEmails as sendUnmarked } from "../emails/lessonEmails.js";
import { completeClass } from "../services/classCompletionService.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { assignmentSchema }         from "../schemas/assignmentSchema.js";
import { parentSchema }             from "../schemas/parentSchema.js";
import logger from "../utils/logger.js";
import { awardMilestonesAndNotify } from "../utils/progressEmails.js";
import { badRequest, notFound, serverError } from '../utils/apiResponse.js';
import { reverseCompletedClass } from "../utils/classReversal.js";
import { reinstateUnmarkedClass } from "../utils/classPayment.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getAssignment         = (db) => db.models.Assignment         || db.model("Assignment",         assignmentSchema);
const getParent             = (db) => db.models.Parent             || db.model("Parent",             parentSchema);

// Lesson marked / reversed emails: server/emails/lessonEmails.js

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/lessons/teacher/:teacherId/students
// ─────────────────────────────────────────────────────────────────────────────
router.get("/teacher/:teacherId/students", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const assignments = await getAssignment(req.db).find({ teacherId })
      .populate("studentId", "firstName lastName email classCredits active")
      .sort({ assignedDate: -1 })
      .lean();

    const students = assignments
      .filter((a) => a.studentId)
      .map((a) => ({
        _id: a.studentId._id,
        firstName: a.studentId.firstName,
        lastName: a.studentId.lastName,
        email: a.studentId.email,
        classCredits: a.studentId.classCredits,
        active: a.studentId.active,
      }));

    res.json({ success: true, students });
  } catch (err) {
    logger.error("Error fetching teacher students:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/lessons/student/:studentId/teachers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/student/:studentId/teachers", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;

    const assignments = await getAssignment(req.db).find({ studentId })
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned active")
      .sort({ assignedDate: -1 })
      .lean();

    const teachers = assignments
      .filter((a) => a.teacherId)
      .map((a) => ({
        _id: a.teacherId._id,
        firstName: a.teacherId.firstName,
        lastName: a.teacherId.lastName,
        email: a.teacherId.email,
        ratePerClass: a.teacherId.ratePerClass,
        lessonsCompleted: a.teacherId.lessonsCompleted,
        earned: a.teacherId.earned,
        active: a.teacherId.active,
      }));

    res.json({ success: true, teachers });
  } catch (err) {
    logger.error("Error fetching student teachers:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching teachers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/lessons/bookings?teacherId=&studentId=&type=mark|unmark
// ─────────────────────────────────────────────────────────────────────────────
router.get("/bookings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId, studentId, type } = req.query;

    if (!teacherId || !studentId) {
      return badRequest(res, "teacherId and studentId required");
    }

    let statusFilter;
    if (type === "mark") {
      // All classes that aren't yet successfully completed: missed = attendance not met,
      // accepted/pending = scheduled but not processed yet
      statusFilter = { status: { $in: ["pending", "accepted", "pending_confirmation", "missed"] } };
    } else if (type === "unmark") {
      statusFilter = { status: "completed", adminRejected: { $ne: true } };
    } else {
      return badRequest(res, "type must be 'mark' or 'unmark'");
    }

    const bookings = await getBooking(req.db).find({ teacherId, studentId, ...statusFilter })
      .populate("teacherId", "firstName lastName ratePerClass")
      .populate("studentId", "firstName lastName")
      .sort({ scheduledTime: -1 })
      .lean();

    res.json({ success: true, bookings });
  } catch (err) {
    logger.error("Error fetching bookings for mark/unmark:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error fetching bookings" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/lessons/mark
// Admin manually marks a lesson as completed.
// Uses the shared classCompletionService — same atomic transaction and
// duplicate-prevention guarantees as the auto-complete flow.
// skipAttendanceCheck: true because admin is making a conscious override.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/mark", verifyToken, verifyAdmin, async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return badRequest(res, "bookingId is required");
  }

  try {
    if (!mongoose.isValidObjectId(bookingId)) return badRequest(res, "Invalid bookingId");

    // An admin-un-marked class (completed + adminRejected) can be marked again
    getBooking(req.db);
    const reinstated = await reinstateUnmarkedClass(req.db, bookingId, "admin");
    if (reinstated) {
      awardMilestonesAndNotify(req.db, reinstated.studentId, req.center);
      return res.json({ success: true, message: "Lesson marked as completed.", studentClassesRemaining: reinstated.student?.classCredits ?? null, teacherEarnedThisClass: reinstated.earned });
    }

    const result = await completeClass(req.db, bookingId, "admin", { skipAttendanceCheck: true });

    if (result.alreadyProcessed) {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${result.completed ? "completed" : "missed"}.`,
      });
    }

    // Send emails non-blocking — email failure must NOT make admin think marking failed
    const db = req.db;
    const centerName = req.center?.centerName || "";
    setImmediate(async () => {
      try {
        const booking = await getBooking(db).findById(bookingId)
          .populate("teacherId", "firstName lastName email ratePerClass timezone")
          .populate("studentId", "firstName lastName email classCredits emailLanguage timezone");
        if (booking) {
          await sendMarked(booking.teacherId, booking.studentId, booking, centerName).catch(e => logger.error("📧 Mark notification email failed:", { error: e?.message }));
        }
      } catch (emailErr) {
        logger.error("📧 Admin mark email failed:", emailErr.message);
      }
    });

    logger.info(`✅ Admin marked lesson complete | bookingId: ${bookingId}`);

    return res.json({
      success: true,
      message: "Lesson marked as completed.",
      ...result,
    });

  } catch (err) {
    logger.error("❌ Error marking lesson:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error marking lesson: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/lessons/unmark
// Admin reverses a completed lesson (admin-reject).
// Restores student credit and deducts teacher earnings.
// NOTE: This intentionally does NOT use the completion service —
// it is a reversal flow, not a completion flow.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/unmark", verifyToken, verifyAdmin, async (req, res) => {
  const { bookingId, reason } = req.body;

  if (!bookingId) {
    return badRequest(res, "bookingId is required");
  }

  try {
    const booking = await getBooking(req.db).findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName lastName email classCredits active");

    if (!booking) {
      return notFound(res, "Booking not found");
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: `Can only unmark 'completed' bookings. Current status: ${booking.status}`,
      });
    }

    if (booking.adminRejected) {
      return res.status(400).json({
        success: false,
        message: "This lesson has already been admin-rejected.",
      });
    }

    // Flag as admin-rejected, restore the student credit, deduct teacher earnings,
    // cancel the pending payment (shared with dispute resolution)
    const { student, teacher, ratePerClass, alreadyReversed } = await reverseCompletedClass(req.db, booking, {
      reason: reason || "", adminId: req.user.id,
    });
    // Lost the race to another click / admin — they already reversed it
    if (alreadyReversed) {
      return res.status(409).json({ success: false, message: "This lesson has already been admin-rejected." });
    }

    // Send emails non-blocking
    const db = req.db;
    const centerName = req.center?.centerName || "";
    const studentId = booking.studentId._id;
    const teacherId = booking.teacherId._id;
    setImmediate(async () => {
      try {
        const updatedStudent = await getStudent(db).findById(studentId);
        const updatedTeacher = await getTeacher(db).findById(teacherId);
        await sendUnmarked(updatedTeacher, updatedStudent, booking, reason, centerName).catch(e => logger.error("📧 Unmark notification email failed:", { error: e?.message }));
      } catch (emailErr) {
        logger.error("📧 Unmark email failed:", emailErr.message);
      }
    });

    logger.info(`⚠️ Admin unmarked lesson | bookingId: ${bookingId} | Reason: ${reason || "none"}`);

    return res.json({
      success: true,
      message: "Lesson marked as not completed (admin rejected).",
      booking: {
        _id: booking._id,
        classTitle: booking.classTitle,
        status: "completed",
        adminRejected: true,
        adminRejectedReason: reason || "",
      },
      teacher: {
        lessonsCompleted: teacher?.lessonsCompleted,
        earned: teacher?.earned,
        rateDeducted: ratePerClass,
      },
      student: {
        classCredits: student?.classCredits,
        active: student?.active,
        classRestored: true,
      },
    });

  } catch (err) {
    logger.error("❌ Error unmarking lesson:", { error: err?.message });
    res.status(500).json({ success: false, message: "Error unmarking lesson: " + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/admin/lessons/broadcast — email teachers, students, and/or parents
// Body: { subject, message, targets: { teachers?: { mode, ids? }, students?: { mode, ids? }, parents?: { mode, ids? } } }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/broadcast', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { subject, message, targets } = req.body;

    if (!subject?.trim() || !message?.trim())
      return badRequest(res, 'Subject and message are required');
    if (!targets || typeof targets !== 'object' || Object.keys(targets).length === 0)
      return badRequest(res, 'Select at least one audience group');

    const db         = req.db;
    const centerName = req.center?.centerName || 'Your School';
    const recipients = [];
    // "Specific" picks: ignore anything that isn't an id (a bad one made the query throw)
    for (const group of ['teachers', 'students', 'parents']) {
      if (Array.isArray(targets[group]?.ids)) targets[group].ids = targets[group].ids.filter((id) => mongoose.isValidObjectId(id));
    }

    if (targets.teachers) {
      const query = targets.teachers.mode === 'specific' && targets.teachers.ids?.length
        ? { _id: { $in: targets.teachers.ids }, active: true }
        : { active: true };
      const list = await getTeacher(db).find(query).select('firstName lastName email').lean();
      for (const t of list) {
        if (t.email) recipients.push({ email: t.email, name: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher' });
      }
    }

    if (targets.students) {
      const query = targets.students.mode === 'specific' && targets.students.ids?.length
        ? { _id: { $in: targets.students.ids }, active: true }
        : { active: true };
      const list = await getStudent(db).find(query).select('firstName lastName email').lean();
      for (const s of list) {
        // Managed students only have a placeholder login address
        if (s.email && !isManagedEmail(s.email)) recipients.push({ email: s.email, name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student' });
      }
    }

    if (targets.parents) {
      const query = targets.parents.mode === 'specific' && targets.parents.ids?.length
        ? { _id: { $in: targets.parents.ids } }
        : {};
      const list = await getParent(db).find(query).select('firstName lastName email').lean();
      for (const p of list) {
        if (p.email) recipients.push({ email: p.email, name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Parent' });
      }
    }

    if (recipients.length === 0)
      return badRequest(res, 'No email addresses found for the selected audience');

    let sent = 0, failed = 0;

    // A few at a time — firing every email at once opens one SMTP connection per
    // recipient, which providers throttle or reject for a large center.
    // Text is escaped: it is shown as written, never as HTML.
    const BATCH = 5;
    for (let i = 0; i < recipients.length; i += BATCH) {
      await Promise.all(recipients.slice(i, i + BATCH).map(async (r) => {
        try {
          const result = await sendEmail({
            centerName,
            to:      r.email,
            subject: subject.trim(),
            html: `
              <p>Dear <strong>${esc(r.name)}</strong>,</p>
              <div style="white-space:pre-line">${esc(message.trim())}</div>
              <br/>
              <p>— The ${esc(centerName)} Team</p>
            `,
          });
          if (result?.success === false) failed++; else sent++;
        } catch { failed++; }
      }));
    }

    res.json({ success: true, sent, failed, total: recipients.length });
  } catch (err) {
    logger.error('❌ Admin broadcast error:', { error: err?.message });
    serverError(res);
  }
});

export default router;
