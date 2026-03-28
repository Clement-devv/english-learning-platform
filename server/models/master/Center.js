import mongoose from 'mongoose';

const centerSchema = new mongoose.Schema({
  centerName:   { type: String, required: true, trim: true },
  slug:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  customDomain: { type: String, default: null },
  adminEmail:   { type: String, required: true, lowercase: true },
  dbName:       { type: String, required: true },

  plan: {
    type:    String,
    enum:    ['free', 'basic', 'pro', 'enterprise'],
    default: 'free',
  },

  // GATED REGISTRATION — default is always pending, never active on creation
  status: {
    type:    String,
    enum:    ['pending', 'active', 'suspended', 'rejected', 'deleted'],
    default: 'pending',
  },

  // Temporary storage during pending state — cleared after center DB admin is created
  pendingPasswordHash: { type: String, default: null, select: false },

  branding: {
    logo:           { type: String, default: null },
    primaryColor:   { type: String, default: '#4F46E5' },
    secondaryColor: { type: String, default: '#E0E7FF' },
    fontFamily:     { type: String, default: 'Inter' },
    favicon:        { type: String, default: null },
    borderRadius:   { type: String, default: '8px' },
    shadowStyle:    { type: String, default: 'soft' },
    spacing:        { type: String, default: 'comfortable' },
    theme:          { type: String, default: null },
  },

  phone:       String,
  country:     String,
  website:     String,
  address:     String,
  timezone:    { type: String, default: 'UTC' },
  description: String,
  registeredBy: String,

  approvedAt:   Date,
  approvedBy:   String,
  rejectedAt:   Date,
  rejectReason: String,

  deletedAt:            Date,   // when soft-delete was triggered
  scheduledDeletionAt:  Date,   // deletedAt + 7 days — for display countdown
  deletedBy:            String, // super admin id

  maxTeachers: { type: Number, default: 5 },
  maxStudents: { type: Number, default: 50 },

  features: {
    agora:         { type: Boolean, default: true },
    googleMeet:    { type: Boolean, default: true },
    recording:     { type: Boolean, default: true },
    pronunciation: { type: Boolean, default: true },
  },

  // Custom domain fields
  domainVerified:    { type: Boolean, default: false },
  domainRequestedAt: Date,
  domainVerifiedAt:  Date,
  domainVerifiedBy:  String,
  domainInstructions: {
    type:  { type: String, default: 'A' },
    name:  { type: String, default: '@' },
    value: String,
  },

}, { timestamps: true });

export default mongoose.model('Center', centerSchema);
