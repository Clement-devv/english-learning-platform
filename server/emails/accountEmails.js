import { config } from "../config/config.js";
import { sendEmail } from "./core.js";

const formatDate = (date) => new Date(date).toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});

export const sendAccountDeletionWarningEmail = async (student, deletionDate, centerName = "") => {
  const formattedDate = formatDate(deletionDate);
  return sendEmail({
    centerName,
    to: student.email,
    subject: `⚠️ Your account is scheduled for deletion on ${formattedDate}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
        <div style="background:#ef4444;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Account Deletion Notice</h1>
        </div>
        <p style="color:#333;font-size:16px;">Hi <strong>${student.firstName}</strong>,</p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          Your account on <strong>${config.appName}</strong> has been scheduled for
          <strong style="color:#ef4444;">permanent deletion on ${formattedDate}</strong>.
        </p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;color:#b91c1c;font-weight:600;">What this means:</p>
          <ul style="color:#7f1d1d;margin:8px 0 0;padding-left:20px;line-height:1.8;">
            <li>Your account is currently <strong>disabled</strong>.</li>
            <li>All your data will be <strong>permanently erased</strong> after the date above.</li>
            <li>This action <strong>cannot be undone</strong> after that date.</li>
          </ul>
        </div>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          If this was a mistake or you would like to continue using the platform,
          please <strong>contact your administrator immediately</strong> before the deletion date.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="mailto:${config.emailUser}"
             style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Contact Admin
          </a>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;margin-top:32px;">
          This is an automated message from ${config.appName}. Please do not reply to this email.
        </p>
      </div>
    `,
  });
};

export const sendAccountDeletionFinalReminderEmail = async (student, deletionDate, centerName = "") => {
  const formattedDate = formatDate(deletionDate);
  return sendEmail({
    centerName,
    to: student.email,
    subject: `🚨 Final warning — your account will be deleted tomorrow (${formattedDate})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
        <div style="background:#dc2626;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🚨 Final Deletion Reminder</h1>
        </div>
        <p style="color:#333;font-size:16px;">Hi <strong>${student.firstName}</strong>,</p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          This is your <strong>final reminder</strong> — your account will be
          <strong style="color:#dc2626;">permanently deleted on ${formattedDate}</strong> (less than 24 hours away).
        </p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          If you want to keep your account, you must contact your administrator
          <strong>right now</strong> before it is too late.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="mailto:${config.emailUser}"
             style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Contact Admin Now
          </a>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;margin-top:32px;">
          This is an automated message from ${config.appName}.
        </p>
      </div>
    `,
  });
};

export const sendTeacherAccountDeletionWarningEmail = async (teacher, deletionDate, centerName = "") => {
  const formattedDate = formatDate(deletionDate);
  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `⚠️ Your teacher account is scheduled for deletion on ${formattedDate}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
        <div style="background:#ef4444;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Account Deletion Notice</h1>
        </div>
        <p style="color:#333;font-size:16px;">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          Your teacher account on <strong>${config.appName}</strong> has been scheduled for
          <strong style="color:#ef4444;">permanent deletion on ${formattedDate}</strong>.
        </p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="margin:0;color:#b91c1c;font-weight:600;">What this means:</p>
          <ul style="color:#7f1d1d;margin:8px 0 0;padding-left:20px;line-height:1.8;">
            <li>Your account is currently <strong>disabled</strong>.</li>
            <li>All your data will be <strong>permanently erased</strong> after the date above.</li>
            <li>This action <strong>cannot be undone</strong> after that date.</li>
          </ul>
        </div>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          If this was a mistake or you would like to continue on the platform,
          please <strong>contact your administrator immediately</strong> before the deletion date.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="mailto:${config.emailUser}"
             style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Contact Admin
          </a>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;margin-top:32px;">
          This is an automated message from ${config.appName}. Please do not reply to this email.
        </p>
      </div>
    `,
  });
};

export const sendTeacherAccountDeletionFinalReminderEmail = async (teacher, deletionDate, centerName = "") => {
  const formattedDate = formatDate(deletionDate);
  return sendEmail({
    centerName,
    to: teacher.email,
    subject: `🚨 Final warning — your teacher account will be deleted tomorrow (${formattedDate})`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px;">
        <div style="background:#dc2626;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">🚨 Final Deletion Reminder</h1>
        </div>
        <p style="color:#333;font-size:16px;">Hi <strong>${teacher.firstName}</strong>,</p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          This is your <strong>final reminder</strong> — your teacher account will be
          <strong style="color:#dc2626;">permanently deleted on ${formattedDate}</strong> (less than 24 hours away).
        </p>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          If you want to keep your account, you must contact your administrator
          <strong>right now</strong> before it is too late.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="mailto:${config.emailUser}"
             style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
            Contact Admin Now
          </a>
        </div>
        <p style="color:#888;font-size:13px;text-align:center;margin-top:32px;">
          This is an automated message from ${config.appName}.
        </p>
      </div>
    `,
  });
};

export const sendCenterDeletionWarningEmail = async (center, deletionDate, contactEmail) => {
  const formattedDate = formatDate(deletionDate);
  return sendEmail({
    to: center.adminEmail,
    subject: `Important: Your ${config.appName} center is scheduled for deletion`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 20px 28px; border-radius: 10px 10px 0 0;">
          <h2 style="color: white; margin: 0;">⚠️ Center Deletion Notice</h2>
        </div>
        <div style="background: #fff8f8; border: 1px solid #fecaca; border-top: none; padding: 28px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 15px; color: #111;">Hi there,</p>
          <p style="font-size: 15px; color: #111;">
            Your center <strong>${center.centerName}</strong> has been scheduled for <strong>permanent deletion</strong> on:
          </p>
          <div style="background: #fee2e2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #dc2626;">${formattedDate}</p>
          </div>
          <p style="font-size: 15px; color: #111;">
            After this date, your center data, student records, and all associated content will be <strong>permanently removed</strong> and cannot be recovered.
          </p>
          <p style="font-size: 15px; color: #111;">
            <strong>If you believe this is a mistake or wish to reactivate your center</strong>, please contact us immediately before the deletion date:
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="mailto:${contactEmail || config.emailFrom}"
               style="background: #4F46E5; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
              Contact Support to Reactivate
            </a>
          </div>
          <p style="font-size: 13px; color: #6b7280; margin-top: 24px;">
            If you no longer need this account, no action is required. The center will be automatically removed on the scheduled date.
          </p>
          <p style="font-size: 13px; color: #6b7280;">— The ${config.appName} Team</p>
        </div>
      </div>
    `,
  });
};
