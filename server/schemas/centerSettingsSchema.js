// server/schemas/centerSettingsSchema.js
// Small center-wide switches an admin can change (one document, key "main").
// Missing document = defaults below.
import mongoose from 'mongoose';

export const centerSettingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  // Email each recorded class's video link to managed students automatically
  // (utils/recordingLinks.js). The "Copy parent link" button works either way.
  recordingLinkEmails: { type: Boolean, default: true },
  // Email the teacher's class summary to managed students' families (utils/classSummaryEmails.js)
  classSummaryEmails:  { type: Boolean, default: true },
  // Email the parent attendance-check link, and homework / quiz links (utils/familyLinkEmails.js)
  parentCheckEmails:   { type: Boolean, default: true },
  shareLinkEmails:     { type: Boolean, default: true },
  // Both are also set per student (Student.recordingLinkEmails / classSummaryEmails) —
  // changing one here sets every managed student (utils/familyEmailPrefs.js).
}, { timestamps: true });

export const CENTER_SETTING_DEFAULTS = { recordingLinkEmails: true, classSummaryEmails: true, parentCheckEmails: true, shareLinkEmails: true };
