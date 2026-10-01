// server/routes/teacherAvailabilityRoutes.js
// Teacher schedule. Free time = weekly working hours (Teacher.workingHours, in the
// teacher's timezone) − time off / reserved blocks (TeacherAvailability docs)
// − pending/accepted classes. See server/utils/schedule.js.
//
//   GET    /teacher-availability/:teacherId/calendar?from=ISO&to=ISO   free + blocks as real moments
//   GET    /teacher-availability/:teacherId?startDate&endDate         raw time-off docs (teacher/admin)
//   POST   /teacher-availability                                      add time off / reserve
//   DELETE /teacher-availability/:id                                  remove time off
import express from "express";
import mongoose from "mongoose";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { teacherAvailabilitySchema } from "../schemas/teacherAvailabilitySchema.js";
import { bookingSchema }             from "../schemas/bookingSchema.js";
import { teacherSchema }             from "../schemas/teacherSchema.js";
import { studentSchema }             from "../schemas/studentSchema.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, notFound, serverError } from '../utils/apiResponse.js';
import {
  BUSY_STATUSES, isHHMM, isValidTz, toMin, zonedToUtc, ymdInTz,
  freeIntervals, blockIntervals, bookingInterval, teacherTz,
} from "../utils/schedule.js";

const router = express.Router();
router.use(tenantMiddleware);

const getTeacherAvailability = (db) =>
  db.models.TeacherAvailability || db.model("TeacherAvailability", teacherAvailabilitySchema);
const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);
const getTeacher = (db) => db.models.Teacher || db.model("Teacher", teacherSchema);
const getStudent = (db) => db.models.Student || db.model("Student", studentSchema);

const MAX_RANGE_DAYS = 32;
const isAdmin = (req) => req.user.role === "admin";
const isSelf  = (req, teacherId) => req.user.role === "teacher" && String(req.user.id) === String(teacherId);
const nameOf  = (p) => (p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "");

// ─────────────────────────────────────────────────────────────────────────────
// GET /free-search?start=ISO&end=ISO&continent=Asia  (admin)
// Which teachers are free for the whole of [start, end)?
//   available — inside their working hours, no class / time off in the way
//   partial   — free for part of it (the free pieces are returned)
//   noHours   — haven't set working hours, but nothing booked/blocked then
// (Defined before "/:teacherId" so the path isn't taken as a teacher id.)
// ─────────────────────────────────────────────────────────────────────────────
const CONTINENTS = ["Africa", "Europe", "Asia", "Americas", "Oceania"];
router.get("/free-search", verifyToken, async (req, res) => {
  try {
    if (!isAdmin(req)) return forbidden(res, "Admins only");
    const start = new Date(req.query.start), end = new Date(req.query.end);
    if (isNaN(start) || isNaN(end) || end <= start) return badRequest(res, "Choose a start and end time");
    if (end - start > 12 * 3600000) return badRequest(res, "Search up to 12 hours at a time");
    const filter = { active: true, status: { $ne: "suspended" } };
    if (req.query.continent) {
      if (!CONTINENTS.includes(req.query.continent)) return badRequest(res, "Unknown continent");
      filter.continent = req.query.continent;
    }

    const teachers = await getTeacher(req.db).find(filter)
      .select("firstName lastName displayName photo continent timezone workingHours workingHoursTz email")
      .sort({ firstName: 1 }).lean();
    const ids = teachers.map(t => t._id);
    const [blocks, bookings] = await Promise.all([
      getTeacherAvailability(req.db).find({
        teacherId: { $in: ids },
        $or: [{ isRecurring: true }, { date: { $gte: new Date(start - 2 * 86400000), $lte: new Date(+end + 2 * 86400000) } }],
      }).lean(),
      getBooking(req.db).find({
        teacherId: { $in: ids }, status: { $in: BUSY_STATUSES },
        scheduledTime: { $gte: new Date(start - 4 * 3600000), $lt: end },
      }).lean(),
    ]);
    const byTeacher = (list) => list.reduce((m, x) => { (m[String(x.teacherId)] ||= []).push(x); return m; }, {});
    const blocksOf = byTeacher(blocks), bookingsOf = byTeacher(bookings);

    const s = start.getTime(), e = end.getTime();
    const out = { available: [], partial: [], noHours: [] };
    for (const t of teachers) {
      const tb = blocksOf[String(t._id)] || [], tk = bookingsOf[String(t._id)] || [];
      const tz = teacherTz(t, tb);
      const row = {
        _id: String(t._id), name: t.displayName?.trim() || nameOf(t), photo: t.photo || "",
        continent: t.continent || "", timezone: tz, email: t.email || "",
      };
      if (!(t.workingHours || []).length) {
        const clash = [...blockIntervals(tb, tz, start, end), ...tk.map(bookingInterval)].some(i => i.start < e && i.end > s);
        if (!clash) out.noHours.push(row);
        continue;
      }
      const free = freeIntervals({ teacher: t, tz, blocks: tb, bookings: tk, from: new Date(s - 86400000), to: new Date(e + 86400000), now: 0 })
        .map(f => ({ start: Math.max(f.start, s), end: Math.min(f.end, e) })).filter(f => f.end > f.start);
      if (free.some(f => f.start === s && f.end === e)) out.available.push(row);
      else if (free.length) out.partial.push({ ...row, free: free.map(f => ({ start: new Date(f.start), end: new Date(f.end) })) });
    }
    res.json({ success: true, ...out });
  } catch (err) {
    logger.error("Free-time search error:", { error: err?.message });
    serverError(res, "Search failed");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /:teacherId/calendar — everything a calendar needs, as real moments (ISO).
// Teacher (self) / admin: full detail. Student: free time + their own classes;
// other people's classes and time off are just "busy" (no names, no notes, and
// never the teacher's timezone).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:teacherId/calendar", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "Invalid teacher");
    const role = req.user.role;
    const full = isAdmin(req) || isSelf(req, teacherId);
    if (!full && role !== "student") return forbidden(res, "Access denied");

    const from = new Date(req.query.from), to = new Date(req.query.to);
    if (isNaN(from) || isNaN(to) || to <= from) return badRequest(res, "from and to are required");
    if (to - from > MAX_RANGE_DAYS * 86400000) return badRequest(res, "Range too long");

    const teacher = await getTeacher(req.db).findById(teacherId).select("workingHours workingHoursTz timezone showScheduleToStudents active").lean();
    if (!teacher) return notFound(res, "Teacher not found");
    if (role === "student" && teacher.showScheduleToStudents === false) {
      return res.json({ success: true, hidden: true, hasHours: false, free: [], blocks: [] });
    }

    getStudent(req.db);
    const [blocks, bookings] = await Promise.all([
      getTeacherAvailability(req.db).find({
        teacherId,
        $or: [{ isRecurring: true }, { date: { $gte: new Date(from - 2 * 86400000), $lte: new Date(+to + 2 * 86400000) } }],
      }).lean(),
      getBooking(req.db).find({
        teacherId,
        status: { $in: full ? [...BUSY_STATUSES, "completed"] : BUSY_STATUSES },
        scheduledTime: { $gte: new Date(from - 4 * 3600000), $lt: to },
      }).populate("studentId", "firstName lastName isManaged").lean(),
    ]);

    const tz = teacherTz(teacher, blocks);
    const hasHours = (teacher.workingHours || []).length > 0;
    const free = hasHours
      ? freeIntervals({ teacher, tz, blocks, bookings, from, to }).map(i => ({ start: new Date(i.start), end: new Date(i.end) }))
      : [];

    const reservedIds = blocks.filter(b => b.studentId).map(b => b.studentId);
    const reservedFor = reservedIds.length && full
      ? Object.fromEntries((await getStudent(req.db).find({ _id: { $in: reservedIds } }).select("firstName lastName").lean()).map(s => [String(s._id), nameOf(s)]))
      : {};

    const out = [];
    for (const i of blockIntervals(blocks, tz, from, to)) {
      const b = i.block;
      out.push(full ? {
        id: `${b._id}:${i.start}`, slotId: String(b._id),
        kind: b.studentId ? "reserved" : "off",
        start: new Date(i.start), end: new Date(i.end),
        recurring: !!b.isRecurring, note: b.note || "",
        studentName: b.studentId ? (reservedFor[String(b.studentId)] || "Student") : "",
      } : { id: `x:${i.start}`, kind: "busy", start: new Date(i.start), end: new Date(i.end) });
    }
    for (const bk of bookings) {
      const i = bookingInterval(bk);
      if (i.end <= from.getTime() || i.start >= to.getTime()) continue;
      const mine = role === "student" && String(bk.studentId?._id || bk.studentId) === String(req.user.id);
      if (full || mine) {
        out.push({
          id: String(bk._id), kind: bk.status === "pending" ? "pending" : bk.status === "completed" ? "done" : "booked",
          start: new Date(i.start), end: new Date(i.end),
          title: bk.classTitle || "Class", topic: bk.topic || "", duration: bk.duration || 60,
          ...(full ? { studentName: nameOf(bk.studentId) || "Student", isManaged: !!bk.studentId?.isManaged, studentTimezone: bk.studentTimezone || "" } : { mine: true }),
        });
      } else {
        out.push({ id: `x:${i.start}`, kind: "busy", start: new Date(i.start), end: new Date(i.end) });
      }
    }
    out.sort((a, b) => a.start - b.start);

    res.json({
      success: true, hasHours, free, blocks: out,
      ...(full ? { timezone: tz, workingHours: teacher.workingHours || [] } : {}),
    });
  } catch (err) {
    logger.error("Error building teacher calendar:", { error: err?.message });
    serverError(res, "Error loading schedule");
  }
});

// GET /:teacherId — raw time-off docs (teacher self / admin)
router.get("/:teacherId", verifyToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "Invalid teacher");
    if (!isAdmin(req) && !isSelf(req, teacherId)) return forbidden(res, "Access denied");
    const { startDate, endDate } = req.query;
    const query = startDate && endDate
      ? { teacherId, $or: [{ isRecurring: true }, { date: { $gte: new Date(startDate), $lte: new Date(endDate) } }] }
      : { teacherId };
    const availability = await getTeacherAvailability(req.db).find(query).sort({ date: 1, startTime: 1 });
    res.json({ availability });
  } catch (err) {
    logger.error("Error fetching availability:", { error: err?.message });
    serverError(res, "Error fetching availability");
  }
});

// POST / — add time off (or reserve time for one student).
// Body: { teacherId (admin only), localDate "YYYY-MM-DD" | dayOfWeek (recurring),
//         startTime, endTime "HH:MM", isRecurring, studentId?, note?, timezone? }
router.post("/", verifyToken, async (req, res) => {
  try {
    const teacherId = req.user.role === "teacher" ? req.user.id : req.body.teacherId;
    if (!isAdmin(req) && !isSelf(req, teacherId)) return forbidden(res, "Only the teacher or an admin can change this schedule");
    if (!mongoose.isValidObjectId(teacherId)) return badRequest(res, "teacherId is required");

    const { startTime, endTime, note } = req.body;
    const isRecurring = !!req.body.isRecurring;
    if (!isHHMM(startTime) || !isHHMM(endTime) || startTime === "24:00") return badRequest(res, "startTime and endTime must be HH:MM");
    if (toMin(endTime) <= toMin(startTime)) return badRequest(res, "endTime must be after startTime");
    if (req.body.studentId && !mongoose.isValidObjectId(req.body.studentId)) return badRequest(res, "Invalid student");

    const teacher = await getTeacher(req.db).findById(teacherId).select("timezone workingHoursTz").lean();
    if (!teacher) return notFound(res, "Teacher not found");
    const tz = isValidTz(req.body.timezone) ? req.body.timezone : teacherTz(teacher);

    // The day, in the teacher's timezone
    let localDate = typeof req.body.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.localDate) ? req.body.localDate : null;
    if (!localDate && req.body.date && !isNaN(new Date(req.body.date))) localDate = ymdInTz(new Date(req.body.date), tz);
    let dayOfWeek = Number(req.body.dayOfWeek);
    if (localDate) {
      const [y, m, d] = localDate.split("-").map(Number);
      dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    }
    if (!isRecurring && !localDate) return badRequest(res, "localDate is required for a one-off block");
    if (isRecurring && !(dayOfWeek >= 0 && dayOfWeek <= 6)) return badRequest(res, "dayOfWeek is required for a weekly block");

    const Avail = getTeacherAvailability(req.db);
    const existing = await Avail.find({ teacherId }).lean();

    if (isRecurring) {
      const clash = existing.find(b => b.isRecurring && b.dayOfWeek === dayOfWeek && toMin(startTime) < toMin(b.endTime) && toMin(endTime) > toMin(b.startTime));
      if (clash) return res.status(409).json({ success: false, message: `Overlaps your weekly block ${clash.startTime}–${clash.endTime}` });
    } else {
      const start = zonedToUtc(localDate, startTime, tz).getTime();
      const end = zonedToUtc(localDate, endTime, tz).getTime();
      const win = { from: new Date(start - 86400000), to: new Date(end + 86400000) };
      const clash = blockIntervals(existing, tz, win.from, win.to).find(i => start < i.end && end > i.start);
      if (clash) return res.status(409).json({ success: false, message: `Overlaps time off you already set (${clash.block.startTime}–${clash.block.endTime})` });
      const booked = await getBooking(req.db).findOne({
        teacherId, status: { $in: ["pending", "accepted"] },
        scheduledTime: { $lt: new Date(end), $gte: new Date(start - 4 * 3600000) },
      }).lean();
      if (booked && bookingInterval(booked).end > start) {
        return res.status(409).json({ success: false, message: "There is already a class booked in that time" });
      }
    }

    const avail = await Avail.create({
      teacherId,
      studentId:   req.body.studentId || null,
      date:        isRecurring ? undefined : zonedToUtc(localDate, "00:00", tz),
      dayOfWeek,
      startTime, endTime, isRecurring,
      note:        typeof note === "string" ? note.slice(0, 300) : "",
      timezone:    tz,
    });
    res.status(201).json({ success: true, availability: avail, message: "Time off saved" });
  } catch (err) {
    logger.error("Error saving availability:", { error: err?.message });
    serverError(res, "Error saving availability");
  }
});

// DELETE /:id — the teacher who owns it, or an admin
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badRequest(res, "Invalid id");
    const Avail = getTeacherAvailability(req.db);
    const avail = await Avail.findById(req.params.id);
    if (!avail) return notFound(res, "Not found");
    if (!isAdmin(req) && !isSelf(req, avail.teacherId)) return forbidden(res, "Access denied");
    await avail.deleteOne();
    res.json({ success: true, message: "Time off removed" });
  } catch (err) {
    logger.error("Error deleting availability:", { error: err?.message });
    serverError(res, "Error deleting availability");
  }
});

export default router;
