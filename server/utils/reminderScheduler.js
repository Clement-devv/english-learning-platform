/**
 * reminderScheduler.js
 *
 * Runs every 60 seconds and sends timed reminder emails for:
 *   - Classes:   60 min, 30 min, 5 min before scheduled time (teacher + student)
 *   - Homework:  30 min before due date (student, if not yet submitted)
 *   - Quizzes:   30 min before due date (student, if not yet attempted)
 *
 * Uses a ReminderLog collection so each reminder is sent exactly once.
 */

import mongoose   from "mongoose";
import Booking     from "../models/Booking.js";
import Homework    from "../models/Homework.js";
import Quiz        from "../models/Quiz.js";
import ReminderLog from "../models/ReminderLog.js";
import Teacher     from "../models/Teacher.js";
import Student     from "../models/Student.js";
import {
  sendClassTimedReminder,
  sendHomeworkDueReminder,
  sendQuizDueReminder,
  sendAccountDeletionFinalReminderEmail,
  sendTeacherAccountDeletionFinalReminderEmail,
} from "./emailService.js";
import { sendPush } from "./webPushService.js";

// ── Helper: mark a reminder as sent (returns false if already sent) ──────────
async function markSent(type, refId) {
  try {
    await ReminderLog.create({ type, refId });
    return true; // newly inserted → not yet sent
  } catch (err) {
    if (err.code === 11000) return false; // duplicate key → already sent
    throw err;
  }
}

// ── Helper: check if a time is within [target-margin, target+margin] minutes --
function inWindow(scheduledTime, targetMins, marginMins = 4) {
  const now        = Date.now();
  const diffMins   = (new Date(scheduledTime).getTime() - now) / 60000;
  return diffMins >= (targetMins - marginMins) && diffMins <= (targetMins + marginMins);
}

// ── Class reminders ──────────────────────────────────────────────────────────
async function checkClassReminders() {
  // Only check accepted bookings that haven't started yet
  const bookings = await Booking.find({
    status: "accepted",
    scheduledTime: {
      $gt:  new Date(Date.now() + 3 * 60 * 1000),   // at least 3 min in the future
      $lt:  new Date(Date.now() + 70 * 60 * 1000),  // at most 70 min away
    },
  })
    .populate("teacherId", "firstName lastName email")
    .populate("studentId", "firstName surname email");

  for (const booking of bookings) {
    const teacher = booking.teacherId;
    const student = booking.studentId;
    if (!teacher?.email || !student?.email) continue;

    for (const { mins, label } of [
      { mins: 60, label: "class_60min" },
      { mins: 30, label: "class_30min" },
      { mins: 5,  label: "class_5min"  },
    ]) {
      if (!inWindow(booking.scheduledTime, mins)) continue;

      const pushPayload = {
        title: `⏰ Class in ${mins} minute${mins > 1 ? "s" : ""}`,
        body:  `"${booking.classTitle}" starts soon. Get ready!`,
        icon:  "/favicon.ico",
        badge: "/favicon.ico",
        data:  { url: "/student/dashboard" },
      };

      // Teacher reminder
      const teacherKey = `${label}_t_${booking._id}`;
      if (await markSent(teacherKey, booking._id)) {
        sendClassTimedReminder(teacher, booking, "teacher", mins).catch(e =>
          console.error(`Reminder email failed (${teacherKey}):`, e.message)
        );
        // Web push — fetch fresh subscription from DB
        Teacher.findById(teacher._id).select("pushSubscription").then(t => {
          if (t?.pushSubscription) {
            sendPush(t.pushSubscription, { ...pushPayload, data: { url: "/teacher/dashboard" } })
              .catch(e => console.error(`Push failed (teacher ${teacher.email}):`, e.message));
          }
        }).catch(e => console.error(`Push subscription fetch failed:`, e.message));
        console.log(`📧 Class reminder sent → teacher ${teacher.email} (${mins} min)`);
      }

      // Student reminder
      const studentKey = `${label}_s_${booking._id}`;
      if (await markSent(studentKey, booking._id)) {
        sendClassTimedReminder(student, booking, "student", mins).catch(e =>
          console.error(`Reminder email failed (${studentKey}):`, e.message)
        );
        // Web push
        Student.findById(student._id).select("pushSubscription").then(s => {
          if (s?.pushSubscription) {
            sendPush(s.pushSubscription, pushPayload)
              .catch(e => console.error(`Push failed (student ${student.email}):`, e.message));
          }
        }).catch(e => console.error(`Push subscription fetch failed:`, e.message));
        console.log(`📧 Class reminder sent → student ${student.email} (${mins} min)`);
      }
    }
  }
}

// ── Homework due reminders ───────────────────────────────────────────────────
async function checkHomeworkReminders() {
  const homeworks = await Homework.find({
    status:  "assigned",   // not yet submitted
    dueDate: {
      $gt: new Date(Date.now() + 24 * 60 * 1000),  // at least 24 min away
      $lt: new Date(Date.now() + 36 * 60 * 1000),  // within 36 min
    },
  }).populate("studentId", "firstName email");

  for (const hw of homeworks) {
    const student = hw.studentId;
    if (!student?.email) continue;

    const key = `homework_30min_${hw._id}`;
    if (await markSent(key, hw._id)) {
      sendHomeworkDueReminder(student, hw, 30).catch(e =>
        console.error(`Homework reminder failed:`, e.message)
      );
      console.log(`📧 Homework due reminder → ${student.email} "${hw.title}"`);
    }
  }
}

// ── Quiz due reminders ───────────────────────────────────────────────────────
async function checkQuizReminders() {
  const quizzes = await Quiz.find({
    status:  "assigned",   // not yet attempted
    dueDate: {
      $gt: new Date(Date.now() + 24 * 60 * 1000),
      $lt: new Date(Date.now() + 36 * 60 * 1000),
    },
  }).populate("studentId", "firstName email");

  for (const quiz of quizzes) {
    const student = quiz.studentId;
    if (!student?.email) continue;

    const key = `quiz_30min_${quiz._id}`;
    if (await markSent(key, quiz._id)) {
      sendQuizDueReminder(student, quiz, 30).catch(e =>
        console.error(`Quiz reminder failed:`, e.message)
      );
      console.log(`📧 Quiz due reminder → ${student.email} "${quiz.title}"`);
    }
  }
}

// ── Scheduled deletion: 24-hour final warning + permanent purge ──────────────
async function checkScheduledDeletions() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 1. Send 24-hour final reminder to students whose deletion is within the next 24 hours
  //    and who haven't yet received this final reminder.
  const pendingReminder = await Student.find({
    scheduledDeletionAt: { $gt: now, $lte: in24h },
    deletionWarningEmailSent: false,
  });

  for (const student of pendingReminder) {
    sendAccountDeletionFinalReminderEmail(student, student.scheduledDeletionAt).catch((err) =>
      console.error(`Final deletion reminder failed for ${student.email}:`, err.message)
    );
    student.deletionWarningEmailSent = true;
    await student.save();
    console.log(`📧 Final deletion reminder → ${student.email} (deletes ${student.scheduledDeletionAt})`);
  }

  // 2. Permanently delete students whose deletion date has passed.
  const toDelete = await Student.find({ scheduledDeletionAt: { $lte: now } });

  for (const student of toDelete) {
    await student.deleteOne();
    console.log(`🗑️  Student permanently deleted: ${student.email}`);
  }

  if (toDelete.length > 0) {
    console.log(`✅ Permanently deleted ${toDelete.length} scheduled student(s)`);
  }

  // 3. Send 24-hour final reminder to teachers whose deletion is within the next 24 hours.
  const pendingTeacherReminder = await Teacher.find({
    scheduledDeletionAt: { $gt: now, $lte: in24h },
    deletionWarningEmailSent: false,
  });

  for (const teacher of pendingTeacherReminder) {
    sendTeacherAccountDeletionFinalReminderEmail(teacher, teacher.scheduledDeletionAt).catch((err) =>
      console.error(`Final teacher deletion reminder failed for ${teacher.email}:`, err.message)
    );
    teacher.deletionWarningEmailSent = true;
    await teacher.save();
    console.log(`📧 Final teacher deletion reminder → ${teacher.email} (deletes ${teacher.scheduledDeletionAt})`);
  }

  // 4. Permanently delete teachers whose deletion date has passed.
  const teachersToDelete = await Teacher.find({ scheduledDeletionAt: { $lte: now } });

  for (const teacher of teachersToDelete) {
    await teacher.deleteOne();
    console.log(`🗑️  Teacher permanently deleted: ${teacher.email}`);
  }

  if (teachersToDelete.length > 0) {
    console.log(`✅ Permanently deleted ${teachersToDelete.length} scheduled teacher(s)`);
  }
}

// ── Main tick (runs every 60 s) ──────────────────────────────────────────────
async function runTick() {
  // Skip if DB is not connected (e.g. during reconnect after outage)
  if (mongoose.connection.readyState !== 1) {
    console.warn("⏰ Reminder scheduler skipped — DB not connected (readyState:", mongoose.connection.readyState, ")");
    return;
  }
  try {
    await Promise.all([
      checkClassReminders(),
      checkHomeworkReminders(),
      checkQuizReminders(),
      checkScheduledDeletions(),
    ]);
  } catch (err) {
    console.error("Reminder scheduler error:", err.message);
  }
}

export function startReminderScheduler() {
  console.log("⏰ Reminder scheduler started (60s interval)");
  // Run once immediately on startup, then every 60 seconds
  runTick();
  setInterval(runTick, 60 * 1000);
}
