

import mongoose from "mongoose";
import dotenv   from "dotenv";
dotenv.config();

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;

    // ── Students ─────────────────────────────────────────────────────────────
    console.log("📝 students...");
    await db.collection("students").createIndex({ email: 1 }, { unique: true });
    await db.collection("students").createIndex({ active: 1 });
    await db.collection("students").createIndex({ status: 1 });
    await db.collection("students").createIndex({ inviteToken: 1 }, { sparse: true }); // sparse = skip docs without the field
    console.log("   ✅ students done");

    // ── Teachers ──────────────────────────────────────────────────────────────
    console.log("📝 teachers...");
    await db.collection("teachers").createIndex({ email: 1 }, { unique: true });
    await db.collection("teachers").createIndex({ active: 1 });
    await db.collection("teachers").createIndex({ continent: 1 });
    console.log("   ✅ teachers done");

    // ── Bookings ─────────────────────────────────────────────────────────────
    console.log("📝 bookings...");
    await db.collection("bookings").createIndex({ teacherId: 1, status: 1 });
    await db.collection("bookings").createIndex({ studentId: 1, status: 1 });
    await db.collection("bookings").createIndex({ scheduledTime: 1 });
    await db.collection("bookings").createIndex({ status: 1, scheduledTime: -1 });
    await db.collection("bookings").createIndex({ recurringPatternId: 1 }, { sparse: true });
    console.log("   ✅ bookings done");

    // ── Assignments ───────────────────────────────────────────────────────────
    console.log("📝 assignments...");
    await db.collection("assignments").createIndex({ teacherId: 1 });
    await db.collection("assignments").createIndex({ studentId: 1 });
    await db.collection("assignments").createIndex({ teacherId: 1, studentId: 1 }, { unique: true });
    console.log("   ✅ assignments done");

    // ── Group Chats ───────────────────────────────────────────────────────────
    console.log("📝 groupchats...");
    await db.collection("groupchats").createIndex({ assignmentId: 1 });
    await db.collection("groupchats").createIndex({ teacherId: 1 });
    await db.collection("groupchats").createIndex({ studentId: 1 });
    console.log("   ✅ groupchats done");

    // ── Payments ──────────────────────────────────────────────────────────────
    console.log("📝 payments...");
    await db.collection("payments").createIndex({ studentId: 1, date: -1 });
    console.log("   ✅ payments done");

    // ── Payment Transactions ──────────────────────────────────────────────────
    console.log("📝 paymenttransactions...");
    await db.collection("paymenttransactions").createIndex({ teacherId: 1, status: 1 });
    await db.collection("paymenttransactions").createIndex({ bookingId: 1 });
    await db.collection("paymenttransactions").createIndex({ status: 1, completedAt: -1 });
    console.log("   ✅ paymenttransactions done");

    // ── Lessons ───────────────────────────────────────────────────────────────
    console.log("📝 lessons...");
    await db.collection("lessons").createIndex({ studentId: 1, date: -1 });
    await db.collection("lessons").createIndex({ teacherId: 1 });
    console.log("   ✅ lessons done");

    // ── Recurring Patterns ────────────────────────────────────────────────────
    console.log("📝 recurringpatterns...");
    await db.collection("recurringpatterns").createIndex({ teacherId: 1, status: 1 });
    await db.collection("recurringpatterns").createIndex({ studentId: 1 });
    console.log("   ✅ recurringpatterns done");

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log("\n🎉 All indexes created successfully!");
    console.log("   Queries will now be significantly faster.\n");

    // Print all indexes for verification
    const collections = ["students", "teachers", "bookings", "assignments", "groupchats", "payments"];
    for (const col of collections) {
      const indexes = await db.collection(col).indexes();
      console.log(`📋 ${col}: ${indexes.length} indexes`);
    }

  } catch (err) {
    console.error("❌ Index creation failed:", err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Connection closed");
    process.exit(0);
  }
}

createIndexes();