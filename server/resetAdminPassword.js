import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";

dotenv.config();

async function resetAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find the admin
    const admin = await Admin.findOne({ username: "admin" });
    
    if (!admin) {
      console.log("❌ No admin found with username 'admin'");
      process.exit(1);
    }

    // Set new password
    const newPassword = "admin123";
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    admin.password = hashedPassword;
    await admin.save();

    console.log("\n✅ Admin password reset successfully!");
    console.log("═══════════════════════════");
    console.log("Username:", admin.username);
    console.log("Email:", admin.email);
    console.log("New Password:", newPassword);
    console.log("═══════════════════════════");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  }
}

resetAdminPassword();