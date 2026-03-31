/**
 * reminderScheduler.js
 *
 * Runs every 60 seconds and sends timed reminder emails for:
 *   - Classes:   60 min, 30 min, 5 min before scheduled time (teacher + student)
 *   - Homework:  30 min before due date (student, if not yet submitted)
 *   - Quizzes:   30 min before due date (student, if not yet attempted)
 *
 * Uses a ReminderLog collection so each reminder is sent exactly once.
 * Call startReminderScheduler(db) once per active center connection.
 */

import { bookingSchema }     from "../schemas/bookingSchema.js";
import { homeworkSchema }    from "../schemas/homeworkSchema.js";
import { quizSchema }        from "../schemas/quizSchema.js";
import { reminderLogSchema } from "../schemas/reminderLogSchema.js";
import { teacherSchema }     from "../schemas/teacherSchema.js";
import { studentSchema }     from "../schemas/studentSchema.js";
import {
  sendClassTimedReminder,
  sendHomeworkDueReminder,
  sendQuizDueReminder,
  sendAccountDeletionFinalReminderEmail,
  sendTeacherAccountDeletionFinalReminderEmail,
} from "./emailService.js";
import { sendPush } from "./webPushService.js";

const getBooking     = (db) => db.models.Booking     || db.model("Booking",     bookingSchema);
const getHomework    = (db) => db.models.Homework    || db.model("Homework",    homeworkSchema);
const getQuiz        = (db) => db.models.Quiz        || db.model("Quiz",        quizSchema);
const getReminderLog = (db) => db.models.ReminderLog || db.model("ReminderLog", reminderLogSchema);
const getTeacher     = (db) => db.models.Teacher     || db.model("Teacher",     teacherSchema);
const getStudent     = (db) => db.models.Student     || db.model("Student",     studentSchema);

// ── Helper: mark a reminder as sent (returns false if already sent) ──────────
async function markSent(db, type, refId) {
  try {
    await getReminderLog(db).create({ type, refId });
    return true; // newly inserted → not yet sent
  } catch (err) {
    if (err.code === 11000) return false; // duplicate key → already sent
    throw err;
  }
}

// ── Helper: check if a time is within [target-margin, target+margin] minutes --
function inWindow(scheduledTime, targetMins, marginMins = 4) {
  const now      = Date.now();
  const diffMins = (new Date(scheduledTime).getTime() - now) / 60000;
  return diffMins >= (targetMins - marginMins) && diffMins <= (targetMins + marginMins);
}

// ── Class reminders ──────────────────────────────────────────────────────────
async function checkClassReminders(db) {
  const bookings = await getBooking(db).find({
    status: "accepted",
    scheduledTime: {
      $gt: new Date(Date.now() + 3  * 60 * 1000),
      $lt: new Date(Date.now() + 70 * 60 * 1000),
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
      if (await markSent(db, teacherKey, booking._id)) {
        sendClassTimedReminder(teacher, booking, "teacher", mins).catch(e =>
          console.error(`Reminder email failed (${teacherKey}):`, e.message)
        );
        getTeacher(db).findById(teacher._id).select("pushSubscription").then(t => {
          if (t?.pushSubscription) {
            sendPush(t.pushSubscription, { ...pushPayload, data: { url: "/teacher/dashboard" } })
              .catch(e => console.error(`Push failed (teacher ${teacher.email}):`, e.message));
          }
        }).catch(e => console.error(`Push subscription fetch failed:`, e.message));
        console.log(`📧 Class reminder sent → teacher ${teacher.email} (${mins} min)`);
      }

      // Student reminder
      const studentKey = `${label}_s_${booking._id}`;
      if (await markSent(db, studentKey, booking._id)) {
        sendClassTimedReminder(student, booking, "student", mins).catch(e =>
          console.error(`Reminder email failed (${studentKey}):`, e.message)
        );
        getStudent(db).findById(student._id).select("pushSubscription").then(s => {
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
async function checkHomeworkReminders(db) {
  const homeworks = await getHomework(db).find({
    status:  "assigned",
    dueDate: {
      $gt: new Date(Date.now() + 24 * 60 * 1000),
      $lt: new Date(Date.now() + 36 * 60 * 1000),
    },
  }).populate("studentId", "firstName email");

  for (const hw of homeworks) {
    const student = hw.studentId;
    if (!student?.email) continue;

    const key = `homework_30min_${hw._id}`;
    if (await markSent(db, key, hw._id)) {
      sendHomeworkDueReminder(student, hw, 30).catch(e =>
        console.error(`Homework reminder failed:`, e.message)
      );
      console.log(`📧 Homework due reminder → ${student.email} "${hw.title}"`);
    }
  }
}

// ── Quiz due reminders ───────────────────────────────────────────────────────
async function checkQuizReminders(db) {
  const quizzes = await getQuiz(db).find({
    status:  "assigned",
    dueDate: {
      $gt: new Date(Date.now() + 24 * 60 * 1000),
      $lt: new Date(Date.now() + 36 * 60 * 1000),
    },
  }).populate("studentId", "firstName email");

  for (const quiz of quizzes) {
    const student = quiz.studentId;
    if (!student?.email) continue;

    const key = `quiz_30min_${quiz._id}`;
    if (await markSent(db, key, quiz._id)) {
      sendQuizDueReminder(student, quiz, 30).catch(e =>
        console.error(`Quiz reminder failed:`, e.message)
      );
      console.log(`📧 Quiz due reminder → ${student.email} "${quiz.title}"`);
    }
  }
}

// ── Scheduled deletion: 24-hour final warning + permanent purge ──────────────
async function checkScheduledDeletions(db) {
  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const Student = getStudent(db);
  const Teacher = getTeacher(db);

  // 1. Send 24-hour final reminder to students whose deletion is within the next 24 hours.
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

// ── Main tick (runs every 60 s per center) ───────────────────────────────────
function makeTick(db) {
  return async function runTick() {
    if (db.readyState !== 1) {
      console.warn("⏰ Reminder scheduler skipped — DB not connected (readyState:", db.readyState, ")");
      return;
    }
    try {
      await Promise.all([
        checkClassReminders(db),
        checkHomeworkReminders(db),
        checkQuizReminders(db),
        checkScheduledDeletions(db),
      ]);
    } catch (err) {
      console.error("Reminder scheduler error:", err.message);
    }
  };
}

export function startReminderScheduler(db) {
  const centerSlug = db.name || "unknown";
  console.log(`⏰ Reminder scheduler started for center: ${centerSlug} (60s interval)`);
  const runTick = makeTick(db);
  // Don't run immediately — DB connection may still be opening (readyState 2).
  // The interval will fire once fully connected.
  setInterval(runTick, 60 * 1000);
}
