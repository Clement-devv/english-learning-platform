// Report emails (PDF attachments) and the custom-domain setup email. Built on the
// shared layout; the student progress report follows the student's emailLanguage.
import { config } from "../config/config.js";
import { sendEmail } from "./core.js";
import { renderEmail, p, details, callout, esc, C } from "./layout.js";
import { langOf, fmtShortDate, brandOf, pick } from "./i18n.js";

const mono = (v) => `<span style="font-family:Menlo,Consolas,monospace;">${esc(v)}</span>`;

// Center owner (sent by the platform)
export const sendDomainInstructionsEmail = async (center, domain, serverIp) => {
  const cell = `padding:10px 12px;border-top:1px solid ${C.line};font-family:'Nunito',Arial,sans-serif;font-size:14px;color:${C.ink};`;
  const head = `padding:10px 12px;font-family:'Nunito',Arial,sans-serif;font-size:12px;font-weight:800;color:${C.muted};text-transform:uppercase;letter-spacing:1px;`;
  const dns = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px;background:${C.accentSoft};border:1px solid ${C.line};border-radius:14px;">
    <tr><td style="${head}">Type</td><td style="${head}">Name</td><td style="${head}">Value</td></tr>
    <tr><td style="${cell}">A</td><td style="${cell}">@</td><td style="${cell}font-weight:800;">${mono(serverIp)}</td></tr>
    <tr><td style="${cell}">CNAME</td><td style="${cell}">www</td><td style="${cell}font-weight:800;">${mono(domain)}</td></tr>
  </table>`;
  return sendEmail({
    to: center.email,
    subject: `Custom domain setup — ${domain}`,
    html: renderEmail({
      centerName: config.appName, baseUrl: null,
      preheader: `Add two DNS records to put your portal on ${domain}.`,
      eyebrow: "Custom domain", title: `Put your portal on ${domain}`,
      body:
        p(`Hi <strong>${esc(center.centerName)}</strong>, to switch on <strong>${esc(domain)}</strong>, add these DNS records at your domain provider:`) +
        dns +
        callout("DNS changes can take up to <strong>48 hours</strong> to spread. When they're in, contact support — we'll verify and switch the domain on within 24 hours.", "amber") +
        p(`After that your portal is live at <strong>https://${esc(domain)}</strong>.`),
    }),
  });
};

const PROGRESS = {
  en: {
    label: (w) => (w ? "Weekly" : "Monthly"),
    subject: (l, f, t) => `${l} progress report — ${f} to ${t}`, eyebrow: (l) => `${l} progress report`,
    title: (n) => `Here's how you did, ${n}! 📊`,
    intro: (l) => `Your ${l.toLowerCase()} progress report is attached as a PDF. It sums up your classes, homework scores, quiz results and flashcard progress.`,
    period: "Period", keep: "Keep it up — every class gets you closer to fluency! 🎯",
    after: "Questions about your report? Ask your teacher.",
  },
  vi: {
    label: (w) => (w ? "Hàng tuần" : "Hàng tháng"),
    subject: (l, f, t) => `Báo cáo tiến bộ ${l.toLowerCase()} — ${f} đến ${t}`, eyebrow: (l) => `Báo cáo tiến bộ ${l.toLowerCase()}`,
    title: (n) => `Kết quả học tập của em đây, ${n}! 📊`,
    intro: () => "Báo cáo tiến bộ của em được đính kèm dưới dạng PDF. Báo cáo tóm tắt các lớp học, điểm bài tập, kết quả bài kiểm tra và tiến độ thẻ từ vựng.",
    period: "Thời gian", keep: "Cố gắng lên nhé — mỗi buổi học giúp em tiến gần hơn đến sự lưu loát! 🎯",
    after: "Có câu hỏi về báo cáo? Hãy hỏi giáo viên của em.",
  },
};
export const sendProgressReport = async (student, pdfBuffer, period, from, to, centerName = "") => {
  const b = brandOf(null, centerName);
  const lang = langOf(student), s = pick(PROGRESS, lang), tz = student?.timezone;
  const label = s.label(period === "weekly");
  const fromStr = fmtShortDate(from, lang, tz);
  const toStr = fmtShortDate(new Date(to - 1), lang, tz);
  return sendEmail({
    centerName: b.centerName,
    to: student.email,
    subject: s.subject(label, fromStr, toStr),
    html: renderEmail({
      ...b, baseUrl: null, lang, tone: "green",
      preheader: `${fromStr} – ${toStr}`,
      eyebrow: s.eyebrow(label), title: s.title(student.firstName),
      body: p(s.intro(label)) + details([[s.period, `${fromStr} – ${toStr}`]]) + p(s.keep),
      after: s.after,
    }),
    attachments: [{
      filename: `progress-report-${from.toISOString().slice(0, 10)}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

// ── Admin: record PDFs for new students / teachers ──────────────────────────────
export const sendNewStudentRecordEmail = async (adminEmail, student, pdfBuffer, centerName = "") => {
  const b = brandOf(null, centerName);
  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  return sendEmail({
    centerName: b.centerName,
    to: adminEmail,
    subject: `New student added: ${fullName}`,
    html: renderEmail({
      ...b, baseUrl: null, tone: "blue",
      preheader: "A PDF copy of the record is attached.",
      eyebrow: "New student", title: fullName,
      body: details([
        ["Email", esc(student.email || "—")],
        ["Phone", esc(student.phone || "—")],
        ["Country", esc(student.country || "—")],
        ["Level / rank", esc(student.rank || "—")],
        ["Classes", String(student.classCredits ?? 0)],
      ]),
      after: "A PDF copy of this record is attached for safe keeping.",
    }),
    attachments: [{
      filename: `${fullName.replace(/\s+/g, "_")}_Student_Record.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

export const sendNewTeacherRecordEmail = async (adminEmail, teacher, pdfBuffer, centerName = "") => {
  const b = brandOf(null, centerName);
  const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  return sendEmail({
    centerName: b.centerName,
    to: adminEmail,
    subject: `New teacher added: ${fullName}`,
    html: renderEmail({
      ...b, baseUrl: null, tone: "blue",
      preheader: "A PDF copy of the record is attached.",
      eyebrow: "New teacher", title: fullName,
      body: details([
        ["Email", esc(teacher.email || "—")],
        ["Phone", esc(teacher.phone || "—")],
        ["Country", esc(teacher.country || "—")],
        ["Continent", esc(teacher.continent || "—")],
        ["Rate per class", teacher.ratePerClass ? `$${esc(teacher.ratePerClass)}` : "—"],
        ["Specializations", esc((teacher.specializations || []).join(", ") || "—")],
      ]),
      after: "A PDF copy of this record is attached for safe keeping.",
    }),
    attachments: [{
      filename: `${fullName.replace(/\s+/g, "_")}_Teacher_Record.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

// ── Daily completed-classes reports ─────────────────────────────────────────────
const num = (v, color) => `<span style="color:${color};">${v}</span>`;
const changeNotes = (c, own) => {
  const were = (n) => (n > 1 ? "were" : "was");
  return (c.changedToNotCompleted
    ? callout(`<strong>${c.changedToNotCompleted}</strong> ${own ? "of your earlier classes" : `earlier completed class${c.changedToNotCompleted > 1 ? "es" : ""}`} ${were(c.changedToNotCompleted)} changed to <strong>not completed</strong> today (shown in red in the report).`, "red")
    : "") +
    (c.changedToCompleted
      ? callout(`<strong>${c.changedToCompleted}</strong> ${own ? "of your earlier classes" : `earlier class${c.changedToCompleted > 1 ? "es" : ""}`} ${were(c.changedToCompleted)} changed to <strong>completed</strong> today after a review (shown in green).`, "green")
      : "");
};

/**
 * @param {object} o
 * @param {string|string[]} o.to
 * @param {object} o.report      from buildDailyClassReport
 * @param {Buffer} o.pdfBuffer
 * @param {string} [o.centerName]
 */
export const sendDailyClassReportEmail = async ({ to, report, pdfBuffer, centerName = "" }) => {
  const b = brandOf(null, centerName);
  const c = report.counts;
  const changed = c.changedToCompleted + c.changedToNotCompleted;
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: `Daily class report — ${report.dateLabel}: ${c.completed} completed, ${c.notCompleted} not completed`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: `${c.completed} completed · ${c.notCompleted} not completed · ${c.teachers} teachers`,
      eyebrow: "Daily class report", title: report.dateLabel,
      body:
        p(`12:00 AM – 11:59 PM (${esc(report.tz)})`, { size: 13, color: C.muted, mt: -8 }) +
        details([
          ["Completed classes", num(c.completed, "#15803d")],
          ["Not completed", num(c.notCompleted, "#b91c1c")],
          ["Teachers", String(c.teachers)],
          ["Changed today", changed ? num(changed, "#b45309") : null],
        ]) +
        changeNotes(c, false),
      after: "The full report, grouped by teacher, is attached as a PDF. You can also see it any time in the admin dashboard under <strong>Class Report</strong>.",
    }),
    attachments: [{
      filename: `Class_Report_${report.date}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

/**
 * A teacher's own daily class report (only their classes).
 * @param {object} o
 * @param {string} o.to           teacher email
 * @param {string} o.teacherName
 * @param {object} o.report       from reportForTeacher()
 * @param {Buffer} o.pdfBuffer
 * @param {string} [o.centerName]
 */
export const sendTeacherDailyClassReportEmail = async ({ to, teacherName, report, pdfBuffer, centerName = "" }) => {
  const b = brandOf(null, centerName);
  const c = report.counts;
  return sendEmail({
    centerName: b.centerName,
    to,
    subject: `Your classes on ${report.dateLabel}: ${c.completed} completed${c.notCompleted ? `, ${c.notCompleted} not completed` : ""}`,
    html: renderEmail({
      ...b, baseUrl: null,
      preheader: `${c.completed} completed${c.notCompleted ? ` · ${c.notCompleted} not completed` : ""}`,
      eyebrow: "Your daily summary", title: `Hi ${teacherName || "there"}, here's your day`,
      body:
        p(`Your classes for ${esc(report.dateLabel)} (${esc(report.tz)}):`) +
        details([["Completed", num(c.completed, "#15803d")], ["Not completed", num(c.notCompleted, "#b91c1c")]]) +
        changeNotes(c, true),
      after: "Your full report is attached as a PDF. If something looks wrong, contact your school admin.",
    }),
    attachments: [{
      filename: `My_Classes_${report.date}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};
