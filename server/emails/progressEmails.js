// Progress emails to the student and their family — homework graded, certificate awarded,
// payment receipt. Built on the shared layout (layout.js); text follows the reader's
// language (i18n.js). Every value from users (names, titles, feedback) is escaped.
// Recipients are chosen in utils/progressEmails.js.
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc } from "./layout.js";
import { fmtDate, brandOf, pick } from "./i18n.js";

/** Teacher feedback / descriptions: escaped, line breaks kept */
const multiline = (s) => esc(String(s || "").trim()).replace(/\r?\n/g, "<br>");

// ── Homework graded ──────────────────────────────────────────────────────────
const GRADED = {
  en: {
    subject: (t) => `Homework graded – ${t}`,
    eyebrow: "Homework graded", title: (n) => `${n}'s homework has been graded`,
    intro: (n, t) => `${t} has graded ${n}'s homework.`,
    labels: ["Homework", "Score", "Graded on"], feedback: "Teacher's feedback",
    cta: "See the homework",
  },
  vi: {
    subject: (t) => `Bài tập đã được chấm – ${t}`,
    eyebrow: "Đã chấm bài", title: (n) => `Bài tập của ${n} đã được chấm`,
    intro: (n, t) => `${t} đã chấm bài tập của ${n}.`,
    labels: ["Bài tập", "Điểm", "Ngày chấm"], feedback: "Nhận xét của giáo viên",
    cta: "Xem bài tập",
  },
};
/** `to` + `lang` per recipient; `studentName` is who did the homework; `href` where to look (null = no button) */
export const sendHomeworkGradedEmail = ({ to, lang, studentName, teacherName, homework, href, center }) => {
  const b = brandOf(center, center?.centerName), s = pick(GRADED, lang);
  const score = homework.grade?.score;
  return sendEmail({
    centerName: b.centerName, to, kind: "Homework graded",
    subject: s.subject(homework.title),
    html: renderEmail({
      ...b, lang, tone: "green",
      preheader: `${homework.title} — ${score}/100`,
      eyebrow: s.eyebrow, title: s.title(studentName),
      body:
        p(s.intro(esc(studentName), esc(teacherName))) +
        details([
          [s.labels[0], esc(homework.title)],
          [s.labels[1], `${Number(score)}/100`],
          [s.labels[2], fmtDate(homework.grade?.gradedAt || new Date(), lang)],
        ]) +
        (homework.grade?.feedback ? callout(`<strong>${s.feedback}:</strong><br>${multiline(homework.grade.feedback)}`, "green") : ""),
      cta: href ? { label: s.cta, href, tone: "green" } : null,
    }),
  });
};

// ── Certificate awarded ──────────────────────────────────────────────────────
const CERT = {
  en: {
    subject: (t) => `Certificate awarded – ${t}`,
    eyebrow: "Congratulations", title: (n) => `Well done, ${n}! 🎉`,
    intro: (n, c) => `${n} has been awarded a certificate by ${c}. The certificate is attached to this email as a PDF.`,
    labels: ["Certificate", "Number", "Awarded on"],
    verify: "Anyone can check it is genuine with the certificate number at",
    cta: "View certificates",
  },
  vi: {
    subject: (t) => `Chứng nhận – ${t}`,
    eyebrow: "Chúc mừng", title: (n) => `Giỏi lắm, ${n}! 🎉`,
    intro: (n, c) => `${n} đã được ${c} trao chứng nhận. Chứng nhận được đính kèm email này (PDF).`,
    labels: ["Chứng nhận", "Số", "Ngày trao"],
    verify: "Bất kỳ ai cũng có thể kiểm tra chứng nhận bằng số chứng nhận tại",
    cta: "Xem chứng nhận",
  },
};
export const sendCertificateEmail = ({ to, lang, studentName, cert, pdf, href, center }) => {
  const b = brandOf(center, center?.centerName), s = pick(CERT, lang);
  const verifyUrl = `${b.baseUrl}/api/v1/certificates/verify/${encodeURIComponent(cert.certificateNumber)}`;
  return sendEmail({
    centerName: b.centerName, to, kind: "Certificate awarded",
    subject: s.subject(cert.title),
    attachments: pdf ? [{ filename: `${cert.certificateNumber}.pdf`, content: pdf, contentType: "application/pdf" }] : [],
    html: renderEmail({
      ...b, lang, tone: "green",
      preheader: cert.title,
      eyebrow: s.eyebrow, title: s.title(studentName),
      body:
        p(s.intro(esc(studentName), esc(b.centerName))) +
        details([
          [s.labels[0], esc(cert.title)],
          [s.labels[1], esc(cert.certificateNumber)],
          [s.labels[2], fmtDate(cert.createdAt || new Date(), lang)],
        ]) +
        (cert.description ? p(multiline(cert.description)) : "") +
        p(`${s.verify} <a href="${esc(verifyUrl)}">${esc(verifyUrl.replace(/^https?:\/\//, ""))}</a>`, { size: 13 }),
      cta: href ? { label: s.cta, href, tone: "green" } : null,
    }),
  });
};

// ── Payment receipt ──────────────────────────────────────────────────────────
const RECEIPT = {
  en: {
    subject: (c) => `Payment received – ${c}`,
    eyebrow: "Payment receipt", title: "Thank you — payment received",
    intro: (n) => `We have recorded this payment for ${n}.`,
    labels: ["Amount", "For", "Method", "Date", "Balance now"],
    classes: (k) => `${k} class${k === 1 ? "" : "es"}`, points: (k) => `${k} group point${k === 1 ? "" : "s"}`,
    pending: "This payment is marked as pending — the classes are added once it is confirmed.",
    keep: "Keep this email as your receipt.", cta: "Open the dashboard",
  },
  vi: {
    subject: (c) => `Đã nhận thanh toán – ${c}`,
    eyebrow: "Biên nhận thanh toán", title: "Cảm ơn — đã nhận thanh toán",
    intro: (n) => `Trung tâm đã ghi nhận khoản thanh toán này cho ${n}.`,
    labels: ["Số tiền", "Cho", "Hình thức", "Ngày", "Số dư hiện tại"],
    classes: (k) => `${k} buổi học`, points: (k) => `${k} điểm lớp nhóm`,
    pending: "Khoản thanh toán đang chờ xác nhận — buổi học sẽ được cộng khi được xác nhận.",
    keep: "Vui lòng giữ email này làm biên nhận.", cta: "Mở trang của em",
  },
};
/** `kind`: "classes" | "points"; `balance` = credits / points after the payment */
export const sendPaymentReceiptEmail = ({ to, lang, studentName, amount, symbol = "", count, kind = "classes", method, pending = false, balance, href, center }) => {
  const b = brandOf(center, center?.centerName), s = pick(RECEIPT, lang);
  const money = `${esc(symbol)}${Number(amount).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { maximumFractionDigits: 2 })}`;
  const what = kind === "points" ? s.points(count) : s.classes(count);
  return sendEmail({
    centerName: b.centerName, to, kind: "Payment receipt",
    subject: s.subject(b.centerName),
    html: renderEmail({
      ...b, lang, tone: pending ? "amber" : "green",
      preheader: `${money} — ${what}`,
      eyebrow: s.eyebrow, title: s.title,
      body:
        p(s.intro(esc(studentName))) +
        details([
          [s.labels[0], money],
          [s.labels[1], esc(what)],
          [s.labels[2], method ? esc(method) : ""],
          [s.labels[3], fmtDate(new Date(), lang)],
          [s.labels[4], balance == null ? "" : esc(kind === "points" ? s.points(balance) : s.classes(balance))],
        ]) +
        (pending ? callout(s.pending, "amber") : "") +
        p(s.keep, { size: 13 }),
      cta: href ? { label: s.cta, href } : null,
    }),
  });
};
