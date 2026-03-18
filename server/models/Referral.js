// server/models/Referral.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const referralSchema = new Schema({
  // Who shared the link
  referrerId:   { type: Schema.Types.ObjectId, ref: "Student", required: true },
  referrerCode: { type: String, required: true },  // code used at sign-up

  // The new person who applied
  referredFirstName: { type: String, required: true },
  referredLastName:  { type: String, required: true },
  referredEmail:     { type: String, required: true, lowercase: true, trim: true },

  // Set once admin creates the student account
  referredStudentId: { type: Schema.Types.ObjectId, ref: "Student", default: null },

  // Workflow status
  status: {
    type: String,
    enum: ["pending", "invited", "active", "rejected"],
    default: "pending",
  },

  // Reward tracking
  creditAwarded: { type: Boolean, default: false },
  creditedAt:    { type: Date, default: null },
}, { timestamps: true });

referralSchema.index({ referrerId: 1 });
referralSchema.index({ referredEmail: 1 });

export default mongoose.model("Referral", referralSchema);
