// server/schemas/libraryFileSchema.js
// One PDF in a center's teaching library (center DB, model "LibraryFile").
// Admins upload; admins and teachers search, view and download.
// Routes: routes/libraryRoutes.js · storage usage: utils/libraryQuota.js
import mongoose from 'mongoose';

export const libraryFileSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  category:    { type: String, default: '', trim: true, maxlength: 60 },   // folder, e.g. "Grammar"
  level:       { type: String, default: '', trim: true, maxlength: 40 },   // e.g. "A2", "Kids", "IELTS"
  tags:        { type: [String], default: [] },

  fileName:    { type: String, required: true },     // original name, used for downloads
  size:        { type: Number, required: true },     // bytes
  sha256:      { type: String, required: true },     // same file is stored once per center
  storageKey:  { type: String, required: true },     // S3 key or local path under uploads/library

  uploadedBy: {
    id:   { type: String, default: null },
    role: { type: String, default: 'admin' },
    name: { type: String, default: '' },
  },
  // Uploader confirmed they have the right to share it (copyright)
  rightsConfirmed:   { type: Boolean, required: true },
  rightsConfirmedAt: { type: Date, default: Date.now },

  downloads: { type: Number, default: 0 },

  // Super admin takedown (copyright notice) — the file is deleted, the record kept
  status:        { type: String, enum: ['active', 'removed'], default: 'active' },
  removedAt:     { type: Date, default: null },
  removedReason: { type: String, default: '' },
}, { timestamps: true });

libraryFileSchema.index({ status: 1, createdAt: -1 });
libraryFileSchema.index({ status: 1, category: 1 });
libraryFileSchema.index({ sha256: 1, status: 1 });
