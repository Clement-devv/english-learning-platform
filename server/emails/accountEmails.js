// Account deletion notices (students, teachers, centers). Built on the shared layout;
// student emails follow the student's emailLanguage (i18n.js).
import { config } from "../config/config.js";
import { sendEmail } from "./core.js";
import { renderEmail, p, callout, list, esc } from "./layout.js";
import { langOf, fmtDate, brandOf, pick } from "./i18n.js";

const contactHref = `mailto:${config.emailUser}`;

const WARN = {
  en: {
    subject: (d) => `Your account is scheduled for deletion on ${d}`, eyebrow: "Action needed",
    title: (d) => `Your account will be deleted on ${d}`,
    intro: (n, who) => `Hi ${n}, your ${who}account has been switched off and is scheduled for permanent deletion.`,
    points: (d) => [`Your account is <strong>disabled</strong> right now.`, `All your data will be <strong>erased</strong> on ${d}.`, `After that it <strong>can't be undone</strong>.`],
    mistake: "If this is a mistake, contact your school before that date.", cta: "Contact my school",
    finalSubject: (d) => `Final reminder — your account will be deleted tomorrow (${d})`, finalEyebrow: "Final reminder",
    finalTitle: "Your account will be deleted tomorrow",
    finalIntro: (n, who, d) => `Hi ${n}, this is your final reminder: your ${who}account will be <strong>permanently deleted on ${d}</strong> — less than 24 hours from now.`,
    finalMistake: "To keep your account, contact your school <strong>right now</strong>.", finalCta: "Contact my school now",
  },
  vi: {
    subject: (d) => `Tài khoản của em sẽ bị xóa vào ${d}`, eyebrow: "Cần xử lý",
    title: (d) => `Tài khoản của em sẽ bị xóa vào ${d}`,
    intro: (n) => `Chào ${n}, tài khoản của em đã bị tắt và đã được lên lịch xóa vĩnh viễn.`,
    points: (d) => [`Tài khoản của em hiện đang <strong>bị vô hiệu hóa</strong>.`, `Toàn bộ dữ liệu sẽ bị <strong>xóa</strong> vào ${d}.`, `Sau đó <strong>không thể khôi phục</strong>.`],
    mistake: "Nếu có nhầm lẫn, hãy liên hệ trung tâm trước ngày đó.", cta: "Liên hệ trung tâm",
    finalSubject: (d) => `Nhắc nhở cuối cùng — tài khoản của em sẽ bị xóa vào ngày mai (${d})`, finalEyebrow: "Nhắc nhở cuối cùng",
    finalTitle: "Tài khoản của em sẽ bị xóa vào ngày mai",
    finalIntro: (n, who, d) => `Chào ${n}, đây là lời nhắc cuối cùng: tài khoản của em sẽ bị <strong>xóa vĩnh viễn vào ${d}</strong> — chưa đầy 24 giờ nữa.`,
    finalMistake: "Để giữ tài khoản, hãy liên hệ trung tâm <strong>ngay bây giờ</strong>.", finalCta: "Liên hệ trung tâm ngay",
  },
};

const warning = ({ user, deletionDate, centerName, lang, who = "" }) => {
  const b = brandOf(null, centerName);
  const s = pick(WARN, lang), d = fmtDate(deletionDate, lang, user?.timezone);
  return sendEmail({
    centerName: b.centerName,
    to: user.email,
    subject: s.subject(d),
    html: renderEmail({
      ...b, baseUrl: null, lang, tone: "red",
      preheader: s.mistake,
      eyebrow: s.eyebrow, title: s.title(d),
      body:
        p(s.intro(esc(user.firstName), who)) +
        callout(list(s.points(d), { color: "#991b1b" }).replace("margin:0 0 16px", "margin:0"), "red") +
        p(s.mistake),
      cta: { label: s.cta, href: contactHref, tone: "red" },
    }),
  });
};

const finalReminder = ({ user, deletionDate, centerName, lang, who = "" }) => {
  const b = brandOf(null, centerName);
  const s = pick(WARN, lang), d = fmtDate(deletionDate, lang, user?.timezone);
  return sendEmail({
    centerName: b.centerName,
    to: user.email,
    subject: s.finalSubject(d),
    html: renderEmail({
      ...b, baseUrl: null, lang, tone: "red",
      preheader: s.finalTitle,
      eyebrow: s.finalEyebrow, title: s.finalTitle,
      body: p(s.finalIntro(esc(user.firstName), who, d)) + callout(s.finalMistake, "red"),
      cta: { label: s.finalCta, href: contactHref, tone: "red" },
    }),
  });
};

export const sendAccountDeletionWarningEmail = async (student, deletionDate, centerName = "") =>
  warning({ user: student, deletionDate, centerName, lang: langOf(student) });

export const sendAccountDeletionFinalReminderEmail = async (student, deletionDate, centerName = "") =>
  finalReminder({ user: student, deletionDate, centerName, lang: langOf(student) });

export const sendTeacherAccountDeletionWarningEmail = async (teacher, deletionDate, centerName = "") =>
  warning({ user: teacher, deletionDate, centerName, lang: "en", who: "teacher " });

export const sendTeacherAccountDeletionFinalReminderEmail = async (teacher, deletionDate, centerName = "") =>
  finalReminder({ user: teacher, deletionDate, centerName, lang: "en", who: "teacher " });

// Center owner (sent by the platform, so it carries the platform's name)
export const sendCenterDeletionWarningEmail = async (center, deletionDate, contactEmail) => {
  const d = fmtDate(deletionDate);
  return sendEmail({
    to: center.adminEmail,
    subject: `Important: your ${config.appName} center is scheduled for deletion`,
    html: renderEmail({
      centerName: config.appName, baseUrl: null, tone: "red",
      preheader: `${center.centerName} will be deleted on ${d}.`,
      eyebrow: "Center deletion notice", title: `${center.centerName} will be deleted on ${d}`,
      body:
        p(`Hi there, your center <strong>${esc(center.centerName)}</strong> is scheduled for <strong>permanent deletion</strong>.`) +
        callout(`After <strong>${d}</strong>, the center's data, student records and all its content will be removed and can't be recovered.`, "red") +
        p("If this is a mistake or you'd like to reactivate the center, contact us before that date."),
      cta: { label: "Contact support", href: `mailto:${contactEmail || config.emailFrom}`, tone: "red" },
      after: "No longer need it? You don't have to do anything — the center is removed automatically on that date.",
    }),
  });
};
