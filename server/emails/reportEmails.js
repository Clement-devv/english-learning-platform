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
