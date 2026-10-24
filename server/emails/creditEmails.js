// "Classes remaining" email after a class uses one of the student's classes
// (utils/creditReminder.js). In the student's emailLanguage; amber when the
// balance is low, red at zero.
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { langOf, fmtDate, fmtTime, brandOf, pick } from "./i18n.js";

export const LOW_CLASSES = 2;

const T = {
  en: {
    subject: (n, left) => (left <= 0 ? `${n} has no classes left` : `${n}: ${left} ${left === 1 ? "class" : "classes"} left`),
    eyebrow: (left) => (left <= 0 ? "No classes left" : left <= LOW_CLASSES ? "Time to top up" : "Class completed"),
    intro: (n) => `<strong>${n}</strong> just finished a class — one class has been used.`,
    labels: ["Class", "Date", "Classes remaining"],
    low: (left) => `Only ${left} ${left === 1 ? "class" : "classes"} left. Please contact the school to top up so lessons continue without a break.`,
    zero: "There are no classes left. New classes can't be booked until the school adds more — please contact the school to top up.",
  },
  vi: {
    subject: (n, left) => (left <= 0 ? `${n} đã hết buổi học` : `${n}: còn ${left} buổi học`),
    eyebrow: (left) => (left <= 0 ? "Đã hết buổi học" : left <= LOW_CLASSES ? "Sắp hết buổi học" : "Hoàn thành buổi học"),
    intro: (n) => `<strong>${n}</strong> vừa hoàn thành một buổi học — đã sử dụng một buổi.`,
    labels: ["Buổi học", "Ngày", "Số buổi còn lại"],
    low: (left) => `Chỉ còn ${left} buổi học. Quý phụ huynh vui lòng liên hệ trung tâm để gia hạn, giúp việc học không bị gián đoạn.`,
    zero: "Đã hết buổi học. Không thể đặt lớp mới cho đến khi trung tâm cộng thêm buổi — quý phụ huynh vui lòng liên hệ trung tâm để gia hạn.",
  },
};

export const sendClassesRemainingEmail = async ({ student, to, left, cls, center = null, centerName = "" }) => {
  const b = brandOf(center, centerName);
  const lang = langOf(student), s = pick(T, lang), tz = student?.timezone;
  const name = esc(student.firstName);
  const tone = left <= 0 ? "red" : left <= LOW_CLASSES ? "amber" : "green";
  const rows = [
    cls?.title ? [s.labels[0], esc(cls.title)] : null,
    cls?.when ? [s.labels[1], `${fmtDate(cls.when, lang, tz)} · ${fmtTime(cls.when, lang, tz)}`] : null,
    [s.labels[2], `<strong>${Math.max(0, left)}</strong>`],
  ].filter(Boolean);
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: s.subject(student.firstName, Math.max(0, left)),
    html: renderEmail({
      ...b, lang, tone,
      preheader: `${s.labels[2]}: ${Math.max(0, left)}`,
      eyebrow: s.eyebrow(left),
      title: s.subject(esc(student.firstName), Math.max(0, left)),
      body: p(s.intro(name)) + details(rows) +
        (left <= 0 ? callout(esc(s.zero), "red") : left <= LOW_CLASSES ? callout(esc(s.low(left)), "amber") : ""),
    }),
  });
};
