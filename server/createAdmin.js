import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";

dotenv.config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: "admin" });
    
    if (existingAdmin) {
      console.log("⚠️  Admin already exists!");
      console.log("Username:", existingAdmin.username);
      console.log("Email:", existingAdmin.email);
      process.exit(0);
    }

    // Create new admin
    const password = "admin123"; // Change this!
    const hashedPassword = await bcryptjs.hash(password, 10);

    const admin = await Admin.create({
      username: "admin",
      email: "admin@school.com",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      active: true
    });

    console.log("\n✅ Admin created successfully!");
    console.log("═══════════════════════════");
    console.log("Username:", admin.username);
    console.log("Email:", admin.email);
    console.log("Password:", password);
    console.log("═══════════════════════════");
    console.log("\n⚠️  IMPORTANT: Change this password after first login!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();