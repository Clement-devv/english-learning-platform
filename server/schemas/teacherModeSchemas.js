import mongoose from 'mongoose';
const O = mongoose.Schema.Types.ObjectId;
export const teacherChargeVersionSchema = new mongoose.Schema({
  effectiveAt: { type: Date, required: true, default: Date.now, index: true },
  by: { type: String, required: true },
  rules: [{ name: { type: String, required: true, maxlength: 60 }, kind: { type: String, enum: ['percent', 'fixed'], required: true }, value: { type: Number, min: 0, required: true }, currency: { type: String, default: '' }, centerIds: { type: [O], default: [] } }],
}, { timestamps: true });
export const managedCenterSchema = new mongoose.Schema({
  notificationEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 254 },
  name: { type: String, required: true, maxlength: 120 },
  currency: { type: String, default: 'USD', match: /^[A-Z]{3}$/ },
  payBasis: { type: String, enum: ['class', 'hour'], default: 'class' },
  salarySchedule: [{ _id: false, from: String, day: Number }],
  salaryDay: { type: Number, min: 1, max: 31, default: 31 },
  rateMinor: { type: Number, default: 0, min: 0 },
  prepaid: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  dailyReportLastDate: String,
  weeklyReportStart: Date,
  weeklyReportLastDate: String,
  meetingUrl: { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });
export const teacherWorkSchema = new mongoose.Schema({
  centerId: { type: O, required: true, index: true },
  studentId: { type: O, required: true, index: true },
  bookingId: { type: O, required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  summary: { type: String, default: '', maxlength: 5000 },
  attended: { type: String, enum: ['yes', 'no', 'unanswered'], default: 'unanswered' },
  parentComment: { type: String, default: '', maxlength: 1000 },
  published: { type: Boolean, default: false },
}, { timestamps: true });
teacherWorkSchema.index({ bookingId: 1, studentId: 1 }, { unique: true });
export const teacherReceiptSchema = new mongoose.Schema({
  centerId: { type: O, required: true, index: true },
  amountMinor: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  receivedAt: { type: Date, required: true }, note: { type: String, maxlength: 1000 },
}, { timestamps: true });
export const teacherConversationSchema = new mongoose.Schema({
  // null = private platform conversation; a student id = family conversation.
  studentId: { type: O, default: null, index: true },
  sender: { type: String, enum: ['teacher', 'superadmin', 'family'], required: true },
  text: { type: String, required: true, maxlength: 3000 },
  readAt: Date,
}, { timestamps: true });
teacherConversationSchema.index({ studentId: 1, createdAt: -1 });
export const teacherModeModels = db => ({
  ManagedCenter: db.models.ManagedCenter || db.model('ManagedCenter', managedCenterSchema),
  TeacherWork: db.models.TeacherWork || db.model('TeacherWork', teacherWorkSchema),
  TeacherReceipt: db.models.TeacherReceipt || db.model('TeacherReceipt', teacherReceiptSchema),
  TeacherConversation: db.models.TeacherConversation || db.model('TeacherConversation', teacherConversationSchema),
});
