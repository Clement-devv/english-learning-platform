/**
 * Migration: rename student fields
 *   surname      → lastName
 *   noOfClasses  → classCredits
 *
 * Run once against each center database:
 *   node server/scripts/migrateStudentFieldNames.js
 *
 * The script reads DB_BASE_URI and a comma-separated list of center slugs
 * from the environment (or prompts you to set them).
 *
 * Example:
 *   DB_BASE_URI=mongodb://user:pass@host:27017/ \
 *   CENTER_SLUGS=center1,center2,center3 \
 *   node server/scripts/migrateStudentFieldNames.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const DB_BASE_URI  = process.env.DB_BASE_URI;
const CENTER_SLUGS = process.env.CENTER_SLUGS?.split(',').map(s => s.trim()).filter(Boolean);

if (!DB_BASE_URI) {
  console.error('❌ DB_BASE_URI is not set. Example: mongodb://user:pass@host:27017/');
  process.exit(1);
}
if (!CENTER_SLUGS?.length) {
  console.error('❌ CENTER_SLUGS is not set. Example: CENTER_SLUGS=school1,school2');
  process.exit(1);
}

async function migrateCenter(slug) {
  const uri  = `${DB_BASE_URI}db_${slug}`;
  const conn = await mongoose.createConnection(uri).asPromise();
  const db   = conn.db;

  const result = await db.collection('students').updateMany(
    { $or: [{ surname: { $exists: true } }, { noOfClasses: { $exists: true } }] },
    [{
      $set: {
        // Copy old field value to new field name (only if old field exists)
        lastName:     { $ifNull: ['$lastName',     '$surname']    },
        classCredits: { $ifNull: ['$classCredits', '$noOfClasses'] },
      },
    }],
  );

  // Remove the old fields
  await db.collection('students').updateMany(
    {},
    { $unset: { surname: '', noOfClasses: '' } },
  );

  console.log(`  ✅ ${slug}: ${result.modifiedCount} students updated`);
  await conn.close();
}

async function run() {
  console.log(`\nMigrating ${CENTER_SLUGS.length} center(s): ${CENTER_SLUGS.join(', ')}\n`);
  for (const slug of CENTER_SLUGS) {
    try {
      await migrateCenter(slug);
    } catch (err) {
      console.error(`  ❌ ${slug}: ${err.message}`);
    }
  }
  console.log('\n✅ Migration complete. Drop this script after confirming data is correct.');
}

run().catch(err => { console.error(err); process.exit(1); });
