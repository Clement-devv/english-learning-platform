// server/models/SubAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SubAdminSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, default: null }, // null until they set it via email

    // Account lifecycle
    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      // pending  = invite sent, not yet accepted
      // active   = account set up, can login
      // suspended = main admin disabled them
    },

    // Invite / setup token (used in email link)
    inviteToken:   { type: String, default: null },
    inviteExpires: { type: Date, default: null },

    // ── Scope: what they manage ──────────────────────────────────────────
    // Option A: region-based (auto includes all teachers in that region)
    assignmentType: {
      type: String,
      enum: ["region", "manual"],
      default: "manual",
    },
    region: {
      type: String,
      enum: ["africa", "asia", "europe", "americas", "oceania", null],
      default: null,
    },

    // Option B: manually assigned teachers
    assignedTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Teacher" }],

    // Students are auto-derived from assigned teachers' bookings
    // (no need to store them — we query dynamically)

    // ── Granular permissions ─────────────────────────────────────────────
    permissions: {
      canMarkLessons:  { type: Boolean, default: false },
      canViewPayments: { type: Boolean, default: false },
      canSendMessages: { type: Boolean, default: true  },
      canViewBookings: { type: Boolean, default: true  },
      canViewClasses:  { type: Boolean, default: true  },
    },

    // ── Security ─────────────────────────────────────────────────────────
    twoFactorEnabled:     { type: Boolean, default: false },
    twoFactorSecret:      { type: String,  default: null  },
    twoFactorBackupCodes: { type: [String], default: []   },

    // ── Meta ─────────────────────────────────────────────────────────────
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    lastLogin:  { type: Date, default: null },
    notes:      { type: String, default: "" }, // internal notes from main admin
  },
  { timestamps: true }
);

// Hash password before saving
SubAdminSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
SubAdminSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

// Full name virtual
SubAdminSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

export default mongoose.model("SubAdmin", SubAdminSchema);