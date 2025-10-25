import express from "express";
import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../utils/emailService.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";

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
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

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
      const hashedPassword = await bcrypt.hash(password, 10);
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
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ message: "Teacher deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;