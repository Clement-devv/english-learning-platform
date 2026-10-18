// server/routes/boardRoutes.js
// Board messages (ads / information) shown on the flip side of the dashboard welcome banner.
//
//  saBoardRoutes     → /api/v1/super-admin/board   (verifySuperAdmin, no tenantMiddleware)
//  centerBoardRoutes → /api/v1/board               (tenantMiddleware → verifyToken)
//
// Model: models/master/BoardMessage.js (master DB — platform-wide, written by the super admin).
import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import BoardMessage, { BOARD_ROLES } from '../models/master/BoardMessage.js';
import Center from '../models/master/Center.js';
import { verifySuperAdmin } from '../middleware/superAdminMiddleware.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { strictLimiter } from '../middleware/rateLimiter.js';
import { s3Enabled, uploadToS3, s3PublicUrl } from '../utils/s3.js';
import { writeAuditLog } from '../utils/auditLog.js';
import logger from '../utils/logger.js';
import { badRequest, notFound, serverError } from '../utils/apiResponse.js';

const isId = (v) => mongoose.isValidObjectId(v);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const httpUrl = (v) => {
  const s = str(v, 500);
  if (!s) return '';
  if (s.startsWith('/uploads/')) return s;                       // our own upload
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
};
const ids = (list, max = 500) => [...new Set((Array.isArray(list) ? list : []).map(String).filter(isId))].slice(0, max);

/** Validate + normalise a message from the super admin's form. Returns { doc } or { error }. */
function readMessage(b) {
  const imageUrl = httpUrl(b.imageUrl);
  const mobileImageUrl = httpUrl(b.mobileImageUrl);
  const ctaUrl = httpUrl(b.ctaUrl);
  if (imageUrl === null || mobileImageUrl === null) return { error: 'The image must be an uploaded file or an http(s) link' };
  if (ctaUrl === null) return { error: 'The button link must start with http:// or https://' };
  const layout = b.layout === 'image' ? 'image' : 'text';
  const title = str(b.title, 80), body = str(b.body, 240);
  if (layout === 'image' && !imageUrl) return { error: 'Upload an image for an image board' };
  if (layout === 'text' && !title && !body) return { error: 'Add a title or a message' };
  if (str(b.ctaLabel, 30) && !ctaUrl) return { error: 'Add a link for the button' };

  const duration = Math.round(Number(b.durationSec));
  if (!Number.isFinite(duration) || duration < 3 || duration > 120) return { error: 'Show time must be between 3 and 120 seconds' };

  const startsAt = b.startsAt ? new Date(b.startsAt) : null;
  const endsAt = b.endsAt ? new Date(b.endsAt) : null;
  if ((startsAt && isNaN(startsAt)) || (endsAt && isNaN(endsAt))) return { error: 'Invalid start or end date' };
  if (startsAt && endsAt && endsAt <= startsAt) return { error: 'The end date must be after the start date' };

  const showOnLogin = b.showOnLogin !== false, showOnClick = b.showOnClick !== false;
  if (!showOnLogin && !showOnClick) return { error: 'Choose when it shows: on sign-in, on tap, or both' };

  const t = b.target || {};
  const roles = [...new Set((Array.isArray(t.roles) ? t.roles : []).filter((r) => BOARD_ROLES.includes(r)))];
  if (!roles.length) return { error: 'Choose who sees it: admins, teachers and/or students' };
  const allCenters = t.allCenters !== false;
  const centerIds = allCenters ? [] : ids(t.centerIds, 200);
  if (!allCenters && !centerIds.length) return { error: 'Choose at least one center' };
  // Individual people only make sense inside a single center
  const single = !allCenters && centerIds.length === 1;
  const allTeachers = !single || t.allTeachers !== false;
  const allStudents = !single || t.allStudents !== false;
  const teacherIds = allTeachers ? [] : ids(t.teacherIds);
  const studentIds = allStudents ? [] : ids(t.studentIds);
  if (roles.includes('teacher') && !allTeachers && !teacherIds.length) return { error: 'Pick at least one teacher, or choose all teachers' };
  if (roles.includes('student') && !allStudents && !studentIds.length) return { error: 'Pick at least one student, or choose all students' };

  return {
    doc: {
      kind: b.kind === 'ad' ? 'ad' : 'info',
      title, body, imageUrl, mobileImageUrl: imageUrl ? mobileImageUrl : '', layout,
      ctaLabel: ctaUrl ? (str(b.ctaLabel, 30) || 'Learn more') : '', ctaUrl,
      durationSec: duration, showOnLogin, showOnClick,
      active: b.active !== false, startsAt, endsAt,
      target: { allCenters, centerIds, roles, allTeachers, teacherIds, allStudents, studentIds },
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// Super admin
// ════════════════════════════════════════════════════════════════════════════════
export const saBoardRoutes = express.Router();
saBoardRoutes.use(verifySuperAdmin);

// GET /super-admin/board — every message, newest first, with center names
saBoardRoutes.get('/', async (_req, res) => {
  try {
    const items = await BoardMessage.find().sort({ createdAt: -1 }).limit(200).lean();
    const cids = [...new Set(items.flatMap((m) => (m.target?.centerIds || []).map(String)))];
    const centers = cids.length ? await Center.find({ _id: { $in: cids } }).select('centerName').lean() : [];
    const names = Object.fromEntries(centers.map((c) => [String(c._id), c.centerName]));
    res.json({ success: true, data: items.map((m) => ({ ...m, centerNames: (m.target?.centerIds || []).map((id) => names[String(id)] || 'Deleted center') })) });
  } catch (err) {
    logger.error('Board list failed:', { error: err?.message });
    serverError(res);
  }
});

saBoardRoutes.post('/', async (req, res) => {
  try {
    const { doc, error } = readMessage(req.body || {});
    if (error) return badRequest(res, error);
    const m = await BoardMessage.create({ ...doc, createdBy: req.superAdmin?.email || '' });
    writeAuditLog({ action: 'board.create', superAdmin: req.superAdmin, targetId: String(m._id), targetName: m.title || m.kind, ip: req.ip });
    res.status(201).json({ success: true, data: m, message: 'Board message created' });
  } catch (err) {
    logger.error('Board create failed:', { error: err?.message });
    serverError(res);
  }
});

saBoardRoutes.put('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return badRequest(res, 'Invalid message');
    const { doc, error } = readMessage(req.body || {});
    if (error) return badRequest(res, error);
    const m = await BoardMessage.findByIdAndUpdate(req.params.id, { $set: doc }, { new: true });
    if (!m) return notFound(res, 'Message not found');
    writeAuditLog({ action: 'board.update', superAdmin: req.superAdmin, targetId: String(m._id), targetName: m.title || m.kind, ip: req.ip });
    res.json({ success: true, data: m, message: 'Board message saved' });
  } catch (err) {
    logger.error('Board update failed:', { error: err?.message });
    serverError(res);
  }
});

// PATCH /super-admin/board/:id/active — pause / resume
saBoardRoutes.patch('/:id/active', async (req, res) => {
  try {
    if (!isId(req.params.id)) return badRequest(res, 'Invalid message');
    const m = await BoardMessage.findByIdAndUpdate(req.params.id, { $set: { active: !!req.body?.active } }, { new: true });
    if (!m) return notFound(res, 'Message not found');
    res.json({ success: true, data: m, message: m.active ? 'Message is live' : 'Message paused' });
  } catch (err) {
    logger.error('Board toggle failed:', { error: err?.message });
    serverError(res);
  }
});

saBoardRoutes.delete('/:id', async (req, res) => {
  try {
    if (!isId(req.params.id)) return badRequest(res, 'Invalid message');
    const m = await BoardMessage.findByIdAndDelete(req.params.id);
    if (!m) return notFound(res, 'Message not found');
    writeAuditLog({ action: 'board.delete', superAdmin: req.superAdmin, targetId: String(m._id), targetName: m.title || m.kind, ip: req.ip });
    res.json({ success: true, message: 'Board message deleted' });
  } catch (err) {
    logger.error('Board delete failed:', { error: err?.message });
    serverError(res);
  }
});

// POST /super-admin/board/upload — one board image → { url }
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }; // no SVG (can carry scripts)
const BOARD_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'branding', '_platform');
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (IMAGE_TYPES[file.mimetype] ? cb(null, true) : cb(new Error('Only JPG, PNG, WebP or GIF images are allowed'))),
});
saBoardRoutes.post('/upload', strictLimiter,
  (req, res, next) => imageUpload.single('image')(req, res, (err) => {
    if (err) return badRequest(res, err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 4 MB)' : err.message);
    next();
  }),
  async (req, res) => {
    try {
      if (!req.file) return badRequest(res, 'No image uploaded');
      const name = `board-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${IMAGE_TYPES[req.file.mimetype]}`;
      let url;
      if (s3Enabled()) {
        const key = `platform/board/${name}`;
        await uploadToS3(req.file.buffer, key, req.file.mimetype);
        url = s3PublicUrl(key);
      } else {
        await fs.promises.mkdir(BOARD_DIR, { recursive: true });
        await fs.promises.writeFile(path.join(BOARD_DIR, name), req.file.buffer);
        url = `/uploads/branding/_platform/${name}`;
      }
      res.json({ success: true, data: { url }, message: 'Image uploaded' });
    } catch (err) {
      logger.error('Board image upload failed:', { error: err?.message });
      serverError(res);
    }
  });

// ════════════════════════════════════════════════════════════════════════════════
// Center dashboards
// ════════════════════════════════════════════════════════════════════════════════
export const centerBoardRoutes = express.Router();
centerBoardRoutes.use(tenantMiddleware, verifyToken);

/** Mongo filter: live messages that target this center + role + person */
export const boardFilterFor = ({ centerId, role, userId, now = new Date() }) => {
  const person = role === 'teacher'
    ? { $or: [{ 'target.allTeachers': true }, { 'target.teacherIds': userId }] }
    : role === 'student'
      ? { $or: [{ 'target.allStudents': true }, { 'target.studentIds': userId }] }
      : {};
  return {
    active: true,
    'target.roles': role,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gt: now } }] },
      { $or: [{ 'target.allCenters': true }, { 'target.centerIds': centerId }] },
      ...(person.$or ? [person] : []),
    ],
  };
};

// GET /board — messages for the signed-in admin / teacher / student
centerBoardRoutes.get('/', async (req, res) => {
  try {
    const role = req.user?.role;
    if (!BOARD_ROLES.includes(role)) return res.json({ success: true, data: [] });
    const items = await BoardMessage.find(boardFilterFor({ centerId: req.center._id, role, userId: String(req.user.id) }))
      .select('kind title body imageUrl mobileImageUrl layout ctaLabel ctaUrl durationSec showOnLogin showOnClick updatedAt')
      .sort({ createdAt: -1 }).limit(10).lean();
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('Board fetch failed:', { error: err?.message });
    serverError(res);
  }
});

// POST /board/:id/seen | /board/:id/click — simple counters for the super admin
const bump = (field) => async (req, res) => {
  if (!isId(req.params.id)) return badRequest(res, 'Invalid message');
  BoardMessage.updateOne({ _id: req.params.id }, { $inc: { [field]: 1 } }).catch(() => {});
  res.json({ success: true });
};
centerBoardRoutes.post('/:id/seen', bump('views'));
centerBoardRoutes.post('/:id/click', bump('clicks'));
