// server/schemas/recordingLinkSchema.js
// A parent link to one class's recordings, for one student (utils/recordingLinks.js).
// One-to-one class: bookingId. Group class: groupClassId — one link per enrolled student.
// The link itself is a share link (utils/shareLink.js): random token, name check, lockout.
import mongoose from 'mongoose';
import { shareLinkSchemaDef } from '../utils/shareLink.js';

const { ObjectId } = mongoose.Schema.Types;

export const recordingLinkSchema = new mongoose.Schema({
  bookingId:    { type: ObjectId, ref: 'Booking' },
  groupClassId: { type: ObjectId, ref: 'GroupClass' },
  studentId:    { type: ObjectId, ref: 'Student', required: true },
  teacherId:    { type: ObjectId, ref: 'Teacher', required: true },
  shareLink:    shareLinkSchemaDef,
  // Teacher / admin can switch a link off (and on again) — the token stays the same
  enabled:      { type: Boolean, default: true },
  // Automatic (or "Email now") email to the managed student's notification address
  emailedAt:    { type: Date, default: null },
  emailedTo:    { type: String, default: '' },
  emailedManual: { type: Boolean, default: false }, // last send was "Email now" (not the automatic one)
  // Links outlive their videos (auto-deleted after 30 days) only briefly
  purgeAt:      { type: Date, required: true },
}, { timestamps: true });

recordingLinkSchema.index({ bookingId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { bookingId: { $exists: true } } });
recordingLinkSchema.index({ groupClassId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { groupClassId: { $exists: true } } });
recordingLinkSchema.index({ 'shareLink.tokenHash': 1 }, { sparse: true });
recordingLinkSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
