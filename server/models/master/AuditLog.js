import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action:           { type: String, required: true, index: true },
  performedBy:      { type: String, required: true },          // superAdmin _id
  performedByEmail: { type: String, default: '' },
  targetId:         { type: String, default: null },           // center _id or other target
  targetName:       { type: String, default: null },           // center name or other target name
  details:          { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:               { type: String, default: null },
  timestamp:        { type: Date, default: Date.now },
});

// TTL: auto-delete logs older than 2 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 60 * 60 });

export default mongoose.model('AuditLog', auditLogSchema);
