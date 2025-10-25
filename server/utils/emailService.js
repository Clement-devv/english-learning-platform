// server/utils/emailService.js
import nodemailer from "nodemailer";

// Create transporter function that accepts credentials
const createTransporter = (emailUser, emailPassword) => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

// Send welcome email
export const sendWelcomeEmail = async (teacherEmail, teacherName, password) => {
  const transporter = createTransporter(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
  
  const mailOptions = {
    from: `School App <${process.env.EMAIL_USER}>`,
    to: teacherEmail,
    subject: "Welcome to the School App - Your Login Credentials",
    html:  `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .password { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to School App!</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${teacherName}</strong>,</p>
              <p>Your teacher account has been created successfully. Below are your login credentials:</p>
              
              <div class="credentials">
                <p><strong>Email:</strong> ${teacherEmail}</p>
                <p><strong>Temporary Password:</strong></p>
                <p class="password">${password}</p>
              </div>

              <p><strong>⚠️ Important Security Note:</strong></p>
              <ul>
                <li>This is a temporary password</li>
                <li>Please change it immediately after your first login</li>
                <li>Do not share this password with anyone</li>
              </ul>

              <a href="${process.env.FRONTEND_URL}/teacher/login" class="button">Login Now</a>

              <div class="footer">
                <p>If you did not request this account, please contact the administrator immediately.</p>
                <p>© 2025 School App. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome email sent to ${teacherEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (teacherEmail, teacherName, newPassword) => {
  // Create transporter for this email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: `School App <${process.env.EMAIL_USER}>`,
    to: teacherEmail,
    subject: "Your Password Has Been Reset",
    html:  `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c; }
            .password { font-size: 24px; font-weight: bold; color: #f5576c; letter-spacing: 2px; }
            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${teacherName}</strong>,</p>
              <p>Your password has been reset by an administrator.</p>
              
              <div class="credentials">
                <p><strong>Your New Password:</strong></p>
                <p class="password">${newPassword}</p>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p>If you did not request this password reset, please contact the administrator immediately and change your password.</p>
              </div>

              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Login using your new password</li>
                <li>Go to your profile settings</li>
                <li>Change your password to something memorable</li>
              </ol>

              <a href="${process.env.FRONTEND_URL}/teacher/login" class="button">Login Now</a>

              <div class="footer">
                <p>© 2025 School App. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${teacherEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending password reset email:", error);
    return { success: false, error: error.message };
  }
};

//Send forgot password email with reset link
export const sendForgotPasswordEmail = async (teacherEmail, teacherName, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/teacher/reset-password/${resetToken}`;
  
  // Create transporter for this email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  
  const mailOptions = {
    from: `School App <${process.env.EMAIL_USER}>`,
    to: teacherEmail,
    subject: "Reset Your Password",
    html:  `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 40px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${teacherName}</strong>,</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              
              <a href="${resetLink}" class="button">Reset Password</a>

              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>

              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Your password won't change unless you click the link above</li>
                </ul>
              </div>

              <div class="footer">
                <p>If you're having trouble, contact the administrator for assistance.</p>
                <p>© 2025 School App. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Forgot password email sent to ${teacherEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending forgot password email:", error);
    return { success: false, error: error.message };
  }
};


// Send forgot password email for STUDENTS
export const sendStudentForgotPasswordEmail = async (studentEmail, studentName, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL}/student/reset-password/${resetToken}`;
  
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  
  const mailOptions = {
    from: `School App <${process.env.EMAIL_USER}>`,
    to: studentEmail,
    subject: "Reset Your Password - Student Portal",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 40px; background: #4facfe; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .warning { background: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hello <strong>${studentName}</strong>,</p>
              <p>We received a request to reset your student account password. Click the button below to create a new password:</p>
              
              <a href="${resetLink}" class="button">Reset Password</a>

              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>

              <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul>
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Your password won't change unless you click the link above</li>
                </ul>
              </div>

              <div class="footer">
                <p>If you're having trouble, contact your teacher or administrator for assistance.</p>
                <p>© 2025 School App. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Student forgot password email sent to ${studentEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending student forgot password email:", error);
    return { success: false, error: error.message };
  }
};