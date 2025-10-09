import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import Student from "./models/Student.js";

dotenv.config();

async function migrateStudentPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const students = await Student.find();
    console.log(`Found ${students.length} students`);

    for (const student of students) {
      const newPassword = "student123";
      const hashedPassword = await bcryptjs.hash(newPassword, 10);

      await Student.findByIdAndUpdate(student._id, {
        password: hashedPassword,
        lastPasswordChange: new Date()
      });

      console.log(`✅ Reset password for ${student.email} to: ${newPassword}`);
    }

    console.log("\n=== Migration Complete ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
}

migrateStudentPasswords();