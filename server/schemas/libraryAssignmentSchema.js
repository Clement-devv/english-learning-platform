// server/schemas/libraryAssignmentSchema.js
// An admin pointing a teacher to a library book ("use this with Minh — unit 3 for
// his IELTS writing"). The book is pinned and highlighted at the top of the
// teacher's library until they press "Acknowledge". (center DB, model "LibraryAssignment")
// Routes: routes/libraryRoutes.js
import mongoose from 'mongoose';

export const libraryAssignmentSchema = new mongoose.Schema({
  fileId:    { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryFile', required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', required: true },
  note:      { type: String, default: '', trim: true, maxlength: 1000 },
  assignedBy: {
    id:   { type: String, default: null },
    name: { type: String, default: '' },
  },
  acknowledgedAt: { type: Date, default: null },
}, { timestamps: true });

libraryAssignmentSchema.index({ teacherId: 1, acknowledgedAt: 1, createdAt: -1 });
libraryAssignmentSchema.index({ fileId: 1 });
libraryAssignmentSchema.index({ createdAt: -1 });
