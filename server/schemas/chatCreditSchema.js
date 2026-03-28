import mongoose from 'mongoose';

export const chatCreditSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  credits:   { type: Number, default: 0, min: 0 },
  totalUsed: { type: Number, default: 0 },
  log: [{
    type:      { type: String, enum: ['grant', 'spend'], required: true },
    amount:    { type: Number, required: true },
    note:      { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

chatCreditSchema.pre('save', function () {
  if (this.log.length > 100) this.log = this.log.slice(-100);
});
