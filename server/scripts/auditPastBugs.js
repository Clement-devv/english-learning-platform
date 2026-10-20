// server/scripts/auditPastBugs.js
// Finds data left wrong by bugs fixed in October 2026 (see the fix notes in each
// section). READ-ONLY by default — it only prints a report for a person to review.
//
//   node scripts/auditPastBugs.js                    # every center
//   node scripts/auditPastBugs.js --center emac      # one center
//   node scripts/auditPastBugs.js --json report.json # also save the findings
//   node scripts/auditPastBugs.js --fix-earned       # the ONE automatic fix: reset each
//                                                    # teacher's unpaid balance to the sum
//                                                    # of their pending payments (section 3)
//
// Everything else needs a human decision (refund? pay? leave it?) — the report
// lists the booking / student / teacher so it can be corrected in the admin UI.
import mongoose from "mongoose";
import fs from "fs";
import { config } from "../config/config.js";
import Center from "../models/master/Center.js";
import { getDb, closeAllConnections } from "../config/dbManager.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { paymentSchema } from "../schemas/paymentSchema.js";
import { paymentTransactionSchema, SIGNED_AMOUNT } from "../schemas/paymentTransactionSchema.js";
import { classroomSessionSchema } from "../schemas/classroomSessionSchema.js";
import { notificationSchema } from "../schemas/notificationSchema.js";

const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const ONLY_CENTER = argValue("--center");
const JSON_OUT    = argValue("--json");
const FIX_EARNED  = args.includes("--fix-earned");

const model = (db, name, schema) => db.models[name] || db.model(name, schema);
const name  = (p) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || String(p._id) : "?");
const day   = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "?");
const money = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);

// ── Master DB: duplicate admin emails block the new unique index (fix #20) ────
async function duplicateAdminEmails() {
  return Center.aggregate([
    { $match: { status: { $in: ["pending", "active", "suspended", "deleted"] } } },
    { $group: { _id: "$adminEmail", centers: { $push: { slug: "$slug", status: "$status" } }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
}

async function auditCenter(slug) {
  const db = await getDb(slug);
  const Booking  = model(db, "Booking", bookingSchema);
  model(db, "Student", studentSchema); // registered for populate("studentId")
  const Teacher  = model(db, "Teacher", teacherSchema);
  const Payment  = model(db, "Payment", paymentSchema);
  const PayTx    = model(db, "PaymentTransaction", paymentTransactionSchema);
  const Session  = model(db, "ClassroomSession", classroomSessionSchema);
  const Notif    = model(db, "Notification", notificationSchema);
  const pop = (q) => q.populate("studentId", "firstName lastName classCredits").populate("teacherId", "firstName lastName");
  const out = {};

  // 1. Dispute won by the student on a class an admin had ALREADY rejected (fix #4):
  //    the rejection refunded the credit and the old dispute code refunded it again.
  //    (A class reversed BY the dispute itself has a reason starting "Dispute upheld" — that one was refunded once.)
  out.doubleRefundedDisputes = (await pop(Booking.find({
    disputeStatus: "resolved_student", adminRejected: true, isTrial: { $ne: true },
    adminRejectedReason: { $not: /^Dispute upheld/ },
  })).lean()).map(b => ({
    booking: String(b._id), class: b.classTitle, date: day(b.scheduledTime), resolvedAt: day(b.disputeResolvedAt),
    student: name(b.studentId), studentId: String(b.studentId?._id || b.studentId), creditsNow: b.studentId?.classCredits,
    action: "Student probably received 1 extra class credit — remove 1 if the dispute was resolved before the fix",
  }));

  // 2. Classes that count as completed but have no live payment record (fix #4 teacher-wins
  //    on an admin-rejected class; also anything else that slipped through unpaid)
  const done = await pop(Booking.find({ status: "completed", adminRejected: { $ne: true }, isTrial: { $ne: true } })
    .select("classTitle scheduledTime markedBy disputeStatus studentId teacherId")).lean();
  const live = new Set((await PayTx.find({ bookingId: { $in: done.map(b => b._id) }, status: { $in: ["pending", "paid"] } })
    .select("bookingId").lean()).map(t => String(t.bookingId)));
  out.completedButUnpaid = done.filter(b => !live.has(String(b._id))).map(b => ({
    booking: String(b._id), class: b.classTitle, date: day(b.scheduledTime), markedBy: b.markedBy || "?",
    dispute: b.disputeStatus || "-", teacher: name(b.teacherId), teacherId: String(b.teacherId?._id || b.teacherId),
    action: "Teacher was not paid for this class — add a manual payment (Payments) if it really happened",
  }));

  // 3. Unpaid balance (Teacher.earned) out of step with the pending payments (fix #9:
  //    paying one transaction never lowered it). --fix-earned resets it.
  const pending = new Map((await PayTx.aggregate([
    { $match: { status: "pending" } },
    { $group: { _id: "$teacherId", total: { $sum: SIGNED_AMOUNT } } },
  ])).map(r => [String(r._id), Math.max(0, Math.round(r.total * 100) / 100)]));
  out.earnedMismatch = [];
  for (const t of await Teacher.find({}).select("firstName lastName earned").lean()) {
    const should = pending.get(String(t._id)) || 0;
    const is = Math.round((t.earned || 0) * 100) / 100;
    if (Math.abs(is - should) < 0.01) continue;
    const row = { teacher: name(t), teacherId: String(t._id), earnedNow: money(is), pendingPayments: money(should), fixed: false };
    if (FIX_EARNED) {
      // Only if unchanged since we read it — never overwrite a class settling right now
      const r = await Teacher.updateOne({ _id: t._id, earned: t.earned }, { $set: { earned: should } });
      row.fixed = r.modifiedCount === 1;
    }
    out.earnedMismatch.push(row);
  }

  // 4. Sub-admin "unmark" before the fix (fix #11): the class went back to "accepted" and the
  //    5-minute check then marked it "missed". Trial classes also got a credit they never paid.
  //    (Found through the activity notification — those are kept 90 days.)
  const unmarks = await Notif.find({ type: "class_unmarked", subAdminId: { $exists: true } }).select("metadata createdAt subAdminName").lean();
  const unmarkIds = unmarks.map(n => n.metadata?.bookingId).filter(id => mongoose.isValidObjectId(id));
  const unmarked = new Map((await pop(Booking.find({ _id: { $in: unmarkIds } })).lean()).map(b => [String(b._id), b]));
  out.subAdminUnmarks = unmarks.map(n => ({ n, b: unmarked.get(String(n.metadata?.bookingId)) }))
    .filter(({ b }) => b && !(b.status === "completed" && b.adminRejected))
    .map(({ n, b }) => ({
      booking: String(b._id), class: b.classTitle, date: day(b.scheduledTime), statusNow: b.status, trial: !!b.isTrial,
      unmarkedBy: n.subAdminName || "?", on: day(n.createdAt), student: name(b.studentId),
      action: b.isTrial
        ? "Trial class: the student received 1 class credit that was never charged — remove 1"
        : `Shows as "${b.status}" — it was unmarked (not completed); credit and pay were already reversed`,
    }));

  // 5. Classes marked "missed" by the 5-minute check although attendance was met (fix #3)
  const missed = await pop(Booking.find({ status: "missed", markedBy: "system" }).select("classTitle scheduledTime studentId teacherId isTrial")).lean();
  const sessions = new Map((await Session.find({ bookingId: { $in: missed.map(b => b._id) } }).lean()).map(s => [String(s.bookingId), s]));
  out.missedButAttended = missed.filter(b => {
    const s = sessions.get(String(b._id));
    return s?.teacherJoinedAt && s?.studentJoinedAt && (s.bothActiveTime || 0) >= (s.requiredTime || Infinity);
  }).map(b => {
    const s = sessions.get(String(b._id));
    return {
      booking: String(b._id), class: b.classTitle, date: day(b.scheduledTime), trial: !!b.isTrial,
      together: `${Math.floor((s.bothActiveTime || 0) / 60)}m of ${Math.floor(s.requiredTime / 60)}m needed`,
      teacher: name(b.teacherId), student: name(b.studentId),
      action: "Fully attended but marked missed — use \"Mark completed\" (charges the student, pays the teacher)",
    };
  });

  // 6. Student payments recorded as pending / failed — these used to ADD classes anyway (review fix)
  out.creditsFromUnpaidPayments = (await Payment.find({ status: { $in: ["pending", "failed"] } })
    .populate("studentId", "firstName lastName classCredits").lean()).map(p => ({
    payment: String(p._id), date: day(p.date), status: p.status, amount: p.amount, classes: p.classes,
    student: name(p.studentId), creditsNow: p.studentId?.classCredits,
    action: `${p.classes} class(es) were added for a ${p.status} payment — remove them unless the money arrived`,
  }));

  // 7. Bookings stuck in "processing" (fix #8: a failed completion could leave them there forever)
  out.stuckProcessing = (await Booking.find({ status: "processing" }).select("classTitle scheduledTime updatedAt").lean()).map(b => ({
    booking: String(b._id), class: b.classTitle, date: day(b.scheduledTime),
    action: "Stuck mid-completion — set it back to \"accepted\" so it can be completed again",
  }));

  return out;
}

const LABELS = {
  doubleRefundedDisputes:    "1. Student refunded twice (dispute on an admin-rejected class)",
  completedButUnpaid:        "2. Completed classes with no teacher payment record",
  earnedMismatch:            "3. Teacher unpaid balance ≠ pending payments",
  subAdminUnmarks:           "4. Classes unmarked by a sub-admin (old behaviour)",
  missedButAttended:         "5. Marked missed although fully attended",
  creditsFromUnpaidPayments: "6. Classes added for pending/failed student payments",
  stuckProcessing:           "7. Bookings stuck in \"processing\"",
};

async function main() {
  await mongoose.connect(config.mongoUri);
  const report = { generatedAt: new Date().toISOString(), fixEarned: FIX_EARNED, master: {}, centers: {} };

  report.master.duplicateAdminEmails = await duplicateAdminEmails();
  console.log("\n══ Master database ══");
  if (report.master.duplicateAdminEmails.length) {
    console.log("⚠️  Admin emails used by more than one center — the one-email-per-center index can't be built until fixed:");
    for (const d of report.master.duplicateAdminEmails) console.log(`   ${d._id}: ${d.centers.map(c => `${c.slug} (${c.status})`).join(", ")}`);
  } else console.log("✓ No admin email is used by two centers");

  const centers = await Center.find(ONLY_CENTER ? { slug: ONLY_CENTER } : { status: { $in: ["active", "suspended"] } }).select("slug centerName").lean();
  if (ONLY_CENTER && !centers.length) console.log(`\n⚠️  No center with slug "${ONLY_CENTER}"`);

  let total = 0;
  for (const c of centers) {
    console.log(`\n══ ${c.centerName} (${c.slug}) ══`);
    try {
      const found = await auditCenter(c.slug);
      report.centers[c.slug] = found;
      for (const [key, rows] of Object.entries(found)) {
        if (!rows.length) { console.log(`✓ ${LABELS[key]}: none`); continue; }
        total += rows.length;
        console.log(`⚠️  ${LABELS[key]}: ${rows.length}`);
        for (const r of rows.slice(0, 25)) {
          const { action, ...rest } = r;
          console.log(`   • ${Object.entries(rest).map(([k, v]) => `${k}: ${v}`).join(" | ")}`);
          console.log(`     → ${action || (key === "earnedMismatch" ? (FIX_EARNED ? (r.fixed ? "reset to pending payments" : "changed meanwhile — rerun") : "run with --fix-earned to reset") : "")}`);
        }
        if (rows.length > 25) console.log(`   … ${rows.length - 25} more (use --json to see all)`);
      }
    } catch (err) {
      console.log(`❌ Could not audit ${c.slug}: ${err.message}`);
    }
  }

  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2)); console.log(`\nSaved: ${JSON_OUT}`); }
  console.log(`\n${total ? `${total} item(s) to review.` : "Nothing found."}${FIX_EARNED ? "" : " Read-only run — nothing was changed."}\n`);
}

main()
  .catch((err) => { console.error("Audit failed:", err); process.exitCode = 1; })
  .finally(async () => { await closeAllConnections(); await mongoose.disconnect(); });
