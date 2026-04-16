// server/routes/subAdminRoutes.js
import express from "express";
import crypto from "crypto";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { sendSubAdminInviteEmail, getCenterBaseUrl } from "../utils/emailService.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { subAdminSchema } from "../schemas/subAdminSchema.js";
import { teacherSchema }  from "../schemas/teacherSchema.js";
import { studentSchema }  from "../schemas/studentSchema.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getSubAdmin = (db) => db.models.SubAdmin || db.model("SubAdmin", subAdminSchema);
const getTeacher  = (db) => db.models.Teacher  || db.model("Teacher",  teacherSchema);
const getStudent  = (db) => db.models.Student  || db.model("Student",  studentSchema);

// All routes require main admin auth
router.use(verifyToken, verifyAdmin);

// GET /api/sub-admins — list all sub-admins
router.get("/", async (req, res) => {
  try {
    const subAdmins = await getSubAdmin(req.db).find()
      .populate("assignedTeachers", "firstName lastName email continent")
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({ success: true, subAdmins });
  } catch (err) {
    logger.error("Get sub-admins error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to fetch sub-admins" });
  }
});

// POST /api/sub-admins/invite — create and invite a new sub-admin
router.post("/invite", async (req, res) => {
  try {
    const { firstName, lastName, email, assignmentType, region, assignedTeachers, permissions, notes } = req.body;

    if (!firstName || !lastName || !email)
      return res.status(400).json({ success: false, message: "First name, last name and email are required" });

    const SubAdmin = getSubAdmin(req.db);
    const Teacher  = getTeacher(req.db);
    const Student  = getStudent(req.db);
    const normalizedEmail = email.toLowerCase().trim();

    const [asSubAdmin, asTeacher, asStudent] = await Promise.all([
      SubAdmin.findOne({ email: normalizedEmail }).lean(),
      Teacher.findOne({ email: normalizedEmail }).lean(),
      Student.findOne({ email: normalizedEmail }).lean(),
    ]);
    if (asSubAdmin) return res.status(409).json({ success: false, message: "Email is already registered as a sub-admin" });
    if (asTeacher)  return res.status(409).json({ success: false, message: "Email is already registered as a teacher" });
    if (asStudent)  return res.status(409).json({ success: false, message: "Email is already registered as a student" });

    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const subAdmin = await SubAdmin.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.toLowerCase().trim(),
      assignmentType:   assignmentType || "manual",
      region:           assignmentType === "region" ? region : null,
      assignedTeachers: assignmentType === "manual" ? (assignedTeachers || []) : [],
      permissions: {
        canMarkLessons:  permissions?.canMarkLessons  ?? false,
        canViewPayments: permissions?.canViewPayments ?? false,
        canSendMessages: permissions?.canSendMessages ?? true,
        canViewBookings: permissions?.canViewBookings ?? true,
        canViewClasses:  permissions?.canViewClasses  ?? true,
      },
      notes: notes || "",
      inviteToken,
      inviteExpires,
      createdBy: req.user.id,
    });

    const { baseUrl: _sb1, needsSlug: _sn1 } = getCenterBaseUrl(req.center);
    const setupUrl = `${_sb1}/sub-admin/setup?token=${inviteToken}${_sn1 ? `&center=${req.center.slug}` : ""}`;
    await sendSubAdminInviteEmail(subAdmin, setupUrl, req.admin, req.center?.centerName || "");

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}`,
      subAdmin: {
        id: subAdmin._id, firstName: subAdmin.firstName,
        lastName: subAdmin.lastName, email: subAdmin.email, status: subAdmin.status,
      },
    });
  } catch (err) {
    logger.error("Invite sub-admin error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to send invitation" });
  }
});

// POST /api/sub-admins/:id/resend-invite
router.post("/:id/resend-invite", async (req, res) => {
  try {
    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: "Sub-admin not found" });
    if (subAdmin.status === "active")
      return res.status(400).json({ success: false, message: "This sub-admin has already set up their account" });

    subAdmin.inviteToken   = crypto.randomBytes(32).toString("hex");
    subAdmin.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    subAdmin.status        = "pending";
    await subAdmin.save();

    const { baseUrl: _sb2, needsSlug: _sn2 } = getCenterBaseUrl(req.center);
    const setupUrl = `${_sb2}/sub-admin/setup?token=${subAdmin.inviteToken}${_sn2 ? `&center=${req.center.slug}` : ""}`;
    await sendSubAdminInviteEmail(subAdmin, setupUrl, req.admin, req.center?.centerName || "");

    res.json({ success: true, message: "Invitation resent successfully" });
  } catch (err) {
    logger.error("Resend invite error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to resend invitation" });
  }
});

// PUT /api/sub-admins/:id — update sub-admin
router.put("/:id", async (req, res) => {
  try {
    const { assignmentType, region, assignedTeachers, permissions, notes, status } = req.body;

    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: "Sub-admin not found" });

    if (assignmentType) subAdmin.assignmentType = assignmentType;
    if (region !== undefined) subAdmin.region = region;
    if (assignedTeachers !== undefined) subAdmin.assignedTeachers = assignedTeachers;
    if (permissions) subAdmin.permissions = { ...subAdmin.permissions.toObject(), ...permissions };
    if (notes !== undefined) subAdmin.notes = notes;
    if (status && ["active", "suspended"].includes(status)) subAdmin.status = status;

    await subAdmin.save();

    const updated = await SubAdmin.findById(subAdmin._id)
      .populate("assignedTeachers", "firstName lastName email continent");

    res.json({ success: true, message: "Sub-admin updated", subAdmin: updated });
  } catch (err) {
    logger.error("Update sub-admin error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to update sub-admin" });
  }
});

// PATCH /api/sub-admins/:id/toggle-status
router.patch("/:id/toggle-status", async (req, res) => {
  try {
    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: "Sub-admin not found" });
    if (subAdmin.status === "pending")
      return res.status(400).json({ success: false, message: "Cannot toggle status of a pending sub-admin" });

    subAdmin.status = subAdmin.status === "active" ? "suspended" : "active";
    await subAdmin.save();

    res.json({
      success: true,
      message: `Sub-admin ${subAdmin.status === "active" ? "reactivated" : "suspended"}`,
      status: subAdmin.status,
    });
  } catch (err) {
    logger.error("Toggle status error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
});

// PATCH /api/sub-admins/:id/assign-teachers
router.patch("/:id/assign-teachers", async (req, res) => {
  try {
    const { teacherIds } = req.body;
    if (!Array.isArray(teacherIds))
      return res.status(400).json({ success: false, message: "teacherIds must be an array" });

    const SubAdmin = getSubAdmin(req.db);
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: "Sub-admin not found" });

    subAdmin.assignedTeachers = teacherIds;
    subAdmin.assignmentType   = "manual";
    subAdmin.region           = null;
    await subAdmin.save();

    const updated = await SubAdmin.findById(subAdmin._id)
      .populate("assignedTeachers", "firstName lastName email continent");

    res.json({ success: true, message: "Teachers assigned successfully", assignedTeachers: updated.assignedTeachers });
  } catch (err) {
    logger.error("Assign teachers error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to assign teachers" });
  }
});

// DELETE /api/sub-admins/:id
router.delete("/:id", async (req, res) => {
  try {
    const subAdmin = await getSubAdmin(req.db).findByIdAndDelete(req.params.id);
    if (!subAdmin) return res.status(404).json({ success: false, message: "Sub-admin not found" });
    res.json({ success: true, message: "Sub-admin deleted" });
  } catch (err) {
    logger.error("Delete sub-admin error:", { error: err?.message });
    res.status(500).json({ success: false, message: "Failed to delete sub-admin" });
  }
});

export default router;
