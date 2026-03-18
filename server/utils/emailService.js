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



/**
 * Send invitation email to a new teacher
 * @param {Object} teacher  - Teacher document (firstName, lastName, email, continent)
 * @param {String} setupUrl - The account setup link
 */
export const sendTeacherInviteEmail = async (teacher, setupUrl) => {
  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `You've been invited to join ${config.appName} as a Teacher 🎓`,
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
            background: #f0f7ff;
            padding: 40px 20px;
          }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card {
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(59,130,246,0.12);
          }
          .header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
            padding: 40px 36px;
            text-align: center;
          }
          .logo-ring {
            width: 72px; height: 72px;
            background: linear-gradient(135deg, #3b82f6, #60a5fa);
            border-radius: 20px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            font-size: 32px;
          }
          .header h1 { color: white; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
          .header p  { color: rgba(255,255,255,0.65); font-size: 14px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 12px; }
          .info-box {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 14px;
            padding: 18px 20px;
            margin: 24px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 7px 0;
            border-bottom: 1px solid #dbeafe;
            font-size: 13.5px;
          }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #94a3b8; font-weight: 500; }
          .info-value { color: #1e293b; font-weight: 700; }
          .cta-btn {
            display: block;
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            color: white !important;
            text-decoration: none;
            border-radius: 14px;
            text-align: center;
            font-size: 15px;
            font-weight: 700;
            margin: 28px 0 16px;
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
          .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin: 20px 0 28px;
          }
          .feature {
            background: #f8faff;
            border: 1px solid #e0e7ff;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
          }
          .feature .icon { font-size: 22px; margin-bottom: 6px; }
          .feature p { font-size: 12px; font-weight: 600; color: #475569; }
          .footer {
            background: #f8faff;
            border-top: 1px solid #e0e7ff;
            padding: 20px 36px;
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            line-height: 1.6;
          }
          .link-fallback { word-break: break-all; font-size: 12px; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">

            <div class="header">
              <div class="logo-ring">👨‍🏫</div>
              <h1>Welcome to the Team!</h1>
              <p>${config.appName} Teacher Invitation</p>
            </div>

            <div class="body">
              <p class="greeting">Hi ${teacher.firstName} ${teacher.lastName},</p>

              <p class="text">
                You've been invited to join <strong>${config.appName}</strong> as an 
                <strong>English Teacher</strong>. You'll be able to manage your classes, 
                connect with students, and track your earnings — all in one place.
              </p>

              <div class="info-box">
                <div class="info-row">
                  <span class="info-label">Your Email</span>
                  <span class="info-value">${teacher.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Role</span>
                  <span class="info-value">English Teacher</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Region</span>
                  <span class="info-value">${teacher.continent}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Rate Per Class</span>
                  <span class="info-value">$${teacher.ratePerClass || 0}</span>
                </div>
              </div>

              <div class="features">
                <div class="feature">
                  <div class="icon">📅</div>
                  <p>Manage Classes</p>
                </div>
                <div class="feature">
                  <div class="icon">👩‍🎓</div>
                  <p>View Students</p>
                </div>
                <div class="feature">
                  <div class="icon">💬</div>
                  <p>Chat & Messaging</p>
                </div>
                <div class="feature">
                  <div class="icon">💰</div>
                  <p>Track Earnings</p>
                </div>
              </div>

              <p class="text">
                Click the button below to set up your password and activate your account.
                This link will expire in <strong>48 hours</strong>.
              </p>

              <a href="${setupUrl}" class="cta-btn">✅ Set Up My Teacher Account</a>

              <p class="expiry">⏰ This invitation expires in 48 hours</p>

              <div class="warning-box">
                ⚠️ If you did not expect this invitation, you can safely ignore this email.
              </div>

              <p class="text" style="font-size: 12.5px; color: #94a3b8;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${setupUrl}" class="link-fallback">${setupUrl}</a>
              </p>
            </div>

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
 * Send welcome email after teacher activates their account
 * @param {Object} teacher - Teacher document
 */
export const sendTeacherWelcomeEmail = async (teacher) => {
  const loginUrl = `${config.frontendUrl}/teacher/login`;

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `Your teacher account is ready, ${teacher.firstName}! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f7ff; padding: 40px 20px; }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(59,130,246,0.12); }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 36px; text-align: center; }
          .header h1 { color: white; font-size: 24px; font-weight: 700; margin-top: 12px; }
          .header p  { color: rgba(255,255,255,0.75); font-size: 14px; margin-top: 6px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 14px; }
          .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
          .feature { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; text-align: center; }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature p { font-size: 12.5px; font-weight: 600; color: #475569; }
          .cta-btn { display: block; padding: 16px; background: linear-gradient(135deg, #2563eb, #3b82f6); color: white !important; text-decoration: none; border-radius: 14px; text-align: center; font-size: 15px; font-weight: 700; margin: 28px 0; }
          .footer { background: #f8faff; border-top: 1px solid #e0e7ff; padding: 20px 36px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">
            <div class="header">
              <div style="font-size: 48px;">🎉</div>
              <h1>You're All Set, ${teacher.firstName}!</h1>
              <p>Your teacher account is now active</p>
            </div>
            <div class="body">
              <p class="greeting">Hi ${teacher.firstName} ${teacher.lastName},</p>
              <p class="text">
                Your account has been successfully activated! You now have full access to 
                <strong>${config.appName}</strong>'s teacher dashboard.
              </p>
              <div class="feature-grid">
                <div class="feature"><div class="icon">📅</div><p>Schedule Classes</p></div>
                <div class="feature"><div class="icon">👩‍🎓</div><p>Manage Students</p></div>
                <div class="feature"><div class="icon">🎥</div><p>Video Classroom</p></div>
                <div class="feature"><div class="icon">💰</div><p>Track Earnings</p></div>
              </div>
              <p class="text">
                Log in using your email <strong>${teacher.email}</strong> and the password you just created.
              </p>
              <a href="${loginUrl}" class="cta-btn">🚀 Go to My Dashboard</a>
              <p class="text" style="font-size: 13px; color: #94a3b8;">
                If you have any questions, contact your administrator for assistance.
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


/**
 * Send invite email to new student
 * @param {Object} student - Student object { firstName, surname, email, noOfClasses, age }
 * @param {String} setupUrl - Full URL to the setup page with token
 */
export const sendStudentInviteEmail = async (student, setupUrl) => {
  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to:   student.email,
    subject: `You've been invited to ${config.appName} — Set up your account`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4ff; color: #333; }
          .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(59,130,246,0.12); }
          .header { background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 44px 40px; text-align: center; }
          .header h1 { color: #fff; font-size: 28px; font-weight: 800; margin-bottom: 8px; }
          .header p  { color: rgba(255,255,255,0.85); font-size: 15px; }
          .avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
          .body { padding: 40px; }
          .body p { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 16px; }
          .info-card { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 24px; margin: 24px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #dbeafe; font-size: 14px; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #3b82f6; font-weight: 700; }
          .info-value { color: #1e3a5f; font-weight: 600; }
          .features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
          .feature { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature .name { font-size: 13px; font-weight: 700; color: #334155; }
          .cta { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; padding: 16px 44px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: 800; letter-spacing: 0.3px; box-shadow: 0 6px 20px rgba(59,130,246,0.35); }
          .expiry { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px 20px; font-size: 13px; color: #92400e; text-align: center; margin-top: 16px; }
          .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
          .footer a { color: #3b82f6; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="avatar">🎓</div>
            <h1>You're invited to learn!</h1>
            <p>Your admin has set up your English learning account</p>
          </div>
          <div class="body">
            <p>Hi <strong>${student.firstName}</strong>,</p>
            <p>Welcome to <strong>${config.appName}</strong>! Your account has been created and you're ready to start your English learning journey. Just set up your password to get started.</p>

            <div class="info-card">
              <div class="info-row">
                <span class="info-label">📧 Email</span>
                <span class="info-value">${student.email}</span>
              </div>
              <div class="info-row">
                <span class="info-label">📚 Classes Purchased</span>
                <span class="info-value">${student.noOfClasses} classes</span>
              </div>
              ${student.age ? `<div class="info-row">
                <span class="info-label">🎂 Age Group</span>
                <span class="info-value">${student.age} years</span>
              </div>` : ""}
              <div class="info-row">
                <span class="info-label">🎯 Role</span>
                <span class="info-value">Student</span>
              </div>
            </div>

            <div class="features">
              <div class="feature"><div class="icon">📅</div><div class="name">Join Live Classes</div></div>
              <div class="feature"><div class="icon">💬</div><div class="name">Chat with Teacher</div></div>
              <div class="feature"><div class="icon">🏆</div><div class="name">Earn Badges</div></div>
              <div class="feature"><div class="icon">📊</div><div class="name">Track Progress</div></div>
            </div>

            <div class="cta">
              <a href="${setupUrl}" class="btn">Set Up My Account →</a>
              <div class="expiry">⏰ This link expires in <strong>48 hours</strong></div>
            </div>

            <p style="font-size:13px; color:#94a3b8; text-align:center;">
              If you didn't expect this email, you can safely ignore it.<br/>
              Need help? Reply to this email.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
            <p>Having trouble? <a href="${setupUrl}">Copy this link</a> into your browser.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await sendEmail(mailOptions);
};

/**
 * Send welcome email after student completes account setup
 * @param {Object} student - Student object { firstName, surname, email }
 */
export const sendStudentWelcomeEmail = async (student) => {
  const loginUrl = `${config.frontendUrl}/student/login`;

  const mailOptions = {
    from: `"${config.appName}" <${config.emailFrom}>`,
    to:   student.email,
    subject: `Welcome to ${config.appName} — Your account is ready! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4ff; color: #333; }
          .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(16,185,129,0.12); }
          .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 44px 40px; text-align: center; }
          .header h1 { color: #fff; font-size: 28px; font-weight: 800; margin-bottom: 8px; }
          .header p  { color: rgba(255,255,255,0.85); font-size: 15px; }
          .emoji { font-size: 56px; margin-bottom: 12px; }
          .body { padding: 40px; }
          .body p { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 16px; }
          .steps { background: #f0fdf4; border: 1px solid #a7f3d0; border-radius: 14px; padding: 24px; margin: 24px 0; }
          .step { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #d1fae5; font-size: 14px; }
          .step:last-child { border-bottom: none; }
          .step-num { width: 30px; height: 30px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 50%; color: white; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .step-text { color: #065f46; font-weight: 600; }
          .cta { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; padding: 16px 44px; background: linear-gradient(135deg, #10b981, #3b82f6); color: #fff; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: 800; box-shadow: 0 6px 20px rgba(16,185,129,0.35); }
          .footer { background: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
          .footer p { font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="emoji">🎉</div>
            <h1>You're all set, ${student.firstName}!</h1>
            <p>Your account is active and ready to go</p>
          </div>
          <div class="body">
            <p>Hi <strong>${student.firstName}</strong>,</p>
            <p>Your <strong>${config.appName}</strong> account is now fully activated! You can login and start joining your English classes right away.</p>

            <div class="steps">
              <div class="step"><div class="step-num">1</div><span class="step-text">Log in with your email and the password you just created</span></div>
              <div class="step"><div class="step-num">2</div><span class="step-text">Check your Dashboard for upcoming live classes</span></div>
              <div class="step"><div class="step-num">3</div><span class="step-text">Join a class and start learning! 🚀</span></div>
              <div class="step"><div class="step-num">4</div><span class="step-text">Earn badges as you complete classes and build streaks</span></div>
            </div>

            <div class="cta">
              <a href="${loginUrl}" class="btn">Go to My Dashboard →</a>
            </div>

            <p style="font-size:13px; color:#94a3b8; text-align:center;">
              Questions? Just reply to this email — we're happy to help!
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return await sendEmail(mailOptions);
};


// ==================== BOOKING CREATED — NOTIFY STUDENT ====================

export const sendBookingCreatedToStudent = async (student, teacher, booking) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
    </div></body></html>`
  });
};

// ==================== CLASS TIMED REMINDERS (1hr / 30min / 5min) ====================

export const sendClassTimedReminder = async (user, booking, role, minutesLeft) => {
  const scheduledDate = new Date(booking.scheduledTime);
  const formattedTime = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const urgency = minutesLeft <= 5 ? '🚨' : minutesLeft <= 30 ? '⚡' : '⏰';
  const urgencyText = minutesLeft <= 5 ? 'starts in 5 minutes — join NOW!' : minutesLeft <= 30 ? `starts in ${minutesLeft} minutes` : `starts in 1 hour`;
  const headerColor = minutesLeft <= 5 ? '#e74c3c' : minutesLeft <= 30 ? '#f39c12' : '#667eea';

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
    </div></body></html>`
  });
};

// ==================== HOMEWORK EMAILS ====================

export const sendHomeworkAssigned = async (student, teacher, homework) => {
  const dueDate = new Date(homework.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
        <div class="due">
          <strong>⏰ Due Date:</strong> ${dueDate}
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${config.frontendUrl}/student/dashboard" class="btn">View Homework</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`
  });
};

export const sendHomeworkSubmitted = async (teacher, student, homework) => {
  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `📬 Homework Submitted – ${homework.title} – ${student.firstName} ${student.surname || student.lastName}`,
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
        <p><strong>${student.firstName} ${student.surname || student.lastName}</strong> has submitted their homework and it is ready for you to grade.</p>
        <div class="card">
          <div class="row"><span class="label">Homework:</span> ${homework.title}</div>
          <div class="row"><span class="label">Student:</span> ${student.firstName} ${student.surname || student.lastName}</div>
          <div class="row"><span class="label">Submitted:</span> ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${config.frontendUrl}/teacher/dashboard" class="btn">Grade Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`
  });
};

export const sendHomeworkDueReminder = async (student, homework, minutesLeft) => {
  const dueDate = new Date(homework.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          <a href="${config.frontendUrl}/student/dashboard" class="btn">Submit Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated reminder from ${config.appName}</p></div>
    </div></body></html>`
  });
};

// ==================== QUIZ EMAILS ====================

export const sendQuizAssigned = async (student, teacher, quiz) => {
  const dueDate = new Date(quiz.dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          <a href="${config.frontendUrl}/student/dashboard" class="btn">Take Quiz</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`
  });
};

export const sendQuizCompleted = async (teacher, student, quiz, attempt) => {
  const scoreColor = attempt.percentage >= 80 ? '#10b981' : attempt.percentage >= 60 ? '#f59e0b' : '#ef4444';
  const trophy = attempt.percentage >= 90 ? '🏆' : attempt.percentage >= 75 ? '🥇' : attempt.percentage >= 60 ? '🥈' : '🥉';

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
    to: teacher.email,
    subject: `📝 Quiz Completed – ${quiz.title} – ${student.firstName} ${student.surname || student.lastName} scored ${attempt.percentage}%`,
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
        <p><strong>${student.firstName} ${student.surname || student.lastName}</strong> has completed the quiz.</p>
        <div class="score-box">
          <div style="font-size:48px">${trophy}</div>
          <div class="score">${attempt.percentage}%</div>
          <p style="font-size:18px;color:#666">${attempt.score} out of ${attempt.totalQuestions} correct</p>
          ${attempt.timeTaken ? `<p style="color:#999">Completed in ${Math.floor(attempt.timeTaken/60)}m ${attempt.timeTaken%60}s</p>` : ''}
        </div>
        <div class="card">
          <div class="row"><span class="label">Quiz:</span> ${quiz.title}</div>
          <div class="row"><span class="label">Student:</span> ${student.firstName} ${student.surname || student.lastName}</div>
          <div class="row"><span class="label">Score:</span> ${attempt.score}/${attempt.totalQuestions} (${attempt.percentage}%)</div>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="${config.frontendUrl}/teacher/dashboard" class="btn">View Results</a>
        </div>
      </div>
      <div class="footer"><p>Automated message from ${config.appName}</p></div>
    </div></body></html>`
  });
};

export const sendQuizDueReminder = async (student, quiz, minutesLeft) => {
  const dueTime = new Date(quiz.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return sendEmail({
    from: `"${config.appName}" <${config.emailFrom}>`,
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
          <a href="${config.frontendUrl}/student/dashboard" class="btn">Take Quiz Now</a>
        </div>
      </div>
      <div class="footer"><p>Automated reminder from ${config.appName}</p></div>
    </div></body></html>`
  });
};

export default {
  verifyEmailConfig,
  sendBookingRequestToTeacher,
  sendBookingAcceptedToStudent,
  sendBookingRejectedToStudent,
  sendBookingCreatedToStudent,
  sendClassReminder,
  sendClassTimedReminder,
  sendClassCompletedNotification,
  sendHomeworkAssigned,
  sendHomeworkSubmitted,
  sendHomeworkDueReminder,
  sendQuizAssigned,
  sendQuizCompleted,
  sendQuizDueReminder,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendForgotPasswordEmail,
  sendSubAdminInviteEmail,
  sendSubAdminWelcomeEmail,
  sendTeacherInviteEmail,
  sendStudentInviteEmail,
  sendStudentWelcomeEmail
};
// ==================== PROGRESS REPORTS ====================

/**
 * Send a progress report PDF to a student by email.
 * @param {Object} student  - { firstName, surname, email }
 * @param {Buffer} pdfBuffer - PDF bytes from generateProgressReport()
 * @param {"weekly"|"monthly"} period
 * @param {Date} from  - start of reporting window
 * @param {Date} to    - end of reporting window
 */
export const sendProgressReport = async (student, pdfBuffer, period, from, to) => {
  const label   = period === "weekly" ? "Weekly" : "Monthly";
  const fromStr = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const toStr   = new Date(to - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const subject = `${label} Progress Report — ${fromStr} to ${toStr}`;
  const filename = `progress-report-${from.toISOString().slice(0, 10)}.pdf`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#16a34a;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:20px;">📊 ${label} Progress Report</h1>
        <p style="color:#dcfce7;margin:8px 0 0;font-size:13px;">${fromStr} – ${toStr}</p>
      </div>
      <div style="background:#f0fdf4;padding:24px 32px;border-radius:0 0 8px 8px;">
        <p style="color:#1e293b;font-size:15px;">
          Hi <strong>${student.firstName}</strong>,
        </p>
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
  `;

  return sendEmail({
    from: `"English Learning Platform" <${config.emailFrom}>`,
    to:   student.email,
    subject,
    html,
    attachments: [{
      filename,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};
