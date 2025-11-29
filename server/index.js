


import dotenv from "dotenv";
dotenv.config();
console.log("📧 Email configured:", process.env.EMAIL_USER ? "✓" : "✗");

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import http from "http"; // 👈 ADD THIS

//import { apiLimiter } from "./middleware/rateLimiter.js";
import { 
  apiLimiter,
  realtimeLimiter,  // ✅ ADD THIS
  pollingLimiter,   // ✅ ADD THIS
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

const app = express();
const httpServer = http.createServer(app); // 👈 CHANGE: Wrap app with http.createServer

// Initialize Socket.IO 👈 ADD THIS
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

app.use('/api/', apiLimiter);

app.use("/api/classroom", realtimeLimiter);
app.use("/api/agora", realtimeLimiter);

app.use("/api/group-chats", pollingLimiter);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.message);
  res.status(500).json({ error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
// 👇 CHANGE: Use httpServer.listen instead of app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO initialized for whiteboard sharing`); // 👈 ADD THIS
});