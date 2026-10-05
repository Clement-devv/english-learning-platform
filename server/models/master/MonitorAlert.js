// server/models/master/MonitorAlert.js
// A health check that went red. Opened when it fails, closed when it recovers.
// The super admin is told by email + WhatsApp when it opens (and again every
// few hours while it stays open, unless they acknowledge it).
import mongoose from 'mongoose';

const monitorAlertSchema = new mongoose.Schema({
  key:            { type: String, required: true },   // check key, e.g. "email"
  title:          { type: String, required: true },
  message:        { type: String, default: '' },
  details:        { type: [String], default: [] },
  status:         { type: String, enum: ['open', 'resolved'], default: 'open' },
  openedAt:       { type: Date, default: Date.now },
  resolvedAt:     { type: Date, default: null },
  acknowledgedAt: { type: Date, default: null },
  acknowledgedBy: { type: String, default: null },
  lastNotifiedAt: { type: Date, default: null },
  notifyCount:    { type: Number, default: 0 },
  // Result of the last attempt per channel: "sent" | "failed: …" | "off"
  delivery:       { type: mongoose.Schema.Types.Mixed, default: {} },
}, { versionKey: false });

monitorAlertSchema.index({ status: 1, key: 1 });
monitorAlertSchema.index({ openedAt: -1 });
// Resolved alerts are kept for 90 days
monitorAlertSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60, partialFilterExpression: { status: 'resolved' } });

export default mongoose.models.MonitorAlert || mongoose.model('MonitorAlert', monitorAlertSchema);
