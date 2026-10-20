// One-off repair: centers that self-registered before the fix in middleware/validation.js
// were saved HTML-escaped — "Ade &amp; Sons" instead of "Ade & Sons", and the time zone
// "Africa&#x2F;Lagos", which is not a valid time zone (date formatting for the center throws).
//
//   node scripts/fixEscapedCenterFields.js           → shows what would change (no writes)
//   node scripts/fixEscapedCenterFields.js --apply   → saves the fixes
//
// Uses MASTER_DB_URI (or MONGO_URI) from server/.env.
import 'dotenv/config';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');
const uri = process.env.MASTER_DB_URI || process.env.MONGO_URI;
if (!uri) { console.error('MASTER_DB_URI / MONGO_URI not set'); process.exit(1); }

// The entities express-validator's escape() produces
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#x2F;': '/', '&#x5C;': '\\', '&#96;': '`' };
const unescape = (s) => (typeof s === 'string' ? s.replace(/&(amp|lt|gt|quot|#x27|#x2F|#x5C|#96);/g, (m) => ENTITIES[m]) : s);
const validTz = (tz) => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };

await mongoose.connect(uri);
const centers = mongoose.connection.db.collection('centers');
let changed = 0;
for await (const c of centers.find({}, { projection: { slug: 1, centerName: 1, country: 1, timezone: 1 } })) {
  const set = {};
  for (const field of ['centerName', 'country', 'timezone']) {
    const fixed = unescape(c[field]);
    if (fixed !== c[field]) set[field] = fixed;
  }
  if (set.timezone && !validTz(set.timezone)) {
    console.warn(`  ${c.slug}: "${set.timezone}" is still not a valid time zone — fix it by hand`);
    delete set.timezone;
  }
  if (!Object.keys(set).length) continue;
  changed++;
  console.log(`${c.slug}:`, Object.entries(set).map(([k, v]) => `${k} "${c[k]}" → "${v}"`).join(', '));
  if (APPLY) await centers.updateOne({ _id: c._id }, { $set: set });
}
console.log(changed ? `${changed} center(s) ${APPLY ? 'fixed' : 'need fixing — run again with --apply'}` : 'Nothing to fix');
await mongoose.disconnect();
