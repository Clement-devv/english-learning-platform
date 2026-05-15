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
    loginBackground: { type: String, default: null },
    loginBgOverlay:  { type: Number, default: 0.45 },
    loginTheme:         { type: String, default: null },  // exclusive — super admin assigns (student)
    teacherLoginTheme:  { type: String, default: null },  // exclusive — super admin assigns (teacher)
    adminLoginTheme:    { type: String, default: null },  // exclusive — super admin assigns (admin+sub-admin)
    dashboardTheme:        { type: String, default: null },  // exclusive — super admin assigns (student)
    teacherDashboardTheme: { type: String, default: null },  // exclusive — super admin assigns (teacher)
    adminDashboardTheme:      { type: String, default: null },  // exclusive — super admin assigns (admin)
    subAdminDashboardTheme:   { type: String, default: null },  // exclusive — super admin assigns (sub-admin)
    borderRadius:    { type: String, default: '8px' },
    shadowStyle:     { type: String, default: 'soft' },
    spacing:         { type: String, default: 'comfortable' },
    theme:           { type: String, default: null },
    partnershipText: { type: String, default: '' },
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

  // ── Certificate template (configured by super admin per center) ─────────────
  certificateTemplate: {
    organizationName: { type: String, default: '' },
    primaryColor:     { type: String, default: '#f97316' },
    secondaryColor:   { type: String, default: '#1e293b' },
    accentColor:      { type: String, default: '#f43f5e' },
    signatureName:    { type: String, default: '' },
    signatureTitle:   { type: String, default: 'Director of Studies' },
    footerText:       { type: String, default: '' },
    completionMilestones: {
      type: [{
        count:       { type: Number, required: true },
        title:       { type: String, required: true },
        description: { type: String, default: '' },
      }],
      default: [
        { count: 10,  title: 'English Starter Certificate',     description: 'Successfully completed 10 English lessons' },
        { count: 25,  title: 'English Foundation Certificate',  description: 'Successfully completed 25 English lessons' },
        { count: 50,  title: 'English Proficiency Certificate', description: 'Successfully completed 50 English lessons' },
        { count: 100, title: 'English Excellence Certificate',  description: 'Successfully completed 100 English lessons' },
      ],
    },
  },

  // ── Center public landing page (managed exclusively by super admin) ─────────
  landingPage: {
    published:  { type: Boolean, default: false },
    template:   { type: String, default: 'classic' },

    design: {
      primaryColor:   { type: String, default: '#4F46E5' },
      secondaryColor: { type: String, default: '#E0E7FF' },
      accentColor:    { type: String, default: '#f59e0b' },
      bgColor:        { type: String, default: '#ffffff' },
      textColor:      { type: String, default: '#1e293b' },
      mutedColor:     { type: String, default: '#64748b' },
      fontFamily:     { type: String, default: 'Inter' },
      heroStyle:      { type: String, default: 'gradient' }, // 'gradient' | 'solid' | 'image'
      heroImage:      { type: String, default: null },
      navStyle:       { type: String, default: 'light' },    // 'light' | 'dark' | 'colored'
    },

    hero: {
      headline:         { type: String, default: '' },
      subheadline:      { type: String, default: '' },
      ctaText:          { type: String, default: 'Start Learning' },
      ctaUrl:           { type: String, default: '/student/login' },
      secondaryCtaText: { type: String, default: '' },
      secondaryCtaUrl:  { type: String, default: '' },
    },

    about: {
      enabled: { type: Boolean, default: true },
      title:   { type: String, default: 'About Us' },
      body:    { type: String, default: '' },
      image:   { type: String, default: null },
    },

    teachers: [{
      name:  { type: String, default: '' },
      photo: { type: String, default: null },
      title: { type: String, default: '' },
      bio:   { type: String, default: '' },
      order: { type: Number, default: 0 },
    }],

    links: {
      studentLogin: { type: String, default: '' },
      teacherLogin: { type: String, default: '' },
      parentLogin:  { type: String, default: '' },
      facebook:     { type: String, default: '' },
      instagram:    { type: String, default: '' },
      youtube:      { type: String, default: '' },
      whatsapp:     { type: String, default: '' },
    },

    contact: {
      enabled: { type: Boolean, default: false },
      email:   { type: String, default: '' },
      phone:   { type: String, default: '' },
      address: { type: String, default: '' },
    },

    seo: {
      title:       { type: String, default: '' },
      description: { type: String, default: '' },
    },

    updatedBy:   { type: String, default: null },
    publishedAt: { type: Date,   default: null },
  },

  // ── AI Chat Credit Budget (allocated by super admin) ──────────────────────
  chatCredits: {
    balance:        { type: Number, default: 0, min: 0 },
    totalAllocated: { type: Number, default: 0 },
    log: [{
      amount:    Number,
      note:      String,
      by:        String,
      createdAt: { type: Date, default: Date.now },
    }],
  },

  // ── Pronunciation Credit Budget (allocated by super admin) ───────────────
  pronunciationCredits: {
    balance:        { type: Number, default: 0, min: 0 },
    totalAllocated: { type: Number, default: 0 },
    log: [{
      amount:    Number,
      note:      String,
      by:        String,
      createdAt: { type: Date, default: Date.now },
    }],
  },

}, { timestamps: true });

export default mongoose.model('Center', centerSchema);
