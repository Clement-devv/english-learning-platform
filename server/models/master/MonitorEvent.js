// server/models/master/MonitorEvent.js
// One row per important thing that happened on the platform (an email sent or
// failed, a booking made, a login that failed, a page that crashed…).
// Written in batches by utils/monitor.js and read by the super admin's
// "App Health" tab. Rows delete themselves after 30 days.
import mongoose from 'mongoose';

const monitorEventSchema = new mongoose.Schema({
  at:     { type: Date, default: Date.now },
  center: { type: String, default: null },       // center slug (null = platform-wide)
  kind:   { type: String, required: true },      // email | login | booking | class | learning | payment | request | client | job
  action: { type: String, required: true },      // e.g. "booking-create", "Class reminder", "crash"
  ok:     { type: Boolean, required: true },
  status: { type: Number, default: null },       // HTTP status, when there is one
  msg:    { type: String, default: '' },         // short error message (never a stack, never a password)
  // Who it happened to. `key` groups one person's events (user id, or a hash of
  // an email address); `label` is safe to show (a name or a masked email).
  actor: {
    key:   { type: String, default: null },
    id:    { type: String, default: null },
    role:  { type: String, default: null },
    label: { type: String, default: null },
  },
  meta:   { type: mongoose.Schema.Types.Mixed, default: undefined },
}, { versionKey: false });

monitorEventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
monitorEventSchema.index({ kind: 1, at: -1 });
monitorEventSchema.index({ ok: 1, at: -1 });
monitorEventSchema.index({ center: 1, at: -1 });
monitorEventSchema.index({ 'actor.key': 1, at: -1 }, { partialFilterExpression: { 'actor.key': { $type: 'string' } } });

export default mongoose.models.MonitorEvent || mongoose.model('MonitorEvent', monitorEventSchema);
