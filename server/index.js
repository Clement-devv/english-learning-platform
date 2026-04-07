import dotenv from "dotenv";
dotenv.config();
console.log("📧 Email configured:", process.env.EMAIL_USER ? "✓" : "✗");

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

console.log("✅ Environment Check:");
console.log("  MongoDB:", process.env.MONGO_URI ? "✓ Configured" : "✗ Missing");
console.log("  JWT Secret:", process.env.JWT_SECRET ? "✓ Configured" : "✗ Missing");
console.log("  Email:", process.env.EMAIL_USER ? "✓ Configured" : "✗ Missing");

import { initializeSocket } from './socketServer.js';
import { verifyEmailConfig } from "./utils/emailService.js";
import { startReminderScheduler } from "./utils/reminderScheduler.js";
import { startRecordingCleanup } from "./routes/recordingRoutes.js";
import { startProgressReportScheduler } from "./utils/progressReportScheduler.js";
import v1Router from "./routes/v1.js";
import Center from "./models/master/Center.js";
import SuperAdmin from "./models/master/SuperAdmin.js";
import { getDb, closeAllConnections } from "./config/dbManager.js";
import { errorHandler, notFoundHandler, registerProcessHandlers } from "./middleware/errorHandler.js";
import healthRoutes from "./routes/healthRoutes.js";

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);

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

// Serve uploaded files (logos, favicons, recordings, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

app.use("/api/v1/", apiLimiter);

app.use("/api/v1/classroom",   realtimeLimiter);
app.use("/api/v1/agora",       realtimeLimiter);

app.use("/api/v1/group-chats", pollingLimiter);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
  })
  .then(async () => {
    console.log("✅ Master MongoDB connected");

    // Start per-center schedulers for all currently active centers
    try {
      const activeCenters = await Center.find({ status: "active" }).select("slug");
      console.log(`🏢 Found ${activeCenters.length} active center(s) — starting per-center schedulers`);
      for (const center of activeCenters) {
        const db = await getDb(center.slug);
        startReminderScheduler(db);
        startRecordingCleanup(db);
        startProgressReportScheduler(db);
      }
    } catch (err) {
      console.error("❌ Failed to start per-center schedulers:", err.message);
    }

    // Master DB keep-alive ping
    setInterval(async () => {
      try {
        await mongoose.connection.db.admin().ping();
        console.log('🏓 Master DB keep-alive ping');
      } catch (e) {
        console.error('Master DB ping failed:', e.message);
      }
    }, 5 * 60 * 1000);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });



// Root endpoint
app.get("/", (req, res) => {
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
      console.log("✅ Email service configured");
    } else {
      console.warn("⚠️ Email service not configured - notifications disabled");
    }
  })
  .catch(err => {
    console.error("❌ verifyEmailConfig threw:", err.message);
  });

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO initialized for whiteboard sharing`);
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

  console.log(`\n${signal} received — starting graceful shutdown`);

  // Hard-kill timer — if anything below stalls, we still exit
  const forceExit = setTimeout(() => {
    console.error("❌ Graceful shutdown timed out — forcing exit");
    process.exit(1);
  }, 15_000).unref();

  try {
    // 1. Stop accepting new connections
    await new Promise((resolve) => httpServer.close(resolve));
    console.log("✅ HTTP server closed (no new connections)");

    // 2. Close Socket.IO (tells clients to reconnect elsewhere)
    await new Promise((resolve) => io.close(resolve));
    console.log("✅ Socket.IO closed");

    // 3. Close all per-center DB connections
    await closeAllConnections();
    console.log("✅ Per-center DB connections closed");

    // 4. Close master DB connection
    await mongoose.connection.close(false);
    console.log("✅ Master DB connection closed");

    clearTimeout(forceExit);
    console.log("👋 Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error during shutdown:", err.message);
    process.exit(1);
  }
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));