import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import TeacherFamilyGrant from '../models/master/TeacherFamilyGrant.js';
import { verifySuperAdmin } from '../middleware/superAdminMiddleware.js';
import { loginLimiter, passwordResetLimiter, strictLimiter } from '../middleware/rateLimiter.js';
import { attachWorkspace, teacherWorkspaceAuth } from '../utils/teacherWorkspace.js';
import { getDb } from '../config/dbManager.js';
import { config, JWT_STANDARD_CLAIMS } from '../config/config.js';
import { getCenterSecret } from '../utils/jwtUtils.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { bookingSchema } from '../schemas/bookingSchema.js';
import { assignmentSchema } from '../schemas/assignmentSchema.js';
import { homeworkSchema } from '../schemas/homeworkSchema.js';
import { quizSchema } from '../schemas/quizSchema.js';
import { quizAttemptSchema } from '../schemas/quizAttemptSchema.js';
import { recordingSchema } from '../schemas/recordingSchema.js';
import { recordingLinkSchema } from '../schemas/recordingLinkSchema.js';
import { linkExpiry as recordingLinkExpiry } from '../utils/recordingLinks.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { classroomSessionSchema } from '../schemas/classroomSessionSchema.js';
import { gameLinkSchema } from '../schemas/gameLinkSchema.js';
import groupClassRoutes from './groupClassRoutes.js';
import teacherModeResourceRoutes from './teacherModeResourceRoutes.js';
import teacherModeLinkRoutes from './teacherModeLinkRoutes.js';
import { teacherModeModels, teacherChargeVersionSchema } from '../schemas/teacherModeSchemas.js';
import { hashPassword, validatePasswordStrength } from '../utils/passwordUtils.js';
import { makeManagedEmail } from '../utils/managedStudent.js';
import { generateStudentId } from '../utils/studentIdGenerator.js';
import { endSessionsAfterPasswordChange, notifySessionsRevoked } from '../utils/sessionManager.js';
import { encrypt, decrypt } from '../utils/fieldEncryption.js';
import { normalizeName, linkExpiresAt } from '../utils/shareLink.js';
import { sendEmail } from '../emails/core.js';
import logger from '../utils/logger.js';
import { sendVideoFile } from '../utils/videoFile.js';
import { getPresignedUrl } from '../utils/s3.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './authRoutes.js';
import homeworkRoutes from './homeworkRoutes.js';
import quizRoutes from './quizRoutes.js';
import quizTemplateRoutes from './quizTemplateRoutes.js';
import gameRoutes from './gameRoutes.js';
import gameAiRoutes from './gameAiRoutes.js';
import vocabRoutes from './vocabRoutes.js';
import recordingRoutes from './recordingRoutes.js';
import recordingLinkRoutes from './recordingLinkRoutes.js';
import classroomRoutes from './classroomRoutes.js';
import contentRoutes from './contentRoutes.js';
import agoraRoutes from './agoraRoutes.js';
import teacherAssignmentRoutes from './teacherAssignmentRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import teacherAvailabilityRoutes from './teacherAvailabilityRoutes.js';
import classSummaryRoutes from './classSummaryRoutes.js';
import classHistoryRoutes from './classHistoryRoutes.js';
import reviewRoutes from './reviewRoutes.js';
import { reviewSchema } from '../schemas/reviewSchema.js';
import { standaloneGroupReviewSchema } from '../schemas/standaloneGroupReviewSchema.js';
import { completeStandaloneLesson } from '../services/standaloneLessonService.js';
import twoFactorRoutes from './twoFactorRoutes.js';
import pushRoutes from './pushRoutes.js';
import agoraUsageRoutes from './agoraUsageRoutes.js';
import { runNextJob, sweepExpiredSources } from '../utils/questionJobs.js';

const router = express.Router(), app = express.Router();
const oid = value => typeof value === 'string' && mongoose.isValidObjectId(value);
const token = () => crypto.randomBytes(32).toString('base64url');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fail = message => Object.assign(new Error(message), { statusCode: 400 });
const text = (value, max = 120) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail('Please enter a valid value.');
  return value.trim();
};
const integer = (value, min = 0) => {
  if (!Number.isSafeInteger(value) || value < min || value > 1_000_000_000) throw fail('Invalid amount or duration.');
  return value;
};
const passwordInput = value => {
  const check = validatePasswordStrength(value);
  if (!check.isValid) throw fail(check.errors.join(' '));
  return value;
};
const email = value => { const s = text(value, 254).toLowerCase(); if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s)) throw fail('Invalid email.'); return s; };
const safeUrl = value => {
  if (!value) return '';
  const u = new URL(text(value, 1000));
  if (u.protocol !== 'https:' || u.username || u.password) throw fail('Use an HTTPS link.');
  return u.href;
};
const front = () => config.frontendUrl.replace(/\/$/, '');
const model = (db, name, schema) => db.models[name] || db.model(name, schema);
const Student = req => model(req.db, 'Student', studentSchema);
const Booking = req => model(req.db, 'Booking', bookingSchema);
const Group = req => model(req.db, 'GroupClass', groupClassSchema);
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const result = (res, data) => res.json({ success: true, data });
const list = query => query.sort({ createdAt: -1 }).limit(500).lean();
const getCenter = async (req, id, active = true) => {
  if (!oid(String(id))) throw fail('Choose a managed center.');
  const c = await teacherModeModels(req.db).ManagedCenter.findOne({ _id: id, ...(active ? { archived: false } : {}) });
  if (!c) throw fail('Managed center not found.');
  return c;
};
const sendLink = async (to, subject, description, url) => {
  const sent = await sendEmail({ to, subject, html: `<p>${esc(description)}</p><p><a href="${esc(url)}">${esc(subject)}</a></p><p>If you did not expect this email, ignore it.</p>` });
  if (sent?.success === false) throw Object.assign(new Error('Email could not be sent. Please retry.'), { statusCode: 502 });
};

// Platform management: this is the only account-creation entry point.
router.get('/admin/workspaces', verifySuperAdmin, handle(async (_req, res) => result(res, await list(TeacherWorkspace.find().select('-inviteHash -resetHash')))));
router.get('/admin/earnings', verifySuperAdmin, handle(async (_req, res) => {
  const workspaces = await TeacherWorkspace.find({ ownerId: { $exists: true, $ne: null } }).select('name email key status ownerId timezone').sort({ name: 1, _id: 1 }).lean();
  const teachers = [];
  // Each workspace has its own database; limit concurrent aggregations.
  for (let i = 0; i < workspaces.length; i += 5) {
    const batch = await Promise.all(workspaces.slice(i, i + 5).map(async workspace => {
      const context = {};
      await attachWorkspace(context, workspace);
      return { id: workspace._id, name: workspace.name, email: workspace.email, status: workspace.status, centers: await standaloneEarnings(context) };
    }));
    teachers.push(...batch);
  }
  const byCurrency = new Map();
  for (const teacher of teachers) for (const center of teacher.centers) for (const total of center.totals) {
    if (!byCurrency.has(total.currency)) byCurrency.set(total.currency, { currency: total.currency, earned: 0, chargesTotal: 0, net: 0, received: 0, outstanding: 0, lessons: 0 });
    const sums = byCurrency.get(total.currency);
    for (const key of ['earned', 'chargesTotal', 'net', 'received', 'outstanding', 'lessons']) sums[key] += total[key] || 0;
  }
  res.set('Cache-Control', 'private, no-store');
  result(res, { teachers, totals: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)) });
}));
router.post('/admin/workspaces/:id/view', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const workspace = await TeacherWorkspace.findOne({ _id: req.params.id, status: 'active', ownerId: { $exists: true } });
  if (!workspace?.ownerId) return res.status(404).json({ success: false, message: 'Active teacher workspace not found.' });
  const db = await getDb(workspace.key), Teacher = model(db, 'Teacher', teacherSchema);
  const teacher = await Teacher.findOne({ _id: workspace.ownerId, active: true }).select('firstName lastName email accountType').lean();
  if (!teacher) return res.status(404).json({ success: false, message: 'Active teacher workspace not found.' });
  const accessToken = jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(teacher._id), role: 'teacher', centerId: workspace.key, realm: 'teacher-mode', teacherInspection: true, inspectedBy: String(req.superAdmin._id) }, getCenterSecret(workspace.key), { expiresIn: '10m' });
  await writeAuditLog({ action: 'STANDALONE_WORKSPACE_VIEWED', superAdmin: req.superAdmin, targetId: String(workspace._id), targetName: workspace.name, ip: req.ip });
  res.set('Cache-Control', 'no-store');
  result(res, { token: accessToken, teacher: { id: String(teacher._id), firstName: teacher.firstName, lastName: teacher.lastName, accountType: 'standalone' } });
}));
router.get('/admin/workspaces/:id/charges', verifySuperAdmin, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const workspace = await TeacherWorkspace.findById(req.params.id);
  if (!workspace?.ownerId) throw fail('Teacher has not accepted the invitation.');
  const db = await getDb(workspace.key), Version = model(db, 'TeacherChargeVersion', teacherChargeVersionSchema);
  const [latest, centers] = await Promise.all([Version.findOne().sort({ effectiveAt: -1, _id: -1 }).lean(), teacherModeModels(db).ManagedCenter.find().select('name archived currency').sort({ name: 1 }).lean()]);
  result(res, { rules: latest?.rules || [], centers, effectiveAt: latest?.effectiveAt || null });
}));
router.put('/admin/workspaces/:id/charges', verifySuperAdmin, handle(async (req, res) => {
  if (!oid(req.params.id) || !Array.isArray(req.body.rules) || req.body.rules.length > 20) throw fail('Provide up to 20 valid charges.');
  const workspace = await TeacherWorkspace.findById(req.params.id);
  if (!workspace?.ownerId) throw fail('Teacher has not accepted the invitation.');
  const db = await getDb(workspace.key), Version = model(db, 'TeacherChargeVersion', teacherChargeVersionSchema);
  const centers = await teacherModeModels(db).ManagedCenter.find().select('_id').lean();
  const allowedCenters = new Set(centers.map(c => String(c._id)));
  const rules = req.body.rules.map(r => {
    const name = text(r.name, 60), kind = r.kind, value = Number(r.value);
    if (!['percent', 'fixed'].includes(kind) || !Number.isSafeInteger(value) || value < 0 || value > 1000000000) throw fail('Invalid charge amount.');
    if (kind === 'percent' && value > 10000) throw fail('A percentage cannot exceed 100%.');
    const currency = kind === 'fixed' ? String(r.currency || '').toUpperCase() : '';
    if (kind === 'fixed' && !/^[A-Z]{3}$/.test(currency)) throw fail('Choose a currency for each fixed charge.');
    if (r.centerIds !== undefined && (!Array.isArray(r.centerIds) || r.centerIds.length > 1000 || r.centerIds.some(id => !oid(String(id)) || !allowedCenters.has(String(id))))) throw fail('Choose centers belonging to this teacher.');
    const centerIds = [...new Set((r.centerIds || []).map(String))];
    return { name, kind, value, currency, centerIds };
  });
  const universal = rules.filter(r => r.kind === 'percent' && !r.centerIds.length).reduce((sum, r) => sum + r.value, 0);
  if (universal > 10000 || centers.some(c => universal + rules.filter(r => r.kind === 'percent' && r.centerIds.includes(String(c._id))).reduce((sum, r) => sum + r.value, 0) > 10000)) throw fail('Percentage charges for a center cannot add up to more than 100%.');
  const saved = await Version.create({ rules, by: String(req.superAdmin._id), effectiveAt: new Date() });
  await writeAuditLog({ action: 'STANDALONE_CHARGES_UPDATED', superAdmin: req.superAdmin, targetId: String(workspace._id), targetName: workspace.name, details: { rules }, ip: req.ip });
  result(res, { rules: saved.rules, effectiveAt: saved.effectiveAt });
}));
router.get('/admin/workspaces/:id/activity', verifySuperAdmin, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const workspace = await TeacherWorkspace.findById(req.params.id);
  if (!workspace?.ownerId) throw fail('Teacher has not accepted the invitation.');
  await attachWorkspace(req, workspace);
  const page = Math.max(1, Math.min(100, Number.parseInt(req.query.page, 10) || 1)), limit = 20;
  const filter = { teacherId: workspace.ownerId };
  const [books, groups, bookingCount, groupCount, centers, pupils] = await Promise.all([
    Booking(req).find(filter).select('classTitle studentId managedCenterId scheduledTime duration status classSummary missedReason').sort({ scheduledTime: -1, _id: -1 }).limit(page * limit).lean(),
    Group(req).find(filter).select('title enrollments.studentId managedCenterId scheduledTime duration status classSummary missedReason').sort({ scheduledTime: -1, _id: -1 }).limit(page * limit).lean(),
    Booking(req).countDocuments(filter), Group(req).countDocuments(filter),
    teacherModeModels(req.db).ManagedCenter.find().select('name').lean(), Student(req).find({ standaloneManaged: true }).select('firstName lastName managedCenterId').lean(),
  ]);
  const items = [...books, ...groups].sort((a, b) => +new Date(b.scheduledTime) - +new Date(a.scheduledTime) || String(b._id).localeCompare(String(a._id))).slice((page - 1) * limit, page * limit);
  result(res, { classes: items, centers, students: pupils, pagination: { page, total: bookingCount + groupCount, totalPages: Math.max(1, Math.ceil((bookingCount + groupCount) / limit)) } });
}));
router.post('/admin/workspaces', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  const address = email(req.body.email), name = text(req.body.name);
  if (await TeacherWorkspace.exists({ email: address })) throw fail('This teacher already has an invitation or workspace.');
  const id = new mongoose.Types.ObjectId(), raw = token();
  const w = await TeacherWorkspace.create({ _id: id, key: `tw-${id}`, email: address, name, invitedBy: req.superAdmin._id, inviteHash: hash(raw), inviteExpires: new Date(Date.now() + 48 * 3600000) });
  try { await sendLink(address, 'Set up your Clemify Teacher Mode account', `${name}, you have been invited to Teacher Mode. This invitation expires in 48 hours.`, `${front()}/teacher-mode/setup/${raw}`); }
  catch (error) { await TeacherWorkspace.deleteOne({ _id: w._id, status: 'invited' }); throw error; }
  result(res, { id: w._id, name, email: address, status: w.status });
}));
router.post('/admin/workspaces/:id/resend', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const raw = token();
  const w = await TeacherWorkspace.findOneAndUpdate({ _id: req.params.id, ownerId: { $exists: false }, status: { $in: ['invited', 'suspended'] } }, { $set: { status: 'invited', inviteHash: hash(raw), inviteExpires: new Date(Date.now() + 48 * 3600000) } }, { new: true });
  if (!w) throw fail('Only pending invitations can be resent.');
  await sendLink(w.email, 'Set up your Clemify Teacher Mode account', 'Your new invitation expires in 48 hours.', `${front()}/teacher-mode/setup/${raw}`);
  result(res, { sent: true });
}));
router.post('/admin/workspaces/:id/revoke-invite', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const w = await TeacherWorkspace.findOneAndUpdate({ _id: req.params.id, status: 'invited', ownerId: { $exists: false } }, { $set: { status: 'suspended' }, $unset: { inviteHash: '', inviteExpires: '' } });
  if (!w) throw fail('This invitation cannot be cancelled.');
  result(res, { revoked: true });
}));
router.post('/admin/workspaces/:id/ai-credits', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const amount = integer(req.body.amount, 1);
  const w = await TeacherWorkspace.findOneAndUpdate({ _id: req.params.id }, { $inc: { 'aiCredits.balance': amount }, $push: { 'aiCredits.log': { $each: [{ amount, note: 'Platform allocation', by: String(req.superAdmin._id), createdAt: new Date() }], $slice: -50 } } }, { new: true });
  if (!w) throw fail('Teacher not found.');
  result(res, { balance: w.aiCredits.balance });
}));
router.patch('/admin/workspaces/:id', verifySuperAdmin, handle(async (req, res) => {
  if (!oid(req.params.id) || !['active', 'suspended'].includes(req.body.status)) throw fail('Invalid status.');
  const w = await TeacherWorkspace.findOne({ _id: req.params.id, ownerId: { $exists: true } });
  if (!w) throw fail('Teacher not found.');
  const db = await getDb(w.key), Teacher = model(db, 'Teacher', teacherSchema);
  const owner = await Teacher.findById(w.ownerId);
  if (!owner) throw fail('Teacher not found.');
  owner.active = req.body.status === 'active';
  if (!owner.active) {
    const ended = await endSessionsAfterPasswordChange(owner, req);
    await notifySessionsRevoked(req.app.get('io'), w.key, owner._id, ended);
  }
  await owner.save(); w.status = req.body.status; await w.save();
  result(res, { status: w.status });
}));
router.get('/admin/workspaces/:id/messages', verifySuperAdmin, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const w = await TeacherWorkspace.findById(req.params.id);
  if (!w?.ownerId) throw fail('Teacher has not accepted the invitation.');
  const M = teacherModeModels(await getDb(w.key)).TeacherConversation;
  await M.updateMany({ studentId: null, sender: 'teacher', readAt: null }, { $set: { readAt: new Date() } });
  result(res, await list(M.find({ studentId: null })));
}));
router.post('/admin/workspaces/:id/messages', verifySuperAdmin, strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid teacher.');
  const w = await TeacherWorkspace.findById(req.params.id);
  if (!w?.ownerId) throw fail('Teacher not found.');
  result(res, await teacherModeModels(await getDb(w.key)).TeacherConversation.create({ sender: 'superadmin', text: text(req.body.text, 3000) }));
}));

router.post('/setup/:token', loginLimiter, handle(async (req, res) => {
  if (!validToken(req.params.token)) throw fail('Invalid or expired invitation.');
  const plain = passwordInput(req.body.password);
  if (req.body.acceptTerms !== true) throw fail('Please accept the terms.');
  const w = await TeacherWorkspace.findOneAndUpdate({ inviteHash: hash(req.params.token), inviteExpires: { $gt: new Date() }, status: 'invited' }, { $set: { status: 'activating' } }, { new: true });
  if (!w) throw fail('Invalid or expired invitation.');
  try {
    const password = await hashPassword(plain);
    const db = await getDb(w.key), Teacher = model(db, 'Teacher', teacherSchema);
    const owner = await Teacher.findOneAndUpdate({ email: w.email }, { $set: { firstName: w.name, lastName: '', password, active: true, status: 'active', continent: 'Asia', accountType: 'standalone', hasAcceptedTerms: true, termsAcceptedAt: new Date() } }, { upsert: true, new: true });
    w.ownerId = owner._id; w.status = 'active'; w.inviteHash = undefined; w.inviteExpires = undefined;
    await w.save(); result(res, { email: w.email });
  } catch (error) { await TeacherWorkspace.updateOne({ _id: w._id, status: 'activating' }, { $set: { status: 'invited' } }); throw error; }
}));
router.post('/login', loginLimiter, handle(async (req, res) => {
  const w = await TeacherWorkspace.findOne({ email: email(req.body.email), status: 'active' });
  if (!w) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  await attachWorkspace(req, w);
  // Keep the existing password, lockout, 2FA and device-session implementation.
  req.url = '/teacher/login';
  authRoutes(req, res, error => { if (error) res.status(500).json({ success: false, message: 'Sign-in failed.' }); });
}));
router.post('/forgot-password', passwordResetLimiter, handle(async (req, res) => {
  const w = await TeacherWorkspace.findOne({ email: email(req.body.email), status: 'active' });
  if (w) {
    const raw = token(); w.resetHash = hash(raw); w.resetExpires = new Date(Date.now() + 3600000); await w.save();
    try { await sendLink(w.email, 'Reset your Teacher Mode password', 'This reset link expires in one hour.', `${front()}/teacher-mode/reset/${raw}`); }
    catch (error) { logger.warn('Standalone password reset email failed', { error: error.message }); }
  }
  result(res, { message: 'If the account exists, a reset link has been sent.' });
}));
router.post('/reset/:token', passwordResetLimiter, handle(async (req, res) => {
  if (!validToken(req.params.token)) throw fail('Invalid reset link.');
  const plain = passwordInput(req.body.password);
  const w = await TeacherWorkspace.findOneAndUpdate({ resetHash: hash(req.params.token), resetExpires: { $gt: new Date() }, status: 'active' }, { $unset: { resetHash: '', resetExpires: '' } });
  if (!w) throw fail('Invalid or expired reset link.');
  const password = await hashPassword(plain);
  const db = await getDb(w.key), owner = await model(db, 'Teacher', teacherSchema).findById(w.ownerId);
  const ended = await endSessionsAfterPasswordChange(owner, req);
  owner.password = password; owner.lastPasswordChange = new Date(); await owner.save();
  await notifySessionsRevoked(req.app.get('io'), w.key, owner._id, ended);
  result(res, { reset: true });
}));

// Family pages use a revocable, recipient/student-scoped grant, never a login.
const family = express.Router({ mergeParams: true });
family.use((req, res, next) => { (async () => {
  if (!validToken(req.params.token)) throw fail('This parent link is invalid.');
  const grant = await TeacherFamilyGrant.findOne({ tokenHash: hash(req.params.token), enabled: true, expiresAt: { $gt: new Date() } });
  if (!grant) return res.status(410).json({ success: false, message: 'This link has expired or was disabled. Please ask your teacher for a new link.' });
  const w = await TeacherWorkspace.findOne({ _id: grant.workspaceId, status: 'active' });
  if (!w) return res.status(410).json({ success: false, message: 'This learning page is unavailable.' });
  await attachWorkspace(req, w); req.familyGrant = grant;
  res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
  // Router continuation is explicit because this wrapper is also used for async handlers.
  next();
})().catch(next); });

// Mount with mergeParams so the opaque token is available in the child router.
const publicFamily = family;
const familyAccess = async (req, res, next) => {
  try {
    const access = req.headers['x-share-access'] || req.query.a;
    const p = jwt.verify(access || '', crypto.createHmac('sha256', config.jwtSecret).update(`family:${req.familyGrant._id}`).digest('hex'), { algorithms: ['HS256'] });
    if (p.hash !== req.familyGrant.tokenHash || p.student !== String(req.familyGrant.studentId)) throw new Error();
    next();
  } catch { res.status(403).json({ success: false, message: 'Please confirm the student name to open this page.' }); }
};
publicFamily.post('/unlock', loginLimiter, handle(async (req, res) => {
  const s = await Student(req).findById(req.familyGrant.studentId).select('firstName lastName');
  if (!s) throw fail('Student not found.');
  const supplied = normalizeName(text(req.body.studentName)).sort().join(' ');
  if (![s.firstName, `${s.firstName} ${s.lastName}`].some(n => normalizeName(n).sort().join(' ') === supplied)) return res.status(403).json({ success: false, message: 'The student name does not match.' });
  const access = jwt.sign({ student: String(s._id), hash: req.familyGrant.tokenHash }, crypto.createHmac('sha256', config.jwtSecret).update(`family:${req.familyGrant._id}`).digest('hex'), { expiresIn: '2h', algorithm: 'HS256' });
  result(res, { access });
}));
publicFamily.use(familyAccess);
publicFamily.get('/schedule', handle(async (req, res) => {
  const studentId = req.familyGrant.studentId, page = Math.max(1, Math.min(100, Number.parseInt(req.query.page, 10) || 1)), limit = 20;
  const completionFilter = req.query.view === 'completed' ? { status: 'completed' } : {};
  const dayStart = req.query.dayStart ? new Date(req.query.dayStart) : new Date(new Date().toISOString().slice(0, 10));
  if (isNaN(dayStart)) throw fail('Invalid date.');
  const dateFilter = req.query.view === 'upcoming' ? { scheduledTime: { $gte: dayStart } } : req.query.view === 'previous' ? { scheduledTime: { $lt: dayStart } } : {};
  const direction = req.query.view === 'upcoming' ? 1 : -1;
  const singleFilter = { studentId, teacherId: req.teacherWorkspace.ownerId, managedCenterId: { $exists: true }, ...completionFilter, ...dateFilter };
  const groupFilter = { 'enrollments.studentId': studentId, teacherId: req.teacherWorkspace.ownerId, managedCenterId: { $exists: true }, ...completionFilter, ...dateFilter };
  const [singles, groups, a, b] = await Promise.all([
    Booking(req).find(singleFilter).select('classTitle scheduledTime duration status parentAbsenceAt').sort({ scheduledTime: direction, _id: direction }).limit(page * limit).lean(),
    Group(req).find(groupFilter).select('title scheduledTime duration status enrollments.studentId enrollments.attendance enrollments.absenceReportedAt').sort({ scheduledTime: direction, _id: direction }).limit(page * limit).lean(),
    Booking(req).countDocuments(singleFilter), Group(req).countDocuments(groupFilter),
  ]);
  const classes = [...singles.map(c => ({ id: c._id, title: c.classTitle, scheduledTime: c.scheduledTime, duration: c.duration, status: c.status, absent: !!c.parentAbsenceAt, group: false })), ...groups.map(c => { const enrollment = c.enrollments.find(e => String(e.studentId) === String(studentId)); return { id: c._id, title: c.title, scheduledTime: c.scheduledTime, duration: c.duration, status: c.status, absent: !!enrollment?.absenceReportedAt, group: true }; })].sort((x, y) => direction * (+new Date(x.scheduledTime) - +new Date(y.scheduledTime) || String(x.id).localeCompare(String(y.id))));
  const pageClasses = classes.slice((page - 1) * limit, page * limit);
  const ids = pageClasses.map(c => c.id);
  const [updates, recordings, sharedLinks, singleReviews, groupReviews] = await Promise.all([
    teacherModeModels(req.db).TeacherWork.find({ studentId, bookingId: { $in: ids }, published: true }).select('bookingId summary').lean(),
    model(req.db, 'Recording', recordingSchema).find({ teacherId: req.teacherWorkspace.ownerId, visibleToStudent: true, $or: [{ bookingId: { $in: ids } }, { groupClassId: { $in: ids } }], $and: [{ $or: [{ autoDeleteAt: { $exists: false } }, { autoDeleteAt: null }, { autoDeleteAt: { $gt: new Date() } }] }] }).select('bookingId groupClassId').lean(),
    model(req.db, 'RecordingLink', recordingLinkSchema).find({ studentId, teacherId: req.teacherWorkspace.ownerId, enabled: true, purgeAt: { $gt: new Date() }, 'shareLink.tokenEnc': { $exists: true, $ne: null }, $or: [{ bookingId: { $in: ids } }, { groupClassId: { $in: ids } }] }).select('bookingId groupClassId createdAt').lean(),
    model(req.db, 'Review', reviewSchema).find({ studentId, teacherId: req.teacherWorkspace.ownerId, bookingId: { $in: ids } }).select('bookingId rating comment').lean(),
    model(req.db, 'StandaloneGroupReview', standaloneGroupReviewSchema).find({ studentId, teacherId: req.teacherWorkspace.ownerId, groupClassId: { $in: ids } }).select('groupClassId rating comment').lean(),
  ]);
  const activeLinks = (await Promise.all(sharedLinks.map(async link => { const expiry = await recordingLinkExpiry(req.db, link); return expiry && expiry > new Date() ? link : null; }))).filter(Boolean);
  result(res, { classes: pageClasses.map(c => { const ownReview = (c.group ? groupReviews : singleReviews).find(r => String(c.group ? r.groupClassId : r.bookingId) === String(c.id)); return { ...c, hasReview: updates.some(w => String(w.bookingId) === String(c.id) && !!w.summary), hasRecordings: [...recordings, ...activeLinks].some(r => String(r.bookingId || r.groupClassId) === String(c.id)), parentReview: ownReview ? { rating: ownReview.rating, comment: ownReview.comment } : null }; }), page, totalPages: Math.max(1, Math.ceil((a + b) / limit)) });
}));
publicFamily.post('/schedule/:id/review', strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id) || typeof req.body.group !== 'boolean' || !Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) throw fail('Choose a rating from 1 to 5.');
  const studentId = req.familyGrant.studentId, teacherId = req.teacherWorkspace.ownerId, group = req.body.group;
  const lesson = group ? await Group(req).findOne({ _id: req.params.id, teacherId, 'enrollments.studentId': studentId, status: 'completed' }).lean() : await Booking(req).findOne({ _id: req.params.id, studentId, teacherId, status: 'completed', adminRejected: { $ne: true } }).lean();
  if (!lesson) return res.status(404).json({ success: false, message: 'Completed class not found.' });
  const comment = typeof req.body.comment === 'string' && req.body.comment.trim() ? text(req.body.comment, 1000) : '';
  const Review = group ? model(req.db, 'StandaloneGroupReview', standaloneGroupReviewSchema) : model(req.db, 'Review', reviewSchema);
  const key = group ? { groupClassId: lesson._id, studentId } : { bookingId: lesson._id, studentId };
  const saved = await Review.findOneAndUpdate(key, { $set: { rating: req.body.rating, comment }, $setOnInsert: { teacherId } }, { upsert: true, new: true, runValidators: true });
  result(res, { rating: saved.rating, comment: saved.comment });
}));
publicFamily.get('/schedule/:id/materials', handle(async (req, res) => {
  if (!oid(req.params.id) || !['true', 'false'].includes(req.query.group)) throw fail('Invalid lesson.');
  const studentId = req.familyGrant.studentId, teacherId = req.teacherWorkspace.ownerId, group = req.query.group === 'true';
  const lesson = group ? await Group(req).findOne({ _id: req.params.id, teacherId, 'enrollments.studentId': studentId }).lean() : await Booking(req).findOne({ _id: req.params.id, studentId, teacherId }).lean();
  if (!lesson) return res.status(404).json({ success: false, message: 'Class not found.' });
  const [update, recordings, sharedLink] = await Promise.all([
    teacherModeModels(req.db).TeacherWork.findOne({ bookingId: lesson._id, studentId, published: true }).select('summary').lean(),
    model(req.db, 'Recording', recordingSchema).find({ teacherId, visibleToStudent: true, [group ? 'groupClassId' : 'bookingId']: lesson._id }).select('title filename externalUrl source autoDeleteAt sessionId partNumber startOffset duration createdAt').sort({ createdAt: 1, partNumber: 1 }).lean(),
    model(req.db, 'RecordingLink', recordingLinkSchema).findOne({ teacherId, studentId, enabled: true, purgeAt: { $gt: new Date() }, [group ? 'groupClassId' : 'bookingId']: lesson._id }).select('+shareLink.tokenEnc bookingId groupClassId createdAt').lean(),
  ]);
  const files = [];
  for (const r of recordings) {
    if (r.autoDeleteAt && r.autoDeleteAt <= new Date()) continue;
    files.push({ id: r._id, title: r.title || 'Class recording', source: r.source, sessionId: r.sessionId, partNumber: r.partNumber, startOffset: r.startOffset, duration: r.duration, url: r.externalUrl || (r.filename?.startsWith('centers/') ? await getPresignedUrl(r.filename, 10800) : null), local: !r.externalUrl && !r.filename?.startsWith('centers/') });
  }
  if (!files.length && sharedLink?.shareLink?.tokenEnc) {
    const expires = await recordingLinkExpiry(req.db, sharedLink);
    if (expires && expires > new Date()) {
      try { files.push({ id: sharedLink._id, title: 'Shared class recording', source: 'external', url: `${front()}/rv/${decrypt(sharedLink.shareLink.tokenEnc)}?workspace=${encodeURIComponent(req.teacherWorkspace.key)}`, local: false }); } catch { /* An unreadable token is not shareable. */ }
    }
  }
  result(res, { review: update?.summary || '', recordings: files });
}));
publicFamily.get('/schedule/:id/join', handle(async (req, res) => {
  if (!oid(req.params.id) || !['true', 'false'].includes(req.query.group)) throw fail('Invalid lesson.');
  const studentId = req.familyGrant.studentId, teacherId = req.teacherWorkspace.ownerId, group = req.query.group === 'true';
  const lesson = group
    ? await Group(req).findOne({ _id: req.params.id, teacherId, status: { $in: ['open', 'full', 'in-progress'] }, enrollments: { $elemMatch: { studentId, attendance: { $ne: 'absent' } } } }).lean()
    : await Booking(req).findOne({ _id: req.params.id, studentId, teacherId, status: { $in: ['accepted', 'pending'] } }).lean();
  if (!lesson) return res.status(404).json({ success: false, message: 'This class is not available to join.' });
  if (Date.now() >= +new Date(lesson.scheduledTime) + (lesson.duration || 60) * 60000) return res.status(404).json({ success: false, message: 'This class has already ended.' });
  const teacher = await model(req.db, 'Teacher', teacherSchema).findById(teacherId).select('googleMeetLink zoomLink').lean();
  const center = await teacherModeModels(req.db).ManagedCenter.findById(lesson.managedCenterId).select('meetingUrl').lean();
  const session = group ? null : await model(req.db, 'ClassroomSession', classroomSessionSchema).findOne({ bookingId: lesson._id }).select('videoProvider').lean();
  const provider = group ? lesson.platform : session?.videoProvider;
  if (!['googlemeet', 'zoom'].includes(provider)) return result(res, { ready: false, message: 'Your teacher has not opened a Google Meet or Zoom classroom yet. Please check again when class starts.' });
  const preferred = group ? lesson.meetingLink : center?.meetingUrl;
  const matchesProvider = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (provider === 'googlemeet' ? u.hostname === 'meet.google.com' : /(^|\.)zoom\.(us|com)$/i.test(u.hostname)); } catch { return false; } };
  const candidate = matchesProvider(preferred) ? preferred : provider === 'googlemeet' ? teacher?.googleMeetLink : teacher?.zoomLink;
  if (!matchesProvider(candidate)) return result(res, { ready: false, message: 'Your teacher has not added a meeting link yet. Please contact your teacher.' });
  result(res, { ready: true, provider, url: candidate });
}));
publicFamily.post('/schedule/:id/absence', strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id) || typeof req.body.group !== 'boolean') throw fail('Invalid lesson.');
  const reason = typeof req.body.reason === 'string' && req.body.reason.trim() ? text(req.body.reason, 500) : '';
  const now = new Date(), studentId = req.familyGrant.studentId, teacherId = req.teacherWorkspace.ownerId;
  let lesson;
  if (req.body.group) {
    lesson = await Group(req).findOneAndUpdate({ _id: req.params.id, teacherId, scheduledTime: { $gt: now }, status: { $in: ['open', 'full'] }, enrollments: { $elemMatch: { studentId, absenceReportedAt: { $exists: false } } } }, { $set: { 'enrollments.$.attendance': 'absent', 'enrollments.$.absenceReason': reason, 'enrollments.$.absenceReportedAt': now } }, { new: true });
  } else {
    lesson = await Booking(req).findOneAndUpdate({ _id: req.params.id, studentId, teacherId, scheduledTime: { $gt: now }, status: { $in: ['accepted', 'pending'] } }, { $set: { status: 'cancelled', cancelledAt: now, parentAbsenceAt: now, parentAbsenceReason: reason } }, { new: true });
  }
  if (!lesson) return res.status(409).json({ success: false, message: 'This class cannot be changed or the absence was already reported.' });
  const student = await Student(req).findById(studentId).select('firstName lastName').lean();
  const title = lesson.classTitle || lesson.title, name = `${student?.firstName || 'Student'} ${student?.lastName || ''}`.trim();
  const message = `${name} will be absent from ${title} on ${new Date(lesson.scheduledTime).toISOString()}.${reason ? ` Reason: ${reason}` : ''}${req.body.group ? ' The group class remains scheduled.' : ' The class was cancelled.'}`;
  await teacherModeModels(req.db).TeacherConversation.create({ studentId, sender: 'family', text: message });
  let emailSent = false;
  try { const sent = await sendEmail({ to: req.teacherWorkspace.email, subject: 'Student absence notification', html: `<p>${esc(message)}</p>` }); emailSent = sent?.success === true && !sent.skipped; } catch { /* The in-app notice remains available. */ }
  result(res, { reported: true, emailSent });
}));
publicFamily.get('/', handle(async (req, res) => {
  const studentId = req.familyGrant.studentId, db = req.db, M = teacherModeModels(db);
  const s = await Student(req).findById(studentId).select('firstName lastName managedCenterId classCredits standaloneClassTracking prepaidCredits').lean();
  if (!s) throw fail('Student not found.');
  const c = await M.ManagedCenter.findById(s.managedCenterId).select('name').lean();
  const work = await list(M.TeacherWork.find({ studentId, published: true }));
  const classFilter = { _id: { $in: work.map(w => w.bookingId) } };
  const bookings = [...await Booking(req).find(classFilter).select('scheduledTime duration status').lean(), ...(await Group(req).find(classFilter).select('scheduledTime duration status').lean()).map(g => ({ ...g, isGroupClass: true }))];
  const reviews = await model(db, 'Review', reviewSchema).find({ studentId }).select('bookingId rating comment').lean();
  const publicWork = work.map(w => ({ ...w, class: bookings.find(b => String(b._id) === String(w.bookingId)), review: reviews.find(r => String(r.bookingId) === String(w.bookingId)) }));
  const activities = [];
  for (const [name, schema, kind] of [['Homework', homeworkSchema, 'hw'], ['Quiz', quizSchema, 'q']]) {
    const docs = await model(db, name, schema).find({ studentId, teacherId: req.teacherWorkspace.ownerId, 'shareLink.tokenEnc': { $exists: true, $ne: null } }).select('+shareLink.tokenEnc title dueDate status grade.score grade.feedback grade.gradedAt submission.submittedAt').sort({ createdAt: -1, _id: -1 }).limit(100).lean();
    const attempts = kind === 'q' ? await model(db, 'QuizAttempt', quizAttemptSchema).find({ quizId: { $in: docs.map(d => d._id) }, studentId, teacherId: req.teacherWorkspace.ownerId }).select('quizId score totalQuestions percentage submittedAt').lean() : [];
    for (const d of docs) {
      let raw; try { raw = d.shareLink?.tokenEnc && decrypt(d.shareLink.tokenEnc); } catch { continue; }
      if (!raw) continue;
      const expiresAt = linkExpiresAt(d.dueDate, req.center?.timezone);
      const attempt = attempts.find(a => String(a.quizId) === String(d._id));
      activities.push({ id: d._id, title: d.title, kind, dueDate: d.dueDate, status: d.status, expiresAt,
        url: expiresAt > new Date() ? `/${kind}/${raw}?workspace=${encodeURIComponent(req.teacherWorkspace.key)}` : null,
        ...(kind === 'hw' && d.status === 'graded' ? { grade: { score: d.grade?.score ?? null, feedback: d.grade?.feedback || '', gradedAt: d.grade?.gradedAt } } : {}),
        ...(kind === 'q' && attempt ? { result: { score: attempt.score, totalQuestions: attempt.totalQuestions, percentage: attempt.percentage, submittedAt: attempt.submittedAt } } : {}),
      });
    }
  }
  const gameLinks = await model(db, 'GameLink', gameLinkSchema).find({ studentId, enabled: { $ne: false } }).select('+shareLink.tokenEnc').limit(100).lean();
  for (const g of gameLinks) {
    if (g.shareLink?.tokenEnc) activities.push({ id: g._id, title: 'Assigned learning game', kind: 'g', url: `/g/${decrypt(g.shareLink.tokenEnc)}?workspace=${req.teacherWorkspace.key}` });
  }
  const owner = await model(db, 'Teacher', teacherSchema).findById(req.teacherWorkspace.ownerId).select('firstName lastName displayName').lean();
  const teacherName = owner?.displayName || `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || req.teacherWorkspace.name;
  result(res, { student: { firstName: s.firstName, lastName: s.lastName, managedCenterId: s.managedCenterId, classesRemaining: s.standaloneClassTracking || s.prepaidCredits ? Math.max(0, s.classCredits || 0) : null }, center: c?.name, teacher: teacherName, work: publicWork, activities, messages: await list(M.TeacherConversation.find({ studentId })) });
}));
publicFamily.get('/work', handle(async (req, res) => {
  const page = Math.max(1, Math.min(parseInt(req.query.page, 10) || 1, 100000));
  const limit = 2, studentId = req.familyGrant.studentId;
  const work = await teacherModeModels(req.db).TeacherWork.find({ studentId, published: true }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit + 1).lean();
  const hasMore = work.length > limit;
  const items = work.slice(0, limit);
  const classFilter = { _id: { $in: items.map(w => w.bookingId) } };
  const bookings = [...await Booking(req).find(classFilter).select('scheduledTime duration status').lean(), ...(await Group(req).find(classFilter).select('scheduledTime duration status').lean()).map(g => ({ ...g, isGroupClass: true }))];
  result(res, { items: items.map(w => ({ ...w, class: bookings.find(b => String(b._id) === String(w.bookingId)) })), page, hasMore });
}));
publicFamily.post('/messages', handle(async (req, res) => result(res, await teacherModeModels(req.db).TeacherConversation.create({ studentId: req.familyGrant.studentId, sender: 'family', text: text(req.body.text, 3000) }))));
publicFamily.post('/work/:id/review', strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id) || !Number.isInteger(req.body.rating) || req.body.rating < 1 || req.body.rating > 5) throw fail('Choose a rating from 1 to 5.');
  const work = await teacherModeModels(req.db).TeacherWork.findOne({ _id: req.params.id, studentId: req.familyGrant.studentId, published: true }).lean();
  const booking = work && await Booking(req).findOne({ _id: work.bookingId, studentId: req.familyGrant.studentId, status: 'completed' }).lean();
  if (!booking) throw fail('Only a published completed individual lesson can be reviewed.');
  const comment = req.body.comment ? text(req.body.comment, 1000) : '';
  const review = await model(req.db, 'Review', reviewSchema).findOneAndUpdate({ bookingId: booking._id, studentId: booking.studentId }, { $set: { rating: req.body.rating, comment }, $setOnInsert: { teacherId: booking.teacherId } }, { upsert: true, new: true, runValidators: true });
  result(res, { rating: review.rating, comment: review.comment });
}));
publicFamily.post('/work/:id/attendance', handle(async (req, res) => {
  if (!oid(req.params.id) || !['yes', 'no'].includes(req.body.attended)) throw fail('Invalid response.');
  const w = await teacherModeModels(req.db).TeacherWork.findOneAndUpdate({ _id: req.params.id, studentId: req.familyGrant.studentId, published: true }, { $set: { attended: req.body.attended, parentComment: req.body.comment ? text(req.body.comment, 1000) : '' } }, { new: true });
  if (!w) throw fail('Class update not found.');
  result(res, { attended: w.attended });
}));
publicFamily.get('/recordings', handle(async (req, res) => {
  const studentId = req.familyGrant.studentId, teacherId = req.teacherWorkspace.ownerId;
  const [bookingIds, groupIds] = await Promise.all([
    Booking(req).distinct('_id', { studentId, teacherId }),
    Group(req).distinct('_id', { teacherId, 'enrollments.studentId': studentId }),
  ]);
  const Recording = model(req.db, 'Recording', recordingSchema);
  const filter = { teacherId, visibleToStudent: true, $or: [{ bookingId: { $in: bookingIds } }, { groupClassId: { $in: groupIds } }], $and: [{ $or: [{ autoDeleteAt: { $exists: false } }, { autoDeleteAt: null }, { autoDeleteAt: { $gt: new Date() } }] }] };
  const paged = req.query.page !== undefined;
  let hasMore = false, recordings;
  if (paged) {
    const page = Math.max(1, Math.min(parseInt(req.query.page, 10) || 1, 100000));
    const groups = await Recording.aggregate([{ $match: filter }, { $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: { $cond: [{ $ifNull: ['$sessionId', false] }, { $concat: ['session:', '$sessionId'] }, { $concat: ['file:', { $toString: '$_id' }] }] }, newest: { $first: '$createdAt' }, newestId: { $first: '$_id' }, parts: { $push: '$$ROOT' } } }, { $sort: { newest: -1, newestId: -1 } }, { $skip: (page - 1) * 2 }, { $limit: 3 }]);
    hasMore = groups.length > 2;
    recordings = groups.slice(0, 2).flatMap(g => g.parts);
  } else recordings = await Recording.find(filter).select('title filename externalUrl source createdAt autoDeleteAt bookingId groupClassId sessionId partNumber startOffset duration').sort({ createdAt: -1, _id: -1 }).limit(100).lean();
  const files = [];
  for (const r of recordings) {
    if (r.autoDeleteAt && r.autoDeleteAt <= new Date()) continue;
    files.push({ id: r._id, title: r.title || 'Class recording', source: r.source, sessionId: r.sessionId, partNumber: r.partNumber, startOffset: r.startOffset, duration: r.duration, createdAt: r.createdAt, url: r.externalUrl || (r.filename?.startsWith('centers/') ? await getPresignedUrl(r.filename, 10800) : null), local: !r.externalUrl && !r.filename?.startsWith('centers/') });
  }
  result(res, paged ? { items: files, hasMore } : files);
}));
publicFamily.get('/work/:id/recordings', handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid class update.');
  const work = await teacherModeModels(req.db).TeacherWork.findOne({ _id: req.params.id, studentId: req.familyGrant.studentId, published: true });
  if (!work) throw fail('Class update not found.');
  const recordings = await model(req.db, 'Recording', recordingSchema).find({ $or: [{ bookingId: work.bookingId }, { groupClassId: work.bookingId }], visibleToStudent: true }).select('title filename externalUrl source createdAt autoDeleteAt').lean();
  const files = [];
  for (const r of recordings) {
    if (r.autoDeleteAt && r.autoDeleteAt <= new Date()) continue;
    files.push({ id: r._id, title: r.title, url: r.externalUrl || (r.filename?.startsWith('centers/') ? await getPresignedUrl(r.filename, 300) : null), local: !r.externalUrl && !r.filename?.startsWith('centers/') });
  }
  result(res, files);
}));
publicFamily.get('/recordings/:id', handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid recording.');
  const r = await model(req.db, 'Recording', recordingSchema).findOne({ _id: req.params.id, visibleToStudent: true });
  if (!r || String(r.teacherId) !== String(req.teacherWorkspace.ownerId) || r.externalUrl || r.filename?.startsWith('centers/') || (r.autoDeleteAt && r.autoDeleteAt <= new Date())) return res.status(404).end();
  const allowed = r.bookingId ? await Booking(req).exists({ _id: r.bookingId, studentId: req.familyGrant.studentId, teacherId: req.teacherWorkspace.ownerId }) : r.groupClassId && await Group(req).exists({ _id: r.groupClassId, teacherId: req.teacherWorkspace.ownerId, 'enrollments.studentId': req.familyGrant.studentId });
  if (!allowed) return res.status(404).end();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/recordings');
  return sendVideoFile(req, res, path.join(root, path.basename(r.filename)), r.mimeType || 'video/webm');
}));
router.use('/family/:token', publicFamily);

app.get('/workspace', handle(async (req, res) => result(res, { name: req.teacherWorkspace.name, email: req.teacherWorkspace.email, key: req.teacherWorkspace.key, teacherId: req.user.id })));
app.use(teacherModeResourceRoutes);
app.use(teacherModeLinkRoutes);
app.get('/managed-centers', handle(async (req, res) => result(res, await list(teacherModeModels(req.db).ManagedCenter.find()))));
const centerFields = (body, current = {}) => {
  const salaryDay = body.salaryDay === undefined ? (current.salaryDay || 31) : integer(body.salaryDay, 1);
  if (salaryDay > 31) throw fail('Salary day must be between 1 and 31.');
  const c = { name: text(body.name), currency: text(body.currency || 'USD', 3).toUpperCase(), payBasis: body.payBasis, rateMinor: integer(body.rateMinor), prepaid: body.prepaid === true, meetingUrl: safeUrl(body.meetingUrl), salaryDay };
  if (!['USD', 'EUR', 'GBP', 'VND', 'JPY', 'CAD', 'AUD', 'PHP'].includes(c.currency) || !['class', 'hour'].includes(c.payBasis)) throw fail('Invalid currency or pay basis.');
  return c;
};
app.post('/managed-centers', handle(async (req, res) => result(res, await teacherModeModels(req.db).ManagedCenter.create(centerFields(req.body)))));
app.put('/managed-centers/:id', handle(async (req, res) => {
  const c = await getCenter(req, req.params.id, false);
  c.set(centerFields(req.body, c)); c.archived = req.body.archived === true; await c.save();
  await Student(req).updateMany({ managedCenterId: c._id }, { $set: { prepaidCredits: c.prepaid } });
  result(res, c);
}));
app.get('/managed-students', handle(async (req, res) => {
  const filter = {};
  if (req.query.centerId) filter.managedCenterId = (await getCenter(req, req.query.centerId, false))._id;
  const students = await Student(req).find(filter).select('firstName lastName managedCenterId classCredits standaloneClassTracking prepaidCredits active +notifyEmail').sort({ createdAt: -1, _id: -1 }).limit(1000).lean();
  const grants = await TeacherFamilyGrant.find({ workspaceId: req.teacherWorkspace._id, enabled: true, expiresAt: { $gt: new Date() } }).select('+tokenEnc').lean();
  result(res, students.map(s => ({ ...s, parentLink: grants.find(g => String(g.studentId) === String(s._id))?.tokenEnc ? `${front()}/teacher-mode/family/${decrypt(grants.find(g => String(g.studentId) === String(s._id)).tokenEnc)}` : null })));
}));
app.post('/managed-students', handle(async (req, res) => {
  if (await Student(req).countDocuments() >= 1000) throw fail('This workspace has reached its 1,000 student allowance.');
  const c = await getCenter(req, req.body.centerId), name = text(req.body.name), notifyEmail = req.body.notifyEmail ? email(req.body.notifyEmail) : '';
  const tracked = req.body.classCount !== undefined && req.body.classCount !== null;
  const classCredits = tracked ? integer(req.body.classCount) : 0;
  const student = await Student(req).create({ firstName: name, lastName: '', email: makeManagedEmail(), studentId: await generateStudentId(Student(req)), isManaged: true, standaloneManaged: true, standaloneClassTracking: tracked, classCredits, prepaidCredits: c.prepaid, managedCenterId: c._id, active: true, status: 'active', hasAcceptedTerms: true, ringEnabled: false, notifyEmail });
  await model(req.db, 'Assignment', assignmentSchema).create({ teacherId: req.user.id, studentId: student._id });
  const raw = token();
  await TeacherFamilyGrant.create({ workspaceId: req.teacherWorkspace._id, studentId: student._id, tokenHash: hash(raw), tokenEnc: encrypt(raw), expiresAt: new Date(Date.now() + 365 * 86400000) });
  result(res, { id: student._id, parentLink: `${front()}/teacher-mode/family/${raw}` });
}));
app.patch('/managed-students/:id', handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid student.');
  const s = await Student(req).findOne({ _id: req.params.id, standaloneManaged: true });
  if (!s) throw fail('Student not found.');
  if (req.body.name !== undefined) s.firstName = text(req.body.name);
  if (req.body.notifyEmail !== undefined) s.notifyEmail = req.body.notifyEmail ? email(req.body.notifyEmail) : '';
  if (req.body.active !== undefined) s.active = req.body.active === true;
  if (req.body.classCount !== undefined) { s.classCredits = integer(req.body.classCount); s.standaloneClassTracking = true; }
  if (req.body.addCredits !== undefined) { s.classCredits += integer(req.body.addCredits, 1); s.active = true; }
  await s.save(); result(res, { saved: true });
}));
app.post('/managed-students/:id/parent-link', handle(async (req, res) => {
  if (!oid(req.params.id) || !await Student(req).exists({ _id: req.params.id, standaloneManaged: true })) throw fail('Student not found.');
  await TeacherFamilyGrant.updateMany({ workspaceId: req.teacherWorkspace._id, studentId: req.params.id }, { $set: { enabled: false } });
  if (req.body.revoke === true) return result(res, { revoked: true });
  const raw = token();
  await TeacherFamilyGrant.create({ workspaceId: req.teacherWorkspace._id, studentId: req.params.id, tokenHash: hash(raw), tokenEnc: encrypt(raw), expiresAt: new Date(Date.now() + 365 * 86400000) });
  result(res, { url: `${front()}/teacher-mode/family/${raw}` });
}));
app.post('/managed-students/:id/email-link', strictLimiter, handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid student.');
  const s = await Student(req).findById(req.params.id).select('+notifyEmail');
  const g = await TeacherFamilyGrant.findOne({ workspaceId: req.teacherWorkspace._id, studentId: req.params.id, enabled: true, expiresAt: { $gt: new Date() } }).select('+tokenEnc');
  if (!s?.notifyEmail || !g) throw fail('Add a family email and create a parent link first.');
  await sendLink(s.notifyEmail, 'Your child’s learning updates', `${req.teacherWorkspace.name} has shared a private learning page for ${s.firstName}. Confirm your child's name to open it.`, `${front()}/teacher-mode/family/${decrypt(g.tokenEnc)}`);
  result(res, { sent: true });
}));

app.get('/work', handle(async (req, res) => {
  const filter = req.query.centerId ? { managedCenterId: (await getCenter(req, req.query.centerId, false))._id } : {};
  const books = [...await list(Booking(req).find(filter).populate('studentId', 'firstName lastName')), ...await list(Group(req).find(filter).populate('enrollments.studentId', 'firstName lastName'))];
  const updates = await list(teacherModeModels(req.db).TeacherWork.find());
  result(res, books.map(b => ({ ...b, ...(b.enrollments ? { isGroupClass: true, classTitle: b.title, studentId: { firstName: `${b.enrollments.length} students` } } : {}), update: updates.find(u => String(u.bookingId) === String(b._id)) })).sort((a, b) => +new Date(b.scheduledTime) - +new Date(a.scheduledTime)));
}));
// Serialize scheduling within this workspace, including requests from other API
// workers. Every class creation below holds this short-lived master-DB lease.
app.use('/work', (req, res, next) => { if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) return next(); (async () => {
  const lock = token(), now = new Date();
  const acquired = await TeacherWorkspace.findOneAndUpdate({ _id: req.teacherWorkspace._id, $or: [{ scheduleLockUntil: { $lt: now } }, { scheduleLockUntil: null }] }, { $set: { scheduleLock: lock, scheduleLockUntil: new Date(+now + 30000) } });
  if (!acquired) return res.status(409).json({ success: false, message: 'Another lesson is being saved. Please retry.' });
  req.scheduleLease = lock;
  const release = () => TeacherWorkspace.updateOne({ _id: req.teacherWorkspace._id, scheduleLock: lock }, { $unset: { scheduleLock: '', scheduleLockUntil: '' } }).catch(() => {});
  res.once('finish', release); next();
})().catch(next); });
app.post('/work', handle(async (req, res) => {
  const c = await getCenter(req, req.body.centerId);
  const ids = req.body.group === true ? [...new Set(req.body.studentIds || [])] : [req.body.studentId];
  if (!ids.length || ids.length > 20 || ids.some(id => !oid(id)) || (req.body.group === true && ids.length < 2)) throw fail('Choose valid students (2–20 for a group).');
  const pupils = await Student(req).find({ _id: { $in: ids }, managedCenterId: c._id, active: true });
  if (pupils.length !== ids.length) throw fail('Choose active students from this center.');
  const s = pupils[0];
  const date = new Date(req.body.scheduledTime), duration = integer(req.body.duration, 15);
  if (isNaN(date) || duration > 180) throw fail('Choose a valid class date and duration.');
  const end = new Date(+date + duration * 60000);
  const clashFilter = { teacherId: req.user.id, status: { $in: ['accepted', 'pending', 'open', 'full', 'in-progress'] }, scheduledTime: { $lt: end, $gt: new Date(+date - 300 * 60000) } };
  const clashes = [...await Booking(req).find(clashFilter).select('scheduledTime duration').lean(), ...await Group(req).find(clashFilter).select('scheduledTime duration').lean()];
  if (clashes.some(b => +new Date(b.scheduledTime) + b.duration * 60000 > +date)) throw fail('This overlaps another class, possibly at a different center.');
  const amountMinor = Math.round(c.rateMinor * (c.payBasis === 'hour' ? duration / 60 : 1));
  if (req.body.group === true) {
    let platform = 'agora';
    if (c.meetingUrl) { const host = new URL(c.meetingUrl).hostname; if (host === 'meet.google.com') platform = 'googlemeet'; else if (/(^|\.)zoom\.(us|com)$/i.test(host)) platform = 'zoom'; }
    const group = await Group(req).create({ teacherId: req.user.id, managedCenterId: c._id, title: text(req.body.title, 200), description: req.body.topic ? text(req.body.topic, 2000) : '', scheduledTime: date, duration, status: 'open', platform, meetingLink: platform === 'agora' ? '' : c.meetingUrl, enrollmentMode: 'invite-only', maxSeats: ids.length, paymentType: 'credits', enrollments: ids.map(studentId => ({ studentId, creditCharged: 0, pointsCharged: 0 })), standalonePay: { currency: c.currency, basis: c.payBasis, rateMinor: c.rateMinor, amountMinor, credits: c.prepaid } });
    await teacherModeModels(req.db).TeacherWork.insertMany(ids.map(studentId => ({ centerId: c._id, studentId, bookingId: group._id, title: group.title })));
    return result(res, group);
  }
  const b = await Booking(req).create({ teacherId: req.user.id, studentId: s._id, managedCenterId: c._id, classTitle: text(req.body.title, 200), topic: req.body.topic ? text(req.body.topic, 200) : '', scheduledTime: date, duration, status: 'accepted', createdBy: 'teacher', standalonePay: { currency: c.currency, basis: c.payBasis, rateMinor: c.rateMinor, amountMinor, credits: c.prepaid } });
  await teacherModeModels(req.db).TeacherWork.create({ centerId: c._id, studentId: s._id, bookingId: b._id, title: b.classTitle });
  result(res, b);
}));
app.patch('/work/:id', handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid class.');
  const b = await Booking(req).findOne({ _id: req.params.id, teacherId: req.user.id, managedCenterId: { $exists: true } }) || await Group(req).findOne({ _id: req.params.id, teacherId: req.user.id, managedCenterId: { $exists: true } });
  if (!b) throw fail('Class not found.');
  if (req.body.action !== undefined) {
    if (!['cancel', 'missed', 'edit'].includes(req.body.action)) throw fail('Invalid lesson action.');
    if (!['accepted', 'open', 'full', 'missed'].includes(b.status)) throw fail('Finish the active lesson before changing it.');
    const Class = b.enrollments ? Group(req) : Booking(req);
    if (req.body.action === 'edit') {
      const scheduledTime = new Date(req.body.scheduledTime), duration = integer(req.body.duration, 15);
      if (isNaN(scheduledTime) || duration > 180) throw fail('Choose a valid date and duration.');
      const end = new Date(+scheduledTime + duration * 60000);
      const filter = { _id: { $ne: b._id }, teacherId: req.user.id, status: { $in: ['accepted', 'pending', 'open', 'full', 'in-progress'] }, scheduledTime: { $lt: end, $gt: new Date(+scheduledTime - 300 * 60000) } };
      const others = [...await Booking(req).find(filter).select('scheduledTime duration').lean(), ...await Group(req).find(filter).select('scheduledTime duration').lean()];
      if (others.some(c => +new Date(c.scheduledTime) + c.duration * 60000 > +scheduledTime)) throw fail('This overlaps another lesson.');
      const title = text(req.body.title, 200);
      await Class.updateOne({ _id: b._id, status: b.status }, { $set: { [b.enrollments ? 'title' : 'classTitle']: title, scheduledTime, duration,
        'standalonePay.amountMinor': Math.round(b.standalonePay.rateMinor * (b.standalonePay.basis === 'hour' ? duration / 60 : 1)) } });
      await teacherModeModels(req.db).TeacherWork.updateMany({ bookingId: b._id }, { $set: { title } });
    } else {
      const status = req.body.action === 'cancel' ? 'cancelled' : 'missed';
      await Class.updateOne({ _id: b._id, status: b.status }, { $set: { status, ...(status === 'missed' ? { missedReason: req.body.reason ? text(req.body.reason, 500) : 'Marked by teacher' } : {}) } });
    }
    return result(res, { saved: true });
  }
  const update = {};
  if (req.body.summary !== undefined) update.summary = req.body.summary === '' ? '' : text(req.body.summary, 3000);
  if (req.body.published !== undefined) update.published = req.body.published === true;
  await teacherModeModels(req.db).TeacherWork.updateMany({ bookingId: b._id }, { $set: update });
  const work = await teacherModeModels(req.db).TeacherWork.findOne({ bookingId: b._id });
  if (req.body.complete === true) await completeStandaloneLesson(req.db, b, req.user.id, req.body.attendance);
  if (req.body.summary !== undefined && (b.status === 'completed' || req.body.complete === true)) {
    const Class = b.enrollments ? Group(req) : Booking(req);
    await Class.updateOne({ _id: b._id }, { $set: { classSummary: { text: update.summary, updatedAt: new Date(), by: req.user.id } } });
  }
  result(res, work);
}));
// Pay periods end on the configured day (inclusive); 29–31 clamp to the
// month's last day. UTC matches the workspace's existing salary charge periods.
const salaryPeriod = (salaryDay, now = new Date()) => {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), today = now.getUTCDate();
  const endDay = (year, month) => Math.min(salaryDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const endMonth = today <= endDay(y, m) ? m : m + 1;
  const end = new Date(Date.UTC(y, endMonth, endDay(y, endMonth) + 1));
  const previous = new Date(Date.UTC(y, endMonth - 1, endDay(y, endMonth - 1) + 1));
  return { start: previous, end, payDate: new Date(+end - 86400000) };
};
async function standaloneEarnings(req) {
  const centers = await list(teacherModeModels(req.db).ManagedCenter.find());
  const filter = { status: 'completed', managedCenterId: { $exists: true }, 'standalonePay.currency': { $exists: true } };
  const totalsPipeline = [{ $match: filter }, { $group: { _id: { center: '$managedCenterId', currency: '$standalonePay.currency', month: { $dateToString: { format: '%Y-%m', date: { $ifNull: ['$completedAt', '$scheduledTime'] }, timezone: 'UTC' } } }, earned: { $sum: '$standalonePay.amountMinor' }, lessons: { $sum: 1 } } }];
  const receiptsPipeline = [{ $group: { _id: { center: '$centerId', currency: '$currency' }, received: { $sum: '$amountMinor' } } }];
  const Receipt = teacherModeModels(req.db).TeacherReceipt;
  const dayPipeline = [{ $match: filter }, { $group: { _id: { center: '$managedCenterId', currency: '$standalonePay.currency', day: { $dateToString: { format: '%Y-%m-%d', date: { $ifNull: ['$completedAt', '$scheduledTime'] }, timezone: 'UTC' } } }, earned: { $sum: '$standalonePay.amountMinor' }, lessons: { $sum: 1 } } }];
  const [bookingTotals, groupTotals, receiptTotals, versions, bookingDays, groupDays] = await Promise.all([Booking(req).aggregate(totalsPipeline), Group(req).aggregate(totalsPipeline), Receipt.aggregate(receiptsPipeline), model(req.db, 'TeacherChargeVersion', teacherChargeVersionSchema).find().sort({ effectiveAt: 1, _id: 1 }).lean(), Booking(req).aggregate(dayPipeline), Group(req).aggregate(dayPipeline)]);
  return centers.map(c => {
    const rows = [...bookingTotals, ...groupTotals, ...receiptTotals].filter(r => String(r._id.center) === String(c._id));
    const period = salaryPeriod(c.salaryDay || 31);
    return { ...c, salaryPeriod: { start: period.start, end: new Date(+period.end - 1), payDate: period.payDate }, totals: [...new Set([c.currency, ...rows.map(r => r._id.currency)])].map(currency => {
      const matching = rows.filter(r => r._id.currency === currency);
      const earned = matching.reduce((n, r) => n + (r.earned || 0), 0), received = matching.reduce((n, r) => n + (r.received || 0), 0);
      const months = [...new Set(matching.map(r => r._id.month).filter(Boolean))];
      const charges = months.flatMap(month => {
        const gross = matching.filter(r => r._id.month === month).reduce((n, r) => n + (r.earned || 0), 0);
        const [year, mon] = month.split('-').map(Number), end = new Date(Date.UTC(year, mon, 1));
        const version = versions.filter(v => v.effectiveAt < end).at(-1);
        const taught = matching.some(r => r._id.month === month && r.lessons > 0);
        return taught ? (version?.rules || []).filter(r => (!r.centerIds?.length || r.centerIds.some(id => String(id) === String(c._id))) && (r.kind === 'percent' || r.currency === currency)).map(r => ({ month, name: r.name, kind: r.kind, value: r.value, amountMinor: r.kind === 'fixed' ? r.value : Math.round(gross * r.value / 10000) })) : [];
      });
      const chargesTotal = charges.reduce((n, r) => n + r.amountMinor, 0);
      const periodRows = [...bookingDays, ...groupDays].filter(r => String(r._id.center) === String(c._id) && r._id.currency === currency && new Date(`${r._id.day}T00:00:00Z`) >= period.start && new Date(`${r._id.day}T00:00:00Z`) < period.end);
      return { currency, earned, received, charges, chargesTotal, net: earned - chargesTotal, outstanding: earned - chargesTotal - received, lessons: matching.reduce((n, r) => n + (r.lessons || 0), 0), periodEarned: periodRows.reduce((n, r) => n + r.earned, 0), periodLessons: periodRows.reduce((n, r) => n + r.lessons, 0) };
    }) };
  });
}
app.get('/earnings', handle(async (req, res) => result(res, await standaloneEarnings(req))));
app.get('/earnings/history', handle(async (req, res) => {
  const c = await getCenter(req, req.query.centerId, false);
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1), limit = 20;
  if (page > 1000) throw fail('Page out of range.');
  const filter = { managedCenterId: c._id, status: 'completed', 'standalonePay.currency': { $exists: true } };
  const Receipt = teacherModeModels(req.db).TeacherReceipt, count = page * limit;
  const [bookings, groups, receipts, bc, gc, rc] = await Promise.all([
    Booking(req).find(filter).select('classTitle scheduledTime duration standalonePay').sort({ scheduledTime: -1, _id: -1 }).limit(count).lean(),
    Group(req).find(filter).select('title scheduledTime duration standalonePay').sort({ scheduledTime: -1, _id: -1 }).limit(count).lean(),
    Receipt.find({ centerId: c._id }).sort({ receivedAt: -1, _id: -1 }).limit(count).lean(),
    Booking(req).countDocuments(filter), Group(req).countDocuments(filter), Receipt.countDocuments({ centerId: c._id }),
  ]);
  const entries = [...bookings.map(b => ({ id: b._id, type: 'lesson', title: b.classTitle, date: b.scheduledTime, duration: b.duration, ...b.standalonePay })), ...groups.map(g => ({ id: g._id, type: 'group', title: g.title, date: g.scheduledTime, duration: g.duration, ...g.standalonePay })), ...receipts.map(r => ({ id: r._id, type: 'payment', title: r.note || 'Payment received', date: r.receivedAt, amountMinor: r.amountMinor, currency: r.currency }))].sort((a, b) => +new Date(b.date) - +new Date(a.date) || String(b.id).localeCompare(String(a.id)));
  result(res, { entries: entries.slice((page - 1) * limit, page * limit), page, totalPages: Math.max(1, Math.ceil((bc + gc + rc) / limit)), total: bc + gc + rc });
}));
app.post('/receipts', handle(async (req, res) => {
  const c = await getCenter(req, req.body.centerId, false), receivedAt = new Date(req.body.receivedAt);
  if (isNaN(receivedAt)) throw fail('Invalid payment date.');
  result(res, await teacherModeModels(req.db).TeacherReceipt.create({ centerId: c._id, currency: c.currency, amountMinor: integer(req.body.amountMinor, 1), receivedAt, note: req.body.note ? text(req.body.note, 1000) : '' }));
}));
app.get('/messages', handle(async (req, res) => {
  const M = teacherModeModels(req.db).TeacherConversation;
  if (req.query.read === 'true' && !req.user.teacherInspection) await M.updateMany({ sender: { $ne: 'teacher' }, readAt: null, ...(req.query.family === 'true' ? { studentId: { $ne: null } } : { studentId: null }) }, { $set: { readAt: new Date() } });
  result(res, await list(M.find()));
}));
app.post('/messages', handle(async (req, res) => {
  const studentId = req.body.studentId || null;
  if (studentId && (!oid(studentId) || !await Student(req).exists({ _id: studentId }))) throw fail('Student not found.');
  result(res, await teacherModeModels(req.db).TeacherConversation.create({ studentId, sender: 'teacher', text: text(req.body.text, 3000) }));
}));
app.get('/bookings/:id', handle(async (req, res) => {
  if (!oid(req.params.id)) throw fail('Invalid class.');
  const booking = await Booking(req).findOne({ _id: req.params.id, teacherId: req.user.id })
    .populate('teacherId', 'firstName lastName googleMeetLink zoomLink timezone')
    .populate('studentId', 'firstName lastName isManaged classCredits timezone');
  if (!booking) return res.status(404).json({ success: false, message: 'Class not found.' });
  const center = await getCenter(req, String(booking.managedCenterId), false);
  if (center.meetingUrl) {
    const host = new URL(center.meetingUrl).hostname;
    if (host === 'meet.google.com') booking.teacherId.googleMeetLink = center.meetingUrl;
    if (host === 'zoom.us' || host.endsWith('.zoom.us')) booking.teacherId.zoomLink = center.meetingUrl;
  }
  res.json({ success: true, booking });
}));

// Reuse the teaching tools, never the center-admin APIs.
app.use('/bookings', classHistoryRoutes);
app.use('/reviews', reviewRoutes);
app.use('/2fa', twoFactorRoutes);
app.use('/quiz-templates', quizTemplateRoutes);
app.use('/push', pushRoutes);
app.use('/agora-usage', agoraUsageRoutes);
// Polling the AI queue also resumes pending work after a server restart.
// The existing worker atomically claims jobs and limits server concurrency.
app.use('/games/ai', (req, res, next) => {
  if (req.path === '/jobs') res.once('finish', () => {
    if (res.statusCode >= 400) return;
    void runNextJob(req.db, req.center).catch(() => {});
  });
  if (req.method === 'GET' && req.path === '/uploads') {
    void sweepExpiredSources(req.db).catch(() => {});
  }
  next();
});
for (const [prefix, child] of Object.entries({ auth: authRoutes, homework: homeworkRoutes, quiz: quizRoutes, games: gameRoutes, 'games/ai': gameAiRoutes, vocab: vocabRoutes, recordings: recordingRoutes, 'recording-links': recordingLinkRoutes, classroom: classroomRoutes, content: contentRoutes, agora: agoraRoutes, 'teacher-assignments': teacherAssignmentRoutes, teachers: teacherRoutes, 'teacher-availability': teacherAvailabilityRoutes, 'class-summaries': classSummaryRoutes, 'group-classes': groupClassRoutes })) app.use(`/${prefix}`, child);
router.use('/app', teacherWorkspaceAuth, app);
router.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  const status = error.statusCode || (['ValidationError', 'CastError', 'MulterError'].includes(error.name) ? 400 : error.code === 11000 ? 409 : 500);
  res.status(status).json({ success: false, message: status >= 500 ? 'Unable to complete this request. Please retry.' : error.message });
});
export default router;
