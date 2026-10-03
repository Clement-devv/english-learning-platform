// server/scripts/seedDemoCenter.js
// Seeds a self-contained DEMO center ("family-english") with realistic fake data,
// used for screenshots / sales manuals. Local development only.
//
//   node scripts/seedDemoCenter.js          — (re)create the demo center
//   node scripts/seedDemoCenter.js --drop   — remove it completely
//
// Demo logins (local only): admin username "family-admin", teachers by email — all use the password below.
// Prints the demo homework / quiz / parent-check link tokens as JSON on the last line.
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();

const SLUG = "family-english";
const DEMO_ADMIN_USERNAME = "family-admin";
const DEMO_ADMIN_PASSWORD = "Family-Demo-2026!";
const TZ = "Asia/Ho_Chi_Minh";

const oid = () => new mongoose.Types.ObjectId();
const pick = (arr, i) => arr[i % arr.length];
const now = new Date();
const daysFrom = (d, h = 0, m = 0) => {
  const t = new Date(now);
  t.setUTCDate(t.getUTCDate() + d);
  t.setUTCHours(h, m, 0, 0);
  return t;
};
const hex = (n) => crypto.randomBytes(n).toString("hex");

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const { createLinkToken, hashLinkToken } = await import("../utils/shareLink.js");
  const { encrypt } = await import("../utils/fieldEncryption.js");
  const link = (createdAt) => { const token = createLinkToken();
    return { token, shareLink: { tokenHash: hashLinkToken(token), tokenEnc: encrypt(token), createdAt, failedAttempts: 0, lockedUntil: null } }; };
  const demoLinks = {};
  await mongoose.connect(process.env.MONGO_URI);
  const master = mongoose.connection.db;
  const db = mongoose.connection.client.db(SLUG);

  await master.collection("centers").deleteOne({ slug: SLUG });
  await db.dropDatabase();
  if (process.argv.includes("--drop")) { console.log("🗑  demo center removed"); return; }

  const template = await master.collection("centers").findOne({}, { projection: { _id: 0, pendingPasswordHash: 0 } });
  await master.collection("centers").insertOne({
    ...(template || {}),
    _id: oid(),
    centerName: "Family English Academy",
    slug: SLUG,
    customDomain: null,
    adminEmail: "admin@familyenglish.demo",
    dbName: `db_${SLUG}`,
    plan: "basic",
    status: "active",
    phone: "+84 90 123 4567",
    country: "Vietnam",
    address: "Ho Chi Minh City",
    timezone: TZ,
    registeredBy: "admin@familyenglish.demo",
    maxTeachers: 10,
    maxStudents: 100,
    recoveryCode: null,
    createdAt: daysFrom(-60), updatedAt: now, approvedAt: daysFrom(-60),
  });

  const pw = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const adminId = oid();
  await db.collection("admins").insertOne({
    _id: adminId, username: DEMO_ADMIN_USERNAME, firstName: "Linh", lastName: "Nguyen", email: "admin@familyenglish.demo", password: pw,
    role: "admin", active: true, twoFactorEnabled: false, twoFactorBackupCodes: [], twoFactorVerified: false,
    ringEnabled: true, hasAcceptedTerms: true, termsAcceptedAt: daysFrom(-60), sessions: [], knownDevices: [],
    lastPasswordChange: daysFrom(-60), analyticsPinFailedAttempts: 0, createdAt: daysFrom(-60), updatedAt: now,
  });

  // ── Teachers ───────────────────────────────────────────────────────────────
  const teacherDefs = [
    ["Sarah", "Mitchell", "United Kingdom", "Europe", ["IELTS", "Business English", "Grammar"], 6, 220000],
    ["David", "Okafor", "Nigeria", "Africa", ["Kids English", "Phonics"], 4, 160000],
    ["Emily", "Carter", "United States", "America", ["Conversation", "Pronunciation"], 5, 190000],
    ["James", "Nguyen", "Vietnam", "Asia", ["General English", "Exam Prep", "Writing"], 8, 250000],
    ["Grace", "Mensah", "Ghana", "Africa", ["Kids English", "Storytelling"], 3, 150000],
  ];
  const tpw = pw;
  const teachers = teacherDefs.map(([firstName, lastName, country, continent, specializations, yrs, rate], i) => ({
    _id: oid(), firstName, lastName, email: `${firstName.toLowerCase()}@familyenglish.demo`, password: tpw,
    ratePerClass: rate, continent, country, phone: `+84 9${i}0 555 01${i}${i}`, timezone: TZ,
    googleMeetLink: "https://meet.google.com/abc-defg-hij", zoomLink: "", bio: "", yearsOfExperience: yrs,
    specializations, certifications: ["TESOL"], showScheduleToStudents: true, status: "active", active: true,
    lessonsCompleted: 0, earned: 0, twoFactorEnabled: false, twoFactorBackupCodes: [], twoFactorVerified: false,
    photo: "", displayName: "", bankName: "", accountNumber: "", accountName: "", ringEnabled: true,
    hasAcceptedTerms: true, termsAcceptedAt: daysFrom(-55), sessions: [], knownDevices: [],
    workingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: "08:00", end: "20:00" })), workingHoursTz: TZ,
    teacherCode: `TCH-${41020 + i * 1137}`, createdAt: daysFrom(-55 + i), updatedAt: now,
  }));

  // ── Managed students ───────────────────────────────────────────────────────
  const studentDefs = [
    ["Minh", "Tran", 9, "A1"], ["Linh", "Pham", 12, "A2"], ["Bao", "Le", 8, "A1"], ["An", "Vo", 14, "B1"],
    ["Khanh", "Do", 11, "A2"], ["Mai", "Hoang", 16, "B2"], ["Duc", "Bui", 10, "A1"], ["Hoa", "Dang", 13, "B1"],
    ["Tuan", "Ngo", 15, "B1"], ["Lan", "Truong", 7, "Pre-A1"], ["Quang", "Ly", 17, "B2"], ["Thao", "Vu", 12, "A2"],
    ["Nam", "Phan", 9, "A1"], ["Vy", "Huynh", 11, "A2"], ["Phuc", "Dinh", 18, "C1"], ["Ngoc", "Cao", 10, "A1"],
  ];
  const students = studentDefs.map(([firstName, lastName, age, rank], i) => ({
    _id: oid(), studentId: `STU-${50110 + i * 613}`, firstName, lastName, email: `dummy-${hex(8)}@managed.invalid`,
    active: true, classCredits: [8, 3, 12, 1, 6, 10, 0, 4, 7, 9, 2, 5, 11, 6, 3, 8][i], showTempPassword: false,
    age, dateOfBirth: null, rank, phone: "", country: "Vietnam", timezone: TZ, status: "active",
    twoFactorEnabled: false, twoFactorBackupCodes: [], twoFactorVerified: false, referredBy: null, referralCreditsEarned: 0,
    currentStreak: 0, longestStreak: 0, streakFreezes: 1, weeklyClassStreak: 0, longestWeeklyClassStreak: 0,
    activityDates: [], ringEnabled: false, hasAcceptedTerms: true, sessions: [], isManaged: true,
    lastPaymentDate: daysFrom(-(i % 20) - 1), createdAt: daysFrom(-50 + i), updatedAt: now,
  }));
  const teacherOf = (s, i) => teachers[i % teachers.length];

  await db.collection("teachers").insertMany(teachers);
  await db.collection("students").insertMany(students);
  await db.collection("assignments").insertMany(students.map((s, i) => ({
    _id: oid(), teacherId: teacherOf(s, i)._id, studentId: s._id, assignedDate: daysFrom(-45), createdAt: daysFrom(-45), updatedAt: daysFrom(-45),
  })));
  await db.collection("classpricings").insertOne({
    _id: oid(), currency: "VND", currencySymbol: "₫", notes: "", pricePerClass: 150000, createdAt: daysFrom(-60), updatedAt: daysFrom(-60),
  });

  // ── Bookings ───────────────────────────────────────────────────────────────
  const topics = ["Present simple", "Past tense stories", "Animals & colours", "IELTS Speaking Part 2", "Phonics: short vowels",
    "Travel conversations", "Comparatives", "Job interview practice", "Reading: The Lost Kite", "Prepositions of place",
    "Future plans", "Debate: school uniforms"];
  const bookings = [];
  const txs = [];
  const hours = [1, 2, 3, 9, 10, 11, 12, 13];
  for (let d = -21; d <= 6; d++) {
    const perDay = d === 0 ? 7 : 4;
    for (let k = 0; k < perDay; k++) {
      const idx = (d + 30) * 7 + k;
      const s = students[idx % students.length];
      const t = teacherOf(s, students.indexOf(s));
      const when = daysFrom(d, pick(hours, idx + k), k % 2 ? 30 : 0);
      const past = when < now;
      let status = past ? (idx % 11 === 0 ? "missed" : idx % 13 === 0 ? "cancelled" : "completed") : (idx % 5 === 0 ? "pending" : "accepted");
      const topic = pick(topics, idx);
      const b = {
        _id: oid(), teacherId: t._id, studentId: s._id, classTitle: `${s.rank} English with ${t.firstName}`, topic,
        scheduledTime: when, duration: s.age < 11 ? 30 : 45, status, notes: "", createdBy: "admin", createdByUserId: adminId,
        createdByUserModel: "Admin", rejectionReason: "", markedBy: past ? (status === "missed" ? "system" : "teacher") : null,
        missedReason: status === "missed" ? "Student did not join." : "",
        attendanceConfirmedBy: status === "completed" ? "teacher" : null,
        parentCheck: { status: status === "completed" ? pick(["confirmed", "confirmed", "no_reply"], idx) : null, comment: "", history: [] },
        adminRejected: false, adminRejectedReason: "", recurringPatternId: null, disputeRaised: false, disputeReason: "",
        disputeStatus: null, disputedBy: "", disputeResolution: "", disputeAdminNotes: "", teacherTimezone: TZ, studentTimezone: TZ,
        isTrial: idx % 17 === 0, createdAt: daysFrom(d - 3), updatedAt: past ? when : daysFrom(d - 3),
        ...(status === "completed" ? { completedAt: new Date(when.getTime() + 50 * 60000) } : {}),
      };
      bookings.push(b);
      if (status === "completed") {
        t.lessonsCompleted++; t.earned += t.ratePerClass;
        txs.push({
          _id: oid(), teacherId: t._id, studentId: s._id, bookingId: b._id, amount: t.ratePerClass, type: "class_completion",
          status: d < -7 ? "paid" : "pending", description: `Class completed: ${topic}`, classTitle: b.classTitle,
          studentName: `${s.firstName} ${s.lastName}`, completedAt: b.completedAt, paymentMethod: "bank_transfer", notes: "",
          ...(d < -7 ? { paidAt: daysFrom(-7, 10) } : {}), createdAt: b.completedAt, updatedAt: b.completedAt,
        });
      }
    }
  }
  await db.collection("bookings").insertMany(bookings);
  await db.collection("paymenttransactions").insertMany(txs);
  for (const t of teachers) await db.collection("teachers").updateOne({ _id: t._id }, { $set: { lessonsCompleted: t.lessonsCompleted, earned: t.earned } });

  // ── Student payments (class packages) ─────────────────────────────────────
  await db.collection("payments").insertMany(students.flatMap((s, i) => [
    { _id: oid(), studentId: s._id, amount: 150000 * 8, classes: 8, method: pick(["Bank Transfer", "Manual"], i), status: "completed", date: daysFrom(-40 + i) },
    ...(i % 2 ? [{ _id: oid(), studentId: s._id, amount: 150000 * 12, classes: 12, method: "Bank Transfer", status: "completed", date: daysFrom(-(i % 9) - 1) }] : []),
  ].map((p) => ({ ...p, createdAt: p.date, updatedAt: p.date }))));

  // ── Homework & quizzes (shared by magic link) ─────────────────────────────
  const hwTitles = ["Write 5 sentences about your family", "Describe your favourite animal", "Record yourself reading page 12",
    "My weekend — a short story", "Fill in the past tense verbs", "Write an email to a friend", "IELTS Task 1: bar chart",
    "Draw & label your bedroom"];
  const homeworks = students.slice(0, 14).map((s, i) => {
    const t = teacherOf(s, i);
    const status = pick(["graded", "submitted", "assigned", "graded"], i);
    const created = daysFrom(-(i % 6) - 1, 9);
    return {
      _id: oid(), teacherId: t._id, studentId: s._id, title: pick(hwTitles, i), description: "Do your best and have fun! 🌟",
      dueDate: daysFrom(i === 2 ? 2 : (i % 5) - 1), attachments: [], status,
      ...(status !== "assigned" ? { submission: { text: "Here is my homework, teacher!", attachments: [], submittedAt: daysFrom(-(i % 3), 12), via: "link" } } : {}),
      ...(status === "graded" ? { grade: { score: 70 + (i * 7) % 31, feedback: pick(["Great work!", "Lovely ideas, watch your spelling.", "Excellent effort 👏"], i), gradedAt: daysFrom(-(i % 2), 14) } } : {}),
      ...(() => { const l = link(created); if (i === 2) demoLinks.homework = l.token; return { shareLink: l.shareLink }; })(),
      instructionAudio: { fileId: null, duration: 0, size: 0, mimeType: "" }, createdAt: created, updatedAt: now,
    };
  });
  await db.collection("homeworks").insertMany(homeworks);

  const quizTitles = ["Past simple check", "Animals vocabulary", "Prepositions quiz", "Irregular verbs", "Reading comprehension"];
  const quizzes = [];
  const attempts = [];
  students.slice(0, 10).forEach((s, i) => {
    const t = teacherOf(s, i);
    const q = {
      _id: oid(), teacherId: t._id, studentId: s._id, title: pick(quizTitles, i), instructions: "Choose the best answer.",
      timeLimit: 10, dueDate: daysFrom(i === 2 ? 2 : (i % 4)), status: i % 3 === 2 ? "assigned" : "attempted",
      questions: [
        { question: "Yesterday I ___ to the park.", options: [{ text: "go" }, { text: "went" }, { text: "going" }, { text: "goes" }], correctIndex: 1, explanation: "" },
        { question: "The cat is ___ the table.", options: [{ text: "under" }, { text: "at" }, { text: "of" }, { text: "for" }], correctIndex: 0, explanation: "" },
        { question: "She ___ English every day.", options: [{ text: "study" }, { text: "studies" }, { text: "studying" }, { text: "studied" }], correctIndex: 1, explanation: "" },
      ],
      ...(() => { const l = link(daysFrom(-1)); if (i === 2) demoLinks.quiz = l.token; return { shareLink: l.shareLink }; })(),
      createdAt: daysFrom(-3), updatedAt: now,
    };
    quizzes.push(q);
    if (q.status === "attempted") {
      const score = 1 + (i % 3);
      attempts.push({ _id: oid(), quizId: q._id, studentId: s._id, teacherId: t._id, answers: [1, 0, score === 3 ? 1 : 0], score,
        totalQuestions: 3, percentage: Math.round((score / 3) * 100), startedAt: daysFrom(-1, 10), submittedAt: daysFrom(-1, 10, 6),
        timeTaken: 240 + i * 20, via: "link", overTime: false, createdAt: daysFrom(-1, 10, 6), updatedAt: daysFrom(-1, 10, 6) });
    }
  });
  await db.collection("quizzes").insertMany(quizzes);
  await db.collection("quizattempts").insertMany(attempts);

  // ── Group classes ─────────────────────────────────────────────────────────
  const enroll = (list) => list.map((s) => ({ studentId: s._id, enrolledAt: daysFrom(-5), attendance: "pending", creditCharged: 1 }));
  await db.collection("groupclasses").insertMany([
    { title: "Saturday Story Club 📚", level: "A1", teacher: teachers[4], when: daysFrom(2, 2), list: students.filter((s) => s.rank === "A1") },
    { title: "IELTS Speaking Bootcamp", level: "B2", teacher: teachers[0], when: daysFrom(3, 11), list: students.filter((s) => ["B2", "C1"].includes(s.rank)) },
    { title: "Conversation Café ☕", level: "Mixed", teacher: teachers[2], when: daysFrom(-2, 10), list: students.slice(3, 9), done: true },
  ].map((g) => ({
    _id: oid(), teacherId: g.teacher._id, title: g.title, description: "", level: g.level, maxSeats: 8, pricePerSeat: 1,
    scheduledTime: g.when, teacherTimezone: TZ, duration: 60, status: g.done ? "completed" : "open",
    enrollments: enroll(g.list).map((e) => (g.done ? { ...e, attendance: "attended" } : e)), enrollmentMode: "open",
    invitedStudents: [], notes: "", tags: [], createdBy: "admin", ...(g.done ? { completedAt: daysFrom(-2, 11) } : {}),
    createdAt: daysFrom(-6), updatedAt: now,
  })));

  // ── Parent checks: latest classes waiting for the family, one disputed ────
  const recentDone = bookings.filter((b) => b.status === "completed").sort((a, b) => b.scheduledTime - a.scheduledTime);
  await db.collection("bookings").updateMany({ _id: { $in: recentDone.slice(0, 6).map((b) => b._id) } }, { $set: { "parentCheck.status": "waiting" } });
  { const l = link(now); demoLinks.attendance = l.token;
    await db.collection("bookings").updateOne({ _id: recentDone[0]._id }, { $set: { shareLink: l.shareLink, "parentCheck.sentAt": now } }); }
  await db.collection("bookings").updateOne({ _id: recentDone[6]._id }, { $set: {
    "parentCheck.status": "denied", "parentCheck.comment": "My son said the class ended after 15 minutes.",
    disputeRaised: true, disputeStatus: "pending", disputedBy: "parent", disputeReason: "Class ended early",
  } });

  // ── Logged classes (held outside the app, awaiting approval) ─────────────
  const logged = [[0, -1, "googlemeet", "Power cut at the office — moved the class to Google Meet."],
    [3, -1, "zoom", "Student's tablet couldn't open the classroom, used Zoom."],
    [7, -3, "googlemeet", "Platform maintenance window."]].map(([si, d, platform, reason], i) => {
    const s = students[si]; const t = teacherOf(s, si); const when = daysFrom(d, 10 + i);
    return {
      _id: oid(), teacherId: t._id, studentId: s._id, classTitle: `${s.rank} English with ${t.firstName}`, topic: pick(topics, i + 3),
      scheduledTime: when, duration: 45, status: i < 2 ? "pending_confirmation" : "completed", notes: "", createdBy: "teacher",
      createdByUserId: t._id, createdByUserModel: "Teacher", markedBy: "teacher", attendanceConfirmedBy: "teacher",
      parentCheck: { status: i < 2 ? null : "confirmed", comment: "", history: [] }, loggedByTeacher: true, teacherConfirmedAt: when,
      teacherTimezone: TZ, studentTimezone: TZ, disputeRaised: false, disputeStatus: null,
      offline: { platform, reason, loggedAt: new Date(when.getTime() + 3600000),
        approval: { status: i < 2 ? "pending" : "approved", ...(i < 2 ? {} : { decidedAt: daysFrom(-2), decidedBy: adminId }), note: "" } },
      createdAt: when, updatedAt: when, ...(i < 2 ? {} : { completedAt: when }),
    };
  });
  await db.collection("bookings").insertMany(logged);
  await db.collection("recordings").insertMany(logged.slice(0, 2).map((b) => ({
    _id: oid(), bookingId: b._id, teacherId: b.teacherId, studentId: b.studentId, title: "", source: "external",
    externalUrl: "https://drive.google.com/file/d/demo-recording/view", note: "Full class recording", duration: 0,
    visibleToStudent: false, createdAt: b.createdAt, updatedAt: b.createdAt,
  })));

  // ── Parents, certificates ─────────────────────────────────────────────────
  await db.collection("parents").insertMany([["Hung", "Tran", [0]], ["Thu", "Pham", [1]], ["Long", "Le", [2, 12]], ["Yen", "Vo", [3]]]
    .map(([firstName, lastName, kids], i) => ({
      _id: oid(), firstName, lastName, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@familyenglish.demo`,
      password: null, phone: `+84 91 222 33${i}${i}`, active: i !== 3, status: i === 3 ? "pending" : "active",
      children: kids.map((k) => students[k]._id), notes: "", sessions: [], knownDevices: [], hasAcceptedTerms: true,
      createdAt: daysFrom(-30 + i), updatedAt: now,
    })));
  await db.collection("certificates").insertMany([[5, 10, "English Starter Certificate"], [14, 25, "English Foundation Certificate"],
    [10, 10, "English Starter Certificate"], [3, 10, "English Starter Certificate"]].map(([si, milestone, title], i) => ({
    _id: oid(), studentId: students[si]._id, teacherId: teacherOf(students[si], si)._id, type: "completion", title,
    description: `Successfully completed ${milestone} English lessons`, milestone, classesCompleted: milestone,
    certificateNumber: `SEA-2026-${1040 + i}`, issuedAt: daysFrom(-i * 4 - 1), issuedBy: "system", revokedAt: null,
    createdAt: daysFrom(-i * 4 - 1), updatedAt: daysFrom(-i * 4 - 1),
  })));

  // ── Sub-admin + activity notifications ────────────────────────────────────
  const subAdminId = oid();
  await db.collection("subadmins").insertOne({
    _id: subAdminId, firstName: "Bich", lastName: "Ngoc", email: "bich.ngoc@familyenglish.demo", password: null, status: "active",
    assignmentType: "manual", region: null, assignedTeachers: [teachers[1]._id, teachers[4]._id],
    permissions: { canMarkLessons: true, canViewPayments: false, canSendMessages: true, canViewBookings: true, canViewClasses: true },
    ringEnabled: true, twoFactorEnabled: false, twoFactorBackupCodes: [], sessions: [], knownDevices: [],
    createdAt: daysFrom(-20), updatedAt: now,
  });
  await db.collection("notifications").insertMany([
    ["lesson_marked", "Bich Ngoc marked Bao Le's class with David as completed", -0.1],
    ["message_sent", "Bich Ngoc messaged Grace Mensah about Saturday Story Club", -0.4],
    ["booking_created", "Bich Ngoc booked a class for Lan Truong with Grace (Mon 9:00)", -1],
    ["lesson_marked", "Bich Ngoc marked Duc Bui's class as missed (student absent)", -2],
  ].map(([type, message, d], i) => ({
    _id: oid(), type, message, subAdminId, subAdminName: "Bich Ngoc", metadata: {}, read: i > 1,
    createdAt: new Date(now.getTime() + d * 86400000),
  })));

  // ── Direct messages ───────────────────────────────────────────────────────
  const msg = (from, model, role, name, text, minsAgo) => ({ _id: oid(), senderId: from, senderModel: model, senderName: name,
    senderRole: role, message: text, isRead: minsAgo > 60, deleted: false, readBy: [], createdAt: new Date(now.getTime() - minsAgo * 60000) });
  const dm = (t, lines) => {
    const messages = lines.map(([who, text, mins]) => who === "a"
      ? msg(adminId, "Admin", "admin", "Linh", text, mins)
      : msg(t._id, "Teacher", "teacher", `${t.firstName} ${t.lastName}`, text, mins));
    const last = messages[messages.length - 1];
    return { _id: oid(), type: "teacher-admin", teacherId: t._id, chatName: `${t.firstName} ${t.lastName} ↔ Admin`,
      unreadCount: { admin: last.senderRole === "teacher" ? 1 : 0, teacher: 0, student: 0, subAdmin: 0 }, messages,
      lastMessage: { text: last.message, senderId: last.senderId, senderName: last.senderName, timestamp: last.createdAt },
      lastActivityAt: last.createdAt, createdAt: messages[0].createdAt, updatedAt: last.createdAt };
  };
  await db.collection("directmessages").insertMany([
    dm(teachers[4], [["t", "Good morning! Can Lan move her class to 9:30 tomorrow? 🙏", 50], ["a", "Sure, I'll update it now.", 45], ["t", "Thank you so much! 💛", 12]]),
    dm(teachers[0], [["a", "Hi Sarah, Mai's mum asked for extra IELTS homework this week.", 300], ["t", "Of course — I'll send a magic link tonight 👍", 280]]),
    dm(teachers[3], [["t", "Phuc scored 92% on the reading quiz! 🎉", 1500], ["a", "Amazing, please tell him well done!", 1490]]),
  ]);

  // ── Class summaries (most classes have one; the latest ones still need one) ──
  const summaries = [
    "We practised the past simple with a story about a trip to the beach. {n} used went, saw and ate correctly 👏. Still mixing up 'goed' → 'went'. Practise at home: tell a family member about your weekend in 5 sentences.",
    "Topic: animals & colours. {n} named 12 animals and described them with colours — great confidence today! 🌟 Home practice: draw 3 animals and say one sentence about each.",
    "IELTS Speaking Part 2 — 'Describe a place you like'. {n} spoke for 1:45 with good linking words. Work on: longer answers and the 'th' sound. Homework: record a 2-minute answer.",
    "Phonics: short vowels a/e/i. {n} read 20 CVC words with only 2 mistakes 🎉. Please read the word cards together for 5 minutes each evening.",
    "Prepositions of place (in / on / under / next to). {n} did very well in the hide-and-seek game. Next class: between and behind. Practise: describe your bedroom.",
  ];
  const nameOf = Object.fromEntries(students.map((s) => [String(s._id), s.firstName]));
  const seen = {};
  const toSummarise = recentDone.filter((b) => (seen[b.teacherId] = (seen[b.teacherId] || 0) + 1) > 2);
  await db.collection("bookings").bulkWrite(toSummarise.map((b, i) => ({ updateOne: { filter: { _id: b._id }, update: { $set: {
    classSummary: { text: pick(summaries, i).replace("{n}", nameOf[String(b.studentId)]), updatedAt: new Date(b.completedAt.getTime() + 20 * 60000), by: b.teacherId },
  } } } })));
  await db.collection("groupclasses").updateOne({ status: "completed" }, { $set: { classSummary: {
    text: "Conversation Café ☕ — we talked about favourite foods and ordering in a restaurant. Everyone spoke at least 5 times! Practise: order dinner in English at home tonight 🍜.",
    updatedAt: daysFrom(-2, 11, 30), by: teachers[2]._id } } });

  // ── Teacher responses to admin bookings → admin notifications ────────────
  await db.collection("notifications").insertMany([
    ["booking_accepted", teachers[0], `Sarah Mitchell accepted the class "B2 English with Sarah" with Mai Hoang.`, -0.05, {}],
    ["booking_rejected", teachers[2], `Emily Carter declined the class "A2 English with Emily" with Thao Vu. Reason: I'm at a teacher training on Saturday morning.`, -0.2, { reason: "I'm at a teacher training on Saturday morning." }],
    ["booking_accepted", teachers[3], `James Nguyen accepted the class "B1 English with James" with An Vo.`, -0.6, {}],
  ].map(([type, t, message, d, meta]) => ({ _id: oid(), type, message, actorName: `${t.firstName} ${t.lastName}`, actorRole: "teacher",
    metadata: { teacherName: `${t.firstName} ${t.lastName}`, ...meta }, read: false, createdAt: new Date(now.getTime() + d * 86400000) })));

  // ── A class starting in a few minutes (shows "Remind to join") ───────────
  const soon = new Date(Date.now() + 8 * 60000);
  await db.collection("bookings").insertOne({
    _id: oid(), teacherId: teachers[0]._id, studentId: students[5]._id, classTitle: "B2 English with Sarah", topic: "Job interview practice",
    scheduledTime: soon, duration: 45, status: "accepted", notes: "", createdBy: "admin", createdByUserId: adminId, createdByUserModel: "Admin",
    parentCheck: { status: null, comment: "", history: [] }, teacherTimezone: TZ, studentTimezone: TZ, disputeRaised: false, disputeStatus: null,
    createdAt: daysFrom(-2), updatedAt: daysFrom(-2),
  });
  await db.collection("students").updateOne({ _id: students[5]._id }, { $set: { notifyEmail: "parent.hoang@familyenglish.demo", joinReminderTeacherAllowed: true } });

  console.log(`✅ Demo center "${SLUG}" seeded: ${teachers.length} teachers, ${students.length} students, ${bookings.length} bookings`);
  console.log(JSON.stringify(demoLinks));
}

main()
  .catch((err) => { console.error("❌ Seed failed:", err); process.exitCode = 1; })
  .finally(() => mongoose.connection.close());
