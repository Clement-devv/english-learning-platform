import { config } from "../config/config.js";
import { sendEmail, getCenterBaseUrl } from "./core.js";

export const sendQuizAssigned = async (student, teacher, quiz, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const dueDate = new Date(quiz.dueDate).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return sendEmail({
    centerName,
    to: student.email,
    subject: `📝 New Quiz – ${quiz.title}`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .card{background:#fff;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .row{margin:10px 0;padding:10px 0;border-bottom:1px solid #eee}
      .label{font-weight:bold;color:#7c3aed}
      .warning{background:#fef3c7;border-left:4px solid #f59e0b;padding:14px;border-radius:4px;margin:16px 0}
      .due{background:#ede9fe;border-left:4px solid #7c3aed;padding:14px;border-radius:4px;margin:16px 0}
      .btn{display:inline-block;padding:12px 30px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>📝 New Quiz Assigned!</h1><p>You have a new test to complete</p></div>
      <div class="content">
        <p>Hi ${student.firstName},</p>
        <p><strong>${teacher.firstName} ${teacher.lastName}</strong> has assigned you a quiz.</p>
        <div class="card">
          <div class="row"><span class="label">Quiz:</span> ${quiz.title}</div>
          <div class="row"><span class="label">Questions:</span> ${quiz.questions.length}</div>
          <div class="row"><span class="label">Time Limit:</span> ${quiz.timeLimit} minutes</div>
          <div class="row"><span class="label">Teacher:</span> ${teacher.firstName} ${teacher.lastName}</div>
        </div>
        <div class="due"><strong>📅 Due Date:</strong> ${dueDate}</div>
        <div class="warning"><strong>⚠️ Note:</strong> You only have <strong>one attempt</strong>. Once started, the timer cannot be paused.</div>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/student/dashboard" class="btn">Take Quiz</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`,
  });
};

export const sendQuizCompleted = async (teacher, student, quiz, attempt, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const scoreColor = attempt.percentage >= 80 ? '#10b981' : attempt.percentage >= 60 ? '#f59e0b' : '#ef4444';
  const trophy     = attempt.percentage >= 90 ? '🏆' : attempt.percentage >= 75 ? '🥇' : attempt.percentage >= 60 ? '🥈' : '🥉';

  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `📝 Quiz Completed – ${quiz.title} – ${student.firstName} ${student.lastName} scored ${attempt.percentage}%`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .score-box{background:#fff;padding:24px;border-radius:8px;margin:20px 0;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .score{font-size:48px;font-weight:bold;color:${scoreColor}}
      .card{background:#fff;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .row{margin:10px 0;padding:10px 0;border-bottom:1px solid #eee}
      .label{font-weight:bold;color:#10b981}
      .btn{display:inline-block;padding:12px 30px;background:#10b981;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>📝 Quiz Completed!</h1><p>A student has finished their quiz</p></div>
      <div class="content">
        <p>Hi ${teacher.firstName},</p>
        <p><strong>${student.firstName} ${student.lastName}</strong> has completed the quiz.</p>
        <div class="score-box">
          <div style="font-size:48px">${trophy}</div>
          <div class="score">${attempt.percentage}%</div>
          <p style="font-size:18px;color:#666">${attempt.score} out of ${attempt.totalQuestions} correct</p>
          ${attempt.timeTaken ? `<p style="color:#999">Completed in ${Math.floor(attempt.timeTaken / 60)}m ${attempt.timeTaken % 60}s</p>` : ''}
        </div>
        <div class="card">
          <div class="row"><span class="label">Quiz:</span> ${quiz.title}</div>
          <div class="row"><span class="label">Student:</span> ${student.firstName} ${student.lastName}</div>
          <div class="row"><span class="label">Score:</span> ${attempt.score}/${attempt.totalQuestions} (${attempt.percentage}%)</div>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/teacher/dashboard" class="btn">View Results</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`,
  });
};

export const sendQuizDueReminder = async (student, quiz, minutesLeft, centerName = "", center = null) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const dueTime = new Date(quiz.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return sendEmail({
    centerName,
    to: student.email,
    subject: `⚡ Quiz Due Soon – ${quiz.title} – ${minutesLeft} minutes left!`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .urgent{background:#ede9fe;border-left:4px solid #7c3aed;padding:16px;border-radius:4px;margin:16px 0;font-size:16px}
      .warning{background:#fee2e2;border-left:4px solid #ef4444;padding:14px;border-radius:4px;margin:16px 0}
      .btn{display:inline-block;padding:14px 40px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>⚡ Quiz Due Soon!</h1><p>Only ${minutesLeft} minutes left</p></div>
      <div class="content">
        <p>Hi ${student.firstName},</p>
        <div class="urgent">
          <strong>📝 ${quiz.title}</strong> is due at <strong>${dueTime}</strong> — only <strong>${minutesLeft} minutes</strong> remaining!
        </div>
        <div class="warning">
          <strong>⚠️ Remember:</strong> You have <strong>one attempt only</strong>. Once you start, the ${quiz.timeLimit}-minute timer begins immediately.
        </div>
        <p>If you haven't started yet, log in now and complete the quiz before the deadline.</p>
        <div style="text-align:center;margin-top:20px">
          <a href="${baseUrl}/student/dashboard" class="btn">Take Quiz Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated reminder from ${config.appName}</p></div>
    </div></body></html>`,
  });
};
