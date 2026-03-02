// server/routes/teacherRoutes.js
import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Teacher from "../models/Teacher.js";
import {
  sendPasswordResetEmail,
  sendTeacherInviteEmail,
  sendTeacherWelcomeEmail,
} from "../utils/emailService.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { config } from "../config/config.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teachers/:id  — single teacher
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes")
    .lean();
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: "Error fetching teacher data" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teachers  — all teachers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const teachers = await Teacher.find().select("-password -inviteToken -twoFactorSecret -twoFactorBackupCodes")
    .lean();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/teachers/:id/google-meet
router.patch("/:id/google-meet", verifyToken, async (req, res) => {
  try {
    const { googleMeetLink } = req.body;
    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { googleMeetLink: googleMeetLink || "" },
      { new: true, select: "firstName lastName googleMeetLink" }
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Google Meet link updated", googleMeetLink: teacher.googleMeetLink });
  } catch (err) {
    console.error("Error updating Google Meet link:", err);
    res.status(500).json({ message: "Error updating Google Meet link" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teachers  — create teacher + send invite email (no password needed)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, ratePerClass, continent } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !continent) {
      return res.status(400).json({ message: "First name, last name, email and continent are required" });
    }
    if (!["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent)) {
      return res.status(400).json({ message: "Invalid continent" });
    }

    // Check duplicate
    const exists = await Teacher.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "A teacher with this email already exists" });
    }

    // Generate invite token (same pattern as sub-admin)
    const inviteToken   = crypto.randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    // Create teacher — NO password yet, status = pending
    const teacher = await Teacher.create({
      firstName,
      lastName,
      email,
      ratePerClass: ratePerClass || 0,
      continent,
      status:        "pending",
      active:        false,
      inviteToken,
      inviteExpires,
    });

    // Send invite email
    const setupUrl = `${config.frontendUrl}/teacher/setup?token=${inviteToken}`;
    try {
      await sendTeacherInviteEmail(teacher, setupUrl);
      console.log(`✅ Teacher invite sent to ${email}`);
    } catch (emailErr) {
      console.error("❌ Failed to send teacher invite email:", emailErr.message);
    }

    const response = teacher.toObject();
    delete response.password;
    delete response.inviteToken;

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}. Teacher will set their own password.`,
      teacher: response,
    });
  } catch (err) {
    console.error("Create teacher error:", err);
    res.status(400).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/teachers/verify-invite/:token  — validate invite token
// ─────────────────────────────────────────────────────────────────────────────
router.get("/verify-invite/:token", async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      inviteToken:   req.params.token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!teacher) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invite link. Please contact your administrator.",
      });
    }

    res.json({
      success: true,
      teacher: {
        firstName: teacher.firstName,
        lastName:  teacher.lastName,
        email:     teacher.email,
        continent: teacher.continent,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teachers/setup-account  — teacher sets password, activates account
// ─────────────────────────────────────────────────────────────────────────────
router.post("/setup-account", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const teacher = await Teacher.findOne({
      inviteToken:   token,
      inviteExpires: { $gt: new Date() },
      status:        "pending",
    });

    if (!teacher) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired invite link. Please contact your administrator.",
      });
    }

    // Activate account
    teacher.password      = await bcrypt.hash(password, config.bcryptRounds);
    teacher.status        = "active";
    teacher.active        = true;
    teacher.inviteToken   = undefined;
    teacher.inviteExpires = undefined;
    teacher.lastPasswordChange = new Date();
    await teacher.save();

    // Send welcome email (non-blocking)
    try {
      await sendTeacherWelcomeEmail(teacher);
    } catch (e) {
      console.error("Welcome email failed:", e.message);
    }

    res.json({ success: true, message: "Account activated successfully! You can now log in." });
  } catch (err) {
    console.error("Setup account error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/teachers/:id/resend-invite  — resend invite (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:id/resend-invite", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    if (teacher.status !== "pending") {
      return res.status(400).json({ message: "Teacher account is already active" });
    }

    // Refresh token
    teacher.inviteToken   = crypto.randomBytes(32).toString("hex");
    teacher.inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await teacher.save();

    const setupUrl = `${config.frontendUrl}/teacher/setup?token=${teacher.inviteToken}`;
    await sendTeacherInviteEmail(teacher, setupUrl);

    res.json({ success: true, message: "Invite resent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to resend invite" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/teachers/:id  — update teacher (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { continent, password, ...otherUpdates } = req.body;

    if (continent && !["Africa", "Europe", "Asia", "Americas", "Oceania"].includes(continent)) {
      return res.status(400).json({ message: "Invalid continent" });
    }

    let updateData = { ...otherUpdates, continent };

    if (password) {
      updateData.password           = await bcrypt.hash(password, config.bcryptRounds);
      updateData.lastPasswordChange = new Date();
    }

    const teacher = await Teacher.findByIdAndUpdate(req.params.id, updateData, {
      new: true, runValidators: true,
    }).select("-password -inviteToken");

    if (!teacher) return res.status(404).json({ message: "Teacher not found" });

    if (password) {
      try {
        await sendPasswordResetEmail(teacher.email, `${teacher.firstName} ${teacher.lastName}`, password);
      } catch (e) { console.error("Password reset email failed:", e.message); }

      const resp = teacher.toObject();
      resp.temporaryPassword = password;
      return res.json(resp);
    }

    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/teachers/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Teacher deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;