// server/routes/adminLessonRoutes.js
// Admin-only routes for marking/unmarking lessons
// Register with: app.use("/api/admin/lessons", adminLessonRoutes)

import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { sendEmail } from "../utils/emailService.js";
import { completeClass } from "../services/classCompletionService.js";
import { bookingSchema }            from "../schemas/bookingSchema.js";
import { teacherSchema }            from "../schemas/teacherSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import { assignmentSchema }         from "../schemas/assignmentSchema.js";
import { paymentTransactionSchema } from "../schemas/paymentTransactionSchema.js";
import { parentSchema }             from "../schemas/parentSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getBooking            = (db) => db.models.Booking            || db.model("Booking",            bookingSchema);
const getTeacher            = (db) => db.models.Teacher            || db.model("Teacher",            teacherSchema);
const getStudent            = (db) => db.models.Student            || db.model("Student",            studentSchema);
const getAssignment         = (db) => db.models.Assignment         || db.model("Assignment",         assignmentSchema);
const getPaymentTransaction = (db) => db.models.PaymentTransaction || db.model("PaymentTransaction", paymentTransactionSchema);
const getParent             = (db) => db.models.Parent             || db.model("Parent",             parentSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Email helpers
// ─────────────────────────────────────────────────────────────────────────────

async function sendLessonMarkedEmails(teacher, student, booking, centerName = "") {
  try {
    const teacherHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#16a34a;margin-bottom:8px">✅ Lesson Marked Completed</h2>
        <p style="color:#374151">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#374151">An admin has marked your lesson as completed:</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#15803d"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#15803d"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
          <p style="margin:4px 0;color:#15803d"><strong>Date:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</p>
          <p style="margin:4px 0;color:#15803d"><strong>Amount added:</strong> $${teacher.ratePerClass}</p>
        </div>
        <p style="color:#374151">Your earnings have been updated. Check your salary dashboard for details.</p>
      </div></body></html>`;

    const studentHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#2563eb;margin-bottom:8px">📚 Lesson Marked Completed</h2>
        <p style="color:#374151">Hi <strong>${student.firstName}</strong>,</p>
        <p style="color:#374151">An admin has marked your lesson as completed:</p>
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#1d4ed8"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#1d4ed8"><strong>Teacher:</strong> ${teacher.firstName} ${teacher.lastName}</p>
          <p style="margin:4px 0;color:#1d4ed8"><strong>Date:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</p>
          <p style="margin:4px 0;color:#1d4ed8"><strong>Classes remaining:</strong> ${student.classCredits}</p>
        </div>
        <p style="color:#374151">This class has been added to your completed classes. Keep up the great work! 🎓</p>
      </div></body></html>`;

    await Promise.all([
      sendEmail({ centerName, to: teacher.email, subject: "Lesson Marked Completed ✅", html: teacherHtml }),
      sendEmail({ centerName, to: student.email, subject: "Lesson Marked Completed 📚", html: studentHtml }),
    ]);
  } catch (err) {
    logger.error("📧 Mark notification email failed:", { error: err?.message });
  }
}

async function sendLessonUnmarkedEmails(teacher, student, booking, reason, centerName = "") {
  try {
    const teacherHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#dc2626;margin-bottom:8px">⚠️ Lesson Marked as Not Completed</h2>
        <p style="color:#374151">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#374151">An admin has reversed a lesson completion:</p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#b91c1c"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#b91c1c"><strong>Student:</strong> ${student.firstName} ${student.lastName}</p>
          <p style="margin:4px 0;color:#b91c1c"><strong>Date:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</p>
          <p style="margin:4px 0;color:#b91c1c"><strong>Amount deducted:</strong> $${teacher.ratePerClass}</p>
          ${reason ? `<p style="margin:4px 0;color:#b91c1c"><strong>Reason:</strong> ${reason}</p>` : ""}
        </div>
        <p style="color:#374151">Your earnings have been adjusted accordingly. Contact admin if you have questions.</p>
      </div></body></html>`;

    const studentHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#ea580c;margin-bottom:8px">⚠️ Lesson Status Updated</h2>
        <p style="color:#374151">Hi <strong>${student.firstName}</strong>,</p>
        <p style="color:#374151">An admin has reviewed and rejected a lesson completion:</p>
        <div style="background:#fff7ed;border-left:4px solid #ea580c;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#c2410c"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#c2410c"><strong>Teacher:</strong> ${teacher.firstName} ${teacher.lastName}</p>
          <p style="margin:4px 0;color:#c2410c"><strong>Date:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</p>
          <p style="margin:4px 0;color:#c2410c"><strong>1 class has been restored</strong> to your account</p>
          ${reason ? `<p style="margin:4px 0;color:#c2410c"><strong>Reason:</strong> ${reason}</p>` : ""}
        </div>
        <p style="color:#374151">Your class balance has been updated. Contact admin if you have questions.</p>
      </div></body></html>`;

    await Promise.all([
      sendEmail({ centerName, to: teacher.email, subject: "Lesson Completion Reversed ⚠️", html: teacherHtml }),
      sendEmail({ centerName, to: student.email, subject: "Lesson Status Updated ⚠️", html: studentHtml }),
    ]);
  } catch (err) {
    logger.error("📧 Unmark notification email failed:", { error: err?.message });
  }
}

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
          .populate("teacherId", "firstName lastName email ratePerClass")
          .populate("studentId", "firstName lastName email classCredits");
        if (booking) {
          await sendLessonMarkedEmails(booking.teacherId, booking.studentId, booking, centerName);
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

    // Flag booking as admin-rejected
    booking.adminRejected = true;
    booking.adminRejectedAt = new Date();
    booking.adminRejectedBy = req.user.id;
    booking.adminRejectedReason = reason || "";
    await booking.save();

    // Restore student class credit (skipped for trial — no credit was ever deducted)
    const student = await getStudent(req.db).findById(booking.studentId._id);
    if (student && !booking.isTrial) {
      student.classCredits = (student.classCredits || 0) + 1;
      student.active = true;
      await student.save();
    }

    // Deduct teacher earnings (float-safe; skipped for trial — no earnings were ever added)
    const teacher = await getTeacher(req.db).findById(booking.teacherId._id);
    let ratePerClass = 0;
    if (teacher && !booking.isTrial) {
      ratePerClass = Math.round((parseFloat(teacher.ratePerClass) || 0) * 100) / 100;
      teacher.lessonsCompleted = Math.max(0, (teacher.lessonsCompleted || 0) - 1);
      teacher.earned = Math.max(0, Math.round(((teacher.earned || 0) - ratePerClass) * 100) / 100);
      await teacher.save();
    }

    // Cancel the PaymentTransaction for this booking (skipped for trial — none was created)
    if (!booking.isTrial) {
      await getPaymentTransaction(req.db).updateMany(
        { bookingId: booking._id, status: "pending" },
        { $set: { status: "cancelled", notes: `Admin rejected: ${reason || "No reason given"}` } }
      );
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
        await sendLessonUnmarkedEmails(updatedTeacher, updatedStudent, booking, reason, centerName);
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
        if (s.email) recipients.push({ email: s.email, name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Student' });
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

    await Promise.all(recipients.map(async (r) => {
      try {
        await sendEmail({
          centerName,
          to:      r.email,
          subject: subject.trim(),
          html: `
            <p>Dear <strong>${r.name}</strong>,</p>
            <div style="white-space:pre-line">${message.trim()}</div>
            <br/>
            <p>— The ${centerName} Team</p>
          `,
        });
        sent++;
      } catch { failed++; }
    }));

    res.json({ success: true, sent, failed, total: recipients.length });
  } catch (err) {
    logger.error('❌ Admin broadcast error:', { error: err?.message });
    serverError(res);
  }
});

export default router;
