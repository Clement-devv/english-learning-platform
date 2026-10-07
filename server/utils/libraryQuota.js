// server/utils/libraryQuota.js
// Teaching-library storage per center (Center.library):
//   allowance = plan allowance (or the super admin's per-center override) + extra space packs
//   uploads keep working past the allowance ("overage") up to HARD_CAP_FACTOR × allowance
//   overage is billed per month on the month's PEAK usage (monthPeakBytes → history[])
// Billing is manual: the super admin sees what each center owes (routes/libraryAdminRoutes.js).
import Center from '../models/master/Center.js';
import PlatformSetting from '../models/master/PlatformSetting.js';
import { sendEmail } from '../emails/core.js';
import logger from './logger.js';

export const MB = 1024 * 1024;
export const GB = 1024 * MB;
export const HARD_CAP_FACTOR = 2;
export const MAX_FILE_BYTES = 25 * MB;

export const DEFAULT_LIBRARY_SETTINGS = {
  pricePerGb: 1,            // charged per extra GB per month
  currency: 'USD',
  copyrightEmail: '',       // shown on library pages for takedown requests
  planMb: { free: 500, basic: 2048, pro: 10240, enterprise: 51200 },
};

let cache = null;
let cacheAt = 0;
export async function getLibrarySettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < 60_000) return cache;
  const doc = await PlatformSetting.findById('library').lean();
  const v = doc?.value || {};
  cache = {
    ...DEFAULT_LIBRARY_SETTINGS, ...v,
    planMb: { ...DEFAULT_LIBRARY_SETTINGS.planMb, ...(v.planMb || {}) },
  };
  cacheAt = Date.now();
  return cache;
}
export const clearLibrarySettingsCache = () => { cache = null; };

export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // "2026-10"

/** Usage numbers for one center (pure). */
export function libraryUsage(center, settings) {
  const lib = center.library || {};
  const planMb = settings.planMb[center.plan] ?? settings.planMb.basic;
  const baseMb = lib.quotaMb ?? planMb;
  const allowanceBytes = Math.round((baseMb + (lib.extraMb || 0)) * MB);
  const usedBytes = Math.max(0, lib.usedBytes || 0);
  const peakBytes = Math.max(usedBytes, lib.month === monthKey() ? (lib.monthPeakBytes || 0) : 0);
  const overageBytes = Math.max(0, peakBytes - allowanceBytes);
  const overageGb = Math.ceil((overageBytes / GB) * 10) / 10; // bill in 0.1 GB steps
  return {
    planMb, baseMb, extraMb: lib.extraMb || 0, quotaOverrideMb: lib.quotaMb ?? null,
    allowanceBytes, hardCapBytes: allowanceBytes * HARD_CAP_FACTOR,
    usedBytes, fileCount: lib.fileCount || 0,
    month: monthKey(), monthPeakBytes: peakBytes,
    overageBytes, overageGb,
    estimatedCharge: Math.round(overageGb * settings.pricePerGb * 100) / 100,
    currency: settings.currency,
    percent: allowanceBytes ? Math.round((usedBytes / allowanceBytes) * 100) : 0,
  };
}

/**
 * Start a new billing month if needed: last month's peak goes into history.
 * Safe to call often (only writes when the month changed).
 */
export async function rollLibraryMonth(center, settings) {
  const lib = center.library || {};
  const now = monthKey();
  if (lib.month === now) return center;
  const set = { 'library.month': now, 'library.monthPeakBytes': lib.usedBytes || 0 };
  const update = { $set: set };
  if (lib.month) {
    const u = libraryUsage({ ...center, library: { ...lib, month: monthKey() } }, settings); // allowance as of now
    const peak = Math.max(lib.monthPeakBytes || 0, lib.usedBytes || 0);
    const over = Math.max(0, peak - u.allowanceBytes);
    const overGb = Math.ceil((over / GB) * 10) / 10;
    update.$push = { 'library.history': { $each: [{
      month: lib.month, peakBytes: peak, allowanceBytes: u.allowanceBytes, overageBytes: over,
      overageGb: overGb, amount: Math.round(overGb * settings.pricePerGb * 100) / 100, currency: settings.currency,
    }], $slice: -24 } };
  }
  await Center.updateOne({ _id: center._id, 'library.month': lib.month ?? null }, update);
  return Center.findById(center._id).select('centerName slug plan adminEmail library').lean();
}

/** Change a center's stored bytes (+ upload / − delete), keep the month's peak, send warnings. */
export async function changeLibraryUsage(centerId, deltaBytes, deltaFiles) {
  const settings = await getLibrarySettings();
  let center = await Center.findById(centerId).select('centerName slug plan adminEmail library').lean();
  center = await rollLibraryMonth(center, settings);
  const after = await Center.findOneAndUpdate(
    { _id: centerId },
    { $inc: { 'library.usedBytes': deltaBytes, 'library.fileCount': deltaFiles } },
    { new: true, projection: 'centerName slug plan adminEmail library' },
  ).lean();
  if (deltaBytes > 0) {
    await Center.updateOne(
      { _id: centerId, $or: [{ 'library.monthPeakBytes': { $lt: after.library.usedBytes } }, { 'library.monthPeakBytes': null }] },
      { $set: { 'library.monthPeakBytes': after.library.usedBytes } },
    );
  }
  await maybeWarn(after, settings);
  return libraryUsage(after, settings);
}

/** Email the center admin once when crossing 80% and 100% of the allowance. */
async function maybeWarn(center, settings) {
  const u = libraryUsage(center, settings);
  const level = u.percent >= 100 ? '100' : u.percent >= 80 ? '80' : null;
  const prev = center.library?.warned || null;
  if (level === prev) return;
  await Center.updateOne({ _id: center._id }, { $set: { 'library.warned': level } });
  if (!level || (prev === '100' && level === '80')) return; // only warn going up
  const gb = (b) => `${(b / GB).toFixed(2)} GB`;
  sendEmail({
    kind: `Library storage ${level}%`,
    centerName: center.centerName,
    to: center.adminEmail,
    subject: level === '100'
      ? `Your teaching library is over its storage allowance`
      : `Your teaching library is at 80% of its storage`,
    html: `<p>Hello,</p>
<p>Your center's teaching library is using <strong>${gb(u.usedBytes)}</strong> of its <strong>${gb(u.allowanceBytes)}</strong> allowance.</p>
${level === '100'
    ? `<p>Uploads still work — extra space is billed at ${settings.currency} ${settings.pricePerGb} per GB per month — up to ${gb(u.hardCapBytes)}. Delete files you no longer need or ask us for more space.</p>`
    : `<p>When you go over the allowance, uploads keep working and the extra space is billed at ${settings.currency} ${settings.pricePerGb} per GB per month.</p>`}`,
  }).catch(err => logger.warn('library warning email failed', { error: err?.message }));
}
