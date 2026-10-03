// server/utils/teacherCode.js
// Human-friendly teacher ID numbers (TCH-12345), like students' STU-12345
// (utils/studentIdGenerator.js) — names repeat, IDs don't.
//
//  • New teachers get one automatically (pre-save hook in schemas/teacherSchema.js).
//  • Existing teachers are backfilled once per center at server start.
// Uniqueness is enforced by a unique sparse index; a collision just retries.
import crypto from "crypto";
import logger from "./logger.js";

export const randomTeacherCode = () => "TCH-" + String(crypto.randomInt(10000, 99999));

/** A code not used yet in this center (checked; the unique index is the final guard). */
export async function generateTeacherCode(Teacher) {
  for (let i = 0; i < 10; i++) {
    const code = randomTeacherCode();
    if (!(await Teacher.exists({ teacherCode: code }))) return code;
  }
  return "TCH-" + Date.now().toString().slice(-6);
}

/** Atomically give one existing teacher a code (no-op if they already have one). */
export async function assignTeacherCode(Teacher, id) {
  for (let i = 0; i < 10; i++) {
    const code = randomTeacherCode();
    try {
      const r = await Teacher.updateOne(
        { _id: id, $or: [{ teacherCode: { $exists: false } }, { teacherCode: null }, { teacherCode: "" }] },
        { $set: { teacherCode: code } }
      );
      return r.matchedCount ? code : null;
    } catch (e) {
      if (e.code !== 11000) throw e; // only retry on a duplicate code
    }
  }
  return null;
}

/** Give every teacher in this center without a code one. Safe to run repeatedly. */
export async function backfillTeacherCodes(Teacher) {
  const missing = await Teacher.find({ $or: [{ teacherCode: { $exists: false } }, { teacherCode: null }, { teacherCode: "" }] })
    .select("_id").limit(10000).lean();
  let n = 0;
  for (const t of missing) if (await assignTeacherCode(Teacher, t._id)) n++;
  if (n) logger.info(`Assigned teacher ID numbers to ${n} teacher(s)`);
  return n;
}
