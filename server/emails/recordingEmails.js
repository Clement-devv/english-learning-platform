// Class recording emails — the parent link to a class video (utils/recordingLinks.js).
// Sent to a managed student's notification address, in the student's emailLanguage.
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

const RECORDING = {
  en: {
    subject: (t) => `Class video – ${t}`, eyebrow: "Class video",
    intro: (n) => `The video of <strong>${n}</strong>'s class is ready to watch.`,
    labels: ["Class", "Date", "Teacher", "Available until"],
    check: "When you open the link, you'll be asked for the student's name and the teacher's name.",
    cta: "Watch the class",
    keep: "Please don't share this link — it is for this student's family only.",
  },
  vi: {
    subject: (t) => `Video buổi học – ${t}`, eyebrow: "Video buổi học",
    intro: (n) => `Video buổi học của <strong>${n}</strong> đã sẵn sàng để xem.`,
    labels: ["Buổi học", "Ngày", "Giáo viên", "Xem được đến"],
    check: "Khi mở đường dẫn, quý phụ huynh sẽ được hỏi tên học sinh và tên giáo viên.",
    cta: "Xem buổi học",
    keep: "Vui lòng không chia sẻ đường dẫn này — chỉ dành cho gia đình học sinh.",
  },
};

/**
 * @param student  { firstName, emailLanguage, timezone }
 * @param to       the managed student's notification address
 * @param cls      { title, scheduledTime }
 * @param teacherName  name shown to the family
 * @param url      the parent link
 * @param expiresAt   when the videos are deleted
 */
export const sendRecordingLinkEmail = async ({ student, to, cls, teacherName, url, expiresAt, center = null, centerName = "" }) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(RECORDING, lang), tz = student?.timezone;
  const when = `${fmtDate(cls.scheduledTime, lang, tz)} · ${fmtTime(cls.scheduledTime, lang, tz)}`;
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: s.subject(cls.title),
    html: renderEmail({
      ...b, lang, tone: "blue",
      preheader: s.intro(esc(student.firstName)).replace(/<[^>]+>/g, ""),
      eyebrow: s.eyebrow,
      title: cls.title,
      body:
        p(s.intro(esc(student.firstName))) +
        details([[s.labels[0], esc(cls.title)], [s.labels[1], when], [s.labels[2], esc(teacherName)], [s.labels[3], fmtDate(expiresAt, lang, tz)]]) +
        callout(esc(s.check), "blue") +
        p(esc(s.keep), { size: 13 }),
      cta: { label: s.cta, href: url, tone: "blue" },
    }),
  });
};
