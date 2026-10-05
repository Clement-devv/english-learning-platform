// server/utils/monitor.js
// Records what happens on the platform for the super admin's "App Health" tab.
//
//  • recordEvent(...)    — queue one event (email sent/failed, booking made,
//                          login failed, page crashed…). Events are written to
//                          the master DB in batches every couple of seconds, so
//                          recording never slows a request down or throws.
//  • requestContext      — remembers which center the current request (or
//                          background job) belongs to, so an email sent deep
//                          inside a route is still tagged with its center.
//  • trackJob(...)       — wraps a background job's tick so the health checks
//                          can tell when a job has stopped running or keeps failing.
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import mongoose from "mongoose";
import MonitorEvent from "../models/master/MonitorEvent.js";
import Center from "../models/master/Center.js";
import logger from "./logger.js";

export const requestContext = new AsyncLocalStorage();

/** The center slug of the request/job we're running inside, if any. */
export const currentCenter = () => requestContext.getStore()?.center || null;

/** Run `fn` as part of a center (used by background jobs). */
export const runForCenter = (center, fn) => requestContext.run({ center }, fn);

// ── People ────────────────────────────────────────────────────────────────────
/** Stable key for an email address without storing the address itself. */
export const emailKey = (email) =>
  email ? "e:" + crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 24) : null;

/** "m•••@gmail.com" */
export const maskEmail = (email) => {
  const [u, d] = String(email || "").split("@");
  return d ? `${u.slice(0, 1)}•••@${d}` : "";
};

/** Actor for a person known by email (login attempts, email recipients). */
export const emailActor = (email, role = null) =>
  email ? { key: emailKey(email), role, label: maskEmail(email) } : undefined;

// ── Event buffer ──────────────────────────────────────────────────────────────
const FLUSH_MS = 2000;
const FLUSH_AT = 200;     // write early when this many are waiting
const MAX_QUEUE = 5000;   // if the DB is down, keep the newest events only
let queue = [];
let flushing = false;

const clip = (s, n) => (s == null ? "" : String(s).slice(0, n));

/**
 * Queue one event. Never throws.
 * @param {{ kind: string, action: string, ok: boolean, status?: number, msg?: string,
 *           center?: string|null, actor?: {key?, id?, role?, label?}, meta?: object }} ev
 */
export function recordEvent(ev) {
  try {
    if (!ev?.kind || !ev?.action) return;
    queue.push({
      at: new Date(),
      center: ev.center !== undefined ? ev.center : currentCenter(),
      kind: ev.kind,
      action: clip(ev.action, 80),
      ok: !!ev.ok,
      status: ev.status ?? null,
      msg: clip(ev.msg, 300),
      ...(ev.actor && (ev.actor.key || ev.actor.id) && {
        actor: {
          key: ev.actor.key || (ev.actor.id ? `u:${ev.actor.id}` : null),
          id: ev.actor.id ? String(ev.actor.id) : null,
          role: ev.actor.role || null,
          label: ev.actor.label ? clip(ev.actor.label, 80) : null,
        },
      }),
      ...(ev.meta && { meta: ev.meta }),
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (queue.length >= FLUSH_AT) flushEvents();
  } catch { /* monitoring must never break the app */ }
}

export async function flushEvents() {
  if (flushing || queue.length === 0 || mongoose.connection.readyState !== 1) return;
  flushing = true;
  const batch = queue;
  queue = [];
  try {
    await MonitorEvent.insertMany(batch, { ordered: false, lean: true });
  } catch (err) {
    logger.warn("monitor: could not save events", { error: err?.message, count: batch.length });
  } finally {
    flushing = false;
  }
}
setInterval(flushEvents, FLUSH_MS).unref();

// ── Center name → slug (for emails sent outside a request) ───────────────────
let nameMap = new Map();
let nameMapAt = 0;
async function refreshNameMap() {
  nameMapAt = Date.now();
  try {
    const list = await Center.find({}).select("slug centerName").lean();
    nameMap = new Map(list.map(c => [String(c.centerName || "").trim().toLowerCase(), c.slug]));
  } catch { /* keep the old map */ }
}
/** Best guess at the center for an email: the request's center, else by center name. */
export function centerForEmail(centerName) {
  const c = currentCenter();
  if (c) return c;
  if (Date.now() - nameMapAt > 5 * 60_000 && mongoose.connection.readyState === 1) refreshNameMap();
  return nameMap.get(String(centerName || "").trim().toLowerCase()) || null;
}

// ── Background jobs ───────────────────────────────────────────────────────────
// Kept in memory: jobs run on the first server worker, and so do the checks.
const jobs = new Map();
const startedAt = Date.now();

const jobKey = (name, center) => `${name}|${center || ""}`;
const jobEntry = (name, center, everyMs) => {
  const k = jobKey(name, center);
  if (!jobs.has(k)) jobs.set(k, { name, center: center || null, everyMs, lastRun: null, lastOk: null, lastError: null, lastErrorAt: null, runs: 0, fails: 0 });
  return jobs.get(k);
};

/**
 * Wrap a job tick. The tick runs "inside" its center (so its emails are tagged)
 * and every run is timed. Use jobFailed() from inside a tick that catches its own errors.
 */
export function trackJob(name, center, everyMs, fn) {
  jobEntry(name, center, everyMs);
  return (...args) => runForCenter(center, async () => {
    const j = jobEntry(name, center, everyMs);
    j.lastRun = new Date();
    j.runs++;
    try {
      await fn(...args);
      j.lastOk = new Date();
    } catch (err) {
      jobFailed(name, center, err);
    }
  });
}

/** Report a failure from inside a job tick. */
export function jobFailed(name, center, err) {
  const j = jobEntry(name, center || currentCenter(), null);
  j.fails++;
  j.lastError = clip(err?.message || err, 200);
  j.lastErrorAt = new Date();
  recordEvent({ kind: "job", action: name, ok: false, msg: j.lastError, center: j.center });
}

export const jobsSnapshot = () => ({ startedAt, jobs: [...jobs.values()] });
