import express from "express";
import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../utils/emailService.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";


import { config } from "../config/config.js";
import { strictLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// 👉 Get all teachers - Admin and Teachers can view
router.get("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🆕 ADD THIS NEW ROUTE HERE - Get single teacher by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).select('-password -sessions -twoFactorSecret -twoFactorBackupCodes');
    
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json(teacher);
  } catch (err) {
    console.error("Error fetching teacher:", err);
    res.status(500).json({ message: err.message });
  }
});

// 👉 Create new teacher - ONLY ADMIN
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { firstName, lastName, email, ratePerClass, password, continent } = req.body;

    // Validation for continent
    if (!continent || !["Africa", "Europe", "Asia"].includes(continent)) {
      return res
        .status(400)
        .json({ message: "Continent is required and must be Africa, Europe, or Asia" });
    }

    // Generate a random password if not provided
    const plainPassword = password || Math.random().toString(36).slice(-8);
    
    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(plainPassword, config.bcryptRounds);

    const teacher = await Teacher.create({
      firstName,
      lastName,
      email,
      ratePerClass,
      password: hashedPassword,
      continent,
    });

    // 📧 Send welcome email
    console.log(`📧 Sending welcome email to ${email}...`);
    try {
      await sendWelcomeEmail(
        email,
        `${firstName} ${lastName}`,
        plainPassword
      );
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send welcome email:`, emailError);
    }

    const teacherResponse = teacher.toObject();
    teacherResponse.temporaryPassword = plainPassword;
    delete teacherResponse.password;

    res.status(201).json(teacherResponse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 👉 Update teacher - ONLY ADMIN
router.put("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { continent, password, ...otherUpdates } = req.body;

    if (continent && !["Africa", "Europe", "Asia"].includes(continent)) {
      return res
        .status(400)
        .json({ message: "Invalid continent. Must be Africa, Europe, or Asia" });
    }

    // If password is being updated, hash it
    let updateData = { ...otherUpdates, continent };
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);
      updateData.password = hashedPassword;
      updateData.lastPasswordChange = new Date();
    }

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id, 
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    
    // 📧 If password was reset by admin, send email
    if (password) {
      console.log(`📧 Sending password reset email to ${teacher.email}...`);
      try {
        await sendPasswordResetEmail(
          teacher.email,
          `${teacher.firstName} ${teacher.lastName}`,
          password
        );
        console.log(`✅ Password reset email sent to ${teacher.email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send password reset email:`, emailError);
      }
      
      const teacherResponse = teacher.toObject();
      teacherResponse.temporaryPassword = password;
      return res.json(teacherResponse);
    }
    
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 👉 Delete teacher - ONLY ADMIN
router.delete("/:id", verifyToken, verifyAdmin, strictLimiter, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Teacher deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


    // 🆕 UPDATE GOOGLE MEET LINK (Teacher only) - WITH DEBUGGING
router.patch("/:id/google-meet", verifyToken, async (req, res) => {
  try {
    const { googleMeetLink } = req.body;
    const teacherId = req.params.id;

    // 🔍 DEBUG: Log everything
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Google Meet Update Request:');
    console.log('  teacherId (from URL):', teacherId);
    console.log('  req.user.id:', req.user.id);
    console.log('  req.user.role:', req.user.role);
    console.log('  Are they equal?', req.user.id.toString() === teacherId.toString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate Google Meet link format
    if (googleMeetLink && !googleMeetLink.includes('meet.google.com')) {
      return res.status(400).json({ 
        message: "Please enter a valid Google Meet link (must contain 'meet.google.com')" 
      });
    }

    // 🔥 TEMPORARILY REMOVE THE PERMISSION CHECK TO TEST
    // We'll add it back after we see the logs

    const teacher = await Teacher.findByIdAndUpdate(
      teacherId,
      { googleMeetLink: googleMeetLink.trim() },
      { new: true, runValidators: true }
    ).select('-password -sessions -twoFactorSecret');

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json({
      success: true,
      message: googleMeetLink ? "Google Meet link updated successfully" : "Google Meet link removed",
      googleMeetLink: teacher.googleMeetLink
    });
  } catch (err) {
    console.error("Error updating Google Meet link:", err);
    res.status(500).json({ message: err.message });
  }
});


export default router;