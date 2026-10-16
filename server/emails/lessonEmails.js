// Lesson status emails sent when an admin marks / reverses a lesson, and the
// "please join your class" reminder. Built on the shared layout; student emails
// follow the student's emailLanguage (i18n.js).
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const fullName = (u) => esc(`${u?.firstName || ""} ${u?.lastName || ""}`.trim());
const when = (d, lang, tz) => `${fmtDate(d, lang, tz)} · ${fmtTime(d, lang, tz)}`;

const MARKED = {
  en: {
    subject: "Lesson marked completed", eyebrow: "Lesson completed", title: (n) => `Nice one, ${n}! 📚`,
    intro: "Your school marked this lesson as completed:", labels: ["Class", "Teacher", "Date", "Classes remaining"],
    after: "It's now in your completed classes. Keep up the great work! 🎓",
  },
  vi: {
    subject: "Buổi học đã được đánh dấu hoàn thành", eyebrow: "Hoàn thành buổi học", title: (n) => `Giỏi lắm, ${n}! 📚`,
    intro: "Trung tâm đã đánh dấu buổi học này là hoàn thành:", labels: ["Lớp học", "Giáo viên", "Ngày", "Số buổi còn lại"],
    after: "Buổi học đã được thêm vào danh sách đã hoàn thành. Tiếp tục cố gắng nhé! 🎓",
  },
};
export const sendLessonMarkedEmails = async (teacher, student, booking, centerName = "") => {
  const b = brandOf(null, centerName);
  const lang = langOf(student), s = pick(MARKED, lang);
  await Promise.all([
    sendEmail({
      centerName: b.centerName, to: teacher.email, subject: "Lesson marked completed",
      html: renderEmail({
        ...b, baseUrl: null, tone: "green",
        preheader: `${booking.classTitle} with ${student.firstName} ${student.lastName}`,
        eyebrow: "Lesson completed", title: `Hi ${teacher.firstName}, a lesson was marked completed`,
        body:
          p("An admin marked this lesson as completed:") +
          details([
            ["Class", esc(booking.classTitle)],
            ["Student", fullName(student)],
            ["Date", when(booking.scheduledTime, "en", teacher?.timezone)],
            ["Amount added", teacher.ratePerClass != null ? `$${esc(teacher.ratePerClass)}` : null],
          ]),
        after: "Your earnings are updated — see your salary dashboard for details.",
      }),
    }),
    sendEmail({
      centerName: b.centerName, to: student.email, subject: s.subject,
      html: renderEmail({
        ...b, baseUrl: null, lang, tone: "green",
        preheader: s.after,
        eyebrow: s.eyebrow, title: s.title(student.firstName),
        body:
          p(s.intro) +
          details([
            [s.labels[0], esc(booking.classTitle)],
            [s.labels[1], fullName(teacher)],
            [s.labels[2], when(booking.scheduledTime, lang, student?.timezone)],
            [s.labels[3], student.classCredits != null ? String(student.classCredits) : null],
          ]),
        after: s.after,
      }),
    }),
  ]);
};

const UNMARKED = {
  en: {
    subject: "Lesson status updated", eyebrow: "Lesson update", title: "A lesson was changed to not completed",
    intro: (n) => `Hi ${n}, your school reviewed a lesson and changed it to not completed:`,
    labels: ["Class", "Teacher", "Date", "Reason"], restored: "<strong>1 class has been returned</strong> to your account.",
    after: "Questions? Contact your school.",
  },
  vi: {
    subject: "Cập nhật trạng thái buổi học", eyebrow: "Cập nhật buổi học", title: "Một buổi học đã được chuyển sang chưa hoàn thành",
    intro: (n) => `Chào ${n}, trung tâm đã xem xét và chuyển một buổi học sang chưa hoàn thành:`,
    labels: ["Lớp học", "Giáo viên", "Ngày", "Lý do"], restored: "<strong>1 buổi học đã được hoàn lại</strong> vào tài khoản của em.",
    after: "Có thắc mắc? Hãy liên hệ trung tâm.",
  },
};
export const sendLessonUnmarkedEmails = async (teacher, student, booking, reason, centerName = "") => {
  const b = brandOf(null, centerName);
  const lang = langOf(student), s = pick(UNMARKED, lang);
  await Promise.all([
    sendEmail({
      centerName: b.centerName, to: teacher.email, subject: "Lesson completion reversed",
      html: renderEmail({
        ...b, baseUrl: null, tone: "red",
        preheader: `${booking.classTitle} with ${student.firstName} ${student.lastName}`,
        eyebrow: "Lesson reversed", title: `Hi ${teacher.firstName}, a lesson was marked not completed`,
        body:
          p("An admin reversed this lesson's completion:") +
          details([
            ["Class", esc(booking.classTitle)],
            ["Student", fullName(student)],
            ["Date", when(booking.scheduledTime, "en", teacher?.timezone)],
            ["Amount deducted", teacher.ratePerClass != null ? `$${esc(teacher.ratePerClass)}` : null],
            ["Reason", reason && esc(reason)],
          ]),
        after: "Your earnings were adjusted. Contact your admin if you have questions.",
      }),
    }),
    sendEmail({
      centerName: b.centerName, to: student.email, subject: s.subject,
      html: renderEmail({
        ...b, baseUrl: null, lang, tone: "amber",
        preheader: s.after,
        eyebrow: s.eyebrow, title: s.title,
        body:
          p(s.intro(esc(student.firstName))) +
          details([
            [s.labels[0], esc(booking.classTitle)],
            [s.labels[1], fullName(teacher)],
            [s.labels[2], when(booking.scheduledTime, lang, student?.timezone)],
            [s.labels[3], reason && esc(reason)],
          ]) +
          callout(s.restored, "green"),
        after: s.after,
      }),
    }),
  ]);
};

// ── "Your class has started / starts soon — please join" ────────────────────────
const JOIN = {
  en: {
    subject: (st) => (st ? "Your class has started — please join now" : "Your class starts soon — please get ready to join"),
    eyebrow: (st) => (st ? "Class started" : "Starting soon"),
    title: (n) => `${n}, your teacher is waiting!`,
    intro: (st, t) => `${st ? "Your class has <strong>already started</strong>" : "Your class starts soon"} and ${t} is waiting for you:`,
    labels: ["Class", "Length"], minutes: "minutes",
    join: "Join the class", open: "Open my classes", noLink: "Please join using the class link your teacher shared with you.",
    why: (who, c) => `You're receiving this because your ${who} sent a reminder from ${c}.`, teacher: "teacher", school: "school",
  },
  vi: {
    subject: (st) => (st ? "Lớp học đã bắt đầu — em vào lớp ngay nhé" : "Lớp học sắp bắt đầu — em chuẩn bị vào lớp nhé"),
    eyebrow: (st) => (st ? "Lớp học đã bắt đầu" : "Sắp bắt đầu"),
    title: (n) => `${n} ơi, giáo viên đang đợi em!`,
    intro: (st, t) => `${st ? "Lớp học của em <strong>đã bắt đầu</strong>" : "Lớp học của em sắp bắt đầu"} và ${t} đang đợi em:`,
    labels: ["Lớp học", "Thời lượng"], minutes: "phút",
    join: "Vào lớp", open: "Xem lớp học của em", noLink: "Em hãy vào lớp bằng đường link giáo viên đã gửi.",
    why: (who, c) => `Em nhận được email này vì ${who} của em đã gửi lời nhắc từ ${c}.`, teacher: "giáo viên", school: "trung tâm",
  },
};
/**
 * @param {object} o
 * @param {string} o.to           address to send to (notifyEmail for managed students)
 * @param {object} o.student      student doc (firstName, isManaged, emailLanguage)
 * @param {object} o.booking      booking (classTitle, duration)
 * @param {string} o.teacherName
 * @param {string} o.meetLink     direct class link (managed students have no login)
 * @param {boolean} o.started
 * @param {"teacher"|"admin"} o.byRole
 * @param {object} o.center
 */
export const sendJoinReminderEmail = ({ to, student, booking, teacherName, meetLink, started, byRole, center }) => {
  const b = brandOf(center, center?.centerName);
  const lang = langOf(student), s = pick(JOIN, lang);
  const cta = student.isManaged
    ? (meetLink ? { label: s.join, href: meetLink } : null)
    : { label: s.open, href: `${b.baseUrl}/student/dashboard` };
  return sendEmail({
    centerName: b.centerName, to,
    subject: s.subject(started),
    html: renderEmail({
      ...b, lang, tone: started ? "red" : "amber",
      preheader: `${booking.classTitle || ""}`,
      eyebrow: s.eyebrow(started), title: s.title(student.firstName || ""),
      body:
        p(s.intro(started, esc(teacherName))) +
        details([[s.labels[0], esc(booking.classTitle || "Class")], [s.labels[1], `${booking.duration || 60} ${s.minutes}`]]) +
        (student.isManaged && !meetLink ? p(s.noLink) : ""),
      cta: cta && { ...cta, tone: started ? "red" : "accent" },
      after: s.why(byRole === "teacher" ? s.teacher : s.school, esc(b.centerName)),
    }),
  });
};
