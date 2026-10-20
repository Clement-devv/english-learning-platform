// Class summary emails — the teacher's notes on a class, to a managed student's family
// (utils/classSummaryEmails.js). Written in the student's emailLanguage.
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const SUMMARY = {
  en: {
    subject: (t) => `Class summary – ${t}`, eyebrow: "Class summary",
    intro: (n, tn) => `Here is what <strong>${n}</strong> did in class, from ${tn}.`,
    labels: ["Class", "Date", "Teacher"],
  },
  vi: {
    subject: (t) => `Tóm tắt buổi học – ${t}`, eyebrow: "Tóm tắt buổi học",
    intro: (n, tn) => `Dưới đây là nội dung buổi học của <strong>${n}</strong>, do ${tn} ghi lại.`,
    labels: ["Buổi học", "Ngày", "Giáo viên"],
  },
};

/**
 * @param student  { firstName, emailLanguage, timezone }
 * @param to       the managed student's notification address
 * @param cls      { title, scheduledTime, text }
 */
export const sendClassSummaryEmail = async ({ student, to, cls, teacherName, center = null, centerName = "" }) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(SUMMARY, lang), tz = student?.timezone;
  const when = `${fmtDate(cls.scheduledTime, lang, tz)} · ${fmtTime(cls.scheduledTime, lang, tz)}`;
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: s.subject(cls.title),
    html: renderEmail({
      ...b, lang, tone: "green",
      preheader: String(cls.text || "").slice(0, 120),
      eyebrow: s.eyebrow,
      title: cls.title,
      body:
        p(s.intro(esc(student.firstName), esc(teacherName))) +
        details([[s.labels[0], esc(cls.title)], [s.labels[1], when], [s.labels[2], esc(teacherName)]]) +
        callout(esc(cls.text).replace(/\n/g, "<br>"), "green"),
    }),
  });
};
