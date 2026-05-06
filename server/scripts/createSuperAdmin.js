import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Load .env with an explicit path so this works regardless of cwd or ESM hoisting
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const email    = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_INITIAL_PASSWORD;
const mongoUri = process.env.MONGO_URI;

if (!email)    { console.error('❌ SUPER_ADMIN_EMAIL not set in .env');            process.exit(1); }
if (!password) { console.error('❌ SUPER_ADMIN_INITIAL_PASSWORD not set in .env'); process.exit(1); }
if (!mongoUri) { console.error('❌ MONGO_URI not set in .env');                    process.exit(1); }
if (password.length < 12) { console.error('❌ Password must be ≥ 12 characters'); process.exit(1); }

// Inline schema — avoids importing config.js (which calls process.exit if vars missing)
const superAdminSchema = new mongoose.Schema({
  firstName: String,
  lastName:  String,
  email:     { type: String, unique: true },
  password:  String,
  role:      { type: String, default: 'superadmin' },
}, { timestamps: true });

async function run() {
  await mongoose.connect(mongoUri);

  const SuperAdmin = mongoose.models.SuperAdmin || mongoose.model('SuperAdmin', superAdminSchema);

  const existing = await SuperAdmin.findOne({ email });
  if (existing) {
    console.log('⚠️  Super admin already exists:', email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 12);
  await SuperAdmin.create({ firstName: 'Super', lastName: 'Admin', email, password: hashed });

  console.log('✅ Super admin created:', email);
  console.log('👉 Remove SUPER_ADMIN_INITIAL_PASSWORD from your .env now');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
