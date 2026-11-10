import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';
import { teacherModeModels } from '../schemas/teacherModeSchemas.js';
import { s3Enabled, uploadToS3, getPresignedUrl, deleteFromS3 } from '../utils/s3.js';
import { pdfHasActiveContent } from './homeworkRoutes.js';

const router = express.Router();
const schema = new mongoose.Schema({ centerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, title: { type: String, required: true, maxlength: 160 }, key: { type: String, required: true }, bytes: { type: Number, required: true }, cloud: Boolean }, { timestamps: true });
const Resource = req => req.db.models.TeacherResource || req.db.model('TeacherResource', schema);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/teacher-resources');
const maxBytes = 200 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3, fieldSize: 1000 } });
const action = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
router.get('/resources', action(async (req, res) => {
  const filter = req.query.managedCenterId ? { centerId: req.query.managedCenterId } : {};
  res.json({ success: true, data: await Resource(req).find(filter).select('-key').sort({ createdAt: -1 }).limit(500).lean() });
}));
router.post('/resources', (req, res, next) => { (async () => {
  const centerId = req.query.managedCenterId;
  if (!mongoose.isValidObjectId(centerId) || !await teacherModeModels(req.db).ManagedCenter.exists({ _id: centerId, archived: false })) return res.status(400).json({ message: 'Choose an active center first.' });
  req.resourceCenter = centerId;
  next();
})().catch(next); }, upload.single('pdf'), action(async (req, res) => {
  if (!req.file || req.file.buffer.subarray(0, 5).toString() !== '%PDF-' || pdfHasActiveContent(req.file.buffer) || req.body.rightsConfirmed !== 'true') return res.status(400).json({ message: 'Upload a passive PDF and confirm your right to use it.' });
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title || title.length > 160) return res.status(400).json({ message: 'Enter a title up to 160 characters.' });
  const reserved = await TeacherWorkspace.findOneAndUpdate({ _id: req.teacherWorkspace._id, $expr: { $lte: [{ $ifNull: ['$resourceBytes', 0] }, maxBytes - req.file.size] } }, { $inc: { resourceBytes: req.file.size } });
  if (!reserved) return res.status(413).json({ message: 'Your resource library has reached its 200 MB allowance.' });
  const id = new mongoose.Types.ObjectId(), key = `centers/${req.teacherWorkspace.key}/resources/${id}.pdf`, cloud = s3Enabled();
  try {
    if (cloud) await uploadToS3(req.file.buffer, key, 'application/pdf');
    else { await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, `${id}.pdf`), req.file.buffer); }
    const record = await Resource(req).create({ _id: id, centerId: req.resourceCenter, title, key, bytes: req.file.size, cloud });
    res.status(201).json({ success: true, data: { id: record._id, title } });
  } catch (error) {
    await TeacherWorkspace.updateOne({ _id: req.teacherWorkspace._id }, { $inc: { resourceBytes: -req.file.size } });
    if (cloud) await deleteFromS3(key); else await fs.unlink(path.join(root, `${id}.pdf`)).catch(() => {});
    throw error;
  }
}));
router.get('/resources/:id/download', action(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const record = await Resource(req).findById(req.params.id);
  if (!record) return res.status(404).end();
  if (record.cloud) return res.json({ success: true, data: { url: await getPresignedUrl(record.key, 300) } });
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="teaching-resource.pdf"', 'Cache-Control': 'private, no-store' });
  return res.sendFile(path.join(root, `${record._id}.pdf`));
}));
router.delete('/resources/:id', action(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const record = await Resource(req).findOneAndDelete({ _id: req.params.id });
  if (!record) return res.status(404).end();
  if (record.cloud) await deleteFromS3(record.key); else await fs.unlink(path.join(root, `${record._id}.pdf`)).catch(() => {});
  await TeacherWorkspace.updateOne({ _id: req.teacherWorkspace._id, resourceBytes: { $gte: record.bytes } }, { $inc: { resourceBytes: -record.bytes } });
  res.json({ success: true });
}));
export default router;
