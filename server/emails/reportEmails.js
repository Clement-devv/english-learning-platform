import { config } from "../config/config.js";
import { sendEmail } from "./core.js";

export const sendDomainInstructionsEmail = async (center, domain, serverIp) => {
  return sendEmail({
    to: center.email,
    subject: `Custom Domain Setup Instructions — ${domain}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#4f46e5;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">🌐 Custom Domain Setup</h1>
        </div>
        <div style="background:#f8f7ff;padding:24px 32px;border-radius:0 0 8px 8px;">
          <p>Hi <strong>${center.centerName}</strong>,</p>
          <p>To activate your custom domain <strong>${domain}</strong>, add these DNS records at your domain provider:</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;">
            <tr style="background:#e0e7ff;">
              <th style="padding:10px;border:1px solid #c7d2fe;text-align:left;">Type</th>
              <th style="padding:10px;border:1px solid #c7d2fe;text-align:left;">Name</th>
              <th style="padding:10px;border:1px solid #c7d2fe;text-align:left;">Value</th>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #c7d2fe;">A</td>
              <td style="padding:10px;border:1px solid #c7d2fe;">@</td>
              <td style="padding:10px;border:1px solid #c7d2fe;font-weight:bold;">${serverIp}</td>
            </tr>
            <tr>
              <td style="padding:10px;border:1px solid #c7d2fe;">CNAME</td>
              <td style="padding:10px;border:1px solid #c7d2fe;">www</td>
              <td style="padding:10px;border:1px solid #c7d2fe;font-weight:bold;">${domain}</td>
            </tr>
          </table>
          <p>⏱️ DNS changes can take up to <strong>48 hours</strong> to propagate.</p>
          <p>Once done, contact support — we will verify and activate your domain within 24 hours.</p>
          <p>After activation your portal will be live at: <strong>https://${domain}</strong></p>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">— The ${config.appName} Team</p>
        </div>
      </div>
    `,
  });
};

export const sendProgressReport = async (student, pdfBuffer, period, from, to, centerName = "") => {
  const label   = period === "weekly" ? "Weekly" : "Monthly";
  const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const toStr   = new Date(to - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const subject = `${label} Progress Report — ${fromStr} to ${toStr}`;
  const filename = `progress-report-${from.toISOString().slice(0, 10)}.pdf`;

  return sendEmail({
    centerName,
    to: student.email,
    subject,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">📊 ${label} Progress Report</h1>
          <p style="color:#dcfce7;margin:8px 0 0;font-size:13px;">${fromStr} – ${toStr}</p>
        </div>
        <div style="background:#f0fdf4;padding:24px 32px;border-radius:0 0 8px 8px;">
          <p style="color:#1e293b;font-size:15px;">Hi <strong>${student.firstName}</strong>,</p>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Your ${label.toLowerCase()} progress report is attached as a PDF.
            It includes a summary of your completed classes, homework scores,
            quiz results, and vocabulary flashcard progress.
          </p>
          <p style="color:#334155;font-size:14px;line-height:1.6;">
            Keep up the great work — every class gets you closer to fluency! 🎯
          </p>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">
            This report was generated automatically by the English Learning Platform.
            If you have questions, contact your teacher directly.
          </p>
        </div>
      </div>
    `,
    attachments: [{
      filename,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

export const sendNewStudentRecordEmail = async (adminEmail, student, pdfBuffer, centerName = "") => {
  const fullName = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  return sendEmail({
    centerName,
    to: adminEmail,
    subject: `New Student Added: ${fullName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:28px 32px;">
          <h1 style="color:#fff;font-size:18px;font-weight:800;margin:0 0 4px;">New Student Added</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">A new student record has been created</p>
        </div>
        <div style="padding:28px 32px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#eff6ff;"><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;width:140px;">Name</td><td style="padding:9px 12px;color:#1e293b;">${fullName}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;">Email</td><td style="padding:9px 12px;color:#1e293b;">${student.email || "—"}</td></tr>
            <tr style="background:#eff6ff;"><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;">Phone</td><td style="padding:9px 12px;color:#1e293b;">${student.phone || "—"}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;">Country</td><td style="padding:9px 12px;color:#1e293b;">${student.country || "—"}</td></tr>
            <tr style="background:#eff6ff;"><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;">Level / Rank</td><td style="padding:9px 12px;color:#1e293b;">${student.rank || "—"}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#1d4ed8;">Classes</td><td style="padding:9px 12px;color:#1e293b;">${student.classCredits ?? 0}</td></tr>
          </table>
          <p style="font-size:12px;color:#94a3b8;margin-top:20px;">A PDF copy of this record is attached for offline safe keeping.</p>
        </div>
      </div>
    `,
    attachments: [{
      filename:    `${fullName.replace(/\s+/g, "_")}_Student_Record.pdf`,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

export const sendNewTeacherRecordEmail = async (adminEmail, teacher, pdfBuffer, centerName = "") => {
  const fullName = `${teacher.firstName || ""} ${teacher.lastName || ""}`.trim();
  return sendEmail({
    centerName,
    to: adminEmail,
    subject: `New Teacher Added: ${fullName}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;">
          <h1 style="color:#fff;font-size:18px;font-weight:800;margin:0 0 4px;">New Teacher Added</h1>
          <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0;">A new teacher record has been created</p>
        </div>
        <div style="padding:28px 32px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#f5f3ff;"><td style="padding:9px 12px;font-weight:700;color:#6d28d9;width:160px;">Name</td><td style="padding:9px 12px;color:#1e293b;">${fullName}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Email</td><td style="padding:9px 12px;color:#1e293b;">${teacher.email || "—"}</td></tr>
            <tr style="background:#f5f3ff;"><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Phone</td><td style="padding:9px 12px;color:#1e293b;">${teacher.phone || "—"}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Country</td><td style="padding:9px 12px;color:#1e293b;">${teacher.country || "—"}</td></tr>
            <tr style="background:#f5f3ff;"><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Continent</td><td style="padding:9px 12px;color:#1e293b;">${teacher.continent || "—"}</td></tr>
            <tr><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Rate/Class</td><td style="padding:9px 12px;color:#1e293b;">${teacher.ratePerClass ? "$" + teacher.ratePerClass : "—"}</td></tr>
            <tr style="background:#f5f3ff;"><td style="padding:9px 12px;font-weight:700;color:#6d28d9;">Specializations</td><td style="padding:9px 12px;color:#1e293b;">${(teacher.specializations || []).join(", ") || "—"}</td></tr>
          </table>
          <p style="font-size:12px;color:#94a3b8;margin-top:20px;">A PDF copy of this record is attached for offline safe keeping.</p>
        </div>
      </div>
    `,
    attachments: [{
      filename:    `${fullName.replace(/\s+/g, "_")}_Teacher_Record.pdf`,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

// ── Daily completed-classes report for admins ────────────────────────────────
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * @param {object} p
 * @param {string|string[]} p.to
 * @param {object} p.report      from buildDailyClassReport
 * @param {Buffer} p.pdfBuffer
 * @param {string} [p.centerName]
 */
export const sendDailyClassReportEmail = async ({ to, report, pdfBuffer, centerName = "" }) => {
  const c = report.counts;
  const changed = c.changedToCompleted + c.changedToNotCompleted;
  const row = (label, value, color) =>
    `<tr><td style="padding:8px 12px;color:#475569;">${label}</td><td style="padding:8px 12px;font-weight:700;color:${color};">${value}</td></tr>`;

  return sendEmail({
    centerName,
    to,
    subject: `Daily class report — ${report.dateLabel}: ${c.completed} completed, ${c.notCompleted} not completed`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
        <h2 style="margin:0 0 4px;">📋 Daily class report</h2>
        <p style="margin:0 0 16px;color:#64748b;">${escHtml(report.dateLabel)} · 12:00 AM – 11:59 PM (${escHtml(report.tz)})</p>
        <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;">
          ${row("Completed classes", c.completed, "#059669")}
          ${row("Not completed", c.notCompleted, "#dc2626")}
          ${row("Teachers", c.teachers, "#4f46e5")}
          ${changed ? row("Earlier classes that changed today", changed, "#b45309") : ""}
        </table>
        ${c.changedToNotCompleted ? `<p style="margin:16px 0 0;padding:10px 14px;border-left:4px solid #dc2626;background:#fef2f2;color:#991b1b;">
          <strong>${c.changedToNotCompleted}</strong> earlier completed class${c.changedToNotCompleted > 1 ? "es were" : " was"} turned <strong>not completed</strong> today (shown in red in the report).</p>` : ""}
        ${c.changedToCompleted ? `<p style="margin:12px 0 0;padding:10px 14px;border-left:4px solid #059669;background:#ecfdf5;color:#065f46;">
          <strong>${c.changedToCompleted}</strong> earlier class${c.changedToCompleted > 1 ? "es were" : " was"} turned <strong>completed</strong> today after a review (shown in green).</p>` : ""}
        <p style="margin:18px 0 0;color:#64748b;font-size:13px;">The full report, grouped by teacher, is attached as a PDF. You can also see it any time in the admin dashboard under <strong>Class Report</strong>.</p>
      </div>
    `,
    attachments: [{
      filename:    `Class_Report_${report.date}.pdf`,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

/**
 * A teacher's own daily class report (only their classes).
 * @param {object} p
 * @param {string} p.to           teacher email
 * @param {string} p.teacherName
 * @param {object} p.report       from reportForTeacher()
 * @param {Buffer} p.pdfBuffer
 * @param {string} [p.centerName]
 */
export const sendTeacherDailyClassReportEmail = async ({ to, teacherName, report, pdfBuffer, centerName = "" }) => {
  const c = report.counts;
  const row = (label, value, color) =>
    `<tr><td style="padding:8px 12px;color:#475569;">${label}</td><td style="padding:8px 12px;font-weight:700;color:${color};">${value}</td></tr>`;

  return sendEmail({
    centerName,
    to,
    subject: `Your classes on ${report.dateLabel}: ${c.completed} completed${c.notCompleted ? `, ${c.notCompleted} not completed` : ""}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;">
        <h2 style="margin:0 0 4px;">📋 Your daily class summary</h2>
        <p style="margin:0 0 16px;color:#64748b;">Hi ${escHtml(teacherName || "there")} — here are your classes for ${escHtml(report.dateLabel)} (${escHtml(report.tz)}).</p>
        <table style="border-collapse:collapse;width:100%;background:#f8fafc;border-radius:8px;">
          ${row("Completed", c.completed, "#059669")}
          ${row("Not completed", c.notCompleted, "#dc2626")}
        </table>
        ${c.changedToNotCompleted ? `<p style="margin:16px 0 0;padding:10px 14px;border-left:4px solid #dc2626;background:#fef2f2;color:#991b1b;">
          <strong>${c.changedToNotCompleted}</strong> of your earlier classes ${c.changedToNotCompleted > 1 ? "were" : "was"} changed to <strong>not completed</strong> today. See the red notes in the report.</p>` : ""}
        ${c.changedToCompleted ? `<p style="margin:12px 0 0;padding:10px 14px;border-left:4px solid #059669;background:#ecfdf5;color:#065f46;">
          <strong>${c.changedToCompleted}</strong> of your earlier classes ${c.changedToCompleted > 1 ? "were" : "was"} changed to <strong>completed</strong> today after a review.</p>` : ""}
        <p style="margin:18px 0 0;color:#64748b;font-size:13px;">Your full report is attached as a PDF. If something looks wrong, please contact your school admin.</p>
      </div>
    `,
    attachments: [{
      filename:    `My_Classes_${report.date}.pdf`,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};
