// server/utils/centerActivation.js
// Turns a 'pending' center into a live one. Used by:
//   • PATCH /super-admin/centers/:id/approve  (self-registered centers)
//   • POST  /center-invite/:token             (admin accepted the super admin's invite)
// This is the ONLY place a center's database is created (CLAUDE.md rule 5).
import crypto from 'crypto';
import { getDb } from '../config/dbManager.js';
import { adminSchema } from '../schemas/adminSchema.js';
import { invalidateCache } from './cache.js';

/**
 * @param {import('mongoose').Document} center   Center doc (status 'pending')
 * @param {{ passwordHash: string, firstName?: string, lastName?: string, approvedBy: string }} admin
 */
export async function activateCenter(center, { passwordHash, firstName = '', lastName = '', approvedBy }) {
  if (!passwordHash) throw new Error('activateCenter: passwordHash is required');

  const db = await getDb(center.slug);
  const Admin = db.models.Admin || db.model('Admin', adminSchema);

  // A half-finished earlier attempt may have created the admin already — update it instead
  const existing = await Admin.findOne({ email: center.adminEmail });
  if (existing) {
    existing.password = passwordHash;
    if (firstName) existing.firstName = firstName;
    if (lastName) existing.lastName = lastName;
    existing.active = true;
    await existing.save();
  } else {
    await Admin.create({
      username: center.adminEmail.split('@')[0],
      email:    center.adminEmail,
      password: passwordHash,
      firstName: firstName || undefined,
      lastName:  lastName || undefined,
      role:     'admin',
      active:   true,
    });
  }

  center.pendingPasswordHash = null;
  center.status     = 'active';
  center.approvedAt = new Date();
  center.approvedBy = approvedBy;

  // One-time recovery code — never overwritten so the admin can quote it for manual support
  if (!center.recoveryCode) {
    const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
    center.recoveryCode = raw.match(/.{4}/g).join('-'); // e.g. ABCD-1234-EF56-7890
  }

  await center.save();
  await invalidateCache(`tenant:slug:${center.slug}`);
  return center;
}
