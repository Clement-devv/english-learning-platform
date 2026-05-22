import { config } from '../config/config.js';
import { sendEmail, getCenterBaseUrl } from './core.js';

const appName = config.appName || 'Clemify';
const supportEmail = process.env.SUPER_ADMIN_EMAIL || config.emailFrom || config.emailUser || 'support@clemify.com';

// ── sendOldEmailAlert ─────────────────────────────────────────────────────────
// Sent to the CURRENT (old) admin email when a change is requested.
// Includes a cancel link that stays valid for 48 h.
export const sendOldEmailAlert = async (center, newEmail, rawCancelToken) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const cancelUrl = `${baseUrl}/admin/email-change/cancel/${rawCancelToken}`;

  return sendEmail({
    centerName: center.centerName,
    to: center.adminEmail,
    subject: `Security alert: Login email change requested for ${center.centerName}`,
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;padding:20px}
    .hdr{background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .body{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .alert{background:#fef2f2;border-left:4px solid #dc2626;padding:16px;margin:20px 0;border-radius:4px}
    .safe{background:#f0fdf4;border-left:4px solid #16a34a;padding:16px;margin:20px 0;border-radius:4px}
    .btn{display:inline-block;padding:14px 28px;margin:20px 0;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1 style="margin:0">&#128274; Security Alert</h1>
    <p style="margin:6px 0 0;opacity:.9">Login email change requested</p>
  </div>
  <div class="body">
    <p>Hello,</p>
    <p>A request was made to change the admin login email for <strong>${center.centerName}</strong>.</p>
    <div class="alert">
      <strong>Requested change:</strong><br>
      Current email: <strong>${center.adminEmail}</strong><br>
      New email: <strong>${newEmail}</strong>
    </div>
    <div class="safe">
      <strong>&#10003; If you made this request:</strong> No action needed. A verification link has been sent to the new email address. The change only takes effect after it is confirmed.
    </div>
    <p><strong>&#9888;&#65039; If you did NOT make this request</strong>, your account may be compromised. Click the button below <em>immediately</em> to cancel:</p>
    <div style="text-align:center">
      <a href="${cancelUrl}" class="btn">Cancel This Change</a>
    </div>
    <p style="color:#666;font-size:13px">Or copy this link:<br>
      <a href="${cancelUrl}" style="color:#dc2626;word-break:break-all">${cancelUrl}</a>
    </p>
    <p style="color:#666;font-size:13px">
      This cancel link is valid for <strong>48 hours</strong>. If you believe your account has been compromised, also change your password and contact support at
      <a href="mailto:${supportEmail}">${supportEmail}</a>.
    </p>
  </div>
  <div class="footer">${center.centerName} &middot; Powered by ${appName}</div>
</div>
</body>
</html>`,
  });
};

// ── sendNewEmailVerification ──────────────────────────────────────────────────
// Sent to the NEW email address to confirm ownership before the change is applied.
export const sendNewEmailVerification = async (center, newEmail, rawVerifyToken) => {
  const { baseUrl } = getCenterBaseUrl(center);
  const verifyUrl = `${baseUrl}/admin/email-change/verify/${rawVerifyToken}`;

  return sendEmail({
    centerName: center.centerName,
    to: newEmail,
    subject: `Verify your new login email for ${center.centerName}`,
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;padding:20px}
    .hdr{background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .body{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .warn{background:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0;border-radius:4px}
    .btn{display:inline-block;padding:14px 28px;margin:20px 0;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:700;font-size:15px}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1 style="margin:0">&#128231; Verify Your Email</h1>
    <p style="margin:6px 0 0;opacity:.9">${center.centerName}</p>
  </div>
  <div class="body">
    <p>Hello,</p>
    <p>This email address has been nominated as the new admin login for <strong>${center.centerName}</strong>. Click the button below to confirm the change:</p>
    <div style="text-align:center">
      <a href="${verifyUrl}" class="btn">Verify New Email</a>
    </div>
    <p style="color:#666;font-size:13px">Or copy this link:<br>
      <a href="${verifyUrl}" style="color:#6366f1;word-break:break-all">${verifyUrl}</a>
    </p>
    <div class="warn">
      <strong>&#9201; This link expires in 1 hour.</strong> If it expires, the admin will need to request the change again.
    </div>
    <p style="color:#666;font-size:13px">Once verified, all existing admin sessions will be signed out. Log in again using this new email address.</p>
    <p style="color:#666;font-size:13px">If you did not request this, ignore this email — no change will occur without clicking the link above.</p>
  </div>
  <div class="footer">${center.centerName} &middot; Powered by ${appName}</div>
</div>
</body>
</html>`,
  });
};

// ── sendOverrideNotification ──────────────────────────────────────────────────
// Sent to BOTH the old and new email when a super admin forces an override.
// Call twice — once with previousEmail, once with newEmail.
export const sendOverrideNotification = async (center, previousEmail, newEmail, reason, toEmail) => {
  return sendEmail({
    centerName: center.centerName,
    to: toEmail,
    subject: `Important: Admin login email for ${center.centerName} has been changed by platform admin`,
    html: `<!DOCTYPE html>
<html>
<head>
  <style>
    body{font-family:Arial,sans-serif;line-height:1.6;color:#333;margin:0;padding:0}
    .wrap{max-width:600px;margin:0 auto;padding:20px}
    .hdr{background:linear-gradient(135deg,#92400e,#b45309);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .body{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
    .info{background:#fefce8;border-left:4px solid #ca8a04;padding:16px;margin:20px 0;border-radius:4px}
    .footer{text-align:center;margin-top:20px;color:#999;font-size:12px}
  </style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1 style="margin:0">&#9888;&#65039; Admin Email Changed</h1>
    <p style="margin:6px 0 0;opacity:.9">Platform administration action</p>
  </div>
  <div class="body">
    <p>Hello,</p>
    <p>The admin login email for <strong>${center.centerName}</strong> has been changed by a platform administrator.</p>
    <div class="info">
      <strong>Change details:</strong><br>
      Previous email: <strong>${previousEmail}</strong><br>
      New email: <strong>${newEmail}</strong><br>
      Date: <strong>${new Date().toUTCString()}</strong><br>
      Reason: <em>${reason}</em>
    </div>
    <p>All previous admin sessions have been signed out. The new login email is <strong>${newEmail}</strong>.</p>
    <p style="color:#666;font-size:13px">If you believe this change was made in error or without your consent, contact platform support immediately at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
  </div>
  <div class="footer">${center.centerName} &middot; Powered by ${appName}</div>
</div>
</body>
</html>`,
  });
};

// ── sendCancelNotification ────────────────────────────────────────────────────
// Sent to both emails after a cancel/reversal is completed.
export const sendCancelNotification = async (center, restoredEmail, cancelledEmail) => {
  const recipients = [...new Set([restoredEmail, cancelledEmail].filter(Boolean))];
  return Promise.allSettled(
    recipients.map(to =>
      sendEmail({
        centerName: center.centerName,
        to,
        subject: `Email change reversed for ${center.centerName}`,
        html: `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;color:#333;margin:0;padding:0">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;padding:24px;border-radius:10px 10px 0 0;text-align:center">
    <h2 style="margin:0">Email Change Reversed</h2>
  </div>
  <div style="background:#f9f9f9;padding:24px;border-radius:0 0 10px 10px">
    <p>The admin login email for <strong>${center.centerName}</strong> has been restored.</p>
    <p>Active login email: <strong style="color:#6366f1">${restoredEmail}</strong></p>
    <p>The change to <em>${cancelledEmail}</em> has been cancelled and all sessions have been signed out.</p>
    <p style="color:#666;font-size:13px">If you have concerns about this action, contact support at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
  </div>
</div>
</body>
</html>`,
      })
    )
  );
};
