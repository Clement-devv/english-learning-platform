// server/models/master/BoardMessage.js
// "Board" messages — ads or information the super admin puts on the welcome banner of
// center dashboards. The banner flips over, shows the message for `durationSec`, then
// flips back. Platform-wide (master DB); each message targets centers → roles → people.
//   Super admin API: routes/boardRoutes.js (saBoardRoutes)  · Center API: centerBoardRoutes
import mongoose from 'mongoose';

const ROLES = ['admin', 'teacher', 'student'];

const boardMessageSchema = new mongoose.Schema({
  kind:     { type: String, enum: ['ad', 'info'], default: 'info' },
  title:    { type: String, trim: true, maxlength: 80, default: '' },
  body:     { type: String, trim: true, maxlength: 240, default: '' },
  imageUrl: { type: String, trim: true, maxlength: 500, default: '' },
  // optional picture for phones, where the board is much less wide (about 2:1 instead of 6:1)
  mobileImageUrl: { type: String, trim: true, maxlength: 500, default: '' },
  // "image" = the picture fills the board (text optional on top) · "text" = text card
  layout:   { type: String, enum: ['image', 'text'], default: 'text' },
  ctaLabel: { type: String, trim: true, maxlength: 30, default: '' },
  ctaUrl:   { type: String, trim: true, maxlength: 500, default: '' },

  durationSec: { type: Number, min: 3, max: 120, default: 8 },
  showOnLogin: { type: Boolean, default: true },   // flips by itself once per sign-in
  showOnClick: { type: Boolean, default: true },   // the board can be tapped to see it

  active:   { type: Boolean, default: true },
  startsAt: { type: Date, default: null },
  endsAt:   { type: Date, default: null },

  // Who sees it. allCenters → every active center. people lists only apply when exactly
  // one center is chosen (picking individuals across centers makes no sense).
  target: {
    allCenters: { type: Boolean, default: true },
    centerIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Center' }],
    roles:      { type: [{ type: String, enum: ROLES }], default: ['admin', 'teacher', 'student'] },
    allTeachers: { type: Boolean, default: true },
    teacherIds:  [{ type: String }],
    allStudents: { type: Boolean, default: true },
    studentIds:  [{ type: String }],
  },

  views:  { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdBy: { type: String, default: '' },
}, { timestamps: true, versionKey: false });

boardMessageSchema.index({ active: 1, startsAt: 1, endsAt: 1 });

export const BOARD_ROLES = ROLES;
export default mongoose.models.BoardMessage || mongoose.model('BoardMessage', boardMessageSchema);
