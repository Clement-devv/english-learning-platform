import { config } from "../config/config.js";
import { sendEmail } from "./core.js";

const formatDate = (date) => new Date(date).toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
});

const formatTime = (date) => new Date(date).toLocaleTimeString('en-US', {
  hour: '2-digit', minute: '2-digit',
});

export const sendBookingRequestToTeacher = async (teacher, student, booking, centerName = "") => {
  const formattedDate = formatDate(booking.scheduledTime);
  const formattedTime = formatTime(booking.scheduledTime);

  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `New Class Request - ${student.firstName} ${student.lastName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-card { background: white; padding: 20px; border-radius: 8px;
                          margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .booking-detail { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #667eea; }
          .value { color: #555; }
          .button { display: inline-block; padding: 12px 30px; margin: 10px 5px;
                    background: #667eea; color: white; text-decoration: none;
                    border-radius: 5px; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎓 New Class Request</h1>
            <p>You have a new booking request from the admin</p>
          </div>
          <div class="content">
            <p>Hi ${teacher.firstName},</p>
            <p>A new class has been scheduled for you. Please review the details below and accept or reject the request.</p>
            <div class="booking-card">
              <h3>Class Details</h3>
              <div class="booking-detail"><span class="label">Student:</span> <span class="value">${student.firstName} ${student.lastName}</span></div>
              <div class="booking-detail"><span class="label">Class Title:</span> <span class="value">${booking.classTitle}</span></div>
              ${booking.topic ? `<div class="booking-detail"><span class="label">Topic:</span> <span class="value">${booking.topic}</span></div>` : ''}
              <div class="booking-detail"><span class="label">Date:</span> <span class="value">${formattedDate}</span></div>
              <div class="booking-detail"><span class="label">Time:</span> <span class="value">${formattedTime}</span></div>
              <div class="booking-detail"><span class="label">Duration:</span> <span class="value">${booking.duration} minutes</span></div>
              ${booking.notes ? `<div class="booking-detail"><span class="label">Notes:</span> <span class="value">${booking.notes}</span></div>` : ''}
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/teacher/dashboard?tab=bookings" class="button">View &amp; Accept Request</a>
            </div>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Please respond to this booking request as soon as possible. Students are waiting to schedule their classes with you!
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>If you have any questions, please contact support</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendBookingAcceptedToStudent = async (student, teacher, booking, centerName = "") => {
  const formattedDate = formatDate(booking.scheduledTime);
  const formattedTime = formatTime(booking.scheduledTime);

  return sendEmail({
    centerName,
    to: student.email,
    subject: `Class Confirmed - ${booking.classTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-card { background: white; padding: 20px; border-radius: 8px;
                          margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .booking-detail { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #11998e; }
          .value { color: #555; }
          .button { display: inline-block; padding: 12px 30px; margin: 10px 5px;
                    background: #11998e; color: white; text-decoration: none;
                    border-radius: 5px; font-weight: bold; }
          .reminder-box { background: #fff3cd; border-left: 4px solid #ffc107;
                          padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Class Confirmed!</h1>
            <p>Your teacher has accepted your class request</p>
          </div>
          <div class="content">
            <p>Hi ${student.firstName},</p>
            <p>Great news! Your class with ${teacher.firstName} ${teacher.lastName} has been confirmed.</p>
            <div class="booking-card">
              <h3>Your Upcoming Class</h3>
              <div class="booking-detail"><span class="label">Teacher:</span> <span class="value">${teacher.firstName} ${teacher.lastName}</span></div>
              <div class="booking-detail"><span class="label">Class Title:</span> <span class="value">${booking.classTitle}</span></div>
              ${booking.topic ? `<div class="booking-detail"><span class="label">Topic:</span> <span class="value">${booking.topic}</span></div>` : ''}
              <div class="booking-detail"><span class="label">Date:</span> <span class="value">${formattedDate}</span></div>
              <div class="booking-detail"><span class="label">Time:</span> <span class="value">${formattedTime}</span></div>
              <div class="booking-detail"><span class="label">Duration:</span> <span class="value">${booking.duration} minutes</span></div>
            </div>
            <div class="reminder-box">
              <strong>⏰ Reminder:</strong> Please join the class 5 minutes before the scheduled time to ensure everything is working properly.
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/student/dashboard?tab=classes" class="button">View My Classes</a>
            </div>
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              You'll receive another reminder 24 hours before your class. See you in class! 📚
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>If you need to reschedule, please contact support</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendBookingRejectedToStudent = async (student, teacher, booking, centerName = "") => {
  const formattedDate = formatDate(booking.scheduledTime);
  const formattedTime = formatTime(booking.scheduledTime);

  return sendEmail({
    centerName,
    to: student.email,
    subject: `Class Request Update - ${booking.classTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .booking-card { background: white; padding: 20px; border-radius: 8px;
                          margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .booking-detail { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { font-weight: bold; color: #667eea; }
          .value { color: #555; }
          .button { display: inline-block; padding: 12px 30px; margin: 10px 5px;
                    background: #667eea; color: white; text-decoration: none;
                    border-radius: 5px; font-weight: bold; }
          .info-box { background: #e3f2fd; border-left: 4px solid #2196f3;
                      padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Class Request Update</h1>
            <p>Update on your class request</p>
          </div>
          <div class="content">
            <p>Hi ${student.firstName},</p>
            <p>We wanted to let you know that your class request for ${formattedDate} at ${formattedTime}
            with ${teacher.firstName} ${teacher.lastName} is not available.</p>
            ${booking.rejectionReason && booking.rejectionReason !== 'No reason provided' ? `
            <div class="info-box">
              <strong>Teacher's Note:</strong> ${booking.rejectionReason}
            </div>
            ` : ''}
            <div class="booking-card">
              <h3>Original Request Details</h3>
              <div class="booking-detail"><span class="label">Class Title:</span> <span class="value">${booking.classTitle}</span></div>
              <div class="booking-detail"><span class="label">Requested Date:</span> <span class="value">${formattedDate}</span></div>
              <div class="booking-detail"><span class="label">Requested Time:</span> <span class="value">${formattedTime}</span></div>
            </div>
            <p style="margin-top: 20px;">
              Don't worry! You can schedule another class at a different time,
              or contact support to help you find an available time slot.
            </p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/student/dashboard" class="button">Schedule Another Class</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>Need help? Contact support for assistance</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendClassReminder = async (user, booking, role, centerName = "") => {
  const formattedDate = formatDate(booking.scheduledTime);
  const formattedTime = formatTime(booking.scheduledTime);

  return sendEmail({
    centerName,
    to: user.email,
    subject: `⏰ Class Reminder - Tomorrow at ${formattedTime}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .time-box { background: white; padding: 30px; border-radius: 8px;
                      margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
          .big-time { font-size: 36px; font-weight: bold; color: #f5576c; margin: 10px 0; }
          .button { display: inline-block; padding: 15px 40px; margin: 20px 5px;
                    background: #f5576c; color: white; text-decoration: none;
                    border-radius: 5px; font-weight: bold; font-size: 16px; }
          .checklist { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .checklist-item { padding: 10px 0; border-bottom: 1px solid #eee; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Class Reminder</h1>
            <p>Your class is tomorrow!</p>
          </div>
          <div class="content">
            <p>Hi ${user.firstName},</p>
            <p>This is a friendly reminder about your upcoming class.</p>
            <div class="time-box">
              <h2>${booking.classTitle}</h2>
              <div class="big-time">${formattedTime}</div>
              <p style="font-size: 18px; color: #666;">${formattedDate}</p>
              <p style="color: #999;">Duration: ${booking.duration} minutes</p>
            </div>
            <div class="checklist">
              <h3>Before your class:</h3>
              <div class="checklist-item">✓ Test your internet connection</div>
              <div class="checklist-item">✓ Check your camera and microphone</div>
              <div class="checklist-item">✓ Prepare any materials you need</div>
              <div class="checklist-item">✓ Join 5 minutes early</div>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/${role}/dashboard" class="button">Go to Dashboard</a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated reminder from ${config.appName}</p>
            <p>See you in class! 🎓</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendClassCompletedNotification = async (teacher, student, booking, centerName = "") => {
  await Promise.all([
    sendEmail({
      centerName,
      to: teacher.email,
      subject: `Class Completed - Payment Pending`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Class Completed Successfully! 🎉</h2>
          <p>Hi ${teacher.firstName},</p>
          <p>Your class "${booking.classTitle}" with ${student.firstName} ${student.lastName} has been marked as completed.</p>
          <p><strong>Payment Status:</strong> $${teacher.ratePerClass} has been added to your pending earnings.</p>
          <p>View your payment dashboard: <a href="${config.frontendUrl}/teacher/dashboard?tab=payment">Payment Dashboard</a></p>
        </body>
        </html>
      `,
    }),
    sendEmail({
      centerName,
      to: student.email,
      subject: `Class Completed - Great Job!`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Class Completed! 🎓</h2>
          <p>Hi ${student.firstName},</p>
          <p>Your class "${booking.classTitle}" with ${teacher.firstName} ${teacher.lastName} has been completed.</p>
          <p><strong>Classes Remaining:</strong> ${student.classCredits}</p>
          <p>Keep up the great work!</p>
          <p><a href="${config.frontendUrl}/student/dashboard">View Your Dashboard</a></p>
        </body>
        </html>
      `,
    }),
  ]);
};

export const sendBookingCreatedToStudent = async (student, teacher, booking, centerName = "") => {
  const formattedDate = formatDate(booking.scheduledTime);
  const formattedTime = formatTime(booking.scheduledTime);

  return sendEmail({
    centerName,
    to: student.email,
    subject: `Class Booked – ${booking.classTitle}`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .card{background:#fff;padding:20px;border-radius:8px;margin:20px 0;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .row{margin:10px 0;padding:10px 0;border-bottom:1px solid #eee}
      .label{font-weight:bold;color:#667eea}
      .btn{display:inline-block;padding:12px 30px;background:#667eea;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>📅 Class Booked!</h1><p>Your class has been scheduled</p></div>
      <div class="content">
        <p>Hi ${student.firstName},</p>
        <p>Your class with <strong>${teacher.firstName} ${teacher.lastName}</strong> has been booked. The teacher will confirm shortly.</p>
        <div class="card">
          <div class="row"><span class="label">Class:</span> ${booking.classTitle}</div>
          ${booking.topic ? `<div class="row"><span class="label">Topic:</span> ${booking.topic}</div>` : ''}
          <div class="row"><span class="label">Date:</span> ${formattedDate}</div>
          <div class="row"><span class="label">Time:</span> ${formattedTime}</div>
          <div class="row"><span class="label">Duration:</span> ${booking.duration} minutes</div>
          <div class="row"><span class="label">Teacher:</span> ${teacher.firstName} ${teacher.lastName}</div>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${config.frontendUrl}/student/dashboard" class="btn">View Dashboard</a>
        </div>
      </div>
      <div class="footer"><p>This is an automated message from ${config.appName}</p></div>
    </div></body></html>`,
  });
};

export const sendClassTimedReminder = async (user, booking, role, minutesLeft, centerName = "") => {
  const formattedTime = formatTime(booking.scheduledTime);
  const urgency      = minutesLeft <= 5  ? '🚨' : minutesLeft <= 30 ? '⚡' : '⏰';
  const urgencyText  = minutesLeft <= 5  ? 'starts in 5 minutes — join NOW!'
                     : minutesLeft <= 30 ? `starts in ${minutesLeft} minutes`
                     : 'starts in 1 hour';
  const headerColor  = minutesLeft <= 5  ? '#e74c3c' : minutesLeft <= 30 ? '#f39c12' : '#667eea';

  return sendEmail({
    centerName,
    to: user.email,
    subject: `${urgency} Class Reminder – ${urgencyText} – ${booking.classTitle}`,
    html: `<!DOCTYPE html><html><head><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333}
      .container{max-width:600px;margin:0 auto;padding:20px}
      .header{background:${headerColor};color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
      .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
      .time-box{background:#fff;padding:24px;border-radius:8px;margin:20px 0;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}
      .big-time{font-size:40px;font-weight:bold;color:${headerColor};margin:10px 0}
      .btn{display:inline-block;padding:14px 40px;background:${headerColor};color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;font-size:16px}
      .footer{text-align:center;margin-top:30px;color:#999;font-size:12px}
    </style></head><body><div class="container">
      <div class="header"><h1>${urgency} Class Reminder</h1><p>Your class ${urgencyText}</p></div>
      <div class="content">
        <p>Hi ${user.firstName},</p>
        <div class="time-box">
          <h2>${booking.classTitle}</h2>
          <div class="big-time">${formattedTime}</div>
          <p style="font-size:18px;color:#666">${minutesLeft} minutes away</p>
          <p style="color:#999">Duration: ${booking.duration} minutes</p>
        </div>
        ${minutesLeft <= 5 ? '<p style="color:#e74c3c;font-weight:bold;text-align:center;font-size:16px">Please join the class immediately!</p>' : ''}
        <div style="text-align:center;margin-top:20px">
          <a href="${config.frontendUrl}/${role}/dashboard" class="btn">Join Class Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated reminder from ${config.appName}</p></div>
    </div></body></html>`,
  });
};
