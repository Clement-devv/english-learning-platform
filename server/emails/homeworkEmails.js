import { config } from "../config/config.js";
import { sendEmail, getCenterBaseUrl } from "./core.js";

export const sendHomeworkAssigned = async (student, teacher, homework, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const dueDate = new Date(homework.dueDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return sendEmail({
    centerName,
    to: student.email,
    subject: `📚 New Homework – ${homework.title}`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .card{background:#fff;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .row{margin:10px 0;padding:10px 0;border-bottom:1px solid #eee}
      .label{font-weight:bold;color:#7c3aed}
      .due{background:#fef3c7;border-left:4px solid #f59e0b;padding:14px;border-radius:4px;margin:16px 0}
      .btn{display:inline-block;padding:12px 30px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>📚 New Homework!</h1><p>Your teacher has assigned new work</p></div>
      <div class="content">
        <p>Hi ${student.firstName},</p>
        <p><strong>${teacher.firstName} ${teacher.lastName}</strong> has assigned you new homework.</p>
        <div class="card">
          <div class="row"><span class="label">Title:</span> ${homework.title}</div>
          ${homework.description ? `<div class="row"><span class="label">Instructions:</span> ${homework.description}</div>` : ''}
          <div class="row"><span class="label">Teacher:</span> ${teacher.firstName} ${teacher.lastName}</div>
        </div>
        <div class="due"><strong>⏰ Due Date:</strong> ${dueDate}</div>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/student/dashboard" class="btn">View Homework</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`,
  });
};

export const sendHomeworkSubmitted = async (teacher, student, homework, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `📬 Homework Submitted – ${homework.title} – ${student.firstName} ${student.lastName}`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .card{background:#fff;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .row{margin:10px 0;padding:10px 0;border-bottom:1px solid #eee}
      .label{font-weight:bold;color:#10b981}
      .btn{display:inline-block;padding:12px 30px;background:#10b981;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>📬 Homework Submitted!</h1><p>A student has submitted their work</p></div>
      <div class="content">
        <p>Hi ${teacher.firstName},</p>
        <p><strong>${student.firstName} ${student.lastName}</strong> has submitted their homework and it is ready for you to grade.</p>
        <div class="card">
          <div class="row"><span class="label">Homework:</span> ${homework.title}</div>
          <div class="row"><span class="label">Student:</span> ${student.firstName} ${student.lastName}</div>
          <div class="row"><span class="label">Submitted:</span> ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/teacher/dashboard" class="btn">Grade Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`,
  });
};

export const sendHomeworkDueReminder = async (student, homework, minutesLeft, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const dueDate = new Date(homework.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return sendEmail({
    centerName,
    to: student.email,
    subject: `⚡ Homework Due Soon – ${homework.title} – ${minutesLeft} minutes left!`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .urgent{background:#fff3cd;border-left:4px solid #f59e0b;padding:16px;border-radius:4px;margin:16px 0;font-size:16px}
      .btn{display:inline-block;padding:14px 40px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>⚡ Homework Due Soon!</h1><p>Only ${minutesLeft} minutes left</p></div>
      <div class="content">
        <p>Hi ${student.firstName},</p>
        <div class="urgent">
          <strong>📚 ${homework.title}</strong> is due at <strong>${dueDate}</strong> — only <strong>${minutesLeft} minutes</strong> remaining!
        </div>
        <p>If you haven't submitted yet, please log in and submit your work before the deadline.</p>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/student/dashboard" class="btn">Submit Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated reminder from ${config.appName}</p></div>
    </div></body></html>`,
  });
};
