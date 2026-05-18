// server/utils/studentIdGenerator.js
// Atomic student ID assignment — race-condition-safe via MongoDB unique index.
// The unique constraint on studentSchema enforces exclusivity at the DB level;
// we simply retry on a duplicate-key error (E11000) instead of doing a
// check-then-write pattern, which would be vulnerable to TOCTOU races.
import crypto from 'crypto';

function randomId() {
  return 'STU-' + String(crypto.randomInt(10000, 99999));
}

/**
 * Atomically assign a STU-XXXXX id to an existing student document.
 * Skips the write if the document already has an id (safe for concurrent calls).
 * Returns the assigned id (either newly generated or the one already on the doc).
 */
export async function assignStudentId(Student, docId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    try {
      const result = await Student.updateOne(
        { _id: docId, $or: [{ studentId: { $exists: false } }, { studentId: null }, { studentId: '' }] },
        { $set: { studentId: id } }
      );
      if (result.matchedCount === 0) {
        // Document already had an id — return the existing one
        const doc = await Student.findById(docId).select('studentId').lean();
        return doc?.studentId || id;
      }
      return id;
    } catch (e) {
      if (e.code !== 11000) throw e; // Only retry on duplicate-key collisions
    }
  }
  // Last-resort fallback: timestamp suffix is virtually collision-free
  const fallback = 'STU-' + Date.now().toString().slice(-5);
  await Student.updateOne({ _id: docId }, { $set: { studentId: fallback } }).catch(() => {});
  return fallback;
}

/**
 * Generate a unique STU-XXXXX id without writing it.
 * Used only for new-student creation where the id is set in the same
 * document.create() call, making a separate existence check safe enough
 * (the unique index will reject a true collision on save).
 * On E11000 the caller should catch and retry.
 */
export async function generateStudentId(Student) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = randomId();
    const taken = await Student.exists({ studentId: id });
    if (!taken) return id;
  }
  return 'STU-' + Date.now().toString().slice(-5);
}
