import mongoose from 'mongoose';
import { hideSecrets } from '../../schemas/shared/hideSecrets.js';

const sessionSchema = new mongoose.Schema({
  token:      { type: String, required: true },
  loginTime:  { type: Date, default: Date.now },
  isActive:   { type: Boolean, default: true },
  // The signed JWT issued for this session — needed by the logout endpoints
  // so the raw token can be added to the blacklist that verifySuperAdmin
  // checks on every request.
  jwtToken:   { type: String, default: null },
  deviceInfo: { browser: String, os: String, device: String },
  ipAddress:  String,
});

const superAdminSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role:      { type: String, default: 'superadmin' },
  active:    { type: Boolean, default: true },
  sessions:  [sessionSchema],
  lastLogin: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret:  String,
  // Email sign-in code (second login step). Only the bcrypt hash is stored.
  loginCode: {
    type: {
      codeHash:  String,
      expiresAt: Date,
      sentAt:    Date,
      attempts:  { type: Number, default: 0 },
    },
    select: false,
    default: undefined,
  },
  // Team (routes/superAdminTeamRoutes.js): every super admin sees and manages the same
  // platform — accounts only separate logins, sign-in codes and who-did-what in the logs.
  // An invited account stays inactive until the invite link is used to set a password.
  invitedBy: { type: String, default: '' }, // inviter's email
  invite: {
    type: {
      tokenHash: String, // sha256 of the link token — the raw token is only in the email
      expiresAt: Date,
      sentAt:    Date,
    },
    select: false,
    default: undefined,
  },
}, { timestamps: true });

// Never serialize password hash or session tokens
hideSecrets(superAdminSchema);

export default mongoose.model('SuperAdmin', superAdminSchema);
