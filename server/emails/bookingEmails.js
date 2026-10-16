// Booking emails — class requests, confirmations, reminders, completions.
// Built on the shared layout (layout.js). Student emails follow the student's
// emailLanguage (i18n.js); teacher emails are English.
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, list, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const fullName = (u) => esc(`${u?.firstName || ""} ${u?.lastName || ""}`.trim());

// ── Teacher: admin booked a class for you ────────────────────────────────────────
export const sendBookingRequestToTeacher = async (teacher, student, booking, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const tz = teacher?.timezone;
  return sendEmail({
    centerName: b.centerName,
    to: teacher.email,
    subject: `New class request – ${student.firstName} ${student.lastName}`,
    html: renderEmail({
      ...b,
      preheader: `${booking.classTitle} · ${fmtDate(booking.scheduledTime, "en", tz)}`,
      eyebrow: "New class request",
      title: `Hi ${teacher.firstName}, you have a new class`,
      body:
        p("A class has been booked for you. Please check the details and accept or decline it.") +
        details([
          ["Student", fullName(student)],
          ["Class", esc(booking.classTitle)],
          ["Topic", booking.topic && esc(booking.topic)],
          ["Date", fmtDate(booking.scheduledTime, "en", tz)],
          ["Time", fmtTime(booking.scheduledTime, "en", tz)],
          ["Duration", `${booking.duration} minutes`],
          ["Notes", booking.notes && esc(booking.notes)],
        ]),
      cta: { label: "Review request", href: `${b.baseUrl}/teacher/dashboard?tab=bookings` },
      after: "Please reply soon — your student is waiting to hear back.",
    }),
  });
};

// ── Student: teacher accepted your class ─────────────────────────────────────────
const ACCEPTED = {
  en: {
    subject: (t) => `Your class with ${t} is confirmed`,
    eyebrow: "Class confirmed",
    title: (n) => `You're all set, ${n}! 🎉`,
    intro: (t) => `${t} accepted your class. Here are the details:`,
    labels: ["Class", "Topic", "Date", "Time", "Duration", "Teacher"], minutes: "minutes",
    tip: "<strong>Tip:</strong> join 5 minutes early so your camera and microphone are ready.",
    cta: "Open my classes", after: "We'll remind you again before the class.",
  },
  vi: {
    subject: (t) => `Lớp học với ${t} đã được xác nhận`,
    eyebrow: "Đã xác nhận lớp học",
    title: (n) => `Sẵn sàng rồi, ${n} ơi! 🎉`,
    intro: (t) => `${t} đã chấp nhận lớp học của em. Thông tin lớp học:`,
    labels: ["Lớp học", "Chủ đề", "Ngày", "Giờ", "Thời lượng", "Giáo viên"], minutes: "phút",
    tip: "<strong>Mẹo:</strong> vào lớp sớm 5 phút để kiểm tra camera và micro.",
    cta: "Xem lớp học của em", after: "Chúng tôi sẽ nhắc em lần nữa trước giờ học.",
  },
};
export const sendBookingAcceptedToStudent = async (student, teacher, booking, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(ACCEPTED, lang), tz = student?.timezone;
  const L = s.labels, tName = `${teacher.firstName} ${teacher.lastName}`;
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(tName),
    html: renderEmail({
      ...b, lang,
      preheader: `${fmtDate(booking.scheduledTime, lang, tz)} · ${booking.classTitle}`,
      eyebrow: s.eyebrow,
      title: s.title(student.firstName),
      body:
        p(s.intro(esc(tName))) +
        details([
          [L[0], esc(booking.classTitle)],
          [L[1], booking.topic && esc(booking.topic)],
          [L[2], fmtDate(booking.scheduledTime, lang, tz)],
          [L[3], fmtTime(booking.scheduledTime, lang, tz)],
          [L[4], `${booking.duration} ${s.minutes}`],
          [L[5], esc(tName)],
        ]) +
        callout(s.tip, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard?tab=classes` },
      after: s.after,
    }),
  });
};

// ── Student: teacher declined your class ─────────────────────────────────────────
const REJECTED = {
  en: {
    subject: (c) => `Update on your class request – ${c}`,
    eyebrow: "Class request update",
    title: "This time didn't work out",
    intro: (n, t, d) => `Hi ${n}, ${t} isn't available for your class on ${d}.`,
    note: "Teacher's note", labels: ["Class", "Date", "Time"],
    more: "No problem — you can book another time that suits you.",
    cta: "Book another class",
  },
  vi: {
    subject: (c) => `Cập nhật yêu cầu lớp học – ${c}`,
    eyebrow: "Cập nhật lớp học",
    title: "Lần này chưa sắp xếp được",
    intro: (n, t, d) => `Chào ${n}, ${t} không thể dạy lớp của em vào ${d}.`,
    note: "Lời nhắn của giáo viên", labels: ["Lớp học", "Ngày", "Giờ"],
    more: "Không sao cả — em có thể đặt một giờ khác phù hợp hơn.",
    cta: "Đặt lớp khác",
  },
};
export const sendBookingRejectedToStudent = async (student, teacher, booking, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(REJECTED, lang), tz = student?.timezone;
  const reason = booking.rejectionReason && booking.rejectionReason !== "No reason provided" ? booking.rejectionReason : "";
  const date = fmtDate(booking.scheduledTime, lang, tz);
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(booking.classTitle),
    html: renderEmail({
      ...b, lang,
      preheader: s.more,
      eyebrow: s.eyebrow,
      title: s.title,
      body:
        p(s.intro(esc(student.firstName), fullName(teacher), date)) +
        (reason ? callout(`<strong>${s.note}:</strong> ${esc(reason)}`, "blue") : "") +
        details([
          [s.labels[0], esc(booking.classTitle)],
          [s.labels[1], date],
          [s.labels[2], fmtTime(booking.scheduledTime, lang, tz)],
        ]) +
        p(s.more),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard` },
    }),
  });
};

// ── Student or teacher: class is tomorrow ────────────────────────────────────────
const TOMORROW = {
  en: {
    subject: (t) => `Reminder: your class is tomorrow at ${t}`,
    eyebrow: "Class tomorrow", title: (n) => `See you tomorrow, ${n}!`,
    intro: "A friendly reminder about your class:",
    labels: ["Class", "Date", "Time", "Duration"], minutes: "minutes",
    before: "<strong>Before class:</strong>",
    checklist: ["Check your internet connection", "Test your camera and microphone", "Have your materials ready", "Join 5 minutes early"],
    cta: "Go to my dashboard",
  },
  vi: {
    subject: (t) => `Nhắc nhở: em có lớp học vào ngày mai lúc ${t}`,
    eyebrow: "Lớp học ngày mai", title: (n) => `Hẹn gặp em ngày mai, ${n}!`,
    intro: "Nhắc em về lớp học sắp tới:",
    labels: ["Lớp học", "Ngày", "Giờ", "Thời lượng"], minutes: "phút",
    before: "<strong>Trước giờ học:</strong>",
    checklist: ["Kiểm tra kết nối internet", "Thử camera và micro", "Chuẩn bị sẵn tài liệu", "Vào lớp sớm 5 phút"],
    cta: "Vào trang của em",
  },
};
export const sendClassReminder = async (user, booking, role, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = role === "student" ? langOf(user) : "en";
  const s = pick(TOMORROW, lang), tz = user?.timezone;
  const time = fmtTime(booking.scheduledTime, lang, tz);
  return sendEmail({
    centerName: b.centerName,
    to: user.email,
    subject: s.subject(time),
    html: renderEmail({
      ...b, lang,
      preheader: `${booking.classTitle} · ${time}`,
      eyebrow: s.eyebrow,
      title: s.title(user.firstName),
      body:
        p(s.intro) +
        details([
          [s.labels[0], esc(booking.classTitle)],
          [s.labels[1], fmtDate(booking.scheduledTime, lang, tz)],
          [s.labels[2], time],
          [s.labels[3], `${booking.duration} ${s.minutes}`],
        ]) +
        callout(`${s.before}${list(s.checklist, { color: "#92400e" }).replace("margin:0 0 16px", "margin:6px 0 0")}`, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}/${role}/dashboard` },
    }),
  });
};

// ── Class marked completed (teacher + student) ──────────────────────────────────
const DONE = {
  en: {
    subject: "Class completed — great job!", eyebrow: "Class completed",
    title: (n) => `Well done, ${n}! 🎓`,
    intro: (c, t) => `Your class "${c}" with ${t} is complete.`,
    left: "Classes remaining", keep: "Keep up the great work!", cta: "Open my dashboard",
  },
  vi: {
    subject: "Đã hoàn thành lớp học — làm tốt lắm!", eyebrow: "Hoàn thành lớp học",
    title: (n) => `Giỏi lắm, ${n}! 🎓`,
    intro: (c, t) => `Em đã hoàn thành lớp "${c}" với ${t}.`,
    left: "Số buổi học còn lại", keep: "Tiếp tục cố gắng nhé!", cta: "Vào trang của em",
  },
};
export const sendClassCompletedNotification = async (teacher, student, booking, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(DONE, lang);
  await Promise.all([
    sendEmail({
      centerName: b.centerName,
      to: teacher.email,
      subject: "Class completed – payment pending",
      html: renderEmail({
        ...b, tone: "green",
        preheader: `${booking.classTitle} with ${student.firstName} ${student.lastName}`,
        eyebrow: "Class completed",
        title: `Nice work, ${teacher.firstName}! 🎉`,
        body:
          p(`Your class "${esc(booking.classTitle)}" with ${fullName(student)} has been marked as completed.`) +
          (teacher.ratePerClass != null
            ? details([["Added to pending earnings", `$${esc(teacher.ratePerClass)}`]])
            : ""),
        cta: { label: "View my earnings", href: `${b.baseUrl}/teacher/dashboard?tab=payment`, tone: "green" },
      }),
    }),
    sendEmail({
      centerName: b.centerName,
      to: student.email,
      subject: s.subject,
      html: renderEmail({
        ...b, lang, tone: "green",
        preheader: s.keep,
        eyebrow: s.eyebrow,
        title: s.title(student.firstName),
        body:
          p(s.intro(esc(booking.classTitle), fullName(teacher))) +
          (student.classCredits != null ? details([[s.left, String(student.classCredits)]]) : "") +
          p(s.keep),
        cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard`, tone: "green" },
      }),
    }),
  ]);
};

// ── Student: a class was booked for you (waiting for the teacher) ───────────────
const BOOKED = {
  en: {
    subject: (c) => `Class booked – ${c}`, eyebrow: "Class booked",
    title: (n) => `Your class is booked, ${n}!`,
    intro: (t) => `Your class with <strong>${t}</strong> is booked. Your teacher will confirm it shortly.`,
    labels: ["Class", "Topic", "Date", "Time", "Duration", "Teacher"], minutes: "minutes",
    cta: "Open my dashboard",
  },
  vi: {
    subject: (c) => `Đã đặt lớp – ${c}`, eyebrow: "Đã đặt lớp",
    title: (n) => `Đã đặt lớp xong rồi, ${n}!`,
    intro: (t) => `Lớp học của em với <strong>${t}</strong> đã được đặt. Giáo viên sẽ xác nhận sớm.`,
    labels: ["Lớp học", "Chủ đề", "Ngày", "Giờ", "Thời lượng", "Giáo viên"], minutes: "phút",
    cta: "Vào trang của em",
  },
};
export const sendBookingCreatedToStudent = async (student, teacher, booking, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(BOOKED, lang), tz = student?.timezone, L = s.labels;
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(booking.classTitle),
    html: renderEmail({
      ...b, lang,
      preheader: `${fmtDate(booking.scheduledTime, lang, tz)} · ${booking.classTitle}`,
      eyebrow: s.eyebrow,
      title: s.title(student.firstName),
      body:
        p(s.intro(fullName(teacher))) +
        details([
          [L[0], esc(booking.classTitle)],
          [L[1], booking.topic && esc(booking.topic)],
          [L[2], fmtDate(booking.scheduledTime, lang, tz)],
          [L[3], fmtTime(booking.scheduledTime, lang, tz)],
          [L[4], `${booking.duration} ${s.minutes}`],
          [L[5], fullName(teacher)],
        ]),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard` },
    }),
  });
};

// ── Student or teacher: class starts in 60 / 30 / 5 minutes ─────────────────────
const SOON = {
  en: {
    when: (m) => (m <= 5 ? "starts in 5 minutes — join now!" : `starts in ${m === 60 ? "1 hour" : `${m} minutes`}`),
    subject: (w, c) => `Your class ${w} – ${c}`,
    eyebrow: (m) => (m <= 5 ? "Starting now" : "Class reminder"),
    title: (c) => c, intro: (n, w) => `Hi ${n}, your class ${w}`,
    labels: ["Starts at", "Duration"], minutes: "minutes",
    now: "Please join the class right away.", cta: "Join class",
  },
  vi: {
    when: (m) => (m <= 5 ? "bắt đầu sau 5 phút — vào lớp ngay!" : `bắt đầu sau ${m === 60 ? "1 giờ" : `${m} phút`}`),
    subject: (w, c) => `Lớp học của em ${w} – ${c}`,
    eyebrow: (m) => (m <= 5 ? "Sắp bắt đầu" : "Nhắc lớp học"),
    title: (c) => c, intro: (n, w) => `Chào ${n}, lớp học của em ${w}`,
    labels: ["Bắt đầu lúc", "Thời lượng"], minutes: "phút",
    now: "Em vào lớp ngay nhé.", cta: "Vào lớp",
  },
};
export const sendClassTimedReminder = async (user, booking, role, minutesLeft, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = role === "student" ? langOf(user) : "en";
  const s = pick(SOON, lang), tz = user?.timezone;
  const tone = minutesLeft <= 5 ? "red" : minutesLeft <= 30 ? "amber" : "accent";
  const when = s.when(minutesLeft);
  return sendEmail({
    centerName: b.centerName,
    to: user.email,
    subject: s.subject(when, booking.classTitle),
    html: renderEmail({
      ...b, lang, tone,
      preheader: `${fmtTime(booking.scheduledTime, lang, tz)} · ${booking.classTitle}`,
      eyebrow: s.eyebrow(minutesLeft),
      title: s.title(booking.classTitle),
      body:
        p(s.intro(esc(user.firstName), when)) +
        details([
          [s.labels[0], fmtTime(booking.scheduledTime, lang, tz)],
          [s.labels[1], `${booking.duration} ${s.minutes}`],
        ]) +
        (minutesLeft <= 5 ? callout(`<strong>${s.now}</strong>`, "red") : ""),
      cta: { label: s.cta, href: `${b.baseUrl}/${role}/dashboard`, tone: tone === "accent" ? "accent" : tone },
    }),
  });
};
