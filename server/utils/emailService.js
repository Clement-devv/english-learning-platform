// server/utils/emailService.js - ENHANCED WITH BOOKING NOTIFICATIONS
import nodemailer from "nodemailer";
import { config } from "../config/config.js";

/**
 * Email Configuration
 * Make sure these are set in your .env file:
 * - EMAIL_HOST (e.g., smtp.gmail.com)
 * - EMAIL_PORT (e.g., 587)
 * - EMAIL_USER (your email)
 * - EMAIL_PASSWORD (app password)
 * - EMAIL_FROM (sender email)
 * - FRONTEND_URL (e.g., https://yourapp.com)
 */

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.emailHost,
  port: config.emailPort,
  secure: false, // true for 465, false for other ports
  auth: {
    user: config.emailUser,
    pass: config.emailPassword,
  },
});

/**
 * Verify email configuration on startup
 */
export const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    console.log("✅ Email service is ready");
    return true;
  } catch (error) {
    console.error("❌ Email service error:", error.message);
    console.error("⚠️ Email notifications will be disabled");
    return false;
  }
};

/**
 * Generic email sender with error handling
 */
export const sendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send failed:", error.message);
    return { success: false, error: error.message };
  }
};

// ==================== BOOKING NOTIFICATIONS ====================

/**
 * Send notification when admin creates a booking request for teacher
 * @param {Object} teacher - Teacher object
 * @param {Object} student - Student object
 * @param {Object} booking - Booking object
 */
export const sendBookingRequestToTeacher = async (teacher, student, booking) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `New Class Request - ${student.firstName} ${student.surname}`,
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
          .button:hover { background: #5568d3; }
          .button-reject { background: #e74c3c; }
          .button-reject:hover { background: #c0392b; }
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
              
              <div class="booking-detail">
                <span class="label">Student:</span>
                <span class="value">${student.firstName} ${student.surname}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Class Title:</span>
                <span class="value">${booking.classTitle}</span>
              </div>
              
              ${booking.topic ? `
              <div class="booking-detail">
                <span class="label">Topic:</span>
                <span class="value">${booking.topic}</span>
              </div>
              ` : ''}
              
              <div class="booking-detail">
                <span class="label">Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Duration:</span>
                <span class="value">${booking.duration} minutes</span>
              </div>
              
              ${booking.notes ? `
              <div class="booking-detail">
                <span class="label">Notes:</span>
                <span class="value">${booking.notes}</span>
              </div>
              ` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/teacher/dashboard?tab=bookings" class="button">
                View & Accept Request
              </a>
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Please respond to this booking request as soon as possible. 
              Students are waiting to schedule their classes with you!
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>If you have any questions, please contact support</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send notification when teacher accepts a booking
 * @param {Object} student - Student object
 * @param {Object} teacher - Teacher object
 * @param {Object} booking - Booking object
 */
export const sendBookingAcceptedToStudent = async (student, teacher, booking) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          .button:hover { background: #0e8074; }
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
              
              <div class="booking-detail">
                <span class="label">Teacher:</span>
                <span class="value">${teacher.firstName} ${teacher.lastName}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Class Title:</span>
                <span class="value">${booking.classTitle}</span>
              </div>
              
              ${booking.topic ? `
              <div class="booking-detail">
                <span class="label">Topic:</span>
                <span class="value">${booking.topic}</span>
              </div>
              ` : ''}
              
              <div class="booking-detail">
                <span class="label">Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Duration:</span>
                <span class="value">${booking.duration} minutes</span>
              </div>
            </div>
            
            <div class="reminder-box">
              <strong>⏰ Reminder:</strong> Please join the class 5 minutes before the scheduled time 
              to ensure everything is working properly.
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/student/dashboard?tab=classes" class="button">
                View My Classes
              </a>
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              You'll receive another reminder 24 hours before your class. 
              See you in class! 📚
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>If you need to reschedule, please contact support</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send notification when teacher rejects a booking
 * @param {Object} student - Student object
 * @param {Object} teacher - Teacher object
 * @param {Object} booking - Booking object
 */
export const sendBookingRejectedToStudent = async (student, teacher, booking) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          .button:hover { background: #5568d3; }
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
              
              <div class="booking-detail">
                <span class="label">Class Title:</span>
                <span class="value">${booking.classTitle}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Requested Date:</span>
                <span class="value">${formattedDate}</span>
              </div>
              
              <div class="booking-detail">
                <span class="label">Requested Time:</span>
                <span class="value">${formattedTime}</span>
              </div>
            </div>
            
            <p style="margin-top: 20px;">
              Don't worry! You can schedule another class at a different time, 
              or contact support to help you find an available time slot.
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="${config.frontendUrl}/student/dashboard" class="button">
                Schedule Another Class
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>Need help? Contact support for assistance</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send class reminder 24 hours before scheduled time
 * @param {Object} user - Student or Teacher object
 * @param {Object} booking - Booking object
 * @param {string} role - 'student' or 'teacher'
 */
export const sendClassReminder = async (user, booking, role) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          .button:hover { background: #e04158; }
          .checklist { background: white; padding: 20px; border-radius: 8px; 
                       margin: 20px 0; }
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
              <a href="${config.frontendUrl}/${role}/dashboard" class="button">
                Go to Dashboard
              </a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder from ${config.appName}</p>
            <p>See you in class! 🎓</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send notification when class is completed
 * @param {Object} teacher - Teacher object
 * @param {Object} student - Student object
 * @param {Object} booking - Booking object
 */
export const sendClassCompletedNotification = async (teacher, student, booking) => {
  // Send to teacher
  const teacherMail = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `Class Completed - Payment Pending`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Class Completed Successfully! 🎉</h2>
        <p>Hi ${teacher.firstName},</p>
        <p>Your class "${booking.classTitle}" with ${student.firstName} ${student.surname} has been marked as completed.</p>
        <p><strong>Payment Status:</strong> $${teacher.ratePerClass} has been added to your pending earnings.</p>
        <p>View your payment dashboard: <a href="${config.frontendUrl}/teacher/dashboard?tab=payment">Payment Dashboard</a></p>
      </body>
      </html>
    `
  };

  // Send to student
  const studentMail = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: student.email,
    subject: `Class Completed - Great Job!`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Class Completed! 🎓</h2>
        <p>Hi ${student.firstName},</p>
        <p>Your class "${booking.classTitle}" with ${teacher.firstName} ${teacher.lastName} has been completed.</p>
        <p><strong>Classes Remaining:</strong> ${student.noOfClasses}</p>
        <p>Keep up the great work!</p>
        <p><a href="${config.frontendUrl}/student/dashboard">View Your Dashboard</a></p>
      </body>
      </html>
    `
  };

  await Promise.all([
    sendEmail(teacherMail),
    sendEmail(studentMail)
  ]);
};

// ==================== EXISTING FUNCTIONS ====================

/**
 * Send welcome email to new users
 */
export const sendWelcomeEmail = async (email, name, password) => {
  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: email,
    subject: `Welcome to ${config.appName}!`,
    html: `
      <h2>Welcome ${name}!</h2>
      <p>Your account has been created successfully.</p>
      <p><strong>Login Credentials:</strong></p>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
      <p>Please change your password after your first login.</p>
      <p>Login here: <a href="${config.frontendUrl}/login">${config.frontendUrl}/login</a></p>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email, name, newPassword) => {
  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: email,
    subject: "Your Password Has Been Reset",
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>Your password has been reset by an administrator.</p>
      <p><strong>New Password:</strong> ${newPassword}</p>
      <p>Please change this password after logging in.</p>
      <p>Login here: <a href="${config.frontendUrl}/login">${config.frontendUrl}/login</a></p>
    `
  };

  return await sendEmail(mailOptions);
};



/**
 * Send forgot password email to student with reset link
 */
export const sendStudentForgotPasswordEmail = async (email, name, resetToken) => {
  const resetUrl = `${config.frontendUrl}/student/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: email,
    subject: "Password Reset Request",
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
          .button { display: inline-block; padding: 15px 30px; margin: 20px 0;
                    background: #667eea; color: white; text-decoration: none;
                    border-radius: 5px; font-weight: bold; }
          .button:hover { background: #5568d3; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107;
                     padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          
          <div class="content">
            <p>Hi ${name},</p>
            <p>You requested to reset your password for your student account. Click the button below to reset it:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset My Password</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This link will expire in <strong>1 hour</strong></li>
                <li>If you didn't request this, please ignore this email</li>
                <li>Your password won't change unless you click the link above</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              If you're having trouble clicking the button, you can contact support for assistance.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return await sendEmail(mailOptions);
};

/**
 * Send forgot password email with reset link
 */
export const sendForgotPasswordEmail = async (email, name, resetToken) => {
  const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  return await sendEmail(mailOptions);
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD THESE TWO FUNCTIONS TO: server/utils/emailService.js
// Add them before the `export default` line at the bottom
// Also add both names to the export default object
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send invitation email to a new sub-admin
 * @param {Object} subAdmin  - SubAdmin document (firstName, lastName, email)
 * @param {String} setupUrl  - The account setup link
 * @param {Object} createdBy - Admin who created the invite (firstName, lastName)
 */
export const sendSubAdminInviteEmail = async (subAdmin, setupUrl, createdBy) => {
  const adminName = createdBy
    ? `${createdBy.firstName} ${createdBy.lastName}`
    : "The main administrator";

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: subAdmin.email,
    subject: `You've been invited to join ${config.appName} as a Sub-Admin`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f0f4ff;
            padding: 40px 20px;
          }
          .wrapper {
            max-width: 580px;
            margin: 0 auto;
          }
          .card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(79,99,210,0.12);
          }
          .header {
            background: linear-gradient(135deg, #1e2540 0%, #2d3a6e 100%);
            padding: 40px 36px;
            text-align: center;
          }
          .logo-ring {
            width: 72px; height: 72px;
            background: linear-gradient(135deg, #4f63d2, #6b82f0);
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            font-size: 32px;
          }
          .header h1 {
            color: white;
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .header p {
            color: rgba(255,255,255,0.6);
            font-size: 14px;
          }
          .body {
            padding: 36px;
          }
          .greeting {
            font-size: 17px;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 14px;
          }
          .text {
            font-size: 14.5px;
            color: #64748b;
            line-height: 1.7;
            margin-bottom: 12px;
          }
          .info-box {
            background: #f0f4ff;
            border: 1px solid #dde3f8;
            border-radius: 14px;
            padding: 18px 20px;
            margin: 24px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
            border-bottom: 1px solid #e8ecf8;
            font-size: 13.5px;
          }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #94a3b8; font-weight: 500; }
          .info-value { color: #1e293b; font-weight: 700; }
          .cta-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #4f63d2, #6b82f0);
            color: white !important;
            text-decoration: none;
            border-radius: 14px;
            text-align: center;
            font-size: 15px;
            font-weight: 700;
            margin: 28px 0 16px;
            letter-spacing: 0.01em;
          }
          .expiry {
            text-align: center;
            font-size: 12.5px;
            color: #94a3b8;
            margin-bottom: 24px;
          }
          .warning-box {
            background: #fef9c3;
            border: 1px solid #fde68a;
            border-radius: 12px;
            padding: 14px 16px;
            font-size: 13px;
            color: #92400e;
            margin-bottom: 24px;
          }
          .footer {
            background: #f8faff;
            border-top: 1px solid #e8ecf8;
            padding: 20px 36px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.6;
          }
          .link-fallback {
            word-break: break-all;
            font-size: 12px;
            color: #4f63d2;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">

            <!-- Header -->
            <div class="header">
              <div class="logo-ring">🛡️</div>
              <h1>You're Invited!</h1>
              <p>${config.appName} Sub-Admin Access</p>
            </div>

            <!-- Body -->
            <div class="body">
              <p class="greeting">Hi ${subAdmin.firstName} ${subAdmin.lastName},</p>

              <p class="text">
                <strong>${adminName}</strong> has invited you to join 
                <strong>${config.appName}</strong> as a <strong>Sub-Administrator</strong>.
                You will be able to manage assigned teachers and their students on the platform.
              </p>

              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Your Email</span>
                  <span class="info-value">${subAdmin.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Role</span>
                  <span class="info-value">Sub-Administrator</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Platform</span>
                  <span class="info-value">${config.appName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Invited By</span>
                  <span class="info-value">${adminName}</span>
                </div>
              </div>

              <p class="text">
                Click the button below to set up your password and activate your account.
                This link will expire in <strong>48 hours</strong>.
              </p>

              <a href="${setupUrl}" class="cta-btn">
                ✅ Set Up My Account
              </a>

              <p class="expiry">⏰ This invitation expires in 48 hours</p>

              <div class="warning-box">
                ⚠️ If you did not expect this invitation, you can safely ignore this email.
                Your email address will not be used without account activation.
              </div>

              <p class="text" style="font-size: 12.5px; color: #94a3b8;">
                If the button above doesn't work, copy and paste this link into your browser:<br />
                <a href="${setupUrl}" class="link-fallback">${setupUrl}</a>
              </p>
            </div>

            <!-- Footer -->
            <div class="footer">
              <p>This is an automated message from <strong>${config.appName}</strong></p>
              <p>Please do not reply to this email · Contact support for assistance</p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await sendEmail(mailOptions);
};

/**
 * Send welcome email after sub-admin activates their account
 * @param {Object} subAdmin - SubAdmin document
 */
export const sendSubAdminWelcomeEmail = async (subAdmin) => {
  const loginUrl = `${config.frontendUrl}/sub-admin/login`;

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: subAdmin.email,
    subject: `Welcome aboard, ${subAdmin.firstName}! Your account is ready 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #f0f4ff;
            padding: 40px 20px;
          }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(79,99,210,0.12);
          }
          .header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            padding: 40px 36px;
            text-align: center;
          }
          .header h1 { color: white; font-size: 24px; font-weight: 700; margin-top: 12px; }
          .header p  { color: rgba(255,255,255,0.75); font-size: 14px; margin-top: 6px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 14px; }
          .feature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 24px 0;
          }
          .feature {
            background: #f0f4ff;
            border: 1px solid #dde3f8;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
          }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature p { font-size: 12.5px; font-weight: 600; color: #475569; }
          .cta-btn {
            display: block;
            padding: 16px;
            background: linear-gradient(135deg, #4f63d2, #6b82f0);
            color: white !important;
            text-decoration: none;
            border-radius: 14px;
            text-align: center;
            font-size: 15px;
            font-weight: 700;
            margin: 28px 0;
          }
          .footer {
            background: #f8faff;
            border-top: 1px solid #e8ecf8;
            padding: 20px 36px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">

            <div class="header">
              <div style="font-size: 48px;">🎉</div>
              <h1>Welcome, ${subAdmin.firstName}!</h1>
              <p>Your sub-admin account is now active</p>
            </div>

            <div class="body">
              <p class="greeting">Hi ${subAdmin.firstName} ${subAdmin.lastName},</p>

              <p class="text">
                Your account has been successfully set up! You now have access to 
                <strong>${config.appName}</strong>'s admin panel where you can manage 
                your assigned teachers and students.
              </p>

              <div class="feature-grid">
                <div class="feature">
                  <div class="icon">👨‍🏫</div>
                  <p>Manage Teachers</p>
                </div>
                <div class="feature">
                  <div class="icon">👩‍🎓</div>
                  <p>View Students</p>
                </div>
                <div class="feature">
                  <div class="icon">💬</div>
                  <p>Send Messages</p>
                </div>
                <div class="feature">
                  <div class="icon">📅</div>
                  <p>Track Bookings</p>
                </div>
              </div>

              <p class="text">
                Use your email address <strong>${subAdmin.email}</strong> and the password 
                you just created to log in.
              </p>

              <a href="${loginUrl}" class="cta-btn">
                🚀 Go to My Dashboard
              </a>

              <p class="text" style="font-size: 13px; color: #94a3b8;">
                If you have questions or need help, contact the main administrator who set up your account.
              </p>
            </div>

            <div class="footer">
              <p>This is an automated message from <strong>${config.appName}</strong></p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await sendEmail(mailOptions);
};

export default {
  verifyEmailConfig,
  sendBookingRequestToTeacher,
  sendBookingAcceptedToStudent,
  sendBookingRejectedToStudent,
  sendClassReminder,
  sendClassCompletedNotification,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendForgotPasswordEmail,
  sendSubAdminInviteEmail,
  sendSubAdminWelcomeEmail
};