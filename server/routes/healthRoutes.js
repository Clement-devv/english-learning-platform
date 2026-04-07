// server/routes/healthRoutes.js
// GET /api/health        — full check (DB ping, memory, uptime)
// GET /api/health/live   — liveness probe: is the process alive? (no DB check)
// GET /api/health/ready  — readiness probe: is the DB connected and ready?

import { Router } from "express";
import mongoose from "mongoose";
import os from "os";

const router = Router();

const DB_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

// ── Liveness — used by load balancers/PM2 to know if the process is up ────────
// Never hits the DB. If this fails the process is dead.
router.get("/live", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// ── Readiness — used to know if the server can handle traffic ─────────────────
// Checks master DB. If this fails, remove from load balancer rotation.
router.get("/ready", async (_req, res) => {
  const state = mongoose.connection.readyState;
  if (state !== 1) {
    return res.status(503).json({
      status: "not_ready",
      db: DB_STATES[state] ?? "unknown",
    });
  }

  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: "ready", db: "connected" });
  } catch {
    res.status(503).json({ status: "not_ready", db: "ping_failed" });
  }
});

// ── Full health — detailed diagnostics ───────────────────────────────────────
router.get("/", async (_req, res) => {
  const start = Date.now();

  // Master DB ping
  let dbStatus = "disconnected";
  let dbLatencyMs = null;
  const state = mongoose.connection.readyState;
  if (state === 1) {
    try {
      const t = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatencyMs = Date.now() - t;
      dbStatus = "connected";
    } catch {
      dbStatus = "ping_failed";
    }
  } else {
    dbStatus = DB_STATES[state] ?? "unknown";
  }

  const memBytes  = process.memoryUsage();
  const toMB      = (b) => Math.round(b / 1024 / 1024);
  const healthy   = dbStatus === "connected";

  res.status(healthy ? 200 : 503).json({
    status:   healthy ? "healthy" : "degraded",
    uptime:   `${Math.floor(process.uptime())}s`,
    responseTimeMs: Date.now() - start,
    db: {
      status:    dbStatus,
      latencyMs: dbLatencyMs,
    },
    memory: {
      heapUsedMB:  toMB(memBytes.heapUsed),
      heapTotalMB: toMB(memBytes.heapTotal),
      rssMB:       toMB(memBytes.rss),
    },
    system: {
      platform:    process.platform,
      nodeVersion: process.version,
      cpus:        os.cpus().length,
      loadAvg:     os.loadavg().map(n => Math.round(n * 100) / 100),
    },
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

export default router;
