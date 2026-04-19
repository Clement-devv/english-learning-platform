// @ts-check
// middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { adminSchema }    from "../schemas/adminSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";

// ─── Model helpers ────────────────────────────────────────────────────────────
// All center routes run tenantMiddleware first, which sets req.db.
// These helpers register the model on the per-center connection if not cached.

const getAdminModel    = (db) => db.models.Admin    || db.model("Admin",    adminSchema);
const getTeacherModel  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getStudentModel  = (db) => db.models.Student  || db.model("Student",  studentSchema);
const getSubAdminModel = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);

// ─── verifyToken ──────────────────────────────────────────────────────────────
// Only decodes the JWT and sets req.user — no DB query, unchanged from before.
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired, please login again" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    return res.status(500).json({ success: false, message: "Token verification failed" });
  }
};

// ─── verifySubAdmin ───────────────────────────────────────────────────────────
export const verifySubAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.role !== "sub-admin") {
      return res.status(403).json({ message: "Sub-admin access required" });
    }
    // Tenant guard: token must have been issued for this center
    if (req.user.centerId !== req.center.slug) {
      return res.status(403).json({ message: "Token not valid for this center" });
    }
    const SubAdmin = getSubAdminModel(req.db);
    const subAdmin = await SubAdmin.findById(req.user.id);
    if (!subAdmin || subAdmin.status !== "active") {
      return res.status(403).json({ message: "Sub-admin account inactive or not found" });
    }
    req.subAdmin = subAdmin;
    if (subAdmin.assignmentType === "region") {
      if (!subAdmin.region) {
        // Region-type sub-admin with no region assigned — deny all access
        req.teacherScope = [];
      } else {
        const Teacher = getTeacherModel(req.db);
        const teachers = await Teacher.find({ continent: subAdmin.region }).select("_id").lean();
        req.teacherScope = teachers.map(t => t._id.toString());
      }
    } else {
      req.teacherScope = subAdmin.assignedTeachers.map(String);
    }
    next();
  } catch (_err) {
    return res.status(500).json({ message: "Authorization error" });
  }
};

// ─── verifyAdmin ──────────────────────────────────────────────────────────────
export const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    // Tenant guard: token must have been issued for this center
    if (req.user.centerId !== req.center.slug) {
      return res.status(403).json({ message: "Token not valid for this center" });
    }
    // Impersonation tokens skip the DB lookup
    if (req.user.isImpersonation) {
      req.admin = { _id: null, role: "admin", active: true, isImpersonation: true };
      return next();
    }
    const Admin = getAdminModel(req.db);
    const admin = await Admin.findById(req.user.id).select("-password");
    if (!admin || !admin.active) {
      return res.status(403).json({ message: "Admin account not found or inactive" });
    }
    req.admin = admin;
    next();
  } catch (_err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// ─── verifyTeacher ────────────────────────────────────────────────────────────
export const verifyTeacher = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.role !== "teacher") {
      return res.status(403).json({ message: "Teacher access required" });
    }
    // Tenant guard: token must have been issued for this center
    if (req.user.centerId !== req.center.slug) {
      return res.status(403).json({ message: "Token not valid for this center" });
    }
    const Teacher = getTeacherModel(req.db);
    const teacher = await Teacher.findById(req.user.id).select("-password");
    if (!teacher || !teacher.active) {
      return res.status(403).json({ message: "Teacher account not found or inactive" });
    }
    req.teacher = teacher;
    next();
  } catch (_err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// ─── verifyStudent ────────────────────────────────────────────────────────────
export const verifyStudent = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Student access required" });
    }
    // Tenant guard: token must have been issued for this center
    if (req.user.centerId !== req.center.slug) {
      return res.status(403).json({ message: "Token not valid for this center" });
    }
    const Student = getStudentModel(req.db);
    const student = await Student.findById(req.user.id).select("-password");
    if (!student || !student.active) {
      return res.status(403).json({ message: "Student account not found or inactive" });
    }
    req.student = student;
    next();
  } catch (_err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// ─── verifyAdminOrTeacher ─────────────────────────────────────────────────────
export const verifyAdminOrTeacher = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    // Tenant guard: token must have been issued for this center
    if (req.user.centerId !== req.center.slug) {
      return res.status(403).json({ message: "Token not valid for this center" });
    }
    if (req.user.role === "admin") {
      // Impersonation tokens skip the DB lookup
      if (req.user.isImpersonation) {
        req.admin = { _id: null, role: "admin", active: true, isImpersonation: true };
        return next();
      }
      const Admin = getAdminModel(req.db);
      const admin = await Admin.findById(req.user.id).select("-password");
      if (!admin || !admin.active) {
        return res.status(403).json({ message: "Admin account not found or inactive" });
      }
      req.admin = admin;
      return next();
    }
    if (req.user.role === "teacher") {
      const Teacher = getTeacherModel(req.db);
      const teacher = await Teacher.findById(req.user.id).select("-password");
      if (!teacher || !teacher.active) {
        return res.status(403).json({ message: "Teacher account not found or inactive" });
      }
      req.teacher = teacher;
      return next();
    }
    return res.status(403).json({ message: "Admin or Teacher access required" });
  } catch (_err) {
    return res.status(500).json({ message: "Server error during authorization" });
  }
};

// ─── verifyOwnership ─────────────────────────────────────────────────────────
export const verifyOwnership = (paramName = "id") => {
  return (req, res, next) => {
    const resourceId = req.params[paramName];
    if (req.user.role === "admin") return next();
    if (req.user.id !== resourceId) {
      return res.status(403).json({ message: "You can only access your own data" });
    }
    next();
  };
};
