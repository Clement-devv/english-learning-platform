// Homework emails. Student emails follow the student's emailLanguage (i18n.js).
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const fullName = (u) => esc(`${u?.firstName || ""} ${u?.lastName || ""}`.trim());

const ASSIGNED = {
  en: {
    subject: (t) => `New homework – ${t}`, eyebrow: "New homework",
    intro: (n, t) => `Hi ${n}, <strong>${t}</strong> has set you new homework.`,
    labels: ["Due", "Teacher"], instructions: "Instructions", cta: "Open homework",
  },
  vi: {
    subject: (t) => `Bài tập mới – ${t}`, eyebrow: "Bài tập mới",
    intro: (n, t) => `Chào ${n}, <strong>${t}</strong> vừa giao bài tập mới cho em.`,
    labels: ["Hạn nộp", "Giáo viên"], instructions: "Hướng dẫn", cta: "Mở bài tập",
  },
};
export const sendHomeworkAssigned = async (student, teacher, homework, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(ASSIGNED, lang), tz = student?.timezone;
  const due = fmtDate(homework.dueDate, lang, tz);
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(homework.title),
    html: renderEmail({
      ...b, lang, tone: "blue",
      preheader: `${s.labels[0]}: ${due}`,
      eyebrow: s.eyebrow,
      title: homework.title,
      body:
        p(s.intro(esc(student.firstName), fullName(teacher))) +
        details([[s.labels[0], due], [s.labels[1], fullName(teacher)]]) +
        (homework.description
          ? p(`<strong style="color:#2b1d14;">${s.instructions}</strong><br>${esc(homework.description).replace(/\n/g, "<br>")}`)
          : ""),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard?tab=homework`, tone: "blue" },
    }),
  });
};

// Teacher (English)
export const sendHomeworkSubmitted = async (teacher, student, homework, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const tz = teacher?.timezone;
  return sendEmail({
    centerName: b.centerName,
    to: teacher.email,
    subject: `Homework submitted – ${homework.title} – ${student.firstName} ${student.lastName}`,
    html: renderEmail({
      ...b, tone: "blue",
      preheader: `${student.firstName} ${student.lastName} handed in "${homework.title}"`,
      eyebrow: "Homework submitted",
      title: "Ready for you to grade",
      body:
        p(`Hi ${esc(teacher.firstName)}, <strong>${fullName(student)}</strong> has handed in their homework.`) +
        details([
          ["Homework", esc(homework.title)],
          ["Student", fullName(student)],
          ["Submitted", `${fmtDate(new Date(), "en", tz)} · ${fmtTime(new Date(), "en", tz)}`],
        ]),
      cta: { label: "Grade now", href: `${b.baseUrl}/teacher/dashboard?tab=homework`, tone: "blue" },
    }),
  });
};

const DUE = {
  en: {
    subject: (t, m) => `Homework due in ${m} minutes – ${t}`, eyebrow: "Due soon",
    intro: (n) => `Hi ${n}, your homework is due very soon.`,
    labels: ["Homework", "Due at", "Time left"], left: (m) => `${m} minutes`,
    note: "If you haven't handed it in yet, please do it before the deadline.", cta: "Hand in now",
  },
  vi: {
    subject: (t, m) => `Bài tập hết hạn sau ${m} phút – ${t}`, eyebrow: "Sắp hết hạn",
    intro: (n) => `Chào ${n}, bài tập của em sắp hết hạn nộp.`,
    labels: ["Bài tập", "Hạn nộp lúc", "Còn lại"], left: (m) => `${m} phút`,
    note: "Nếu em chưa nộp bài, hãy nộp trước khi hết hạn nhé.", cta: "Nộp bài ngay",
  },
};
export const sendHomeworkDueReminder = async (student, homework, minutesLeft, centerName = "", center = null) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(DUE, lang), tz = student?.timezone;
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(homework.title, minutesLeft),
    html: renderEmail({
      ...b, lang, tone: "amber",
      preheader: s.note,
      eyebrow: s.eyebrow,
      title: homework.title,
      body:
        p(s.intro(esc(student.firstName))) +
        details([
          [s.labels[0], esc(homework.title)],
          [s.labels[1], fmtTime(homework.dueDate, lang, tz)],
          [s.labels[2], `<span style="color:#b45309;">${s.left(minutesLeft)}</span>`],
        ]) +
        callout(s.note, "amber"),
      cta: { label: s.cta, href: `${b.baseUrl}/student/dashboard?tab=homework`, tone: "amber" },
    }),
  });
};
