import dotenv from "dotenv";
dotenv.config();
console.log("📧 Email configured:", process.env.EMAIL_USER ? "✓" : "✗");


import express from "express";
import mongoose from "mongoose";
import cors from "cors";

import { apiLimiter } from "./middleware/rateLimiter.js";
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
import paymentRoutes from "./routes/paymentRoutes.js"; // 👈 new file for global payments
import lessonRoutes from "./routes/lessonRoutes.js"
import assignmentRoutes from "./routes/assignmentRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import agoraRoutes from "./routes/agoraRoutes.js";






const app = express();

// Trust proxy if behind reverse proxy
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Security Middleware - 
app.use(securityHeaders);
app.use(noSqlInjectionProtection);
app.use(xssProtection);
app.use(parameterPollutionProtection);


// Middleware

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


// Body parser with size limits 
app.use(express.json(requestLimits.json));
app.use(express.urlencoded(requestLimits.urlencoded));
//app.use(express.json());

app.use('/api/', apiLimiter);


// MongoDB connection (no deprecated options needed)
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
app.use("/api/payments", paymentRoutes); // 👈 global payments
app.use("/api/lessons", lessonRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/agora", agoraRoutes);


// Error handling middleware (better debugging)
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.message);
  res.status(500).json({ error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
