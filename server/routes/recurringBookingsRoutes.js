// server/routes/recurringBookingsRoutes.js
import express from "express";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { sendBookingRequestToTeacher } from "../utils/emailService.js";
import { bookingSchema }          from "../schemas/bookingSchema.js";
import { recurringPatternSchema } from "../schemas/recurringPatternSchema.js";
import { studentSchema }          from "../schemas/studentSchema.js";
import { teacherSchema }          from "../schemas/teacherSchema.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking          = (db) => db.models.Booking          || db.model("Booking",          bookingSchema);
const getRecurringPattern = (db) => db.models.RecurringPattern || db.model("RecurringPattern", recurringPatternSchema);
const getStudent          = (db) => db.models.Student          || db.model("Student",          studentSchema);
const getTeacher          = (db) => db.models.Teacher          || db.model("Teacher",          teacherSchema);

/**
 * Helper: Generate booking dates based on recurring pattern
 */
const generateRecurringDates = (startDate, frequency, occurrences, daysOfWeek = []) => {
  const dates = [];
  let currentDate = new Date(startDate);

  console.log(`📅 Generating ${occurrences} dates with frequency: ${frequency}`);

  try {
    switch (frequency) {
      case 'daily':
        for (let i = 0; i < occurrences; i++) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        break;

      case 'weekly':
        if (daysOfWeek && daysOfWeek.length > 0) {
          let weeksGenerated = 0;
          while (dates.length < occurrences) {
            for (let day of daysOfWeek) {
              if (dates.length >= occurrences) break;
              const date = new Date(startDate);
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

    console.log(`✅ Generated ${dates.length} dates`);
    return dates.sort((a, b) => a - b);

  } catch (error) {
    console.error("❌ Error generating dates:", error);
    throw error;
  }
};

/**
 * POST /api/recurring-bookings
 * Create recurring bookings pattern and generate individual bookings
 * Supports both Admin and Teacher creation
 */
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    console.log("📥 Recurring booking request received");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("User:", req.user);

    const {
      teacherId,
      studentId,
      classTitle,
      topic,
      startTime,
      duration,
      notes,
      frequency,
      occurrences,
      daysOfWeek,
      endDate
    } = req.body;

    // === VALIDATION ===
    console.log("🔍 Validating request...");

    if (!teacherId || !studentId || !classTitle || !startTime || !frequency) {
      console.error("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "Teacher, student, class title, start time, and frequency are required",
        missingFields: {
          teacherId: !teacherId,
          studentId: !studentId,
          classTitle: !classTitle,
          startTime: !startTime,
          frequency: !frequency
        }
      });
    }

    if (!occurrences && !endDate) {
      console.error("❌ Missing occurrences or endDate");
      return res.status(400).json({
        success: false,
        message: "Either occurrences or end date must be specified"
      });
    }

    const validFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({
        success: false,
        message: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
      });
    }

    const parsedStartTime = new Date(startTime);
    if (isNaN(parsedStartTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start time format. Must be a valid ISO date string"
      });
    }

    // === VERIFY TEACHER AND STUDENT ===
    console.log("🔍 Verifying teacher and student...");

    const [teacher, student] = await Promise.all([
      getTeacher(req.db).findById(teacherId),
      getStudent(req.db).findById(studentId)
    ]);

    if (!teacher) {
      console.error(`❌ Teacher not found: ${teacherId}`);
      return res.status(404).json({ success: false, message: "Teacher not found", teacherId });
    }

    if (!student) {
      console.error(`❌ Student not found: ${studentId}`);
      return res.status(404).json({ success: false, message: "Student not found", studentId });
    }

    console.log(`✅ Teacher: ${teacher.firstName} ${teacher.lastName}`);
    console.log(`✅ Student: ${student.firstName} ${student.surname}`);

    // === CALCULATE OCCURRENCES ===
    let finalOccurrences = occurrences;
    if (endDate && !occurrences) {
      const start = new Date(startTime);
      const end = new Date(endDate);
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      switch (frequency) {
        case 'daily':    finalOccurrences = daysDiff; break;
        case 'weekly':   finalOccurrences = Math.ceil(daysDiff / 7); break;
        case 'biweekly': finalOccurrences = Math.ceil(daysDiff / 14); break;
        case 'monthly':  finalOccurrences = Math.ceil(daysDiff / 30); break;
      }
      console.log(`📊 Calculated occurrences from endDate: ${finalOccurrences}`);
    }

    if (finalOccurrences < 2 || finalOccurrences > 100) {
      return res.status(400).json({
        success: false,
        message: "Number of occurrences must be between 2 and 100"
      });
    }

    // === CHECK STUDENT CLASSES ===
    console.log(`🔍 Checking student classes: ${student.noOfClasses} available`);
    if (student.noOfClasses < finalOccurrences) {
      return res.status(400).json({
        success: false,
        message: `Student only has ${student.noOfClasses} classes remaining, but ${finalOccurrences} bookings requested`
      });
    }

    // === GENERATE DATES ===
    console.log("📅 Generating booking dates...");
    const bookingDates = generateRecurringDates(parsedStartTime, frequency, finalOccurrences, daysOfWeek);

    if (bookingDates.length === 0) {
      return res.status(500).json({ success: false, message: "Failed to generate booking dates" });
    }

    console.log(`✅ Generated ${bookingDates.length} booking dates`);

    // === DETERMINE CREATOR INFO ===
    const isAdmin   = req.user.role === 'admin';
    const isTeacher = req.user.role === 'teacher';

    const createdByModel  = isAdmin ? "Admin" : "Teacher";
    const bookingCreatedBy = isAdmin ? "admin" : "teacher";

    console.log(`👤 Created by: ${createdByModel} (${req.user.id})`);

    // === CREATE RECURRING PATTERN ===
    console.log("📝 Creating recurring pattern record...");

    const recurringPattern = await getRecurringPattern(req.db).create({
      teacherId,
      studentId,
      classTitle,
      topic: topic || "",
      startTime: parsedStartTime,
      frequency,
      occurrences: finalOccurrences,
      daysOfWeek: daysOfWeek || [],
      duration: duration || 60,
      notes: notes || "",
      createdBy: req.user.id,
      createdByModel,
      status: "active"
    });

    console.log(`✅ Recurring pattern created: ${recurringPattern._id}`);

    // === CREATE INDIVIDUAL BOOKINGS (with transaction if replica set) ===
    console.log("📝 Creating individual bookings...");

    let useTransactions = true;
    try {
      await req.db.db.admin().command({ replSetGetStatus: 1 });
    } catch (error) {
      console.warn("⚠️ MongoDB is not running as a replica set. Transactions disabled.");
      useTransactions = false;
    }

    let bookings = [];
    let session  = null;

    try {
      if (useTransactions) {
        session = await req.db.startSession();
        session.startTransaction();
      }

      for (let i = 0; i < bookingDates.length; i++) {
        const date = bookingDates[i];

        const startTimeDate = new Date(startTime);
        date.setHours(startTimeDate.getHours());
        date.setMinutes(startTimeDate.getMinutes());
        date.setSeconds(0);
        date.setMilliseconds(0);

        const bookingData = {
          teacherId,
          studentId,
          classTitle,
          topic: topic || "",
          scheduledTime: date,
          duration: duration || 60,
          notes: notes || `Part of recurring series (${i + 1}/${finalOccurrences})`,
          status: isTeacher ? "accepted" : "pending",
          createdBy: bookingCreatedBy,
          createdByUserId: req.user.id,
          createdByUserModel: createdByModel,
          recurringPatternId: recurringPattern._id,
          isRecurring: true
        };

        let booking;
        if (useTransactions) {
          const result = await getBooking(req.db).create([bookingData], { session });
          booking = result[0];
        } else {
          booking = await getBooking(req.db).create(bookingData);
        }

        bookings.push(booking);
        console.log(`  ✓ Booking ${i + 1}/${finalOccurrences} created`);
      }

      recurringPattern.bookingIds = bookings.map(b => b._id);

      if (useTransactions) {
        await recurringPattern.save({ session });
        await session.commitTransaction();
      } else {
        await recurringPattern.save();
      }

      console.log(`✅ All bookings created and linked to pattern`);

      // === SEND EMAIL NOTIFICATION (Admin bookings only) ===
      if (isAdmin) {
        try {
          const firstBooking = bookings[0];
          await sendBookingRequestToTeacher(teacher, student, {
            ...firstBooking.toObject(),
            notes: `Recurring class: ${frequency} for ${finalOccurrences} sessions. ${notes || ''}`
          }, req.center?.centerName || "");
          console.log(`📧 Email notification sent to ${teacher.email}`);
        } catch (emailError) {
          console.error("📧 Email notification failed:", emailError.message);
        }
      }

      console.log(`✅ Successfully created ${bookings.length} recurring bookings`);

      res.status(201).json({
        success: true,
        message: `Created ${bookings.length} recurring bookings`,
        recurringPattern: {
          ...recurringPattern.toObject(),
          bookings: bookings.map(b => ({
            _id: b._id,
            scheduledTime: b.scheduledTime,
            status: b.status
          })),
          occurrences: finalOccurrences
        }
      });

    } catch (error) {
      if (useTransactions && session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }

  } catch (err) {
    console.error("❌ Error creating recurring bookings:", err);
    console.error("Stack trace:", err.stack);
    res.status(500).json({
      success: false,
      message: "Error creating recurring bookings",
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

/**
 * GET /api/recurring-bookings
 * Get all recurring patterns
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const isTeacher = req.user.role === 'teacher';

    let query = {};
    if (isTeacher) query.teacherId = req.user.id;

    const patterns = await getRecurringPattern(req.db).find(query)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .populate("bookingIds", "scheduledTime status")
      .sort({ createdAt: -1 });

    res.json({ success: true, patterns, count: patterns.length });
  } catch (err) {
    console.error("❌ Error fetching recurring patterns:", err);
    res.status(500).json({ success: false, message: "Error fetching recurring patterns", error: err.message });
  }
});

/**
 * GET /api/recurring-bookings/:id
 * Get specific recurring pattern with all bookings
 */
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const pattern = await getRecurringPattern(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("studentId", "firstName surname email")
      .populate("bookingIds");

    if (!pattern) {
      return res.status(404).json({ success: false, message: "Recurring pattern not found" });
    }

    const isAdmin   = req.user.role === 'admin';
    const isTeacher = req.user.role === 'teacher' && pattern.teacherId._id.toString() === req.user.id;

    if (!isAdmin && !isTeacher) {
      return res.status(403).json({ success: false, message: "Not authorized to view this recurring pattern" });
    }

    res.json({ success: true, pattern });
  } catch (err) {
    console.error("❌ Error fetching recurring pattern:", err);
    res.status(500).json({ success: false, message: "Error fetching recurring pattern", error: err.message });
  }
});

/**
 * PATCH /api/recurring-bookings/:id/cancel
 * Cancel recurring pattern and all future bookings
 */
router.patch("/:id/cancel", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const { cancelFuture = true, reason } = req.body;

    const pattern = await getRecurringPattern(req.db).findById(req.params.id);

    if (!pattern) {
      return res.status(404).json({ success: false, message: "Recurring pattern not found" });
    }

    const isAdmin   = req.user.role === 'admin';
    const isTeacher = req.user.role === 'teacher' && pattern.teacherId.toString() === req.user.id;

    if (!isAdmin && !isTeacher) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this recurring pattern" });
    }

    let useTransactions = true;
    let session = null;

    try {
      await req.db.db.admin().command({ replSetGetStatus: 1 });
      session = await req.db.startSession();
      session.startTransaction();
    } catch (error) {
      useTransactions = false;
    }

    try {
      pattern.status = "cancelled";
      pattern.cancelledAt = new Date();
      pattern.cancellationReason = reason || "Cancelled by user";

      if (useTransactions) {
        await pattern.save({ session });
      } else {
        await pattern.save();
      }

      if (cancelFuture) {
        const now = new Date();
        const updateData = {
          $set: {
            status: "cancelled",
            cancelledAt: now,
            notes: `Recurring series cancelled: ${reason || "No reason provided"}`
          }
        };
        const filter = {
          recurringPatternId: pattern._id,
          scheduledTime: { $gt: now },
          status: { $in: ["pending", "accepted"] }
        };

        if (useTransactions) {
          await getBooking(req.db).updateMany(filter, updateData, { session });
        } else {
          await getBooking(req.db).updateMany(filter, updateData);
        }
      }

      if (useTransactions) await session.commitTransaction();

      console.log(`🚫 Cancelled recurring pattern ${pattern._id}`);

      res.json({ success: true, message: "Recurring pattern cancelled successfully", pattern });

    } catch (error) {
      if (useTransactions && session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }

  } catch (err) {
    console.error("❌ Error cancelling recurring pattern:", err);
    res.status(500).json({ success: false, message: "Error cancelling recurring pattern", error: err.message });
  }
});

/**
 * DELETE /api/recurring-bookings/:id
 * Delete recurring pattern and all associated bookings (Admin only)
 */
router.delete("/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const pattern = await getRecurringPattern(req.db).findById(req.params.id);

    if (!pattern) {
      return res.status(404).json({ success: false, message: "Recurring pattern not found" });
    }

    let useTransactions = true;
    let session = null;

    try {
      await req.db.db.admin().command({ replSetGetStatus: 1 });
      session = await req.db.startSession();
      session.startTransaction();
    } catch (error) {
      useTransactions = false;
    }

    try {
      if (useTransactions) {
        await getBooking(req.db).deleteMany({ recurringPatternId: pattern._id }, { session });
        await getRecurringPattern(req.db).findByIdAndDelete(pattern._id, { session });
      } else {
        await getBooking(req.db).deleteMany({ recurringPatternId: pattern._id });
        await getRecurringPattern(req.db).findByIdAndDelete(pattern._id);
      }

      if (useTransactions) await session.commitTransaction();

      console.log(`🗑️ Deleted recurring pattern ${pattern._id} and all bookings`);

      res.json({ success: true, message: "Recurring pattern and all bookings deleted successfully" });

    } catch (error) {
      if (useTransactions && session) await session.abortTransaction();
      throw error;
    } finally {
      if (session) session.endSession();
    }

  } catch (err) {
    console.error("❌ Error deleting recurring pattern:", err);
    res.status(500).json({ success: false, message: "Error deleting recurring pattern", error: err.message });
  }
});

export default router;
