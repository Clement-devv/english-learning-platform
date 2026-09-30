/**
 * Migration: "dummy" students → "managed" students
 *
 * Students created while the feature was called "dummy" have `isDummy: true`
 * and an `@dummy.invalid` placeholder email. The code now uses `isManaged` and
 * `@managed.invalid`, so those students show up as real student accounts and
 * aren't covered by email suppression until migrated.
 *
 * Dry run (default — shows what would change, writes nothing):
 *   node server/scripts/migrateDummyToManaged.js
 * Apply:
 *   node server/scripts/migrateDummyToManaged.js --apply
 *
 * Centers are read from the master DB; DB names match server/config/dbManager.js.
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const APPLY = process.argv.includes('--apply');
const { MASTER_DB_URI, DB_BASE_URI } = process.env;

if (!MASTER_DB_URI || !DB_BASE_URI) {
  console.error('❌ MASTER_DB_URI and DB_BASE_URI must be set (server/.env)');
  process.exit(1);
}

const LEGACY_FILTER = { $or: [{ isDummy: true }, { email: /@dummy\.invalid$/i }] };

async function migrateCenter(slug) {
  const uri  = `${DB_BASE_URI.replace(/\/+$/, '')}/${encodeURIComponent(slug)}`;
  const conn = await mongoose.createConnection(uri).asPromise();
  const students = conn.db.collection('students');

  const legacy = await students.find(LEGACY_FILTER).project({ firstName: 1, lastName: 1, email: 1 }).toArray();
  if (legacy.length === 0) {
    await conn.close();
    return 0;
  }

  console.log(`  ${slug}: ${legacy.length} student(s)`);
  for (const s of legacy) console.log(`    - ${`${s.firstName} ${s.lastName || ''}`.trim()}  <${s.email}>`);

  if (APPLY) {
    const result = await students.updateMany(LEGACY_FILTER, [
      {
        $set: {
          isManaged: true,
          email: { $replaceOne: { input: '$email', find: '@dummy.invalid', replacement: '@managed.invalid' } },
        },
      },
      { $unset: 'isDummy' },
    ]);
    console.log(`    ✅ migrated ${result.modifiedCount}`);
  }

  await conn.close();
  return legacy.length;
}

async function run() {
  const master  = await mongoose.createConnection(MASTER_DB_URI).asPromise();
  const centers = await master.db.collection('centers')
    .find({ status: { $ne: 'deleted' } }).project({ slug: 1 }).toArray();
  await master.close();

  console.log(`\n${APPLY ? 'Migrating' : 'Dry run —'} ${centers.length} center(s)\n`);
  let total = 0;
  for (const { slug } of centers) {
    try {
      total += await migrateCenter(slug);
    } catch (err) {
      console.error(`  ❌ ${slug}: ${err.message}`);
    }
  }

  if (total === 0) console.log('  Nothing to migrate.');
  else if (!APPLY) console.log(`\nFound ${total}. Re-run with --apply to migrate.`);
  console.log('');
}

run().catch(err => { console.error(err); process.exit(1); });
