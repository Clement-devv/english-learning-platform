// server/scripts/resetSuperAdminPassword.js
// Emergency password reset for a super admin — mainly the main (owner) account, which
// can't be reset from the Team page. Run it on the droplet:
//
//   docker compose exec app node scripts/resetSuperAdminPassword.js you@example.com
//
// It prints a one-time link (valid 1 hour) to set a new password — no email needed.
// The old password stops working, every device is signed out, and a switched-off
// account is switched back on. Run it without an email to list the super admins.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') }); // in Docker the env is already set

const RESET_MINUTES = 60;
const email = (process.argv[2] || '').trim().toLowerCase();
const mongoUri = process.env.MONGO_URI;
const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');

if (!mongoUri)    { console.error('❌ MONGO_URI not set');    process.exit(1); }
if (!frontendUrl) { console.error('❌ FRONTEND_URL not set'); process.exit(1); }

async function run() {
  await mongoose.connect(mongoUri);
  const admins = mongoose.connection.collection('superadmins');

  if (!email) {
    const all = await admins.find({}, { projection: { email: 1, invitedBy: 1, active: 1 } }).toArray();
    console.log('Usage: node scripts/resetSuperAdminPassword.js <email>\n\nSuper admins:');
    for (const a of all) console.log(`  ${a.email}${a.invitedBy ? '' : '  (main)'}${a.active === false ? '  [switched off]' : ''}`);
    process.exit(0);
  }

  const account = await admins.findOne({ email });
  if (!account) { console.error(`❌ No super admin with the email ${email}`); process.exit(1); }

  // Same token format and hashing as routes/superAdminTeamRoutes.js
  const token = crypto.randomBytes(32).toString('base64url');
  await admins.updateOne({ _id: account._id }, {
    $set: {
      passwordReset: {
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + RESET_MINUTES * 60000),
        sentAt: new Date(),
        by: 'server',
      },
      password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10), // old password stops working
      passwordChangedAt: new Date(), // every signed-in device is signed out
      active: true,
    },
    $unset: { invite: 1, loginCode: 1 },
  });
  await admins.updateOne({ _id: account._id, sessions: { $type: 'array' } }, { $set: { 'sessions.$[].isActive': false } });

  console.log(`✅ Password reset for ${email}`);
  console.log(`\nOpen this link within ${RESET_MINUTES} minutes to set a new password:\n`);
  console.log(`   ${frontendUrl}/super-admin/reset-password/${token}\n`);
  console.log('The link works once. Don\'t paste it anywhere public.');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
