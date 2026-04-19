// backend/migratePasswords.js
// Run this ONCE to hash all existing plain text passwords

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { teacherSchema } from "./schemas/teacherSchema.js";

dotenv.config();

async function migratePasswords() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");
    const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);

    // Find all teachers
    const teachers = await Teacher.find();
    console.log(`Found ${teachers.length} teachers to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const teacher of teachers) {
      // Check if password is already hashed (bcrypt hashes start with $2a$ or $2b$)
      if (teacher.password.startsWith('$2a$') || teacher.password.startsWith('$2b$')) {
        console.log(`⏭️  Skipping ${teacher.email} - already hashed`);
        skipped++;
        continue;
      }

      // Store the plain password (you might want to log this)
      const plainPassword = teacher.password;
      console.log(`📧 ${teacher.email} - Plain password: ${plainPassword}`);

      // Hash the password
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      // Update the teacher
      await Teacher.findByIdAndUpdate(teacher._id, {
        password: hashedPassword
      });

      console.log(`✅ Migrated password for ${teacher.email}`);
      migrated++;
    }

    console.log("\n=== Migration Complete ===");
    console.log(`✅ Migrated: ${migrated} teachers`);
    console.log(`⏭️  Skipped: ${skipped} teachers (already hashed)`);
    console.log("\n⚠️  IMPORTANT: Save the plain passwords logged above!");
    console.log("Teachers will need to use these passwords to login.");

    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

migratePasswords();