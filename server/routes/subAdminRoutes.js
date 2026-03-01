// server/routes/subAdminRoutes.js
import express from "express";
import crypto from "crypto";
import SubAdmin from "../models/SubAdmin.js";
import Teacher from "../models/Teacher.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { sendSubAdminInviteEmail } from "../utils/emailService.js";

const router = express.Router();

// All routes require main admin auth
router.use(verifyToken, verifyAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sub-admins
// List all sub-admins (with populated teachers)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const subAdmins = await SubAdmin.find()
      .populate("assignedTeachers", "firstName lastName email continent")
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({ success: true, subAdmins });
  } catch (err) {
    console.error("Get sub-admins error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch sub-admins" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sub-admins/invite
// Create and invite a new sub-admin
// ─────────────────────────────────────────────────────────────────────────────
router.post("/invite", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      assignmentType,
      region,
      assignedTeachers,
      permissions,
      notes,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name and email are required",
      });
    }

    // Check duplicate email
    const existing = await SubAdmin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A sub-admin with this email already exists",
      });
    }

    // Generate secure invite token (valid for 48 hours)
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const subAdmin = await SubAdmin.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      assignmentType: assignmentType || "manual",
      region: assignmentType === "region" ? region : null,
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

    // Send invitation email
    const setupUrl = `${config.frontendUrl}/sub-admin/setup?token=${inviteToken}`;
    await sendSubAdminInviteEmail(subAdmin, setupUrl, req.admin);

    console.log(`✅ Sub-admin invited: ${email}`);

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}`,
      subAdmin: {
        id: subAdmin._id,
        firstName: subAdmin.firstName,
        lastName: subAdmin.lastName,
        email: subAdmin.email,
        status: subAdmin.status,
      },
    });
  } catch (err) {
    console.error("Invite sub-admin error:", err);
    res.status(500).json({ success: false, message: "Failed to send invitation" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sub-admins/:id/resend-invite
// Resend invite email with a fresh token
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/resend-invite", async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    if (subAdmin.status === "active") {
      return res.status(400).json({
        success: false,
        message: "This sub-admin has already set up their account",
      });
    }

    // Refresh token
    subAdmin.inviteToken = crypto.randomBytes(32).toString("hex");
    subAdmin.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    subAdmin.status = "pending";
    await subAdmin.save();

    const setupUrl = `${config.frontendUrl}/sub-admin/setup?token=${subAdmin.inviteToken}`;
    await sendSubAdminInviteEmail(subAdmin, setupUrl, req.admin);

    res.json({ success: true, message: "Invitation resent successfully" });
  } catch (err) {
    console.error("Resend invite error:", err);
    res.status(500).json({ success: false, message: "Failed to resend invitation" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/sub-admins/:id
// Update sub-admin (permissions, assignment, notes)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const {
      assignmentType,
      region,
      assignedTeachers,
      permissions,
      notes,
      status,
    } = req.body;

    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

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
    console.error("Update sub-admin error:", err);
    res.status(500).json({ success: false, message: "Failed to update sub-admin" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sub-admins/:id/toggle-status
// Suspend or reactivate a sub-admin
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/toggle-status", async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    if (subAdmin.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot toggle status of a pending sub-admin",
      });
    }

    subAdmin.status = subAdmin.status === "active" ? "suspended" : "active";
    await subAdmin.save();

    res.json({
      success: true,
      message: `Sub-admin ${subAdmin.status === "active" ? "reactivated" : "suspended"}`,
      status: subAdmin.status,
    });
  } catch (err) {
    console.error("Toggle status error:", err);
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/sub-admins/:id/assign-teachers
// Assign or remove specific teachers from a sub-admin
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/:id/assign-teachers", async (req, res) => {
  try {
    const { teacherIds } = req.body;

    if (!Array.isArray(teacherIds)) {
      return res.status(400).json({ success: false, message: "teacherIds must be an array" });
    }

    const subAdmin = await SubAdmin.findById(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    subAdmin.assignedTeachers = teacherIds;
    subAdmin.assignmentType = "manual";
    subAdmin.region = null;
    await subAdmin.save();

    const updated = await SubAdmin.findById(subAdmin._id)
      .populate("assignedTeachers", "firstName lastName email continent");

    res.json({
      success: true,
      message: "Teachers assigned successfully",
      assignedTeachers: updated.assignedTeachers,
    });
  } catch (err) {
    console.error("Assign teachers error:", err);
    res.status(500).json({ success: false, message: "Failed to assign teachers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/sub-admins/:id
// Permanently delete a sub-admin
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const subAdmin = await SubAdmin.findByIdAndDelete(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ success: false, message: "Sub-admin not found" });
    }

    res.json({ success: true, message: "Sub-admin deleted" });
  } catch (err) {
    console.error("Delete sub-admin error:", err);
    res.status(500).json({ success: false, message: "Failed to delete sub-admin" });
  }
});

export default router;