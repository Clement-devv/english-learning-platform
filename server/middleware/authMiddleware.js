// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/Student.js";
import Admin from "../models/Admin.js";

// Verify JWT token and attach user to request
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "No token provided" 
      });
    }

    // Use config for JWT secret - NO FALLBACK!
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Attach decoded token to request
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: "Token expired, please login again" 
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: "Invalid token" 
      });
    }
    return res.status(500).json({ 
      success: false,
      message: "Token verification failed" 
    });
  }
};

// Verify user is Admin
export const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const admin = await Admin.findById(req.user.id).select("-password");
    
    if (!admin || !admin.active) {
      return res.status(403).json({ message: "Admin account not found or inactive" });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// Verify user is Teacher
export const verifyTeacher = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Teacher access required" });
    }

    const teacher = await Teacher.findById(req.user.id).select("-password");
    
    if (!teacher || !teacher.active) {
      return res.status(403).json({ message: "Teacher account not found or inactive" });
    }

    req.teacher = teacher;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// Verify user is Student
export const verifyStudent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Student access required" });
    }

    const student = await Student.findById(req.user.id).select("-password");
    
    if (!student || !student.active) {
      return res.status(403).json({ message: "Student account not found or inactive" });
    }

    req.student = student;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// Verify user is Admin OR Teacher (for shared resources)
export const verifyAdminOrTeacher = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (req.user.role === "admin") {
      const admin = await Admin.findById(req.user.id).select("-password");
      if (!admin || !admin.active) {
        return res.status(403).json({ message: "Admin account not found or inactive" });
      }
      req.admin = admin;
      return next();
    }

    if (req.user.role === "teacher") {
      const teacher = await Teacher.findById(req.user.id).select("-password");
      if (!teacher || !teacher.active) {
        return res.status(403).json({ message: "Teacher account not found or inactive" });
      }
      req.teacher = teacher;
      return next();
    }

    return res.status(403).json({ message: "Admin or Teacher access required" });
  } catch (err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// Verify user can only access their own data
export const verifyOwnership = (paramName = 'id') => {
  return (req, res, next) => {
    const resourceId = req.params[paramName];
    
    // Admins can access anything
    if (req.user.role === "admin") {
      return next();
    }

    // Users can only access their own resources
    if (req.user.id !== resourceId) {
      return res.status(403).json({ message: "You can only access your own data" });
    }

    next();
  };
};