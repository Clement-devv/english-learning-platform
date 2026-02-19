// server/routes/adminLessonRoutes.js
// Admin-only routes for marking/unmarking lessons
// Register with: app.use("/api/admin/lessons", adminLessonRoutes)

import express from "express";
import Booking from "../models/Booking.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Assignment from "../models/Assignment.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { sendEmail } from "../utils/emailService.js";

const router = express.Router();

// ─── Email helpers ────────────────────────────────────────────────────────────
async function sendLessonMarkedEmails(teacher, student, booking) {
  try {
    const teacherHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#16a34a;margin-bottom:8px">✅ Lesson Marked Completed</h2>
        <p style="color:#374151">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#374151">An admin has marked your lesson as completed:</p>
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#15803d"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#15803d"><strong>Student:</strong> ${student.firstName} ${student.surname}</p>
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
          <p style="margin:4px 0;color:#1d4ed8"><strong>Classes remaining:</strong> ${student.noOfClasses}</p>
        </div>
        <p style="color:#374151">This class has been added to your completed classes. Keep up the great work! 🎓</p>
      </div></body></html>`;

    await Promise.all([
      sendEmail({ to: teacher.email, subject: "Lesson Marked Completed ✅", html: teacherHtml }),
      sendEmail({ to: student.email, subject: "Lesson Marked Completed 📚", html: studentHtml }),
    ]);
  } catch (err) {
    console.error("📧 Mark notification email failed:", err.message);
  }
}

async function sendLessonUnmarkedEmails(teacher, student, booking, reason) {
  try {
    const teacherHtml = `
      <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9fafb;padding:24px">
      <div style="max-width:500px;margin:auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <h2 style="color:#dc2626;margin-bottom:8px">⚠️ Lesson Marked as Not Completed</h2>
        <p style="color:#374151">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#374151">An admin has reversed a lesson completion:</p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:4px 0;color:#b91c1c"><strong>Class:</strong> ${booking.classTitle}</p>
          <p style="margin:4px 0;color:#b91c1c"><strong>Student:</strong> ${student.firstName} ${student.surname}</p>
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
      sendEmail({ to: teacher.email, subject: "Lesson Completion Reversed ⚠️", html: teacherHtml }),
      sendEmail({ to: student.email, subject: "Lesson Status Updated ⚠️", html: studentHtml }),
    ]);
  } catch (err) {
    console.error("📧 Unmark notification email failed:", err.message);
  }
}

// ─── GET: Students assigned to a teacher ─────────────────────────────────────
router.get("/teacher/:teacherId/students", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId } = req.params;

    const assignments = await Assignment.find({ teacherId })
      .populate("studentId", "firstName surname email noOfClasses active")
      .sort({ assignedDate: -1 });

    const students = assignments
      .filter((a) => a.studentId)
      .map((a) => ({
        _id: a.studentId._id,
        firstName: a.studentId.firstName,
        surname: a.studentId.surname,
        email: a.studentId.email,
        noOfClasses: a.studentId.noOfClasses,
        active: a.studentId.active,
      }));

    res.json({ success: true, students });
  } catch (err) {
    console.error("Error fetching teacher students:", err);
    res.status(500).json({ success: false, message: "Error fetching students" });
  }
});

// ─── GET: Teachers assigned to a student ─────────────────────────────────────
router.get("/student/:studentId/teachers", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { studentId } = req.params;

    const assignments = await Assignment.find({ studentId })
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned active")
      .sort({ assignedDate: -1 });

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
    console.error("Error fetching student teachers:", err);
    res.status(500).json({ success: false, message: "Error fetching teachers" });
  }
});

// ─── GET: Bookings between a teacher-student pair ────────────────────────────
router.get("/bookings", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { teacherId, studentId, type } = req.query;

    if (!teacherId || !studentId) {
      return res.status(400).json({ success: false, message: "teacherId and studentId required" });
    }

    let statusFilter;
    if (type === "mark") {
      statusFilter = { status: "accepted" };
    } else if (type === "unmark") {
      statusFilter = { status: "completed", adminRejected: { $ne: true } };
    } else {
      return res.status(400).json({ success: false, message: "type must be 'mark' or 'unmark'" });
    }

    const bookings = await Booking.find({ teacherId, studentId, ...statusFilter })
      .populate("teacherId", "firstName lastName ratePerClass")
      .populate("studentId", "firstName surname")
      .sort({ scheduledTime: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    console.error("Error fetching bookings for mark/unmark:", err);
    res.status(500).json({ success: false, message: "Error fetching bookings" });
  }
});

// ─── POST: Mark a lesson as completed ────────────────────────────────────────
router.post("/mark", verifyToken, verifyAdmin, async (req, res) => {
  const { bookingId } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, message: "bookingId is required" });
  }

  try {
    // 1. Load booking
    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses active");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: `Can only mark 'accepted' bookings. Current status: ${booking.status}`,
      });
    }

    // 2. Mark booking complete
    booking.status = "completed";
    booking.completedAt = new Date();
    booking.adminRejected = false;
    booking.markedBy = "admin";
    await booking.save();

    // 3. Deduct student class
    const student = await Student.findById(booking.studentId._id);
    if (student) {
      student.noOfClasses = Math.max(0, (student.noOfClasses || 0) - 1);
      if (student.noOfClasses === 0) student.active = false;
      await student.save();
    }

    // 4. Add teacher earnings
    const teacher = await Teacher.findById(booking.teacherId._id);
    let ratePerClass = 0;
    if (teacher) {
      ratePerClass = parseFloat(teacher.ratePerClass || 0);
      teacher.lessonsCompleted = (teacher.lessonsCompleted || 0) + 1;
      teacher.earned = (teacher.earned || 0) + ratePerClass;
      await teacher.save();
    }

    // 5. Create PaymentTransaction
    await PaymentTransaction.create({
      bookingId: booking._id,
      teacherId: booking.teacherId._id,
      studentId: booking.studentId._id,
      amount: ratePerClass,
      status: "pending",
      type: "class_completion",
      classTitle: booking.classTitle,
      studentName: `${booking.studentId.firstName} ${booking.studentId.surname}`,
      completedAt: new Date(),
      description: `Admin marked class completed - ${booking.classTitle}`,
    });

    // 6. Send emails (non-critical — intentionally not awaited)
    const updatedStudent = await Student.findById(booking.studentId._id);
    const updatedTeacher = await Teacher.findById(booking.teacherId._id);
    sendLessonMarkedEmails(updatedTeacher, updatedStudent, booking);

    console.log(`✅ Admin marked lesson: ${booking.classTitle} | Teacher: ${updatedTeacher.firstName} | Student: ${updatedStudent.firstName}`);

    res.json({
      success: true,
      message: "Lesson marked as completed",
      booking: {
        _id: booking._id,
        classTitle: booking.classTitle,
        status: "completed",
        completedAt: booking.completedAt,
      },
      teacher: {
        lessonsCompleted: updatedTeacher.lessonsCompleted,
        earned: updatedTeacher.earned,
        rateAdded: ratePerClass,
      },
      student: {
        noOfClasses: updatedStudent.noOfClasses,
        active: updatedStudent.active,
      },
    });
  } catch (err) {
    console.error("❌ Error marking lesson:", err);
    res.status(500).json({ success: false, message: "Error marking lesson: " + err.message });
  }
});

// ─── POST: Unmark (admin-reject) a completed lesson ──────────────────────────
router.post("/unmark", verifyToken, verifyAdmin, async (req, res) => {
  const { bookingId, reason } = req.body;

  if (!bookingId) {
    return res.status(400).json({ success: false, message: "bookingId is required" });
  }

  try {
    // 1. Load booking
    const booking = await Booking.findById(bookingId)
      .populate("teacherId", "firstName lastName email ratePerClass lessonsCompleted earned")
      .populate("studentId", "firstName surname email noOfClasses active");

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
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
        message: "This lesson has already been admin-rejected",
      });
    }

    // 2. Flag booking as admin-rejected
    booking.adminRejected = true;
    booking.adminRejectedAt = new Date();
    booking.adminRejectedBy = req.user.id;
    booking.adminRejectedReason = reason || "";
    await booking.save();

    // 3. Restore student class
    const student = await Student.findById(booking.studentId._id);
    if (student) {
      student.noOfClasses = (student.noOfClasses || 0) + 1;
      student.active = true;
      await student.save();
    }

    // 4. Deduct teacher earnings
    const teacher = await Teacher.findById(booking.teacherId._id);
    let ratePerClass = 0;
    if (teacher) {
      ratePerClass = parseFloat(teacher.ratePerClass || 0);
      teacher.lessonsCompleted = Math.max(0, (teacher.lessonsCompleted || 0) - 1);
      teacher.earned = Math.max(0, (teacher.earned || 0) - ratePerClass);
      await teacher.save();
    }

    // 5. Cancel PaymentTransaction
    await PaymentTransaction.updateMany(
      { bookingId: booking._id, status: "pending" },
      { $set: { status: "cancelled", notes: `Admin rejected: ${reason || "No reason given"}` } }
    );

    // 6. Send emails (non-critical — intentionally not awaited)
    const updatedStudent = await Student.findById(booking.studentId._id);
    const updatedTeacher = await Teacher.findById(booking.teacherId._id);
    sendLessonUnmarkedEmails(updatedTeacher, updatedStudent, booking, reason);

    console.log(`⚠️ Admin unmarked lesson: ${booking.classTitle} | Reason: ${reason || "none"}`);

    res.json({
      success: true,
      message: "Lesson marked as not completed (admin rejected)",
      booking: {
        _id: booking._id,
        classTitle: booking.classTitle,
        status: "completed",
        adminRejected: true,
        adminRejectedReason: reason || "",
      },
      teacher: {
        lessonsCompleted: updatedTeacher.lessonsCompleted,
        earned: updatedTeacher.earned,
        rateDeducted: ratePerClass,
      },
      student: {
        noOfClasses: updatedStudent.noOfClasses,
        active: updatedStudent.active,
        classRestored: true,
      },
    });
  } catch (err) {
    console.error("❌ Error unmarking lesson:", err);
    res.status(500).json({ success: false, message: "Error unmarking lesson: " + err.message });
  }
});

export default router;