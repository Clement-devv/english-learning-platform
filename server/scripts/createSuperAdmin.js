import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import SuperAdmin from '../models/master/SuperAdmin.js';

async function createSuperAdmin() {
  const email = process.env.production.SUPER_ADMIN_EMAIL;
  const password = process.env.productionSUPER_ADMIN_INITIAL_PASSWORD;

  if (!email) {
    console.error('❌ SUPER_ADMIN_EMAIL is not set in your .env');
    process.exit(1);
  }
  if (!password) {
    console.error('❌ SUPER_ADMIN_INITIAL_PASSWORD is not set in your .env');
    console.error('   Add it temporarily, run this script, then remove it.');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('❌ SUPER_ADMIN_INITIAL_PASSWORD must be at least 12 characters');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const existing = await SuperAdmin.findOne({ email });
  if (existing) {
    console.log('⚠️  Super admin already exists:', email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 12);
  await SuperAdmin.create({
    firstName: 'Super',
    lastName: 'Admin',
    email,
    password: hashed,
    role: 'superadmin',
  });

  console.log('✅ Super admin created:', email);
  console.log('👉 Now remove SUPER_ADMIN_INITIAL_PASSWORD from your .env');
  process.exit(0);
}

createSuperAdmin().catch(e => { console.error(e); process.exit(1); });
