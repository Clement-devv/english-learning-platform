// server/models/master/MonitorState.js
// Two single documents:
//   _id "settings" — where alerts go (emails, WhatsApp number, on/off switches)
//   _id "status"   — the latest health-check results, written once a minute by
//                    utils/monitorChecks.js so every server worker reads the same thing
import mongoose from 'mongoose';

const monitorStateSchema = new mongoose.Schema({
  _id: { type: String },
}, { strict: false, versionKey: false, timestamps: { createdAt: false, updatedAt: true } });

export default mongoose.models.MonitorState || mongoose.model('MonitorState', monitorStateSchema);
