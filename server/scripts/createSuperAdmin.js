import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import SuperAdmin from '../models/master/SuperAdmin.js';

async function createSuperAdmin() {
  await mongoose.connect(process.env.MONGO_URI);
  const existing = await SuperAdmin.findOne({ email: process.env.SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log('Super admin already exists');
    process.exit(0);
  }
  const password = await bcrypt.hash('changeme123!', 12);
  await SuperAdmin.create({
    firstName: 'Super',
    lastName:  'Admin',
    email:     process.env.SUPER_ADMIN_EMAIL,
    password,
    role: 'superadmin',
  });
  console.log('Super admin created. Email:', process.env.SUPER_ADMIN_EMAIL);
  console.log('Password: changeme123! — change this immediately on first login!');
  process.exit(0);
}

createSuperAdmin().catch(e => { console.error(e); process.exit(1); });
