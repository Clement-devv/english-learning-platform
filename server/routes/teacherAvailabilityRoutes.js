import express from "express";
import TeacherAvailability from "../models/TeacherAvailability.js";
import Booking from "../models/Booking.js";
import Teacher from "../models/Teacher.js";
import { verifyToken } from "../middleware/authMiddleware.js";

// Returns true if [s1,e1) overlaps with [s2,e2)  (string "HH:MM" comparison)
function timesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

const router = express.Router();

// GET /api/teacher-availability/:teacherId
// Query: ?startDate=ISO&endDate=ISO
router.get("/:teacherId", verifyToken, async (req, res) => {
  try {
    // Students are blocked when teacher has hidden their schedule
    if (req.user.role === "student") {
      const teacher = await Teacher.findById(req.params.teacherId).select("showScheduleToStudents");
      if (teacher && teacher.showScheduleToStudents === false) {
        return res.json({ availability: [], hidden: true });
      }
    }

    const { startDate, endDate } = req.query;
    const base = { teacherId: req.params.teacherId };

    let query;
    if (startDate && endDate) {
      // Return recurring slots always + specific slots within the date range
      query = {
        ...base,
        $or: [
          { isRecurring: true },
          { date: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        ],
      };
    } else {
      query = base;
    }

    const availability = await TeacherAvailability.find(query).sort({ date: 1, startTime: 1 });
    res.json({ availability });
  } catch (err) {
    console.error("Error fetching availability:", err);
    res.status(500).json({ message: "Error fetching availability" });
  }
});

// POST /api/teacher-availability
router.post("/", verifyToken, async (req, res) => {
  try {
    const { teacherId, date, dayOfWeek, startTime, endTime, isRecurring, note, timezone } = req.body;

    if (!teacherId || !startTime || !endTime) {
      return res.status(400).json({ message: "teacherId, startTime, and endTime are required" });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ message: "endTime must be after startTime" });
    }
    if (!isRecurring && !date) {
      return res.status(400).json({ message: "date is required for non-recurring availability" });
    }

    // ── Conflict check against existing availability slots ────────────────────
    const targetDay = isRecurring ? Number(dayOfWeek) : new Date(date).getDay();
    const dayStart  = isRecurring ? null : new Date(date); if (dayStart) dayStart.setHours(0,0,0,0);
    const dayEnd    = isRecurring ? null : new Date(date); if (dayEnd)   dayEnd.setHours(23,59,59,999);

    const slotConflictQuery = {
      teacherId,
      $or: [
        { isRecurring: true,  dayOfWeek: targetDay },
        ...(isRecurring ? [] : [{ isRecurring: false, date: { $gte: dayStart, $lte: dayEnd } }]),
      ],
    };
    const existingSlots = await TeacherAvailability.find(slotConflictQuery);
    for (const slot of existingSlots) {
      if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        return res.status(409).json({
          message: `Time conflict: you already have an occupied slot at ${slot.startTime}–${slot.endTime}`,
        });
      }
    }

    // ── Conflict check against accepted/pending bookings (specific day only) ──
    if (!isRecurring && dayStart && dayEnd) {
      const existingBookings = await Booking.find({
        teacherId,
        scheduledTime: { $gte: dayStart, $lte: dayEnd },
        status: { $in: ["pending", "accepted"] },
      });
      for (const b of existingBookings) {
        const bStart = new Date(b.scheduledTime);
        const bEnd   = new Date(bStart.getTime() + (b.duration || 60) * 60000);
        const bST = `${String(bStart.getHours()).padStart(2,"0")}:${String(bStart.getMinutes()).padStart(2,"0")}`;
        const bET = `${String(bEnd.getHours()).padStart(2,"0")}:${String(bEnd.getMinutes()).padStart(2,"0")}`;
        if (timesOverlap(startTime, endTime, bST, bET)) {
          return res.status(409).json({
            message: `Time conflict: there is already a booked class at ${bST}–${bET}`,
          });
        }
      }
    }

    const avail = new TeacherAvailability({
      teacherId,
      studentId:   req.body.studentId || null,
      date:        isRecurring ? undefined : new Date(date),
      dayOfWeek:   isRecurring ? dayOfWeek : undefined,
      startTime,
      endTime,
      isRecurring: !!isRecurring,
      note:        note || "",
      timezone:    timezone || "",
    });

    await avail.save();
    res.status(201).json({ availability: avail, message: "Availability saved" });
  } catch (err) {
    console.error("Error saving availability:", err);
    res.status(500).json({ message: "Error saving availability" });
  }
});

// DELETE /api/teacher-availability/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const avail = await TeacherAvailability.findByIdAndDelete(req.params.id);
    if (!avail) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Availability removed" });
  } catch (err) {
    console.error("Error deleting availability:", err);
    res.status(500).json({ message: "Error deleting availability" });
  }
});

export default router;
