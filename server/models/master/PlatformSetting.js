// server/models/master/PlatformSetting.js
// Small platform-wide settings set by the super admin, one document per key.
//   _id "library" → { pricePerGb, currency, copyrightEmail, planMb: { free, basic, pro, enterprise } }
import mongoose from 'mongoose';

const platformSettingSchema = new mongoose.Schema({
  _id:   { type: String },
  value: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { versionKey: false, timestamps: { createdAt: false, updatedAt: true } });

export default mongoose.models.PlatformSetting || mongoose.model('PlatformSetting', platformSettingSchema);
