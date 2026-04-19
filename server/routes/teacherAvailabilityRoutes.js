import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { teacherAvailabilitySchema } from "../schemas/teacherAvailabilitySchema.js";
import { bookingSchema }             from "../schemas/bookingSchema.js";
import { teacherSchema }             from "../schemas/teacherSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

// Returns true if [s1,e1) overlaps with [s2,e2)  (string "HH:MM" comparison)
function timesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

const router = express.Router();
router.use(tenantMiddleware);

const getTeacherAvailability = (db) =>
  db.models.TeacherAvailability || db.model("TeacherAvailability", teacherAvailabilitySchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);

// GET /api/teacher-availability/:teacherId
// Query: ?startDate=ISO&endDate=ISO
router.get("/:teacherId", verifyToken, async (req, res) => {
  try {
    // Students are blocked when teacher has hidden their schedule
    if (req.user.role === "student") {
      const teacher = await getTeacher(req.db).findById(req.params.teacherId).select("showScheduleToStudents");
      if (teacher && teacher.showScheduleToStudents === false) {
        return res.json({ availability: [], hidden: true });
      }
    }

    const { startDate, endDate } = req.query;
    const base = { teacherId: req.params.teacherId };

    let query;
    if (startDate && endDate) {
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

    const availability = await getTeacherAvailability(req.db).find(query).sort({ date: 1, startTime: 1 });
    res.json({ availability });
  } catch (err) {
    logger.error("Error fetching availability:", { error: err?.message });
    serverError(res, "Error fetching availability");
  }
});

// POST /api/teacher-availability
router.post("/", verifyToken, async (req, res) => {
  try {
    const { teacherId, date, dayOfWeek, startTime, endTime, isRecurring, note, timezone } = req.body;

    if (!teacherId || !startTime || !endTime) {
      return badRequest(res, "teacherId, startTime, and endTime are required");
    }
    if (startTime >= endTime) {
      return badRequest(res, "endTime must be after startTime");
    }
    if (!isRecurring && !date) {
      return badRequest(res, "date is required for non-recurring availability");
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
    const existingSlots = await getTeacherAvailability(req.db).find(slotConflictQuery);
    for (const slot of existingSlots) {
      if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
        return res.status(409).json({
          message: `Time conflict: you already have an occupied slot at ${slot.startTime}–${slot.endTime}`,
        });
      }
    }

    // ── Conflict check against accepted/pending bookings (specific day only) ──
    if (!isRecurring && dayStart && dayEnd) {
      const existingBookings = await getBooking(req.db).find({
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

    const TeacherAvailability = getTeacherAvailability(req.db);
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
    logger.error("Error saving availability:", { error: err?.message });
    serverError(res, "Error saving availability");
  }
});

// DELETE /api/teacher-availability/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const avail = await getTeacherAvailability(req.db).findByIdAndDelete(req.params.id);
    if (!avail) return notFound(res, "Not found");
    res.json({ message: "Availability removed" });
  } catch (err) {
    logger.error("Error deleting availability:", { error: err?.message });
    serverError(res, "Error deleting availability");
  }
});

export default router;
