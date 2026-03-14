import dotenv from "dotenv";
dotenv.config();
console.log("📧 Email configured:", process.env.EMAIL_USER ? "✓" : "✗");

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http"; 
import compression from "compression";

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

// Routes
import teacherRoutes from "./routes/teacherRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js"
import assignmentRoutes from "./routes/assignmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import agoraRoutes from "./routes/agoraRoutes.js";
import twoFactorRoutes from "./routes/twoFactorRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import teacherAssignmentRoutes from "./routes/teacherAssignmentRoutes.js";
import { initializeSocket } from './socketServer.js'; 
import classroomRoutes from "./routes/classroomRoutes.js";
import groupChatRoutes from "./routes/groupChatRoutes.js";
import paymentTransactionRoutes from "./routes/paymentTransactionRoutes.js";
import recurringBookingsRoutes from "./routes/recurringBookingsRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import { verifyEmailConfig } from "./utils/emailService.js";
import adminLessonRoutes from "./routes/adminLessonRoutes.js";
import subAdminRoutes     from "./routes/subAdminRoutes.js";
import subAdminAuthRoutes from "./routes/subAdminAuthRoutes.js";
import subAdminScopeRoutes from "./routes/subAdminScopeRoutes.js";
import disputeRoutes from "./routes/disputeRoutes.js";


// ✅ FIXED: Correct import path for RecurringPattern model
import RecurringPattern from "./models/RecurringPattern.js";

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

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (config.corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

// Make io available to routes if needed
app.set('io', io);

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

app.use('/api/', apiLimiter);

app.use("/api/classroom", realtimeLimiter);
app.use("/api/agora", realtimeLimiter);

app.use("/api/group-chats", pollingLimiter);

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
  .then(() => {
    console.log("✅ MongoDB connected");
    // ✅ Only start keep-alive AFTER successful connection
    setInterval(async () => {
      try {
        await mongoose.connection.db.admin().ping();
        console.log('🏓 DB keep-alive ping');
      } catch (e) {
        console.error('DB ping failed:', e.message);
      }
    }, 5 * 60 * 1000);
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
  
  setInterval(async () => {
    try {
      await mongoose.connection.db.admin().ping();
      console.log('🏓 DB keep-alive ping');
    } catch (e) { console.error('DB ping failed:', e.message); }
  }, 5 * 60 * 1000);



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

// Routes
app.use("/api/teachers", teacherRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/agora", agoraRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/teachers", teacherAssignmentRoutes);
app.use("/api/classroom", classroomRoutes);
app.use("/api/group-chats", groupChatRoutes);
app.use("/api/payments", paymentTransactionRoutes);
app.use("/api/recurring-bookings", recurringBookingsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/lessons", adminLessonRoutes);
app.use("/api/sub-admins",      subAdminRoutes);
app.use("/api/sub-admin-auth",  subAdminAuthRoutes);
app.use("/api/sub-admin-scope", subAdminScopeRoutes);
app.use("/api/disputes",        disputeRoutes);



// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.message);
  res.status(500).json({ error: err.message });
});

// Verify email configuration on startup
verifyEmailConfig().then(isValid => {
  if (isValid) {
    console.log("✅ Email service configured");
  } else {
    console.warn("⚠️ Email service not configured - notifications disabled");
  }
});

// ✅ REMOVED: Incorrect export statement
// (Models don't need to be exported from server file)

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO initialized for whiteboard sharing`);
});