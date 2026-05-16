import mongoose from 'mongoose';
import { sessionSchema } from './shared/sessionSchema.js';

const { Schema, Types: { ObjectId } } = mongoose;

export const parentSchema = new Schema({
  firstName: { type: String, required: true },
  lastName:  { type: String, required: true },
  email:     { type: String, required: true, unique: true },
  password:  { type: String, default: null },
  phone:     { type: String, default: '' },
  active:    { type: Boolean, default: false },
  status:    { type: String, enum: ['pending', 'active'], default: 'pending' },
  children:  [{ type: ObjectId, ref: 'Student' }],
  notes:     { type: String, default: '' },
  inviteToken:          { type: String },
  inviteExpires:        { type: Date },
  resetPasswordToken:   { type: String },
  resetPasswordExpires: { type: Date },
  resetPasswordCenter:  { type: String },
  lastPasswordChange:   { type: Date },
  sessions:  [sessionSchema],
  lastLogin: { type: Date },
}, { timestamps: true });

parentSchema.index({ status: 1 });
parentSchema.index({ inviteToken: 1 }, { sparse: true });
parentSchema.index({ resetPasswordToken: 1 }, { sparse: true });
