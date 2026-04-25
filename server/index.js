import dotenv from "dotenv";
dotenv.config();

import logger from "./utils/logger.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import { 
  apiLimiter,
  realtimeLimiter,  
  pollingLimiter,   
  loginLimiter
} from "./middleware/rateLimiter.js";
import { config } from "./config/config.js";
import { 
  securityHeaders, 
  noSqlInjectionProtection,
  xssProtection,
  parameterPollutionProtection,
  requestLimits
} from "./middleware/security.js";

logger.info("✅ Environment Check:");
logger.info("  MongoDB:", process.env.MONGO_URI ? "✓ Configured" : "✗ Missing");
logger.info("  JWT Secret:", process.env.JWT_SECRET ? "✓ Configured" : "✗ Missing");
logger.info("  Email:", process.env.EMAIL_USER ? "✓ Configured" : "✗ Missing");

import { initializeSocket } from './socketServer.js';
import { verifyEmailConfig } from "./utils/emailService.js";
import { startReminderScheduler } from "./utils/reminderScheduler.js";
import { startRecordingCleanup } from "./routes/recordingRoutes.js";
import { startProgressReportScheduler } from "./utils/progressReportScheduler.js";
import { startMissedClassScheduler } from "./utils/missedClassScheduler.js";
import v1Router from "./routes/v1.js";
import Center from "./models/master/Center.js";
import SuperAdmin from "./models/master/SuperAdmin.js";
import { getDb, closeAllConnections } from "./config/dbManager.js";
import { errorHandler, notFoundHandler, registerProcessHandlers } from "./middleware/errorHandler.js";
import healthRoutes from "./routes/healthRoutes.js";
import { sweepExpiredSessionsFromDb } from "./utils/sessionManager.js";
import { SESSION_CLEANUP_INTERVAL_MS } from "./config/constants.js";

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO (async — sets up Redis adapter when REDIS_URL is set)
const io = await initializeSocket(httpServer);

// Trust proxy if behind reverse proxy
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(securityHeaders);
app.use(noSqlInjectionProtection);
app.use(xssProtection);
app.use(parameterPollutionProtection);

// CORS Configuration — allows static origins + verified custom domains
app.use(cors({
  origin: async (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin)) return callback(null, true);

    // Check if origin matches a verified custom domain
    try {
      const hostname = new URL(origin).hostname;
      const match = await Center.findOne({ customDomain: hostname, domainVerified: true });
      if (match) return callback(null, true);
    } catch (_) { /* invalid URL — fall through */ }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-center-slug'],
  maxAge: 86400
}));

// Make io available to routes if needed
app.set('io', io);

// Public uploads — branding assets and teacher photos are needed before / outside auth
app.use('/uploads/branding', express.static(path.join(__dirname, 'uploads', 'branding')));
app.use('/uploads/teachers', express.static(path.join(__dirname, 'uploads', 'teachers')));

// Block direct static access to private upload directories.
// Clients must go through the authenticated API routes instead:
//   recordings → GET /api/recordings/:id/stream  (verifyToken)
//   content    → GET /api/content/file/:bookingId (verifyToken)
//   homework   → GET /api/homework/... routes     (verifyToken)
app.use('/uploads/recordings', (_req, res) => res.status(403).json({ message: 'Access denied' }));
app.use('/uploads/content',    (_req, res) => res.status(403).json({ message: 'Access denied' }));
app.use('/uploads/homework',   (_req, res) => res.status(403).json({ message: 'Access denied' }));

// Body parser with size limits
app.use(express.json(requestLimits.json));
app.use(express.urlencoded(requestLimits.urlencoded));

app.use(compression({
  level: 6,           // compression level 1-9 (6 = good balance of speed vs size)
  threshold: 1024,    // only compress responses > 1KB (no point compressing tiny ones)
  filter: (req, res) => {
    // Don't compress SSE streams (Socket.IO handles its own compression)
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// Health checks — no rate limit, no auth, no tenant middleware
app.use("/api/health", healthRoutes);

// CSP violation reports — browsers POST here when a Content-Security-Policy is violated.
// No auth required (reports come from the browser, before any JS runs).
// Logs in production so you can spot real violations vs. browser extensions.
app.post("/api/v1/csp-report", express.json({ type: "application/csp-report", limit: "10kb" }), (req, res) => {
  if (config.nodeEnv === "production") {
    const report = req.body?.["csp-report"] || req.body;
    logger.warn("CSP violation:", JSON.stringify(report));
  }
  res.status(204).end();
});

app.use("/api/v1/", apiLimiter);

app.use("/api/v1/classroom",   realtimeLimiter);
app.use("/api/v1/agora",       realtimeLimiter);

app.use("/api/v1/group-chats", pollingLimiter);

// In PM2 cluster mode each worker gets NODE_APP_INSTANCE = '0', '1', '2'…
// Only the first worker (or a non-clustered process) should run background
// schedulers and sweep jobs — otherwise every instance fires the same job.
const isFirstWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 50,  // was 20 — supports up to 4 cluster instances × 50 = 200 total connections
    minPoolSize: 10,  // was 5
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
  })
  .then(async () => {
    logger.info("Master MongoDB connected");

    // Schedulers and sweep jobs run on the first worker only.
    // In PM2 cluster mode all other workers skip this block entirely.
    if (isFirstWorker) {
      try {
        const activeCenters = await Center.find({ status: "active" }).select("slug");
        logger.info(`🏢 Found ${activeCenters.length} active center(s) — starting per-center schedulers`);
        for (const center of activeCenters) {
          const db = await getDb(center.slug);
          startReminderScheduler(db);
          startRecordingCleanup(db);
          startProgressReportScheduler(db);
          startMissedClassScheduler(db);
        }

        // Hourly background sweep: remove expired/inactive sessions from all
        // center DBs. Re-fetches active centers each tick so newly added centers
        // are included without a server restart. Processed in batches of 10 to
        // avoid opening too many DB connections simultaneously.
        setInterval(async () => {
          try {
            const currentCenters = await Center.find({ status: "active" }).select("slug").lean();
            for (let i = 0; i < currentCenters.length; i += 10) {
              const batch = currentCenters.slice(i, i + 10);
              await Promise.allSettled(batch.map(async (center) => {
                try {
                  const db = await getDb(center.slug);
                  await sweepExpiredSessionsFromDb(db);
                } catch (e) {
                  logger.error(`Session sweep failed for ${center.slug}:`, { error: e?.message });
                }
              }));
            }
          } catch (e) {
            logger.error("Session sweep: failed to fetch centers:", { error: e?.message });
          }
        }, SESSION_CLEANUP_INTERVAL_MS);

        // Daily purge job: hard-delete center data for soft-deleted centers whose
        // scheduledDeletionAt has passed. Drops the per-center MongoDB database.
        setInterval(async () => {
          try {
            const due = await Center.find({
              status: "deleted",
              scheduledDeletionAt: { $lte: new Date() },
            }).select("slug centerName").lean();

            for (const center of due) {
              try {
                const db = await getDb(center.slug);
                await db.dropDatabase();
                await closeAllConnections();
                await Center.deleteOne({ slug: center.slug });
                logger.info(`🗑️ Purged center DB and record: ${center.slug} (${center.centerName})`);
              } catch (e) {
                logger.error(`Purge failed for ${center.slug}:`, { error: e?.message });
              }
            }
          } catch (e) {
            logger.error("Purge job: failed to fetch due centers:", { error: e?.message });
          }
        }, 24 * 60 * 60 * 1000); // once per day
      } catch (err) {
        logger.error("❌ Failed to start per-center schedulers:", { error: err?.message });
      }
    } else {
      logger.info(`⏭️ Worker ${process.env.NODE_APP_INSTANCE} — skipping schedulers (handled by worker 0)`);
    }

    // Master DB keep-alive ping
    setInterval(async () => {
      try {
        await mongoose.connection.db.admin().ping();
        logger.info('🏓 Master DB keep-alive ping');
      } catch (e) {
        logger.error('Master DB ping failed:', { error: e?.message });
      }
    }, 5 * 60 * 1000);
  })
  .catch((err) => {
    logger.error("❌ MongoDB connection error:", { error: err?.message });
    process.exit(1);
  });



// Root endpoint — full structure only in development
app.get("/", (req, res) => {
  if (config.nodeEnv === 'production') {
    return res.json({ message: "API is running" });
  }
  res.json({
    message: "📘 English Teaching Platform API is running!",
    endpoints: {
      teachers: {
        "GET /api/teachers": "Get all teachers",
        "POST /api/teachers": "Create new teacher",
        "PUT /api/teachers/:id": "Update teacher",
        "DELETE /api/teachers/:id": "Delete teacher",
      },
      students: {
        "GET /api/students": "Get all students",
        "POST /api/students": "Create new student",
        "PUT /api/students/:id": "Update student",
        "DELETE /api/students/:id": "Delete student",
        "POST /api/students/:id/payment": "Record payment for student",
        "GET /api/students/:id/payments": "Get payments for student",
      },
      payments: {
        "GET /api/payments": "Get all payments (global history)",
      },
    },
  });
});

// Versioned API
app.use("/api/v1", v1Router);



// 404 + global error handlers (must come after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

// Verify email configuration on startup
verifyEmailConfig()
  .then(isValid => {
    if (isValid) {
      logger.info("Email service configured");
    } else {
      logger.warn("Email service not configured - notifications disabled");
    }
  })
  .catch(err => {
    logger.error("❌ verifyEmailConfig threw:", { error: err?.message });
  });

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`🔌 Socket.IO initialized for whiteboard sharing`);
});

// Process-level uncaught exception + unhandled rejection handlers
registerProcessHandlers();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Order:
//   1. Stop accepting new HTTP + WS connections
//   2. Wait for in-flight HTTP requests to finish (httpServer.close)
//   3. Close Socket.IO (drains active socket connections)
//   4. Close all per-center MongoDB connections
//   5. Close master MongoDB connection
//   6. Exit cleanly
// A 15-second hard-kill ensures we never hang forever (e.g. a stalled request).

let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`\n${signal} received — starting graceful shutdown`);

  // Hard-kill timer — if anything below stalls, we still exit
  const forceExit = setTimeout(() => {
    logger.error("❌ Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000).unref();

  try {
    // 1. Stop accepting new connections
    await new Promise((resolve) => httpServer.close(resolve));
    logger.info("HTTP server closed");

    // 2. Close Socket.IO (tells clients to reconnect elsewhere)
    await new Promise((resolve) => io.close(resolve));
    logger.info("Socket.IO closed");

    // 3. Close all per-center DB connections
    await closeAllConnections();
    logger.info("Per-center DB connections closed");

    // 4. Close master DB connection
    await mongoose.connection.close(false);
    logger.info("Master DB connection closed");

    clearTimeout(forceExit);
    logger.info("👋 Shutdown complete");
    process.exit(0);
  } catch (err) {
    logger.error("❌ Error during shutdown:", { error: err?.message });
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));