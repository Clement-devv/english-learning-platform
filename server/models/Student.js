// models/Student.js
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  surname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  active: { type: Boolean, default: true },
  noOfClasses: { type: Number, default: 0 },
  lastPaymentDate: Date,
  showTempPassword: { type: Boolean, default: false },
  age: { type: Number }, // 👈 optional, added so your modal doesn’t break
}, { timestamps: true });

// Hash password before save
studentSchema.pre("save", async function (next) {
  // Only hash if password was actually modified
  if (!this.isModified("password")) {
    return next();
  }

  // If password is being modified but is empty/null, generate one
  if (!this.password) {
    const tempPass = Math.random().toString(36).slice(-8);
    this.password = await bcrypt.hash(tempPass, 10);
    this.showTempPassword = true;
  } else {
    // Password was provided, just hash it
    this.password = await bcrypt.hash(this.password, 10);
  }
  
  next();
});

export default mongoose.model("Student", studentSchema);
