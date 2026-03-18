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
              .catch(() => {});
          }
        }).catch(() => {});
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
            sendPush(s.pushSubscription, pushPayload).catch(() => {});
          }
        }).catch(() => {});
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

// ── Main tick (runs every 60 s) ──────────────────────────────────────────────
async function runTick() {
  try {
    await Promise.all([
      checkClassReminders(),
      checkHomeworkReminders(),
      checkQuizReminders(),
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
