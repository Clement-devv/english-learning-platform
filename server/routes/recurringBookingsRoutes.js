// server/routes/recurringBookingsRoutes.js - RECURRING BOOKINGS SYSTEM
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import RecurringPattern from "../models/RecurringPattern.js"; // We'll create this model
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { sendBookingRequestToTeacher } from "../utils/emailService.js";

const router = express.Router();

/**
 * Helper: Generate booking dates based on recurring pattern
 * @param {Date} startDate - Start date for recurring pattern
 * @param {string} frequency - 'daily', 'weekly', 'biweekly', 'monthly'
 * @param {number} occurrences - Number of bookings to create
 * @param {Array} daysOfWeek - For weekly: [0,1,2,3,4,5,6] (Sun-Sat)
 * @returns {Array} Array of Date objects
 */
const generateRecurringDates = (startDate, frequency, occurrences, daysOfWeek = []) => {
  const dates = [];
  let currentDate = new Date(startDate);

  switch (frequency) {
    case 'daily':
      for (let i = 0; i < occurrences; i++) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      break;

    case 'weekly':
      // If daysOfWeek specified, generate for those days
      if (daysOfWeek && daysOfWeek.length > 0) {
        let weeksGenerated = 0;
        while (dates.length < occurrences) {
          for (let day of daysOfWeek) {
            if (dates.length >= occurrences) break;
            
            const date = new Date(currentDate);
            const currentDay = date.getDay();
            const daysUntilTarget = (day - currentDay + 7) % 7;
            date.setDate(date.getDate() + daysUntilTarget + (weeksGenerated * 7));
            
            if (date >= startDate) {
              dates.push(new Date(date));
            }
          }
          weeksGenerated++;
        }
      } else {
        // Weekly on same day
        for (let i = 0; i < occurrences; i++) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 7);
        }
      }
      break;

    case 'biweekly':
      for (let i = 0; i < occurrences; i++) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 14);
      }
      break;

    case 'monthly':
      for (let i = 0; i < occurrences; i++) {
        dates.push(new Date(currentDate));
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
      break;

    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }

  return dates.sort((a, b) => a - b);
};

/**
 * POST /api/recurring-bookings
 * Create recurring bookings pattern and generate individual bookings
 */
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const {
      teacherId,
      studentId,
      classTitle,
      topic,
      startTime, // First booking time (ISO format)
      duration,
      notes,
      frequency, // 'daily', 'weekly', 'biweekly', 'monthly'
      occurrences, // Number of bookings to create
      daysOfWeek, // For weekly: [0,1,2,3,4,5,6] (optional)
      endDate // Alternative to occurrences
    } = req.body;

    // Validation
    if (!teacherId || !studentId || !classTitle || !startTime || !frequency) {
      return res.status(400).json({
        success: false,
        message: "Teacher, student, class title, start time, and frequency are required"
      });
    }

    if (!occurrences && !endDate) {
      return res.status(400).json({
        success: false,
        message: "Either occurrences or end date must be specified"
      });
    }

    // Verify teacher and student exist
    const [teacher, student] = await Promise.all([
      Teacher.findById(teacherId),
      Student.findById(studentId)
    ]);

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    // Calculate occurrences if endDate provided
    let finalOccurrences = occurrences;
    if (endDate && !occurrences) {
      const start = new Date(startTime);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      switch (frequency) {
        case 'daily':
          finalOccurrences = daysDiff;
          break;
        case 'weekly':
          finalOccurrences = Math.ceil(daysDiff / 7);
          break;
        case 'biweekly':
          finalOccurrences = Math.ceil(daysDiff / 14);
          break;
        case 'monthly':
          finalOccurrences = Math.ceil(daysDiff / 30);
          break;
      }
    }

    // Check if student has enough classes
    if (student.noOfClasses < finalOccurrences) {
      return res.status(400).json({
        success: false,
        message: `Student only has ${student.noOfClasses} classes remaining, but ${finalOccurrences} bookings requested`
      });
    }

    // Generate dates
    const bookingDates = generateRecurringDates(
      new Date(startTime),
      frequency,
      finalOccurrences,
      daysOfWeek
    );

    // Create recurring pattern record
    const recurringPattern = await RecurringPattern.create({
      teacherId,
      studentId,
      classTitle,
      topic,
      startTime: new Date(startTime),
      frequency,
      occurrences: finalOccurrences,
      daysOfWeek,
      duration: duration || 60,
      notes,
      createdBy: req.user.id,
      createdByModel: "Admin",
      status: "active"
    });

    // Create individual bookings
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const bookings = await Promise.all(
        bookingDates.map(async (date) => {
          // Set the time from startTime to each date
          const startTimeDate = new Date(startTime);
          date.setHours(startTimeDate.getHours());
          date.setMinutes(startTimeDate.getMinutes());
          date.setSeconds(0);
          date.setMilliseconds(0);

          const booking = await Booking.create([{
            teacherId,
            studentId,
            classTitle,
            topic: topic || "",
            scheduledTime: date,
            duration: duration || 60,
            notes: notes || `Part of recurring series`,
            status: "pending",
            createdBy: "admin",
            createdByUserId: req.user.id,
            createdByUserModel: "Admin",
            recurringPatternId: recurringPattern._id,
            isRecurring: true
          }], { session });

          return booking[0];
        })
      );

      // Update recurring pattern with booking IDs
      recurringPattern.bookingIds = bookings.map(b => b._id);
      await recurringPattern.save({ session });

      await session.commitTransaction();

      // Send email notification to teacher
      try {
        const firstBooking = bookings[0];
        await sendBookingRequestToTeacher(teacher, student, {
          ...firstBooking.toObject(),
          notes: `Recurring class: ${frequency} for ${finalOccurrences} sessions. ${firstBooking.notes}`
        });
        console.log(`📧 Recurring booking notification sent to ${teacher.email}`);
      } catch (emailError) {
        console.error("📧 Email notification failed:", emailError.message);
      }

      console.log(`✅ Created ${bookings.length} recurring bookings`);

      res.status(201).json({
        success: true,
        message: `Created ${bookings.length} recurring bookings`,
        recurringPattern: {
          ...recurringPattern.toObject(),
          bookings: bookings.map(b => ({
            _id: b._id,
            scheduledTime: b.scheduledTime,
            status: b.status
          }))
        }
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error creating recurring bookings:", err);
    res.status(500).json({
      success: false,
      message: "Error creating recurring bookings",
      error: err.message
    });
  }
});

/**
 * GET /api/recurring-bookings
 * Get all recurring patterns (Admin only)
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const patterns = await RecurringPattern.find()
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .populate("bookingIds", "scheduledTime status")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      patterns
    });
  } catch (err) {
    console.error("❌ Error fetching recurring patterns:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching recurring patterns"
    });
  }
});

/**
 * GET /api/recurring-bookings/:id
 * Get specific recurring pattern with all bookings
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const pattern = await RecurringPattern.findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .populate("bookingIds");

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: "Recurring pattern not found"
      });
    }

    res.json({
      success: true,
      pattern
    });
  } catch (err) {
    console.error("❌ Error fetching recurring pattern:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching recurring pattern"
    });
  }
});

/**
 * PATCH /api/recurring-bookings/:id/cancel
 * Cancel recurring pattern and all future bookings
 */
router.patch("/:id/cancel", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { cancelFuture = true, reason } = req.body;

    const pattern = await RecurringPattern.findById(req.params.id);

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: "Recurring pattern not found"
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update pattern status
      pattern.status = "cancelled";
      pattern.cancelledAt = new Date();
      pattern.cancellationReason = reason || "Cancelled by admin";
      await pattern.save({ session });

      // Cancel future bookings
      if (cancelFuture) {
        const now = new Date();
        await Booking.updateMany(
          {
            recurringPatternId: pattern._id,
            scheduledTime: { $gt: now },
            status: { $in: ["pending", "accepted"] }
          },
          {
            $set: {
              status: "cancelled",
              cancelledAt: now,
              notes: `Recurring series cancelled: ${reason || "No reason provided"}`
            }
          },
          { session }
        );
      }

      await session.commitTransaction();

      console.log(`🚫 Cancelled recurring pattern ${pattern._id}`);

      res.json({
        success: true,
        message: "Recurring pattern cancelled successfully",
        pattern
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error cancelling recurring pattern:", err);
    res.status(500).json({
      success: false,
      message: "Error cancelling recurring pattern"
    });
  }
});

/**
 * DELETE /api/recurring-bookings/:id
 * Delete recurring pattern and all associated bookings (Admin only)
 */
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const pattern = await RecurringPattern.findById(req.params.id);

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: "Recurring pattern not found"
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Delete all associated bookings
      await Booking.deleteMany(
        { recurringPatternId: pattern._id },
        { session }
      );

      // Delete pattern
      await RecurringPattern.findByIdAndDelete(pattern._id, { session });

      await session.commitTransaction();

      console.log(`🗑️ Deleted recurring pattern ${pattern._id} and all bookings`);

      res.json({
        success: true,
        message: "Recurring pattern and all bookings deleted successfully"
      });

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }

  } catch (err) {
    console.error("❌ Error deleting recurring pattern:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting recurring pattern"
    });
  }
});

export default router;