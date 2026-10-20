// server/routes/libraryRoutes.js — a center's teaching library (PDFs).
// Mounted at /api/v1/library.
//
//   GET    /                 admin + teachers: search/filter, paged (+ storage usage for admins)
//   POST   /                 admin: upload one PDF (multipart "file" + title, category, level, tags, rightsConfirmed=true)
//   PATCH  /:id              admin: edit title / description / category / level / tags
//   DELETE /:id              admin: delete (frees the space)
//   GET    /:id/download     admin + teachers: short-lived link → { url, fileName }  (?mode=view opens in the browser)
//   GET    /file/:token      the link itself for files on local disk (S3 files use a presigned S3 URL).
//                            Authorised by the signed token, not a login header, so <a href> downloads work.
//
// Files: S3 (centers/<slug>/library/<id>.pdf) when S3 is configured, else uploads/library/<slug>/ (never served statically).
// Space: Center.library via utils/libraryQuota.js — over the allowance is allowed (billed) up to 2×.
import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import Center from '../models/master/Center.js';
import { tenantMiddleware } from '../middleware/tenantMiddleware.js';
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from '../middleware/authMiddleware.js';
import { getDb } from '../config/dbManager.js';
import { getCenterSecret } from '../utils/jwtUtils.js';
import { s3Enabled, uploadToS3, deleteFromS3, getPresignedUrl } from '../utils/s3.js';
import { libraryFileSchema } from '../schemas/libraryFileSchema.js';
import { libraryAssignmentSchema } from '../schemas/libraryAssignmentSchema.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { notifyChanged } from '../utils/liveUpdates.js';
import { readPaging, pageMeta } from '../utils/paging.js';
import {
  getLibrarySettings, libraryUsage, changeLibraryUsage, rollLibraryMonth, MAX_FILE_BYTES, MB,
} from '../utils/libraryQuota.js';
import logger from '../utils/logger.js';

const router = express.Router();
const LOCAL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads', 'library');
const LINK_SECONDS = 5 * 60;
const formatBytes = (b) => (b >= 1024 * MB ? `${(b / (1024 * MB)).toFixed(1)} GB` : `${Math.max(1, Math.round(b / MB))} MB`);

const getFileModel = (db) => db.models.LibraryFile || db.model('LibraryFile', libraryFileSchema);
const fail = (res, status, message, extra) => res.status(status).json({ success: false, message, ...extra });
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseTags = (v) => [...new Set((Array.isArray(v) ? v : String(v || '').split(','))
  .map(t => str(String(t), 30).toLowerCase()).filter(Boolean))].slice(0, 12);
const safeName = (n) => (String(n || 'document.pdf').replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'document.pdf');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => (file.mimetype === 'application/pdf'
    ? cb(null, true) : cb(new Error('Only PDF files can be added to the library'))),
});

// ── Storage ───────────────────────────────────────────────────────────────────
const storageKeyFor = (slug, id) => (s3Enabled() ? `centers/${slug}/library/${id}.pdf` : `${slug}/${id}.pdf`);
async function saveFile(key, buffer) {
  if (s3Enabled()) return uploadToS3(buffer, key, 'application/pdf');
  const full = path.join(LOCAL_DIR, key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
}
export async function removeLibraryFile(key) {
  try {
    if (key.startsWith('centers/')) await deleteFromS3(key);
    else await fs.promises.unlink(path.join(LOCAL_DIR, key));
  } catch (err) {
    logger.warn('library file delete failed', { key, error: err?.message });
  }
}

/** A book was deleted / taken down: drop its sends and refresh those teachers' libraries. */
export async function clearAssignments(db, slug, fileId) {
  const Assign = db.models.LibraryAssignment || db.model('LibraryAssignment', libraryAssignmentSchema);
  const teachers = await Assign.distinct('teacherId', { fileId, acknowledgedAt: null });
  await Assign.deleteMany({ fileId });
  if (teachers.length) notifyChanged(slug, { teachers }, ['library']);
}

// ── File links (local disk) — token-authorised, no tenant header needed ──────
router.get('/file/:token', async (req, res) => {
  try {
    const unverified = jwt.decode(req.params.token);
    if (!unverified?.c || !/^[a-z0-9-]+$/.test(unverified.c)) return fail(res, 404, 'Link not valid');
    const t = jwt.verify(req.params.token, getCenterSecret(unverified.c));
    if (t.typ !== 'library-file') return fail(res, 404, 'Link not valid');
    const db = await getDb(t.c);
    const doc = await getFileModel(db).findOne({ _id: t.f, status: 'active' }).lean();
    if (!doc || doc.storageKey.startsWith('centers/')) return fail(res, 404, 'File not found');
    const full = path.join(LOCAL_DIR, doc.storageKey);
    if (!full.startsWith(LOCAL_DIR + path.sep)) return fail(res, 404, 'File not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${t.m === 'view' ? 'inline' : 'attachment'}; filename="${safeName(doc.fileName)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    req.clearRequestTimeout?.();
    fs.createReadStream(full).on('error', () => { if (!res.headersSent) fail(res, 404, 'File not found'); }).pipe(res);
  } catch {
    fail(res, 410, 'This link has expired — open the library and try again');
  }
});

// ── Sending a book to a teacher ("use this for …") ───────────────────────────
// The book is pinned + highlighted at the top of the teacher's library until
// they press Acknowledge. Live push key: "library" (utils/liveUpdates.js).
const getAssignmentModel = (db) => db.models.LibraryAssignment || db.model('LibraryAssignment', libraryAssignmentSchema);
const getTeacherModel = (db) => db.models.Teacher || db.model('Teacher', teacherSchema);
const teacherName = (t) => (t ? `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher' : 'Teacher');

// Teacher picker for the "Send to teacher" dialog
router.get('/teachers', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    const q = str(req.query.q, 60);
    const match = { $or: [{ active: true }, { status: 'active' }] };
    if (q) {
      const re = new RegExp(escapeRe(q), 'i');
      match.$and = [{ $or: [{ firstName: re }, { lastName: re }, { email: re }, { teacherCode: re }] }];
    }
    const teachers = await getTeacherModel(req.db).find(match).select('firstName lastName teacherCode photo profilePicture').sort({ firstName: 1 }).limit(30).lean();
    res.json({ success: true, data: teachers.map(t => ({ _id: t._id, name: teacherName(t), code: t.teacherCode || null })) });
  } catch (err) {
    logger.error('library teacher list failed', { error: err?.message });
    fail(res, 500, 'Could not load teachers');
  }
});

// Admin: send a book to one or more teachers with a note
router.post('/:id/assign', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid file');
    const ids = [...new Set((Array.isArray(req.body?.teacherIds) ? req.body.teacherIds : []).map(String))].filter(mongoose.isValidObjectId).slice(0, 50);
    if (!ids.length) return fail(res, 400, 'Choose at least one teacher');
    const note = str(req.body?.note, 1000);
    if (!note) return fail(res, 400, 'Add a short description — e.g. which student and what to use it for');
    const file = await getFileModel(req.db).findOne({ _id: req.params.id, status: 'active' }).select('title').lean();
    if (!file) return fail(res, 404, 'File not found');
    const teachers = await getTeacherModel(req.db).find({ _id: { $in: ids } }).select('firstName lastName').lean();
    if (!teachers.length) return fail(res, 400, 'Those teachers were not found');
    const who = req.admin || {};
    const by = { id: who._id ? String(who._id) : null, name: `${who.firstName || ''} ${who.lastName || ''}`.trim() || (who.isImpersonation ? 'Platform support' : 'Admin') };
    await getAssignmentModel(req.db).insertMany(teachers.map(t => ({ fileId: file._id, teacherId: t._id, note, assignedBy: by })));
    notifyChanged(req.center.slug, { teachers: teachers.map(t => t._id) }, ['library']);
    res.status(201).json({
      success: true,
      data: { sent: teachers.length },
      message: `"${file.title}" sent to ${teachers.length === 1 ? teacherName(teachers[0]) : `${teachers.length} teachers`}`,
    });
  } catch (err) {
    logger.error('library assign failed', { error: err?.message });
    fail(res, 500, 'Could not send the book');
  }
});

// Admin: who a book was sent to, and who acknowledged
router.get('/:id/assignments', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid file');
    getTeacherModel(req.db);
    const list = await getAssignmentModel(req.db).find({ fileId: req.params.id }).sort({ createdAt: -1 }).limit(100)
      .populate('teacherId', 'firstName lastName teacherCode').lean();
    res.json({
      success: true,
      data: list.map(a => ({
        _id: a._id, note: a.note, createdAt: a.createdAt, acknowledgedAt: a.acknowledgedAt, assignedBy: a.assignedBy?.name || '',
        teacher: { _id: a.teacherId?._id, name: teacherName(a.teacherId), code: a.teacherId?.teacherCode || null },
      })),
    });
  } catch (err) {
    logger.error('library assignments list failed', { error: err?.message });
    fail(res, 500, 'Could not load');
  }
});

// Admin: cancel a send (removes the pin from that teacher's library)
router.delete('/assignments/:aid', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.aid)) return fail(res, 400, 'Invalid request');
    const a = await getAssignmentModel(req.db).findByIdAndDelete(req.params.aid).lean();
    if (!a) return fail(res, 404, 'Not found');
    notifyChanged(req.center.slug, { teachers: [a.teacherId] }, ['library']);
    res.json({ success: true, message: 'Removed' });
  } catch {
    fail(res, 500, 'Could not remove');
  }
});

// Teacher: "Acknowledge" — the book stops being pinned
router.post('/assignments/:aid/acknowledge', tenantMiddleware, verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return fail(res, 403, 'Only the teacher can acknowledge');
    if (!mongoose.isValidObjectId(req.params.aid)) return fail(res, 400, 'Invalid request');
    const a = await getAssignmentModel(req.db).findOneAndUpdate(
      { _id: req.params.aid, teacherId: req.user.id, acknowledgedAt: null },
      { $set: { acknowledgedAt: new Date() } },
      { new: true },
    ).lean();
    if (!a) return fail(res, 404, 'Already acknowledged or not yours');
    notifyChanged(req.center.slug, { teachers: [] }, ['library']); // admins see it as acknowledged
    res.json({ success: true, message: 'Acknowledged' });
  } catch {
    fail(res, 500, 'Could not acknowledge');
  }
});

// ── List / search ─────────────────────────────────────────────────────────────
router.get('/', tenantMiddleware, verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const File = getFileModel(req.db);
    const { page, limit } = readPaging(req.query, { defaultLimit: 24, maxLimit: 60 });
    const match = { status: 'active' };
    const q = str(req.query.q, 80);
    if (q) {
      const re = new RegExp(escapeRe(q), 'i');
      match.$or = [{ title: re }, { description: re }, { tags: re }, { category: re }, { fileName: re }];
    }
    if (req.query.category) match.category = str(req.query.category, 60);
    if (req.query.level) match.level = str(req.query.level, 40);
    const sort = { title: { title: 1 }, popular: { downloads: -1, createdAt: -1 }, size: { size: -1 } }[req.query.sort] || { createdAt: -1 };

    const [total, categories, levels] = await Promise.all([
      File.countDocuments(match),
      File.distinct('category', { status: 'active' }),
      File.distinct('level', { status: 'active' }),
    ]);
    const meta = pageMeta(page, limit, total);
    const files = await File.find(match).sort(sort).skip((meta.page - 1) * limit).limit(limit)
      .select('-sha256 -storageKey -status -removedAt -removedReason').lean();

    const data = { files, pagination: meta, categories: categories.filter(Boolean).sort(), levels: levels.filter(Boolean).sort() };
    const settings = await getLibrarySettings();
    data.copyrightEmail = settings.copyrightEmail || '';
    if (req.user.role === 'admin') {
      let center = await Center.findById(req.center._id).select('centerName slug plan adminEmail library').lean();
      center = await rollLibraryMonth(center, settings);
      data.usage = libraryUsage(center, settings);
      data.pricePerGb = settings.pricePerGb;
      // Per book on this page: sent to how many teachers, how many not acknowledged yet
      const rows = files.length ? await getAssignmentModel(req.db).aggregate([
        { $match: { fileId: { $in: files.map(f => f._id) } } },
        { $group: { _id: '$fileId', sent: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$acknowledgedAt', null] }, 1, 0] } } } },
      ]) : [];
      const byFile = new Map(rows.map(r => [String(r._id), r]));
      for (const f of files) { const r = byFile.get(String(f._id)); f.sentTo = r ? { total: r.sent, pending: r.pending } : null; }
    } else {
      // Teacher: books the admin sent them, pinned on top until acknowledged
      const pins = await getAssignmentModel(req.db).find({ teacherId: req.user.id, acknowledgedAt: null })
        .sort({ createdAt: -1 }).limit(20).lean();
      const pinnedFiles = pins.length ? await getFileModel(req.db).find({ _id: { $in: pins.map(p => p.fileId) }, status: 'active' })
        .select('-sha256 -storageKey -status -removedAt -removedReason').lean() : [];
      const fileMap = new Map(pinnedFiles.map(f => [String(f._id), f]));
      data.pinned = pins.filter(p => fileMap.has(String(p.fileId))).map(p => ({
        assignmentId: p._id, note: p.note, assignedBy: p.assignedBy?.name || 'Admin', assignedAt: p.createdAt,
        file: fileMap.get(String(p.fileId)),
      }));
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error('library list failed', { error: err?.message });
    fail(res, 500, 'Could not load the library');
  }
});

// ── Upload ────────────────────────────────────────────────────────────────────
router.post('/', tenantMiddleware, verifyToken, verifyAdmin,
  (req, res, next) => upload.single('file')(req, res, (err) => {
    if (!err) return next();
    return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? `PDF is too large (max ${MAX_FILE_BYTES / MB} MB)` : err.message);
  }),
  async (req, res) => {
    try {
      if (!req.file) return fail(res, 400, 'Choose a PDF to upload');
      if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return fail(res, 400, 'That file is not a valid PDF');
      if (req.body.rightsConfirmed !== 'true') return fail(res, 400, 'Please confirm you have the right to share this file');
      const title = str(req.body.title, 160) || str(req.file.originalname.replace(/\.pdf$/i, ''), 160);
      if (!title) return fail(res, 400, 'Give the file a title');

      const File = getFileModel(req.db);
      const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
      const dup = await File.findOne({ sha256, status: 'active' }).select('title').lean();
      if (dup) return fail(res, 409, `This PDF is already in the library as "${dup.title}"`, { existingId: dup._id });

      // Space: over the allowance is fine (billed), past the hard cap is not
      const settings = await getLibrarySettings();
      let center = await Center.findById(req.center._id).select('centerName slug plan adminEmail library').lean();
      center = await rollLibraryMonth(center, settings);
      const before = libraryUsage(center, settings);
      if (before.usedBytes + req.file.size > before.hardCapBytes) {
        return fail(res, 413, `Your library is full (${formatBytes(before.hardCapBytes)} limit). Delete files or ask for more space.`);
      }

      const _id = new mongoose.Types.ObjectId();
      const storageKey = storageKeyFor(req.center.slug, _id);
      await saveFile(storageKey, req.file.buffer);
      const who = req.admin || {};
      let doc;
      try {
        doc = await File.create({
          _id, title, sha256, storageKey,
          description: str(req.body.description, 1000),
          category: str(req.body.category, 60),
          level: str(req.body.level, 40),
          tags: parseTags(req.body.tags),
          fileName: safeName(req.file.originalname),
          size: req.file.size,
          rightsConfirmed: true,
          uploadedBy: { id: who._id ? String(who._id) : null, role: 'admin', name: `${who.firstName || ''} ${who.lastName || ''}`.trim() || (who.isImpersonation ? 'Platform support' : 'Admin') },
        });
      } catch (err) {
        await removeLibraryFile(storageKey);
        throw err;
      }
      const usage = await changeLibraryUsage(req.center._id, req.file.size, 1);
      const { sha256: _s, storageKey: _k, ...file } = doc.toObject();
      res.status(201).json({
        success: true, data: { file, usage },
        message: usage.usedBytes > usage.allowanceBytes ? 'Uploaded — your library is now over its allowance (extra space is billed)' : 'Uploaded',
      });
    } catch (err) {
      logger.error('library upload failed', { error: err?.message });
      fail(res, 500, 'Upload failed — please try again');
    }
  });

// ── Edit details ──────────────────────────────────────────────────────────────
router.patch('/:id', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid file');
    const b = req.body || {};
    const set = {};
    if (b.title !== undefined) { set.title = str(b.title, 160); if (!set.title) return fail(res, 400, 'Title cannot be empty'); }
    if (b.description !== undefined) set.description = str(b.description, 1000);
    if (b.category !== undefined) set.category = str(b.category, 60);
    if (b.level !== undefined) set.level = str(b.level, 40);
    if (b.tags !== undefined) set.tags = parseTags(b.tags);
    const doc = await getFileModel(req.db).findOneAndUpdate({ _id: req.params.id, status: 'active' }, { $set: set }, { new: true })
      .select('-sha256 -storageKey').lean();
    if (!doc) return fail(res, 404, 'File not found');
    res.json({ success: true, data: doc, message: 'Saved' });
  } catch (err) {
    logger.error('library edit failed', { error: err?.message });
    fail(res, 500, 'Could not save');
  }
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', tenantMiddleware, verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid file');
    const doc = await getFileModel(req.db).findOneAndDelete({ _id: req.params.id, status: 'active' }).lean();
    if (!doc) return fail(res, 404, 'File not found');
    await removeLibraryFile(doc.storageKey);
    const usage = await changeLibraryUsage(req.center._id, -doc.size, -1);
    await clearAssignments(req.db, req.center.slug, doc._id);
    res.json({ success: true, data: { usage }, message: `"${doc.title}" deleted` });
  } catch (err) {
    logger.error('library delete failed', { error: err?.message });
    fail(res, 500, 'Could not delete');
  }
});

// ── Download / view link ──────────────────────────────────────────────────────
router.get('/:id/download', tenantMiddleware, verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid file');
    const mode = req.query.mode === 'view' ? 'view' : 'download';
    const doc = await getFileModel(req.db).findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      mode === 'download' ? { $inc: { downloads: 1 } } : {},
      { new: true },
    ).lean();
    if (!doc) return fail(res, 404, 'File not found');
    const fileName = safeName(doc.fileName);
    let url;
    if (doc.storageKey.startsWith('centers/')) {
      url = await getPresignedUrl(doc.storageKey, LINK_SECONDS, {
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: `${mode === 'view' ? 'inline' : 'attachment'}; filename="${fileName}"`,
      });
    } else {
      const token = jwt.sign({ typ: 'library-file', c: req.center.slug, f: String(doc._id), m: mode }, getCenterSecret(req.center.slug), { expiresIn: LINK_SECONDS });
      url = `/api/v1/library/file/${token}`;
    }
    res.json({ success: true, data: { url, fileName, expiresIn: LINK_SECONDS } });
  } catch (err) {
    logger.error('library download link failed', { error: err?.message });
    fail(res, 500, 'Could not open the file');
  }
});

export default router;
