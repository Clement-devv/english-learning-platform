// Family link emails for managed students (no login) — sent to the family's notification
// address in the student's emailLanguage (utils/familyLinkEmails.js):
//   • parent attendance check ("did your child attend?")
//   • new homework / new quiz, with the share link
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const NAMES_NOTE = {
  en: "When you open the link, you'll be asked for the student's name and the teacher's name.",
  vi: "Khi mở đường dẫn, quý phụ huynh sẽ được hỏi tên học sinh và tên giáo viên.",
};

const CHECK = {
  en: {
    subject: (n, t) => `Did ${n} attend? – ${t}`, eyebrow: "Class check",
    intro: (tn, n) => `${tn} marked <strong>${n}</strong> as present in this class. Please let us know if that's right.`,
    labels: ["Class", "Date", "Teacher", "Answer by"],
    noReply: "If we don't hear from you by then, the class counts as attended.",
    cta: "Answer now",
  },
  vi: {
    subject: (n, t) => `${n} có tham gia buổi học không? – ${t}`, eyebrow: "Xác nhận buổi học",
    intro: (tn, n) => `${tn} đã đánh dấu <strong>${n}</strong> có mặt trong buổi học này. Quý phụ huynh vui lòng xác nhận giúp.`,
    labels: ["Buổi học", "Ngày", "Giáo viên", "Trả lời trước"],
    noReply: "Nếu không nhận được trả lời trước thời hạn, buổi học sẽ được tính là đã tham gia.",
    cta: "Trả lời ngay",
  },
};

export const sendParentCheckLinkEmail = async ({ student, to, cls, teacherName, url, expiresAt, center = null, centerName = "" }) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(CHECK, lang), tz = student?.timezone;
  const name = esc(student.firstName);
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: s.subject(student.firstName, cls.title),
    html: renderEmail({
      ...b, lang, tone: "amber",
      preheader: s.intro(esc(teacherName), name).replace(/<[^>]+>/g, ""),
      eyebrow: s.eyebrow,
      title: cls.title,
      body:
        p(s.intro(esc(teacherName), name)) +
        details([
          [s.labels[0], esc(cls.title)],
          [s.labels[1], `${fmtDate(cls.scheduledTime, lang, tz)} · ${fmtTime(cls.scheduledTime, lang, tz)}`],
          [s.labels[2], esc(teacherName)],
          [s.labels[3], `${fmtDate(expiresAt, lang, tz)} · ${fmtTime(expiresAt, lang, tz)}`],
        ]) +
        callout(esc(`${pick(NAMES_NOTE, lang)} ${s.noReply}`), "amber"),
      cta: { label: s.cta, href: url, tone: "amber" },
    }),
  });
};

const LINK = {
  homework: {
    en: { subject: (n, t) => `New homework for ${n} – ${t}`, eyebrow: "New homework",
      intro: (tn, n) => `${tn} has set new homework for <strong>${n}</strong>.`, labels: ["Homework", "Due", "Teacher"], cta: "Open homework" },
    vi: { subject: (n, t) => `Bài tập mới cho ${n} – ${t}`, eyebrow: "Bài tập mới",
      intro: (tn, n) => `${tn} vừa giao bài tập mới cho <strong>${n}</strong>.`, labels: ["Bài tập", "Hạn nộp", "Giáo viên"], cta: "Mở bài tập" },
  },
  quiz: {
    en: { subject: (n, t) => `New quiz for ${n} – ${t}`, eyebrow: "New quiz",
      intro: (tn, n) => `${tn} has set a new quiz for <strong>${n}</strong>.`, labels: ["Quiz", "Due", "Teacher"], cta: "Start the quiz" },
    vi: { subject: (n, t) => `Bài kiểm tra mới cho ${n} – ${t}`, eyebrow: "Bài kiểm tra mới",
      intro: (tn, n) => `${tn} vừa giao bài kiểm tra mới cho <strong>${n}</strong>.`, labels: ["Bài kiểm tra", "Hạn", "Giáo viên"], cta: "Làm bài kiểm tra" },
  },
};

/** kind: "homework" | "quiz" */
export const sendShareLinkEmail = async ({ kind, student, to, title, dueDate, teacherName, url, center = null, centerName = "" }) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(LINK[kind], lang), tz = student?.timezone;
  const name = esc(student.firstName);
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: s.subject(student.firstName, title),
    html: renderEmail({
      ...b, lang, tone: "blue",
      preheader: `${s.labels[1]}: ${fmtDate(dueDate, lang, tz)}`,
      eyebrow: s.eyebrow,
      title,
      body:
        p(s.intro(esc(teacherName), name)) +
        details([[s.labels[0], esc(title)], [s.labels[1], fmtDate(dueDate, lang, tz)], [s.labels[2], esc(teacherName)]]) +
        callout(esc(pick(NAMES_NOTE, lang)), "blue"),
      cta: { label: s.cta, href: url, tone: "blue" },
    }),
  });
};
