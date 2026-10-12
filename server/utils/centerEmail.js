// server/utils/centerEmail.js
// One email = one center admin login. Used when a center is created (super admin
// invite, public registration). Rejected registrations don't hold the email.
import Center from '../models/master/Center.js';

const norm = (e) => String(e || '').trim().toLowerCase();

/**
 * Is this email already a center's admin email?
 * @returns {null | { center, reason }} reason: 'active' | 'suspended' | 'invited' | 'pending' | 'deleted'
 */
export async function centerEmailInUse(email, { excludeId = null } = {}) {
  const adminEmail = norm(email);
  if (!adminEmail) return null;
  const center = await Center.findOne({
    adminEmail,
    status: { $ne: 'rejected' },
    ...(excludeId && { _id: { $ne: excludeId } }),
  }).select('centerName slug status invite.sentAt invite.acceptedAt').lean();
  if (!center) return null;
  const reason = center.status === 'pending'
    ? (center.invite?.sentAt && !center.invite?.acceptedAt ? 'invited' : 'pending')
    : center.status;
  return { center, reason };
}

/** Message for the super admin (may name the center). */
export function emailInUseMessage({ center, reason }) {
  const name = `"${center.centerName}" (${center.slug})`;
  switch (reason) {
    case 'invited':   return `This email already has an invite waiting for ${name}. Use "Resend invite" on that center instead.`;
    case 'pending':   return `This email has a registration waiting for approval: ${name}.`;
    case 'deleted':   return `This email belongs to ${name}, which is scheduled for deletion. Restore that center, or wait until it's permanently deleted.`;
    case 'suspended': return `This email is the admin of ${name} (suspended). Reactivate that center instead, or use a different email.`;
    default:          return `This email is already the admin of ${name}. Use a different email.`;
  }
}

/**
 * True when a save failed on the one-email-per-center unique index — i.e. a
 * second create/rename with the same email won a race the check above lost.
 */
export function isEmailTakenError(err) {
  return err?.code === 11000 && (!!err.keyPattern?.adminEmail || String(err.message || '').includes('adminEmail_one_center'));
}
