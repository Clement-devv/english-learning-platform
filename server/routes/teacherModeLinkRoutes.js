import express from 'express';
import mongoose from 'mongoose';
import { config } from '../config/config.js';
import TeacherFamilyGrant from '../models/master/TeacherFamilyGrant.js';
import { teacherModeModels } from '../schemas/teacherModeSchemas.js';
import { homeworkSchema } from '../schemas/homeworkSchema.js';
import { quizSchema } from '../schemas/quizSchema.js';
import { gameLinkSchema } from '../schemas/gameLinkSchema.js';
import { gameAssignmentSchema } from '../schemas/gameAssignmentSchema.js';
import { questionSetSchema } from '../schemas/questionSetSchema.js';
import { recordingLinkSchema } from '../schemas/recordingLinkSchema.js';
import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { decrypt } from '../utils/fieldEncryption.js';
import { linkExpiresAt } from '../utils/shareLink.js';
import { linkExpiry as recordingExpiry } from '../utils/recordingLinks.js';

const router = express.Router();
const types = ['family', 'homework', 'quiz', 'game', 'recording'];
const model = (db, name, schema) => db.models[name] || db.model(name, schema);
const bad = message => Object.assign(new Error(message), { statusCode: 400 });

// Mounted only behind teacherWorkspaceAuth. The existing encrypted source records
// are the link library: generating a link in any tool makes it appear here.
router.get('/parent-links', async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1), limit = 30;
    if (!Number.isInteger(page) || page < 1 || page > 1000) throw bad('Invalid page.');
    const kind = req.query.kind || 'all';
    if (kind !== 'all' && !types.includes(kind)) throw bad('Invalid link type.');
    const filter = { standaloneManaged: true };
    if (req.query.centerId) {
      if (!mongoose.isValidObjectId(req.query.centerId) || !await teacherModeModels(req.db).ManagedCenter.exists({ _id: req.query.centerId })) throw bad('Center not found.');
      filter.managedCenterId = req.query.centerId;
    }
    if (req.query.studentId) {
      if (!mongoose.isValidObjectId(req.query.studentId)) throw bad('Invalid student.');
      filter._id = req.query.studentId;
    }
    const [students, centers] = await Promise.all([
      req.db.models.Student.find(filter).select('firstName lastName managedCenterId').limit(1000).lean(),
      teacherModeModels(req.db).ManagedCenter.find().select('name').lean(),
    ]);
    const ids = students.map(s => s._id), byStudent = new Map(students.map(s => [String(s._id), {
      id: s._id, name: `${s.firstName} ${s.lastName || ''}`.trim(), centerId: s.managedCenterId,
      centerName: centers.find(c => String(c._id) === String(s.managedCenterId))?.name || 'Managed center',
    }]));
    model(req.db, 'GameAssignment', gameAssignmentSchema); model(req.db, 'QuestionSet', questionSetSchema);
    model(req.db, 'Booking', bookingSchema); model(req.db, 'GroupClass', groupClassSchema);
    const owner = { teacherId: req.user.id, studentId: { $in: ids }, 'shareLink.tokenEnc': { $exists: true, $ne: null } };
    const sources = [
      ['family', TeacherFamilyGrant, { workspaceId: req.teacherWorkspace._id, studentId: { $in: ids } }, '+tokenEnc studentId enabled expiresAt createdAt', 'createdAt'],
      ['homework', model(req.db, 'Homework', homeworkSchema), owner, '+shareLink.tokenEnc title studentId shareLink.createdAt dueDate createdAt', 'shareLink.createdAt'],
      ['quiz', model(req.db, 'Quiz', quizSchema), owner, '+shareLink.tokenEnc title studentId shareLink.createdAt dueDate createdAt', 'shareLink.createdAt'],
      ['game', model(req.db, 'GameLink', gameLinkSchema), owner, '+shareLink.tokenEnc studentId shareLink.createdAt assignmentId createdAt', 'shareLink.createdAt'],
      ['recording', model(req.db, 'RecordingLink', recordingLinkSchema), owner, '+shareLink.tokenEnc studentId shareLink.createdAt enabled purgeAt bookingId groupClassId createdAt', 'shareLink.createdAt'],
    ].filter(([type]) => kind === 'all' || kind === type);
    // Fetch enough from each sorted source for the requested merged page; source
    // counts keep pagination accurate without returning every URL to the client.
    const parts = await Promise.all(sources.map(async ([type, M, query, fields, sort]) => {
      let q = M.find(query).select(fields).sort({ [sort]: -1, _id: -1 }).limit(page * limit);
      if (type === 'game') q = q.populate({ path: 'assignmentId', select: 'active startsAt dueAt setId', populate: { path: 'setId', select: 'title' } });
      if (type === 'recording') q = q.populate('bookingId', 'classTitle').populate('groupClassId', 'title');
      const [rows, count] = await Promise.all([q.lean(), M.countDocuments(query)]);
      return { type, rows, count };
    }));
    const sorted = parts.flatMap(p => p.rows.map(row => ({ type: p.type, row }))).sort((a, b) => {
      const date = v => +new Date(v.row.shareLink?.createdAt || v.row.createdAt || 0);
      return date(b) - date(a) || `${b.type}:${b.row._id}`.localeCompare(`${a.type}:${a.row._id}`);
    }).slice((page - 1) * limit, page * limit);
    const now = new Date(), root = config.frontendUrl.replace(/\/$/, '');
    const data = await Promise.all(sorted.map(async ({ type, row }) => {
      let expiresAt = null, status = 'active', title = row.title || 'Learning page';
      if (type === 'family') { expiresAt = row.expiresAt; if (!row.enabled) status = 'disabled'; }
      if (type === 'homework' || type === 'quiz') expiresAt = linkExpiresAt(row.dueDate, req.center.timezone);
      if (type === 'game') {
        title = row.assignmentId?.setId?.title || 'Learning game'; expiresAt = row.assignmentId?.dueAt;
        if (!row.assignmentId?.active) status = 'disabled';
        else if (row.assignmentId.startsAt > now) status = 'scheduled';
      }
      if (type === 'recording') {
        title = row.bookingId?.classTitle || row.groupClassId?.title || 'Class recording';
        if (!row.enabled) status = 'disabled';
        else {
          // linkExpiry expects the reference IDs, not populated class objects.
          expiresAt = row.bookingId || row.groupClassId ? await recordingExpiry(req.db, { ...row, bookingId: row.bookingId?._id, groupClassId: row.groupClassId?._id }) : null;
          if (!expiresAt) status = 'unavailable';
        }
      }
      if (status !== 'disabled' && expiresAt && new Date(expiresAt) <= now) status = 'expired';
      let raw = null;
      try { raw = decrypt(type === 'family' ? row.tokenEnc : row.shareLink.tokenEnc); } catch { status = 'unavailable'; }
      const prefix = { family: '/teacher-mode/family/', homework: '/hw/', quiz: '/q/', game: '/g/', recording: '/rv/' }[type];
      const url = raw && ['active', 'scheduled'].includes(status) ? `${root}${prefix}${raw}${type === 'family' ? '' : `?workspace=${encodeURIComponent(req.teacherWorkspace.key)}`}` : null;
      return { id: `${type}:${row._id}`, kind: type, title, student: byStudent.get(String(row.studentId)), status, url, expiresAt, createdAt: row.shareLink?.createdAt || row.createdAt };
    }));
    const total = parts.reduce((n, p) => n + p.count, 0);
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { next(error); }
});

// Remove only the link, never the lesson, assignment, recording, or student.
router.delete('/parent-links/:kind/:id', async (req, res, next) => {
  try {
    const { kind, id } = req.params;
    if (!types.includes(kind) || !mongoose.isValidObjectId(id)) throw bad('Invalid link.');
    const now = new Date();
    if (kind === 'family') {
      const deleted = await TeacherFamilyGrant.findOneAndDelete({ _id: id, workspaceId: req.teacherWorkspace._id, $or: [{ enabled: false }, { expiresAt: { $lte: now } }] });
      if (!deleted) return res.status(404).json({ success: false, message: 'Expired or disabled link not found.' });
      return res.json({ success: true });
    }
    const schemas = { homework: ['Homework', homeworkSchema], quiz: ['Quiz', quizSchema], game: ['GameLink', gameLinkSchema], recording: ['RecordingLink', recordingLinkSchema] };
    const [name, schema] = schemas[kind], M = model(req.db, name, schema);
    if (kind === 'game') model(req.db, 'GameAssignment', gameAssignmentSchema);
    const query = { _id: id, teacherId: req.user.id, 'shareLink.tokenEnc': { $exists: true, $ne: null } };
    let q = M.findOne(query).select('+shareLink.tokenEnc +shareLink.tokenHash');
    if (kind === 'game') q = q.populate('assignmentId', 'active dueAt');
    const row = await q.lean();
    if (!row) return res.status(404).json({ success: false, message: 'Link not found.' });
    let inactive = false;
    if (kind === 'homework' || kind === 'quiz') inactive = linkExpiresAt(row.dueDate, req.center.timezone) <= now;
    if (kind === 'game') inactive = !row.assignmentId?.active || (row.assignmentId?.dueAt && row.assignmentId.dueAt <= now);
    if (kind === 'recording') {
      if (!row.enabled) inactive = true;
      else {
        model(req.db, 'Booking', bookingSchema); model(req.db, 'GroupClass', groupClassSchema);
        const expiry = await recordingExpiry(req.db, row);
        inactive = !!expiry && expiry <= now;
      }
    }
    if (!inactive) return res.status(409).json({ success: false, message: 'Only expired or disabled links can be deleted.' });
    // Match the token read above so a newly regenerated link is never removed.
    query['shareLink.tokenHash'] = row.shareLink.tokenHash;
    const changed = kind === 'recording' ? await M.deleteOne(query) : await M.updateOne(query, { $unset: { shareLink: 1 } });
    if (!(changed.deletedCount || changed.modifiedCount)) return res.status(409).json({ success: false, message: 'The link changed. Refresh and try again.' });
    res.json({ success: true });
  } catch (error) { next(error); }
});
export default router;
