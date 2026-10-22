// server/routes/libraryAdminRoutes.js — super admin view of every center's teaching library.
// Mounted at /api/v1/super-admin/library (verifySuperAdmin, no tenantMiddleware).
//
//   GET   /usage?q&page            every active center: used / allowance / overage / this month's charge + history
//   PATCH /centers/:id             { quotaMb (number|null), addExtraMb, note }  — change allowance / add a space pack
//   PATCH /centers/:id/history/:month  { paid: true|false }  — mark a month's overage as paid
//   GET   /settings  PUT /settings { pricePerGb, currency, copyrightEmail, planMb: { free, basic, pro, enterprise } }
//   GET   /centers/:id/files?q&page  browse a center's files (for copyright notices)
//   POST  /centers/:id/files/:fileId/takedown  { reason }  — delete the file, keep a record, email the center admin
import express from 'express';
import mongoose from 'mongoose';
import Center from '../models/master/Center.js';
import PlatformSetting from '../models/master/PlatformSetting.js';
import { verifySuperAdmin } from '../middleware/superAdminMiddleware.js';
import { getDb } from '../config/dbManager.js';
import { libraryFileSchema } from '../schemas/libraryFileSchema.js';
import { removeLibraryFile, clearAssignments } from './libraryRoutes.js';
import {
  getLibrarySettings, clearLibrarySettingsCache, libraryUsage, rollLibraryMonth, changeLibraryUsage, DEFAULT_LIBRARY_SETTINGS,
} from '../utils/libraryQuota.js';
import { readPaging, pageMeta } from '../utils/paging.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { sendEmail } from '../emails/core.js';
import logger from '../utils/logger.js';

const router = express.Router();
router.use(verifySuperAdmin);

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PROJ = 'centerName slug plan adminEmail status library';

router.get('/usage', async (req, res) => {
  try {
    const settings = await getLibrarySettings();
    const { page, limit } = readPaging(req.query, { defaultLimit: 25, maxLimit: 100 });
    const match = { status: 'active' };
    const q = String(req.query.q || '').trim().slice(0, 60);
    if (q) match.$or = [{ centerName: new RegExp(escapeRe(q), 'i') }, { slug: new RegExp(escapeRe(q), 'i') }];
    const total = await Center.countDocuments(match);
    const meta = pageMeta(page, limit, total);
    // Biggest users first
    const list = await Center.find(match).sort({ 'library.usedBytes': -1, centerName: 1 })
      .skip((meta.page - 1) * limit).limit(limit).select(PROJ).lean();
    const centers = [];
    for (let c of list) {
      c = await rollLibraryMonth(c, settings);
      const lib = c.library || {};
      centers.push({
        _id: c._id, centerName: c.centerName, slug: c.slug, plan: c.plan,
        usage: libraryUsage(c, settings),
        history: (lib.history || []).slice(-12).reverse(),
        log: (lib.log || []).slice(-10).reverse(),
      });
    }
    // Platform totals (all active centers)
    const [agg] = await Center.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, bytes: { $sum: { $ifNull: ['$library.usedBytes', 0] } }, files: { $sum: { $ifNull: ['$library.fileCount', 0] } } } },
    ]);
    res.json({ success: true, data: { centers, pagination: meta, totals: { bytes: agg?.bytes || 0, files: agg?.files || 0 }, settings } });
  } catch (err) {
    logger.error('library usage failed', { error: err?.message });
    fail(res, 500, 'Could not load library usage');
  }
});

router.patch('/centers/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid center');
    const b = req.body || {};
    const update = {};
    if (b.quotaMb !== undefined) {
      if (b.quotaMb === null || b.quotaMb === '') update.$set = { 'library.quotaMb': null };
      else {
        const v = Number(b.quotaMb);
        if (!Number.isFinite(v) || v < 0 || v > 10_000_000) return fail(res, 400, 'Allowance must be a number of MB');
        update.$set = { 'library.quotaMb': Math.round(v) };
      }
    }
    if (b.addExtraMb !== undefined && b.addExtraMb !== '' && b.addExtraMb !== 0) {
      const mb = Math.round(Number(b.addExtraMb));
      if (!Number.isFinite(mb) || Math.abs(mb) > 10_000_000) return fail(res, 400, 'Extra space must be a number of MB');
      update.$inc = { 'library.extraMb': mb };
      update.$push = { 'library.log': { $each: [{ at: new Date(), mb, note: String(b.note || '').slice(0, 200), by: req.superAdmin.email || String(req.superAdmin._id) }], $slice: -50 } };
    }
    if (!update.$set && !update.$inc) return fail(res, 400, 'Nothing to change');
    const c = await Center.findByIdAndUpdate(req.params.id, update, { new: true, projection: PROJ }).lean();
    if (!c) return fail(res, 404, 'Center not found');
    if ((c.library?.extraMb || 0) < 0) await Center.updateOne({ _id: c._id }, { $set: { 'library.extraMb': 0 } });
    await writeAuditLog({ action: 'LIBRARY_ALLOWANCE_CHANGED', superAdmin: req.superAdmin, targetId: String(c._id), targetName: c.centerName, details: b, ip: req.ip });
    const settings = await getLibrarySettings();
    const fresh = await Center.findById(c._id).select(PROJ).lean();
    res.json({ success: true, data: { usage: libraryUsage(fresh, settings) }, message: 'Library space updated' });
  } catch (err) {
    logger.error('library allowance update failed', { error: err?.message });
    fail(res, 500, 'Could not update');
  }
});

router.patch('/centers/:id/history/:month', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !/^\d{4}-\d{2}$/.test(req.params.month)) return fail(res, 400, 'Invalid request');
    const r = await Center.updateOne(
      { _id: req.params.id, 'library.history.month': req.params.month },
      { $set: { 'library.history.$.paid': req.body?.paid !== false } },
    );
    if (!r.matchedCount) return fail(res, 404, 'Month not found');
    res.json({ success: true, message: req.body?.paid !== false ? 'Marked as paid' : 'Marked as unpaid' });
  } catch {
    fail(res, 500, 'Could not update');
  }
});

router.get('/settings', async (_req, res) => {
  try { res.json({ success: true, data: await getLibrarySettings({ fresh: true }) }); }
  catch { fail(res, 500, 'Could not load settings'); }
});

router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    const cur = await getLibrarySettings({ fresh: true });
    const next = { ...cur };
    if (b.pricePerGb !== undefined) {
      const p = Number(b.pricePerGb);
      if (!Number.isFinite(p) || p < 0 || p > 1000) return fail(res, 400, 'Price per GB must be between 0 and 1000');
      next.pricePerGb = Math.round(p * 100) / 100;
    }
    if (b.currency !== undefined) {
      const c = String(b.currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) return fail(res, 400, 'Currency must be a 3-letter code like VND or USD');
      next.currency = c;
    }
    if (b.copyrightEmail !== undefined) {
      const e = String(b.copyrightEmail).trim().toLowerCase();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return fail(res, 400, 'Enter a valid copyright contact email');
      next.copyrightEmail = e;
    }
    if (b.planMb && typeof b.planMb === 'object') {
      next.planMb = { ...cur.planMb };
      for (const k of Object.keys(DEFAULT_LIBRARY_SETTINGS.planMb)) {
        if (b.planMb[k] === undefined) continue;
        const v = Number(b.planMb[k]);
        if (!Number.isFinite(v) || v < 0 || v > 10_000_000) return fail(res, 400, `Allowance for ${k} must be a number of MB`);
        next.planMb[k] = Math.round(v);
      }
    }
    await PlatformSetting.updateOne({ _id: 'library' }, { $set: { value: next } }, { upsert: true });
    clearLibrarySettingsCache();
    res.json({ success: true, data: next, message: 'Library settings saved' });
  } catch (err) {
    logger.error('library settings save failed', { error: err?.message });
    fail(res, 500, 'Could not save settings');
  }
});

router.get('/centers/:id/files', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid center');
    const c = await Center.findById(req.params.id).select('slug centerName').lean();
    if (!c) return fail(res, 404, 'Center not found');
    const db = await getDb(c.slug);
    const File = db.models.LibraryFile || db.model('LibraryFile', libraryFileSchema);
    const { page, limit } = readPaging(req.query, { defaultLimit: 25, maxLimit: 100 });
    const match = {};
    if (req.query.status === 'removed') match.status = 'removed'; else match.status = 'active';
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q) { const re = new RegExp(escapeRe(q), 'i'); match.$or = [{ title: re }, { fileName: re }, { tags: re }]; }
    const total = await File.countDocuments(match);
    const meta = pageMeta(page, limit, total);
    const files = await File.find(match).sort({ createdAt: -1 }).skip((meta.page - 1) * limit).limit(limit)
      .select('title fileName category level size downloads uploadedBy rightsConfirmed rightsConfirmedAt createdAt status removedAt removedReason').lean();
    res.json({ success: true, data: { centerName: c.centerName, files, pagination: meta } });
  } catch (err) {
    logger.error('library files (super admin) failed', { error: err?.message });
    fail(res, 500, 'Could not load files');
  }
});

router.post('/centers/:id/files/:fileId/takedown', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.fileId)) return fail(res, 400, 'Invalid request');
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!reason) return fail(res, 400, 'Give a reason (e.g. the copyright notice received)');
    const c = await Center.findById(req.params.id).select('slug centerName adminEmail').lean();
    if (!c) return fail(res, 404, 'Center not found');
    const db = await getDb(c.slug);
    const File = db.models.LibraryFile || db.model('LibraryFile', libraryFileSchema);
    const doc = await File.findOneAndUpdate(
      { _id: req.params.fileId, status: 'active' },
      { $set: { status: 'removed', removedAt: new Date(), removedReason: reason } },
      { new: true },
    ).lean();
    if (!doc) return fail(res, 404, 'File not found or already removed');
    await removeLibraryFile(doc.storageKey);
    await changeLibraryUsage(c._id, -doc.size, -1);
    await clearAssignments(db, c.slug, doc._id);
    await writeAuditLog({ action: 'LIBRARY_FILE_TAKEDOWN', superAdmin: req.superAdmin, targetId: String(c._id), targetName: c.centerName, details: { fileId: String(doc._id), title: doc.title, reason }, ip: req.ip });
    sendEmail({
      kind: 'Library takedown',
      centerName: c.centerName,
      to: c.adminEmail,
      subject: `A file was removed from your teaching library`,
      html: `<p>Hello,</p><p>The file <strong>${esc(doc.title)}</strong> (${esc(doc.fileName)}) was removed from your center's teaching library.</p>
<p><strong>Reason:</strong> ${esc(reason)}</p>
<p>Please only upload materials your center owns or is licensed to share. If you believe this was a mistake, reply to this email.</p>`,
    }).catch(() => {});
    res.json({ success: true, message: `"${doc.title}" removed and the center was notified` });
  } catch (err) {
    logger.error('library takedown failed', { error: err?.message });
    fail(res, 500, 'Could not remove the file');
  }
});

export default router;
