// server/utils/aiCredits.js
// The center's AI credit budget for teacher tools (Center.aiCredits, topped up by
// the super admin). A job is checked against an estimate before it starts and
// charged by what the AI actually used when it finishes.
import Center from "../models/master/Center.js";
import TeacherWorkspace from '../models/master/TeacherWorkspace.js';

/** Credits for a Claude call: 1 credit per 4,000 tokens (input + output), at least 1. */
export const creditsForUsage = (usage = {}) =>
  Math.max(1, Math.ceil(((usage.input_tokens || 0) + (usage.output_tokens || 0)) / 4000));

/** A rough upper estimate before the job runs: PDF pages are heavier than photos. */
export const estimateCredits = (files = []) =>
  Math.max(2, files.reduce((n, f) => n + (f.mime === "application/pdf" ? 6 : 2), 0));

export async function getAiBalance(slug) {
  const M = /^tw-[a-f\d]{24}$/.test(slug) ? TeacherWorkspace : Center;
  const c = await M.findOne(M === TeacherWorkspace ? { key: slug } : { slug }).select("aiCredits").lean();
  return c?.aiCredits?.balance ?? 0;
}

/**
 * Take `amount` credits (atomic). If the balance is lower than the real cost,
 * whatever is left is taken — the work is already done. Returns what was charged.
 */
export async function chargeAiCredits(slug, amount, note) {
  const M = /^tw-[a-f\d]{24}$/.test(slug) ? TeacherWorkspace : Center;
  const scope = M === TeacherWorkspace ? { key: slug } : { slug };
  const entry = { amount: -amount, note: String(note || "AI job").slice(0, 120), by: "system", createdAt: new Date() };
  const full = await M.findOneAndUpdate(
    { ...scope, "aiCredits.balance": { $gte: amount } },
    { $inc: { "aiCredits.balance": -amount }, $push: { "aiCredits.log": { $each: [entry], $slice: -50 } } },
    { new: true },
  ).select("aiCredits.balance").lean();
  if (full) return amount;
  const c = await M.findOne(scope).select("aiCredits.balance").lean();
  const left = Math.max(0, c?.aiCredits?.balance ?? 0);
  if (left > 0) {
    await M.updateOne(
      { ...scope, "aiCredits.balance": left },
      { $set: { "aiCredits.balance": 0 }, $push: { "aiCredits.log": { $each: [{ ...entry, amount: -left }], $slice: -50 } } },
    );
  }
  return left;
}
