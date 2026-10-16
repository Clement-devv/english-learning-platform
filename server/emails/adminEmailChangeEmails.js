// Admin login-email change emails (security). Built on the shared layout; English.
import { config } from '../config/config.js';
import { sendEmail } from './core.js';
import { renderEmail, p, details, callout, esc, C } from './layout.js';
import { brandOf } from './i18n.js';

const supportEmail = process.env.SUPER_ADMIN_EMAIL || config.emailFrom || config.emailUser || 'support@clemify.com';
const support = `<a href="mailto:${esc(supportEmail)}" style="color:${C.accent};">${esc(supportEmail)}</a>`;
const fallback = (url) => p(
  `Button not working? Copy this link into your browser:<br><a href="${esc(url)}" style="color:${C.accent};word-break:break-all;">${esc(url)}</a>`,
  { size: 12, color: C.muted, mt: 18, mb: 0, align: 'center' });

// ── Sent to the CURRENT (old) admin email when a change is requested.
//    Includes a cancel link that stays valid for 48 h.
export const sendOldEmailAlert = async (center, newEmail, rawCancelToken) => {
  const b = brandOf(center, center.centerName);
  const cancelUrl = `${b.baseUrl}/admin/email-change/cancel/${rawCancelToken}`;
  return sendEmail({
    centerName: b.centerName,
    to: center.adminEmail,
    subject: `Security alert: login email change requested for ${center.centerName}`,
    html: renderEmail({
      ...b, tone: 'red',
      preheader: `Someone asked to change the admin login email to ${newEmail}.`,
      eyebrow: 'Security alert', title: 'Login email change requested',
      body:
        p(`A request was made to change the admin login email for <strong>${esc(center.centerName)}</strong>.`) +
        details([['Current email', esc(center.adminEmail)], ['New email', esc(newEmail)]]) +
        callout('<strong>You made this request?</strong> Nothing to do — a confirmation link went to the new address, and the change only happens once it is confirmed.', 'green') +
        p('<strong>You did NOT make this request?</strong> Your account may be at risk. Cancel the change straight away:'),
      cta: { label: 'Cancel this change', href: cancelUrl, tone: 'red' },
      after: `This cancel link works for 48 hours. If you think your account was broken into, also change your password and contact ${support}.`,
      extra: fallback(cancelUrl),
    }),
  });
};

// ── Sent to the NEW email address to confirm ownership before the change applies.
export const sendNewEmailVerification = async (center, newEmail, rawVerifyToken) => {
  const b = brandOf(center, center.centerName);
  const verifyUrl = `${b.baseUrl}/admin/email-change/verify/${rawVerifyToken}`;
  return sendEmail({
    centerName: b.centerName,
    to: newEmail,
    subject: `Verify your new login email for ${center.centerName}`,
    html: renderEmail({
      ...b,
      preheader: 'Confirm within 1 hour to finish the change.',
      eyebrow: 'Verify your email', title: 'Confirm your new login email',
      body:
        p(`This address was chosen as the new admin login for <strong>${esc(center.centerName)}</strong>. Confirm it to finish the change.`) +
        callout('<strong>This link expires in 1 hour.</strong> After that, the change has to be requested again.', 'amber') +
        p('Once confirmed, all admin sessions are signed out — sign in again with this address.', { size: 14 }),
      cta: { label: 'Verify new email', href: verifyUrl },
      after: "Didn't ask for this? Ignore this email — nothing changes unless the link is clicked.",
      extra: fallback(verifyUrl),
    }),
  });
};

// ── Sent to BOTH the old and new email when a super admin forces an override.
//    Call twice — once with previousEmail, once with newEmail.
export const sendOverrideNotification = async (center, previousEmail, newEmail, reason, toEmail) => {
  const b = brandOf(center, center.centerName);
  return sendEmail({
    centerName: b.centerName,
    to: toEmail,
    subject: `Important: the admin login email for ${center.centerName} was changed by the platform admin`,
    html: renderEmail({
      ...b, tone: 'amber',
      preheader: `The new admin login email is ${newEmail}.`,
      eyebrow: 'Platform admin action', title: 'Admin login email changed',
      body:
        p(`A platform administrator changed the admin login email for <strong>${esc(center.centerName)}</strong>.`) +
        details([
          ['Previous email', esc(previousEmail)],
          ['New email', esc(newEmail)],
          ['Date', esc(new Date().toUTCString())],
          ['Reason', reason && `<em>${esc(reason)}</em>`],
        ]) +
        p(`All admin sessions were signed out. Sign in with <strong>${esc(newEmail)}</strong> from now on.`),
      after: `Think this was a mistake or done without your consent? Contact ${support} straight away.`,
    }),
  });
};

// ── Sent to both emails after a cancel / reversal is completed.
export const sendCancelNotification = async (center, restoredEmail, cancelledEmail) => {
  const b = brandOf(center, center.centerName);
  const recipients = [...new Set([restoredEmail, cancelledEmail].filter(Boolean))];
  return Promise.allSettled(
    recipients.map(to =>
      sendEmail({
        centerName: b.centerName,
        to,
        subject: `Email change reversed for ${center.centerName}`,
        html: renderEmail({
          ...b, tone: 'green',
          preheader: `The admin login email is back to ${restoredEmail}.`,
          eyebrow: 'Change reversed', title: 'Admin login email restored',
          body:
            p(`The admin login email for <strong>${esc(center.centerName)}</strong> has been restored.`) +
            details([['Active login email', esc(restoredEmail)], ['Cancelled change to', esc(cancelledEmail)]]) +
            p('All sessions were signed out.'),
          after: `Concerned about this? Contact ${support}.`,
        }),
      })
    )
  );
};
