import { config } from "../config/config.js";
import { sendEmail, getCenterBaseUrl } from "./core.js";

export const sendWelcomeEmail = async (email, name, password, centerName = "") => {
  return sendEmail({
    centerName,
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
    `,
  });
};

export const sendPasswordResetEmail = async (email, name, newPassword, role = "teacher", centerName = "") => {
  const loginPath = role === "student" ? "/student/login" : role === "admin" ? "/admin/login" : "/teacher/login";
  return sendEmail({
    centerName,
    to: email,
    subject: "Your Password Has Been Reset",
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>Your password has been reset by an administrator.</p>
      <p><strong>New Password:</strong> ${newPassword}</p>
      <p>Please change this password after logging in.</p>
      <p>Login here: <a href="${config.frontendUrl}${loginPath}">${config.frontendUrl}${loginPath}</a></p>
    `,
  });
};

export const sendStudentForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "") => {
  const { baseUrl, needsSlug } = getCenterBaseUrl(center);
  const centerSlug  = typeof center === "string" ? center : center?.slug;
  const centerParam = needsSlug && centerSlug ? `?center=${centerSlug}` : "";
  const resetUrl    = `${baseUrl}/student/reset-password/${resetToken}${centerParam}`;

  return sendEmail({
    centerName,
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
          .warning { background: #fff3cd; border-left: 4px solid #ffc107;
                     padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header"><h1>🔐 Password Reset Request</h1></div>
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
          </div>
          <div class="footer">
            <p>This is an automated message from ${config.appName}</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendAdminForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "") => {
  const { baseUrl, needsSlug } = getCenterBaseUrl(center);
  const centerSlug  = typeof center === "string" ? center : center?.slug;
  const centerParam = needsSlug && centerSlug ? `?center=${centerSlug}` : "";
  const resetUrl    = `${baseUrl}/admin/reset-password/${resetToken}${centerParam}`;

  return sendEmail({
    centerName,
    to: email,
    subject: 'Admin Password Reset Request',
    html: `
      <h2>Admin Password Reset</h2>
      <p>Hi ${name || 'Admin'},</p>
      <p>You requested to reset your admin account password. Click the link below:</p>
      <p><a href="${resetUrl}" style="background:#4F46E5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;">Reset Password</a></p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you did not request this, please ignore this email — your password will not change.</p>
      <p>— The ${config.appName} Team</p>
    `,
  });
};

export const sendForgotPasswordEmail = async (email, name, resetToken, center = null, centerName = "") => {
  const { baseUrl, needsSlug } = getCenterBaseUrl(center);
  const centerSlug  = typeof center === "string" ? center : center?.slug;
  const centerParam = needsSlug && centerSlug ? `?center=${centerSlug}` : "";
  const resetUrl    = `${baseUrl}/teacher/reset-password/${resetToken}${centerParam}`;

  return sendEmail({
    centerName,
    to: email,
    subject: "Password Reset Request",
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });
};

export const sendSubAdminInviteEmail = async (subAdmin, setupUrl, createdBy, centerName = "") => {
  const adminName = createdBy
    ? `${createdBy.firstName} ${createdBy.lastName}`
    : "The main administrator";

  return sendEmail({
    centerName,
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
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4ff; padding: 40px 20px; }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(79,99,210,0.12); }
          .header { background: linear-gradient(135deg, #1e2540 0%, #2d3a6e 100%); padding: 40px 36px; text-align: center; }
          .logo-ring { width: 72px; height: 72px; background: linear-gradient(135deg, #4f63d2, #6b82f0); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 32px; }
          .header h1 { color: white; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
          .header p { color: rgba(255,255,255,0.6); font-size: 14px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 12px; }
          .info-box { background: #f0f4ff; border: 1px solid #dde3f8; border-radius: 14px; padding: 18px 20px; margin: 24px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #e8ecf8; font-size: 13.5px; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #94a3b8; font-weight: 500; }
          .info-value { color: #1e293b; font-weight: 700; }
          .cta-btn { display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #4f63d2, #6b82f0); color: white !important; text-decoration: none; border-radius: 14px; text-align: center; font-size: 15px; font-weight: 700; margin: 28px 0 16px; }
          .expiry { text-align: center; font-size: 12.5px; color: #94a3b8; margin-bottom: 24px; }
          .warning-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; font-size: 13px; color: #92400e; margin-bottom: 24px; }
          .footer { background: #f8faff; border-top: 1px solid #e8ecf8; padding: 20px 36px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
          .link-fallback { word-break: break-all; font-size: 12px; color: #4f63d2; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">
            <div class="header">
              <div class="logo-ring">🛡️</div>
              <h1>You're Invited!</h1>
              <p>${config.appName} Sub-Admin Access</p>
            </div>
            <div class="body">
              <p class="greeting">Hi ${subAdmin.firstName} ${subAdmin.lastName},</p>
              <p class="text">
                <strong>${adminName}</strong> has invited you to join
                <strong>${config.appName}</strong> as a <strong>Sub-Administrator</strong>.
                You will be able to manage assigned teachers and their students on the platform.
              </p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">Your Email</span><span class="info-value">${subAdmin.email}</span></div>
                <div class="info-row"><span class="info-label">Role</span><span class="info-value">Sub-Administrator</span></div>
                <div class="info-row"><span class="info-label">Platform</span><span class="info-value">${config.appName}</span></div>
                <div class="info-row"><span class="info-label">Invited By</span><span class="info-value">${adminName}</span></div>
              </div>
              <p class="text">Click the button below to set up your password and activate your account. This link will expire in <strong>48 hours</strong>.</p>
              <a href="${setupUrl}" class="cta-btn">✅ Set Up My Account</a>
              <p class="expiry">⏰ This invitation expires in 48 hours</p>
              <div class="warning-box">⚠️ If you did not expect this invitation, you can safely ignore this email.</div>
              <p class="text" style="font-size: 12.5px; color: #94a3b8;">
                If the button above doesn't work, copy and paste this link into your browser:<br />
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
  });
};

export const sendSubAdminWelcomeEmail = async (subAdmin, centerName = "") => {
  const loginUrl = `${config.frontendUrl}/sub-admin/login`;

  return sendEmail({
    centerName,
    to: subAdmin.email,
    subject: `Welcome aboard, ${subAdmin.firstName}! Your account is ready 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4ff; padding: 40px 20px; }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(79,99,210,0.12); }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 40px 36px; text-align: center; }
          .header h1 { color: white; font-size: 24px; font-weight: 700; margin-top: 12px; }
          .header p  { color: rgba(255,255,255,0.75); font-size: 14px; margin-top: 6px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 14px; }
          .feature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
          .feature { background: #f0f4ff; border: 1px solid #dde3f8; border-radius: 12px; padding: 14px; text-align: center; }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature p { font-size: 12.5px; font-weight: 600; color: #475569; }
          .cta-btn { display: block; padding: 16px; background: linear-gradient(135deg, #4f63d2, #6b82f0); color: white !important; text-decoration: none; border-radius: 14px; text-align: center; font-size: 15px; font-weight: 700; margin: 28px 0; }
          .footer { background: #f8faff; border-top: 1px solid #e8ecf8; padding: 20px 36px; text-align: center; font-size: 12px; color: #94a3b8; }
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
              <p class="text">Your account has been successfully set up! You now have access to <strong>${config.appName}</strong>'s admin panel where you can manage your assigned teachers and students.</p>
              <div class="feature-grid">
                <div class="feature"><div class="icon">👨‍🏫</div><p>Manage Teachers</p></div>
                <div class="feature"><div class="icon">👩‍🎓</div><p>View Students</p></div>
                <div class="feature"><div class="icon">💬</div><p>Send Messages</p></div>
                <div class="feature"><div class="icon">📅</div><p>Track Bookings</p></div>
              </div>
              <p class="text">Use your email address <strong>${subAdmin.email}</strong> and the password you just created to log in.</p>
              <a href="${loginUrl}" class="cta-btn">🚀 Go to My Dashboard</a>
              <p class="text" style="font-size: 13px; color: #94a3b8;">If you have questions or need help, contact the main administrator who set up your account.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from <strong>${config.appName}</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendTeacherInviteEmail = async (teacher, setupUrl, centerName = "") => {
  const displayName = centerName || config.appName;

  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `You've been invited to join ${displayName} as a Teacher 🎓`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f7ff; padding: 40px 20px; }
          .wrapper { max-width: 580px; margin: 0 auto; }
          .card { background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(59,130,246,0.12); }
          .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 40px 36px; text-align: center; }
          .logo-ring { width: 72px; height: 72px; background: linear-gradient(135deg, #3b82f6, #60a5fa); border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; font-size: 32px; }
          .header h1 { color: white; font-size: 22px; font-weight: 700; margin-bottom: 6px; }
          .header p  { color: rgba(255,255,255,0.65); font-size: 14px; }
          .body { padding: 36px; }
          .greeting { font-size: 17px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
          .text { font-size: 14.5px; color: #64748b; line-height: 1.7; margin-bottom: 12px; }
          .info-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 18px 20px; margin: 24px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #dbeafe; font-size: 13.5px; }
          .info-row:last-child { border-bottom: none; }
          .info-label { color: #94a3b8; font-weight: 500; }
          .info-value { color: #1e293b; font-weight: 700; }
          .cta-btn { display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #2563eb, #3b82f6); color: white !important; text-decoration: none; border-radius: 14px; text-align: center; font-size: 15px; font-weight: 700; margin: 28px 0 16px; }
          .expiry { text-align: center; font-size: 12.5px; color: #94a3b8; margin-bottom: 24px; }
          .warning-box { background: #fef9c3; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; font-size: 13px; color: #92400e; margin-bottom: 24px; }
          .features { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0 28px; }
          .feature { background: #f8faff; border: 1px solid #e0e7ff; border-radius: 12px; padding: 14px; text-align: center; }
          .feature .icon { font-size: 22px; margin-bottom: 6px; }
          .feature p { font-size: 12px; font-weight: 600; color: #475569; }
          .footer { background: #f8faff; border-top: 1px solid #e0e7ff; padding: 20px 36px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
          .link-fallback { word-break: break-all; font-size: 12px; color: #2563eb; }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="card">
            <div class="header">
              <div class="logo-ring">👨‍🏫</div>
              <h1>Welcome to the Team!</h1>
              <p>${displayName} Teacher Invitation</p>
            </div>
            <div class="body">
              <p class="greeting">Hi ${teacher.firstName} ${teacher.lastName},</p>
              <p class="text">You've been invited to join <strong>${displayName}</strong> as a <strong>Teacher</strong>. You'll be able to manage your classes, connect with students, and track your earnings — all in one place.</p>
              <div class="info-box">
                <div class="info-row"><span class="info-label">Your Email</span><span class="info-value">${teacher.email}</span></div>
                <div class="info-row"><span class="info-label">Role</span><span class="info-value">English Teacher</span></div>
                <div class="info-row"><span class="info-label">Region</span><span class="info-value">${teacher.continent}</span></div>
                <div class="info-row"><span class="info-label">Rate Per Class</span><span class="info-value">$${teacher.ratePerClass || 0}</span></div>
              </div>
              <div class="features">
                <div class="feature"><div class="icon">📅</div><p>Manage Classes</p></div>
                <div class="feature"><div class="icon">👩‍🎓</div><p>View Students</p></div>
                <div class="feature"><div class="icon">💬</div><p>Chat &amp; Messaging</p></div>
                <div class="feature"><div class="icon">💰</div><p>Track Earnings</p></div>
              </div>
              <p class="text">Click the button below to set up your password and activate your account. This link will expire in <strong>48 hours</strong>.</p>
              <a href="${setupUrl}" class="cta-btn">✅ Set Up My Teacher Account</a>
              <p class="expiry">⏰ This invitation expires in 48 hours</p>
              <div class="warning-box">⚠️ If you did not expect this invitation, you can safely ignore this email.</div>
              <p class="text" style="font-size: 12.5px; color: #94a3b8;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${setupUrl}" class="link-fallback">${setupUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated message from <strong>${displayName}</strong></p>
              <p>Please do not reply to this email · Contact support for assistance</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendTeacherWelcomeEmail = async (teacher, centerName = "") => {
  const displayName = centerName || config.appName;
  const loginUrl    = `${config.frontendUrl}/teacher/login`;

  return sendEmail({
    centerName,
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
              <p class="text">Your account has been successfully activated! You now have full access to <strong>${displayName}</strong>'s teacher dashboard.</p>
              <div class="feature-grid">
                <div class="feature"><div class="icon">📅</div><p>Schedule Classes</p></div>
                <div class="feature"><div class="icon">👩‍🎓</div><p>Manage Students</p></div>
                <div class="feature"><div class="icon">🎥</div><p>Video Classroom</p></div>
                <div class="feature"><div class="icon">💰</div><p>Track Earnings</p></div>
              </div>
              <p class="text">Log in using your email <strong>${teacher.email}</strong> and the password you just created.</p>
              <a href="${loginUrl}" class="cta-btn">🚀 Go to My Dashboard</a>
              <p class="text" style="font-size: 13px; color: #94a3b8;">If you have any questions, contact your administrator for assistance.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from <strong>${displayName}</strong></p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendStudentInviteEmail = async (student, setupUrl, centerName = "") => {
  const displayName = centerName || config.appName;

  return sendEmail({
    centerName,
    to: student.email,
    subject: `You've been invited to ${displayName} — Set up your account`,
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
          .btn { display: inline-block; padding: 16px 44px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: #fff; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: 800; box-shadow: 0 6px 20px rgba(59,130,246,0.35); }
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
            <p>Your admin has set up your account at ${displayName}</p>
          </div>
          <div class="body">
            <p>Hi <strong>${student.firstName}</strong>,</p>
            <p>Welcome to <strong>${displayName}</strong>! Your account has been created and you're ready to start your learning journey. Just set up your password to get started.</p>
            <div class="info-card">
              <div class="info-row"><span class="info-label">📧 Email</span><span class="info-value">${student.email}</span></div>
              <div class="info-row"><span class="info-label">📚 Classes Purchased</span><span class="info-value">${student.classCredits} classes</span></div>
              ${student.age ? `<div class="info-row"><span class="info-label">🎂 Age Group</span><span class="info-value">${student.age} years</span></div>` : ""}
              <div class="info-row"><span class="info-label">🎯 Role</span><span class="info-value">Student</span></div>
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
            <p>© ${new Date().getFullYear()} ${displayName}. All rights reserved.</p>
            <p>Having trouble? <a href="${setupUrl}">Copy this link</a> into your browser.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendStudentWelcomeEmail = async (student, centerName = "") => {
  const displayName = centerName || config.appName;
  const loginUrl    = `${config.frontendUrl}/student/login`;

  return sendEmail({
    centerName,
    to: student.email,
    subject: `Welcome to ${displayName} — Your account is ready! 🎉`,
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
            <p>Your <strong>${displayName}</strong> account is now fully activated! You can login and start joining your classes right away.</p>
            <div class="steps">
              <div class="step"><div class="step-num">1</div><span class="step-text">Log in with your email and the password you just created</span></div>
              <div class="step"><div class="step-num">2</div><span class="step-text">Check your Dashboard for upcoming live classes</span></div>
              <div class="step"><div class="step-num">3</div><span class="step-text">Join a class and start learning! 🚀</span></div>
              <div class="step"><div class="step-num">4</div><span class="step-text">Earn badges as you complete classes and build streaks</span></div>
            </div>
            <div class="cta">
              <a href="${loginUrl}" class="btn">Go to My Dashboard →</a>
            </div>
            <p style="font-size:13px; color:#94a3b8; text-align:center;">Questions? Just reply to this email — we're happy to help!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${displayName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};

export const sendParentInviteEmail = async (parent, setupUrl, centerName = "") => {
  const displayName = centerName || config.appName;

  return sendEmail({
    centerName,
    to: parent.email,
    subject: `You're invited to monitor your child's progress at ${displayName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff8f0; color: #333; }
          .wrap { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(249,115,22,0.12); }
          .header { background: linear-gradient(135deg, #f97316 0%, #f43f5e 100%); padding: 44px 40px; text-align: center; }
          .header h1 { color: #fff; font-size: 26px; font-weight: 800; margin-bottom: 8px; }
          .header p  { color: rgba(255,255,255,0.88); font-size: 15px; }
          .avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
          .body { padding: 40px; }
          .body p { font-size: 15px; line-height: 1.7; color: #444; margin-bottom: 16px; }
          .features { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }
          .feature { background: #fff8f0; border: 1px solid #fed7aa; border-radius: 12px; padding: 16px; text-align: center; }
          .feature .icon { font-size: 24px; margin-bottom: 6px; }
          .feature .name { font-size: 13px; font-weight: 700; color: #92400e; }
          .cta { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; padding: 16px 44px; background: linear-gradient(135deg, #f97316, #f43f5e); color: #fff; text-decoration: none; border-radius: 50px; font-size: 16px; font-weight: 800; box-shadow: 0 6px 20px rgba(249,115,22,0.35); }
          .expiry { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 14px 20px; font-size: 13px; color: #92400e; text-align: center; margin-top: 16px; }
          .footer { background: #fff8f0; padding: 24px 40px; text-align: center; border-top: 1px solid #ffe8cc; }
          .footer p { font-size: 12px; color: #a89480; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="header">
            <div class="avatar">👨‍👩‍👧</div>
            <h1>You're invited!</h1>
            <p>Track your child's learning progress at ${displayName}</p>
          </div>
          <div class="body">
            <p>Hi <strong>${parent.firstName}</strong>,</p>
            <p>Your child's school has created a Parent Portal account for you at <strong>${displayName}</strong>. Set up your password to start monitoring their progress in real time.</p>
            <div class="features">
              <div class="feature"><div class="icon">📅</div><div class="name">Class Schedule</div></div>
              <div class="feature"><div class="icon">📝</div><div class="name">Homework &amp; Grades</div></div>
              <div class="feature"><div class="icon">✅</div><div class="name">Attendance</div></div>
              <div class="feature"><div class="icon">🏆</div><div class="name">Certificates</div></div>
            </div>
            <div class="cta">
              <a href="${setupUrl}" class="btn">Set Up Your Account</a>
            </div>
            <div class="expiry">⏰ This invite link expires in 48 hours.</div>
            <p style="margin-top:24px;font-size:13px;color:#a89480;">Can't click the button? Copy this link:<br/><a href="${setupUrl}" style="color:#f97316;word-break:break-all;">${setupUrl}</a></p>
          </div>
          <div class="footer">
            <p>You received this because ${displayName} created a parent account for you.</p>
            <p>© ${new Date().getFullYear()} ${displayName}</p>
          </div>
        </div>
      </body>
      </html>
    `,
  });
};
