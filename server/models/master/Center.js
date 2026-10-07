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

  // Teaching library storage (utils/libraryQuota.js). Files themselves live in the
  // center DB (LibraryFile) + S3 or local disk; this is the usage/billing summary.
  library: {
    quotaMb:        { type: Number, default: null },  // super admin override of the plan allowance
    extraMb:        { type: Number, default: 0 },     // extra space packs added by the super admin
    usedBytes:      { type: Number, default: 0 },
    fileCount:      { type: Number, default: 0 },
    month:          { type: String, default: null },  // "2026-10" — current billing month
    monthPeakBytes: { type: Number, default: 0 },     // highest usage this month (billed on this)
    warned:         { type: String, default: null },  // '80' | '100' — last warning email sent
    history: [{
      _id: false, month: String, peakBytes: Number, allowanceBytes: Number,
      overageBytes: Number, overageGb: Number, amount: Number, currency: String,
      paid: { type: Boolean, default: false },
    }],
    log: [{ _id: false, at: { type: Date, default: Date.now }, mb: Number, note: String, by: String }],
  },

  // Invite flow (super admin → "Create center"): the center stays 'pending' until
  // the admin opens the emailed link and sets their name, location and password
  // (routes/centerInviteRoutes.js). Only a SHA-256 of the link token is stored.
  invite: {
    tokenHash:  { type: String, default: null, select: false },
    expiresAt:  { type: Date,   default: null },
    sentAt:     { type: Date,   default: null },
    sentCount:  { type: Number, default: 0 },
    invitedBy:  { type: String, default: null },  // super admin id
    acceptedAt: { type: Date,   default: null },
  },

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
    classroomTheme:           { type: String, default: null },  // non-exclusive — super admin assigns Google Meet classroom design
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
    zoom:          { type: Boolean, default: true },
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
      primaryColor:   { type: String, default: '#BE185D' },
      secondaryColor: { type: String, default: '#FCE7F3' },
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
      badge:            { type: String, default: '' },   // small label above the headline
      image:            { type: String, default: null }, // big hero photo (Classic template)
    },

    about: {
      enabled: { type: Boolean, default: true },
      title:   { type: String, default: 'About Us' },
      body:    { type: String, default: '' },
      image:   { type: String, default: null },
      subtitle:   { type: String, default: '' },
      image2:     { type: String, default: null },  // second photo in the collage
      badgeValue: { type: String, default: '' },    // e.g. "15+"
      badgeLabel: { type: String, default: '' },    // e.g. "Years of experience"
      points:     { type: [String], default: [] },  // checklist
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
      hours:   { type: String, default: '' },
    },

    // ── Extra sections (Classic template). Each: { enabled, title, subtitle, items: [...] }.
    // Shapes are validated/cleaned in superAdminRoutes.js (cleanLandingPage).
    topBar:       { type: mongoose.Schema.Types.Mixed, default: undefined }, // { enabled, text }
    stats:        { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ value, label }]
    features:     { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ icon, title, text }]
    programs:     { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ image, title, level, duration, price, text, ctaText, ctaUrl }]
    testimonials: { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ name, role, photo, quote, rating }]
    gallery:      { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ image, caption }]
    faq:          { type: mongoose.Schema.Types.Mixed, default: undefined }, // items: [{ q, a }]
    cta:          { type: mongoose.Schema.Types.Mixed, default: undefined }, // { enabled, title, text, buttonText, buttonUrl, image }
    footer:       { type: mongoose.Schema.Types.Mixed, default: undefined }, // { about }

    seo: {
      title:       { type: String, default: '' },
      description: { type: String, default: '' },
    },

    updatedBy:   { type: String, default: null },
    publishedAt: { type: Date,   default: null },
  },

  // ── Admin email change flow ───────────────────────────────────────────────
  // previousEmail kept for reversal; token/cancelToken stored as SHA-256 hashes
  // so raw tokens never touch the DB. select:false prevents accidental leaks.
  pendingEmailChange: {
    previousEmail:   { type: String, default: null },
    newEmail:        { type: String, default: null, lowercase: true },
    token:           { type: String, default: null, select: false },
    expiresAt:       { type: Date,   default: null },
    requestedAt:     { type: Date,   default: null },
    requestIp:       { type: String, default: null },
    cancelToken:     { type: String, default: null, select: false },
    cancelExpiresAt: { type: Date,   default: null },
  },

  // ── Recovery code — set once on approval, never changes ──────────────────
  // Quoted by the admin when requesting manual recovery from the super admin.
  recoveryCode: { type: String, default: null },

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

centerSchema.index({ 'pendingEmailChange.token': 1 }, { sparse: true });
centerSchema.index({ 'invite.tokenHash': 1 }, { sparse: true });

export default mongoose.model('Center', centerSchema);
