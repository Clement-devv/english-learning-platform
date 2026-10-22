// server/routes/monitorRoutes.js
// App Health — the super admin's view of whether the platform is working.
//
//   clientErrorRoutes  POST /api/v1/client-errors           browsers report page crashes (no login needed)
//   monitorAdminRoutes (super admin only, /api/v1/super-admin/monitor)
//     GET  /status            latest checks + open alerts + alert settings
//     GET  /events            the event log (filters: kind, ok, center, q) — paged
//     GET  /trouble           teachers / students having difficulties (last 7 days)
//     GET  /settings, PUT /settings      where alerts go
//     POST /test-alert        send a test alert on every channel
//     POST /run               run the checks now
//     POST /alerts/:id/ack    stop reminders for an open alert
//
// Data: models/master/Monitor*.js · recording: utils/monitor.js · checks: utils/monitorChecks.js
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import MonitorEvent from "../models/master/MonitorEvent.js";
import MonitorAlert from "../models/master/MonitorAlert.js";
import MonitorState from "../models/master/MonitorState.js";
import Center from "../models/master/Center.js";
import { verifySuperAdmin } from "../middleware/superAdminMiddleware.js";
import { getDb } from "../config/dbManager.js";
import { getCenterSecret } from "../utils/jwtUtils.js";
import { JWT_VERIFY_OPTIONS } from "../config/config.js";
import { teacherSchema } from "../schemas/teacherSchema.js";
import { studentSchema } from "../schemas/studentSchema.js";
import { adminSchema } from "../schemas/adminSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { recordEvent } from "../utils/monitor.js";
import { runChecks } from "../utils/monitorChecks.js";
import { notifySuperAdmin, getAlertSettings, whatsappProvider } from "../utils/alertNotifier.js";
import { readPaging, pageMeta } from "../utils/paging.js";
import logger from "../utils/logger.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const serverError = (res) => res.status(500).json({ success: false, message: "Something went wrong" });

// ── Browsers report crashes ───────────────────────────────────────────────────
export const clientErrorRoutes = express.Router();

// Small in-memory limit per IP: a broken page in a loop can't flood the log
const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();

clientErrorRoutes.post("/", (req, res) => {
  const ip = req.ip || "?";
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  if (n > 20) return res.status(204).end();
  try {
    const b = req.body || {};
    const slug = String(req.headers["x-center-slug"] || "").toLowerCase();
    const center = SLUG_RE.test(slug) ? slug : null;
    // Who: only trust a token that verifies for that center
    let actor;
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (token && center) {
      try {
        const d = jwt.verify(token, getCenterSecret(center), JWT_VERIFY_OPTIONS);
        if (d?.id && d.centerId === center) actor = { id: String(d.id), role: d.role || null };
      } catch { /* anonymous */ }
    }
    const action = ["crash", "chunk-load", "unhandled"].includes(b.type) ? b.type : "crash";
    recordEvent({
      kind: "client", action, ok: false, center, actor,
      msg: String(b.message || "Unknown error").slice(0, 300),
      meta: {
        page: String(b.page || "").replace(/[?#].*$/, "").slice(0, 120),
        where: String(b.where || "").slice(0, 300),
      },
    });
  } catch { /* ignore */ }
  res.status(204).end();
});

// ── Super admin ───────────────────────────────────────────────────────────────
export const monitorAdminRoutes = express.Router();
monitorAdminRoutes.use(verifySuperAdmin);

const channelInfo = (settings) => ({
  emailEnabled: settings.emailEnabled,
  whatsappEnabled: settings.whatsappEnabled,
  alertEmails: settings.alertEmails || [],
  whatsappPhone: settings.whatsappPhone || "",
  whatsappProvider: whatsappProvider(),
});

monitorAdminRoutes.get("/status", async (_req, res) => {
  try {
    const [status, open, recent, settings] = await Promise.all([
      MonitorState.findById("status").lean(),
      MonitorAlert.find({ status: "open" }).sort({ openedAt: -1 }).lean(),
      MonitorAlert.find({ status: "resolved" }).sort({ resolvedAt: -1 }).limit(10).lean(),
      getAlertSettings(),
    ]);
    res.json({
      success: true,
      data: {
        computedAt: status?.computedAt || null,
        overall: status?.overall || "unknown",
        checks: status?.checks || [],
        centers: status?.scan?.centers || [],
        alerts: { open, recent },
        settings: channelInfo(settings),
      },
    });
  } catch (err) {
    logger.error("monitor status failed", { error: err?.message });
    serverError(res);
  }
});

monitorAdminRoutes.get("/events", async (req, res) => {
  try {
    const { page, limit } = readPaging(req.query, { defaultLimit: 25, maxLimit: 100 });
    const match = {};
    const kinds = ["email", "login", "booking", "class", "learning", "payment", "request", "client", "job"];
    if (kinds.includes(req.query.kind)) match.kind = req.query.kind;
    if (req.query.ok === "0") match.ok = false;
    if (req.query.ok === "1") match.ok = true;
    if (SLUG_RE.test(String(req.query.center || ""))) match.center = req.query.center;
    if (req.query.actor && typeof req.query.actor === "string") match["actor.key"] = req.query.actor.slice(0, 80);
    const q = String(req.query.q || "").trim().slice(0, 60);
    if (q) match.$or = [{ action: new RegExp(escapeRe(q), "i") }, { msg: new RegExp(escapeRe(q), "i") }];
    const hours = Math.min(Math.max(parseInt(req.query.hours, 10) || 24 * 7, 1), 24 * 30);
    match.at = { $gte: new Date(Date.now() - hours * 3600_000) };

    const total = await MonitorEvent.countDocuments(match);
    const meta = pageMeta(page, limit, total);
    const events = await MonitorEvent.find(match).sort({ at: -1 })
      .skip((meta.page - 1) * limit).limit(limit).lean();
    res.json({ success: true, data: { events, pagination: meta } });
  } catch (err) {
    logger.error("monitor events failed", { error: err?.message });
    serverError(res);
  }
});

/** Names + ID codes for people the events only know by id. */
async function resolvePeople(rows) {
  const byCenter = new Map();
  for (const r of rows) {
    if (!r.center || !r.id || !mongoose.isValidObjectId(r.id)) continue;
    if (!byCenter.has(r.center)) byCenter.set(r.center, []);
    byCenter.get(r.center).push(r);
  }
  const models = {
    teacher:  ["Teacher", teacherSchema, "firstName lastName teacherCode", "teacherCode"],
    student:  ["Student", studentSchema, "firstName lastName studentId", "studentId"],
    admin:    ["Admin", adminSchema, "firstName lastName", null],
    subadmin: ["SubAdmin", subAdminSchema, "firstName lastName", null],
  };
  await Promise.allSettled([...byCenter].map(async ([slug, list]) => {
    const db = await getDb(slug);
    for (const [role, [model, schema, fields, codeField]] of Object.entries(models)) {
      const want = list.filter(r => (r.role || "").replace("-", "") === role);
      if (!want.length) continue;
      const M = db.models[model] || db.model(model, schema);
      const found = await M.find({ _id: { $in: want.map(r => r.id) } }).select(fields).lean();
      const map = new Map(found.map(p => [String(p._id), p]));
      for (const r of want) {
        const p = map.get(r.id);
        if (p) { r.name = `${p.firstName || ""} ${p.lastName || ""}`.trim() || r.name; if (codeField) r.code = p[codeField] || null; }
      }
    }
  }));
}

const ACTION_WORDS = {
  login: "sign in", "login-2fa": "2-step code", "forgot-password": "password reset", "reset-password": "password reset",
  "booking-create": "booking a class", "booking-request": "requesting a class", "booking-accept": "accepting a class",
  "booking-reject": "rejecting a class", "booking-cancel": "cancelling a class", "group-enroll": "joining a group class",
  "class-join": "joining a class", "class-open": "opening the classroom", "class-attendance": "class attendance",
  "class-complete": "completing a class", "homework-submit": "submitting homework", "quiz-attempt": "taking a quiz",
  crash: "page crashed", "chunk-load": "page failed to load (connection)",
};

monitorAdminRoutes.get("/trouble", async (_req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600_000);
    const [rows, status, centers] = await Promise.all([
      MonitorEvent.aggregate([
        { $match: { at: { $gte: since }, ok: false, "actor.key": { $type: "string" } } },
        { $sort: { at: 1 } },
        { $group: {
          _id: { center: "$center", key: "$actor.key" },
          n: { $sum: 1 },
          system: { $sum: { $cond: [{ $gte: ["$status", 500] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ["$status", 429] }, 1, 0] } },
          crashes: { $sum: { $cond: [{ $eq: ["$kind", "client"] }, 1, 0] } },
          emails: { $sum: { $cond: [{ $eq: ["$kind", "email"] }, 1, 0] } },
          actions: { $addToSet: "$action" },
          lastAt: { $last: "$at" }, lastMsg: { $last: "$msg" },
          id: { $last: "$actor.id" }, role: { $last: "$actor.role" }, label: { $last: "$actor.label" },
        } },
        { $match: { $or: [{ n: { $gte: 3 } }, { system: { $gte: 1 } }, { locked: { $gte: 1 } }, { crashes: { $gte: 1 } }, { emails: { $gte: 1 } }] } },
        { $sort: { lastAt: -1 } },
        { $limit: 150 },
      ]),
      MonitorState.findById("status").select("scan.people").lean(),
      Center.find({}).select("slug centerName").lean(),
    ]);
    const centerName = new Map(centers.map(c => [c.slug, c.centerName]));

    const people = rows.map(r => {
      const issues = [];
      if (r.emails) issues.push(`${r.emails} email${r.emails === 1 ? "" : "s"} to them failed`);
      if (r.locked) issues.push("locked out after too many tries");
      if (r.crashes) issues.push(`${r.crashes} page crash${r.crashes === 1 ? "" : "es"}`);
      const other = r.actions.filter(a => a !== "crash" && a !== "chunk-load" && !/[A-Z]/.test(a));
      if (other.length) issues.push(`problems ${other.slice(0, 3).map(a => ACTION_WORDS[a] || a).join(", ")}`);
      return {
        source: "events", key: r._id.key, center: r._id.center, centerName: centerName.get(r._id.center) || r._id.center || "—",
        role: r.role, id: r.id, name: r.label || null, code: null,
        severity: r.system || r.locked || r.emails ? "high" : "medium",
        count: r.n, text: issues.join(" · ") || `${r.n} failed actions`, lastMsg: r.lastMsg, lastAt: r.lastAt,
      };
    });
    await resolvePeople(people);

    const scanned = (status?.scan?.people || []).map(p => ({
      source: "classes", key: `${p.role}:${p.id}`, center: p.center, centerName: p.centerName,
      role: p.role, id: p.id, name: p.name, code: p.code, severity: p.issue === "teacher-no-show" ? "high" : "medium",
      count: p.count, text: p.text, lastMsg: "", lastAt: null,
    }));

    res.json({ success: true, data: { people: [...people, ...scanned] } });
  } catch (err) {
    logger.error("monitor trouble failed", { error: err?.message });
    serverError(res);
  }
});

monitorAdminRoutes.get("/settings", async (_req, res) => {
  try { res.json({ success: true, data: channelInfo(await getAlertSettings()) }); }
  catch { serverError(res); }
});

monitorAdminRoutes.put("/settings", async (req, res) => {
  try {
    const b = req.body || {};
    const set = {};
    if (typeof b.emailEnabled === "boolean") set.emailEnabled = b.emailEnabled;
    if (typeof b.whatsappEnabled === "boolean") set.whatsappEnabled = b.whatsappEnabled;
    if (b.alertEmails !== undefined) {
      const list = (Array.isArray(b.alertEmails) ? b.alertEmails : String(b.alertEmails).split(/[,\s;]+/))
        .map(e => String(e).trim().toLowerCase()).filter(Boolean);
      const bad = list.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
      if (bad) return res.status(400).json({ success: false, message: `"${bad}" is not a valid email address` });
      if (list.length > 5) return res.status(400).json({ success: false, message: "Up to 5 alert emails" });
      set.alertEmails = [...new Set(list)];
    }
    if (b.whatsappPhone !== undefined) {
      const phone = String(b.whatsappPhone || "").replace(/[\s()-]/g, "");
      if (phone && !/^\+\d{7,15}$/.test(phone)) return res.status(400).json({ success: false, message: "WhatsApp number must be in international format, e.g. +84912345678" });
      set.whatsappPhone = phone;
    }
    await MonitorState.updateOne({ _id: "settings" }, { $set: set }, { upsert: true });
    res.json({ success: true, data: channelInfo(await getAlertSettings()), message: "Alert settings saved" });
  } catch (err) {
    logger.error("monitor settings save failed", { error: err?.message });
    serverError(res);
  }
});

let lastTest = 0;
monitorAdminRoutes.post("/test-alert", async (_req, res) => {
  if (Date.now() - lastTest < 30_000) return res.status(429).json({ success: false, message: "Please wait 30 seconds between test alerts" });
  lastTest = Date.now();
  try {
    const delivery = await notifySuperAdmin({ level: "test", title: "Test alert", message: "This is a test from App Health. If you got this, alerts reach you." });
    res.json({ success: true, data: { delivery }, message: "Test alert sent" });
  } catch (err) {
    logger.error("monitor test alert failed", { error: err?.message });
    serverError(res);
  }
});

let lastRun = 0;
monitorAdminRoutes.post("/run", async (_req, res) => {
  if (Date.now() - lastRun < 15_000) return res.status(429).json({ success: false, message: "Checks just ran — try again in a few seconds" });
  lastRun = Date.now();
  try {
    const r = await runChecks({ forceScan: true });
    if (!r) return res.status(409).json({ success: false, message: "Checks are already running — refresh in a moment" });
    res.json({ success: true, data: { overall: r.overall }, message: "Checks finished" });
  } catch { serverError(res); }
});

monitorAdminRoutes.post("/alerts/:id/ack", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid alert" });
    const a = await MonitorAlert.findOneAndUpdate(
      { _id: req.params.id, status: "open" },
      { $set: { acknowledgedAt: new Date(), acknowledgedBy: req.superAdmin?.email || String(req.superAdmin?._id || "") } },
      { new: true },
    ).lean();
    if (!a) return res.status(404).json({ success: false, message: "Alert not found or already resolved" });
    res.json({ success: true, data: a, message: "Acknowledged — no more reminders for this alert" });
  } catch { serverError(res); }
});
