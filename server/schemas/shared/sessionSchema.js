import mongoose from 'mongoose';

export const sessionSchema = new mongoose.Schema({
  token:        { type: String, required: true },
  deviceInfo:   { browser: String, os: String, device: String },
  ipAddress:    String,
  location:     String,
  loginTime:    { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive:     { type: Boolean, default: true },
  // The signed JWT this session was issued with.  Required for logout-session
  // and logout-all-devices to add the raw token to the in-memory + Redis
  // blacklist so verifyToken rejects it immediately.  Without this field,
  // session.jwtToken was silently dropped by Mongoose strict mode and the
  // blacklist code in /auth/logout-session was effectively a no-op.
  jwtToken:     { type: String, default: null },

  // ── Device binding ─────────────────────────────────────────────────────────
  // The browser generates a key pair whose private half can never be exported
  // (not even from the console) and sends the public half at login. Renewing
  // the session requires a signature from that key, so a session copied to
  // another computer stops working once its short-lived JWT expires.
  // Sessions without a key (older logins, insecure http) fall back to a
  // same-browser/same-OS check.
  deviceId:        { type: String, default: null },
  devicePublicKey: { type: mongoose.Schema.Types.Mixed, default: null }, // EC P-256 JWK

  // ── Notifications for THIS device ─────────────────────────────────────────
  // Push goes only to active sessions that opted in, so logging out (or being
  // logged out remotely) stops notifications on that device.
  pushSubscription: { type: mongoose.Schema.Types.Mixed, default: null },

  revokedAt:     { type: Date, default: null },
  revokedReason: { type: String, default: null }, // 'remote' | 'all-devices' | 'device-mismatch' | 'logout'
});

// Devices this account has signed in from before. Kept separately from
// sessions (which are removed on logout) so a returning device isn't treated
// as new — used for the "new sign-in on a new device" email.
//   key: the browser's device id, or "ua:<browser>|<os>" when it has none
export const knownDeviceSchema = new mongoose.Schema({
  key:       { type: String, required: true },
  firstSeen: { type: Date, default: Date.now },
  lastSeen:  { type: Date, default: Date.now },
}, { _id: false });

// When this person last cleared their missed-call / new-message alerts.
// Stored on the server (per person, server time) so a cleared alert stays
// cleared after logout, on other devices, and for other people using the
// same computer. Missed calls / messages newer than this are "new".
export const alertsSeenDef = {
  calls:    { type: Date, default: null },
  messages: { type: Date, default: null },
};
