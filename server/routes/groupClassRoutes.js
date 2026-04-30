// server/routes/groupClassRoutes.js
import express from "express";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware }       from "../middleware/tenantMiddleware.js";
import { groupClassSchema }       from "../schemas/groupClassSchema.js";
import { teacherSchema }          from "../schemas/teacherSchema.js";
import { studentSchema }          from "../schemas/studentSchema.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";
import { validateObjectId }  from "../middleware/validateObjectId.js";
import { parsePagination }   from "../utils/pagination.js";
import { toStr, toObjectId } from "../utils/inputSanitizer.js";

const router = express.Router();
router.use(tenantMiddleware);

const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);

// ─── GET / — list group classes ───────────────────────────────────────────────
// admin: all | teacher: own | student: enrolled + open
router.get("/", verifyToken, async (req, res) => {
  try {
    const { status, teacherId: qTeacherId } = req.query;
    const { limit, skip } = parsePagination(req.query, 50, 200);
    getTeacher(req.db);
    getStudent(req.db);

    let filter = {};
    if (req.user.role === "teacher") {
      filter.teacherId = req.user.id;
    } else if (req.user.role === "student") {
      filter.$or = [
        { "enrollments.studentId": req.user.id },
        { status: "open" },
      ];
    } else if (req.user.role === "admin" || req.user.role === "sub-admin") {
      if (qTeacherId) filter.teacherId = qTeacherId;
    }

    if (status) filter.status = status;

    const [classes, total] = await Promise.all([
      getGroupClass(req.db).find(filter)
        .populate("teacherId", "firstName lastName email")
        .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean(),
      getGroupClass(req.db).countDocuments(filter),
    ]);
    res.json({ success: true, classes, total, limit, skip });
  } catch (err) {
    logger.error("Error fetching group classes:", { error: err?.message });
    serverError(res, "Error fetching group classes");
  }
});

// ─── POST / — create ──────────────────────────────────────────────────────────
router.post("/", verifyToken, verifyAdminOrTeacher, async (req, res) => {
  try {
    const {
      scheduledTime, duration, maxSeats, pricePerSeat,
      level, description, notes, tags,
    } = req.body;

    const teacherId = req.user.role === "teacher"
      ? req.user.id
      : toObjectId(req.body.teacherId, "teacherId");
    const title = toStr(req.body.title, "title", { required: true, maxLen: 200 });

    if (!scheduledTime) return badRequest(res, "scheduledTime is required");

    const teacher = await getTeacher(req.db).findById(teacherId);
    if (!teacher) return notFound(res, "Teacher not found");

    const groupClass = await getGroupClass(req.db).create({
      teacherId,
      title,
      description:     description || "",
      level:           level || "Mixed",
      maxSeats:        maxSeats || 8,
      pricePerSeat:    pricePerSeat || 1,
      scheduledTime:   new Date(scheduledTime),
      teacherTimezone: teacher.timezone || "",
      duration:        duration || 60,
      notes:           notes || "",
      tags:            Array.isArray(tags) ? tags : [],
      createdBy:       req.user.role === "admin" ? "admin" : "teacher",
    });

    res.status(201).json({ success: true, message: "Group class created", groupClass });
  } catch (err) {
    logger.error("Error creating group class:", { error: err?.message });
    serverError(res, "Error creating group class");
  }
});

// ─── GET /:id — single ────────────────────────────────────────────────────────
router.get("/:id", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const gc = await getGroupClass(req.db).findById(req.params.id)
      .populate("teacherId", "firstName lastName email")
      .populate("enrollments.studentId", "firstName lastName email classCredits");
    if (!gc) return notFound(res, "Group class not found");

    const { role, id } = req.user;
    if (
      role !== "admin" && role !== "sub-admin" &&
      !(role === "teacher" && gc.teacherId._id.toString() === id) &&
      !(role === "student" && gc.enrollments.some(e => e.studentId?._id?.toString() === id)) &&
      gc.status !== "open"
    ) return forbidden(res, "Not authorized to view this class");

    res.json({ success: true, groupClass: gc });
  } catch (err) {
    logger.error("Error fetching group class:", { error: err?.message });
    serverError(res, "Error fetching group class");
  }
});

// ─── PATCH /:id — update metadata ────────────────────────────────────────────
router.patch("/:id", verifyToken, verifyAdminOrTeacher, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    if (req.user.role === "teacher" && gc.teacherId.toString() !== req.user.id)
      return forbidden(res, "You can only edit your own group classes");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, "Cannot edit a completed or cancelled class");

    const allowed = ["title", "description", "level", "maxSeats", "pricePerSeat",
                     "scheduledTime", "duration", "notes", "tags"];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) gc[field] = req.body[field];
    });
    if (req.body.scheduledTime) gc.scheduledTime = new Date(req.body.scheduledTime);

    await gc.save();
    res.json({ success: true, message: "Group class updated", groupClass: gc });
  } catch (err) {
    logger.error("Error updating group class:", { error: err?.message });
    serverError(res, "Error updating group class");
  }
});

// ─── DELETE /:id — admin only ─────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");
    await gc.deleteOne();
    res.json({ success: true, message: "Group class deleted" });
  } catch (err) {
    logger.error("Error deleting group class:", { error: err?.message });
    serverError(res, "Error deleting group class");
  }
});

// ─── POST /:id/enroll — add a student ────────────────────────────────────────
// Admin passes { studentId }; student self-enrolls (no body needed beyond auth)
router.post("/:id/enroll", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let studentId;
    if (role === "student") {
      studentId = userId;
    } else if (role === "admin" || role === "sub-admin" || role === "teacher") {
      studentId = toObjectId(req.body.studentId, "studentId");
    } else {
      return forbidden(res, "Not authorized to enroll students");
    }

    const [gc, student] = await Promise.all([
      getGroupClass(req.db).findById(req.params.id),
      getStudent(req.db).findById(studentId),
    ]);
    if (!gc)      return notFound(res, "Group class not found");
    if (!student) return notFound(res, "Student not found");

    if (gc.status !== "open") return badRequest(res, `Class is ${gc.status} — enrollment is closed`);

    const alreadyEnrolled = gc.enrollments.some(
      e => e.studentId.toString() === studentId.toString()
    );
    if (alreadyEnrolled) return conflict(res, "Student is already enrolled");
    if (gc.enrollments.length >= gc.maxSeats) return conflict(res, "Class is full");

    const price = gc.pricePerSeat || 1;
    if (student.classCredits < price)
      return badRequest(res, `Student needs ${price} credit(s) but only has ${student.classCredits}`);

    // Deduct credits
    student.classCredits -= price;
    await student.save();

    gc.enrollments.push({ studentId, creditCharged: price });
    if (gc.enrollments.length >= gc.maxSeats) gc.status = "full";
    await gc.save();

    // Notify via socket
    try {
      const io = req.app.get("io");
      io.to(`student-room:${req.center.slug}:${studentId}`).emit("group-class-update", {
        type: "enrolled",
        title: "✅ Enrolled in Group Class",
        message: `You're enrolled in "${gc.title}"`,
        groupClassId: gc._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: "Student enrolled successfully",
      creditsRemaining: student.classCredits,
      seatsLeft: gc.maxSeats - gc.enrollments.length,
    });
  } catch (err) {
    logger.error("Error enrolling student:", { error: err?.message });
    serverError(res, "Error enrolling student");
  }
});

// ─── DELETE /:id/enroll/:studentId — remove enrollment + refund ───────────────
router.delete("/:id/enroll/:studentId", verifyToken, validateObjectId("id"), validateObjectId("studentId"), async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { studentId } = req.params;

    // Student may only remove themselves; admin/teacher can remove anyone
    if (role === "student" && userId !== studentId)
      return forbidden(res, "You can only remove your own enrollment");

    const [gc, student] = await Promise.all([
      getGroupClass(req.db).findById(req.params.id),
      getStudent(req.db).findById(studentId),
    ]);
    if (!gc) return notFound(res, "Group class not found");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, "Cannot remove enrollment from a completed or cancelled class");

    const idx = gc.enrollments.findIndex(e => e.studentId.toString() === studentId);
    if (idx === -1) return notFound(res, "Student is not enrolled in this class");

    const creditCharged = gc.enrollments[idx].creditCharged || 0;
    gc.enrollments.splice(idx, 1);
    if (gc.status === "full" && gc.enrollments.length < gc.maxSeats) gc.status = "open";
    await gc.save();

    // Refund credits
    if (student && creditCharged > 0) {
      student.classCredits += creditCharged;
      await student.save();
    }

    res.json({
      success: true,
      message: "Enrollment removed and credits refunded",
      creditsRefunded: creditCharged,
    });
  } catch (err) {
    logger.error("Error removing enrollment:", { error: err?.message });
    serverError(res, "Error removing enrollment");
  }
});

// ─── PATCH /:id/attendance — teacher marks per-student attendance ─────────────
// Body: { attendance: [{ studentId, status: 'attended'|'absent' }] }
router.patch("/:id/attendance", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && role !== "admin") return forbidden(res, "Not authorized to mark attendance");
    if (!["in-progress", "completed"].includes(gc.status))
      return badRequest(res, "Can only mark attendance for in-progress or completed classes");

    const { attendance } = req.body;
    if (!Array.isArray(attendance)) return badRequest(res, "attendance must be an array");

    const valid = new Set(["attended", "absent", "pending"]);
    for (const entry of attendance) {
      const idx = gc.enrollments.findIndex(e => e.studentId.toString() === entry.studentId);
      if (idx !== -1 && valid.has(entry.status)) {
        gc.enrollments[idx].attendance = entry.status;
      }
    }
    await gc.save();

    res.json({ success: true, message: "Attendance updated", enrollments: gc.enrollments });
  } catch (err) {
    logger.error("Error marking attendance:", { error: err?.message });
    serverError(res, "Error marking attendance");
  }
});

// ─── PATCH /:id/complete — teacher/admin marks class as done ─────────────────
router.patch("/:id/complete", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && role !== "admin") return forbidden(res, "Not authorized to complete this class");
    if (!["open", "full", "in-progress"].includes(gc.status))
      return badRequest(res, `Cannot complete a class with status: ${gc.status}`);

    // Apply final attendance from body if provided
    if (Array.isArray(req.body.attendance)) {
      const valid = new Set(["attended", "absent", "pending"]);
      for (const entry of req.body.attendance) {
        const idx = gc.enrollments.findIndex(e => e.studentId.toString() === entry.studentId);
        if (idx !== -1 && valid.has(entry.status)) gc.enrollments[idx].attendance = entry.status;
      }
    }

    gc.status      = "completed";
    gc.completedAt = new Date();
    await gc.save();

    // Notify enrolled students via socket
    try {
      const io  = req.app.get("io");
      const slug = req.center?.slug;
      for (const enr of gc.enrollments) {
        io.to(`student-room:${slug}:${enr.studentId}`).emit("group-class-update", {
          type: "completed",
          title: "🎉 Group Class Completed",
          message: `"${gc.title}" has ended`,
          groupClassId: gc._id,
        });
      }
    } catch (_) {}

    res.json({ success: true, message: "Group class completed", groupClass: gc });
  } catch (err) {
    logger.error("Error completing group class:", { error: err?.message });
    serverError(res, "Error completing group class");
  }
});

// ─── PATCH /:id/cancel — admin or teacher cancels + full refund ───────────────
router.patch("/:id/cancel", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && role !== "admin") return forbidden(res, "Not authorized to cancel this class");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, `Class is already ${gc.status}`);

    const reason = req.body.reason || "";

    // Refund all enrolled students
    const Student = getStudent(req.db);
    const refundOps = gc.enrollments
      .filter(e => (e.creditCharged || 0) > 0)
      .map(e =>
        Student.findByIdAndUpdate(e.studentId, { $inc: { classCredits: e.creditCharged } })
      );
    await Promise.all(refundOps);

    gc.status       = "cancelled";
    gc.cancelledAt  = new Date();
    gc.cancelReason = reason;
    await gc.save();

    // Notify students
    try {
      const io   = req.app.get("io");
      const slug = req.center?.slug;
      for (const enr of gc.enrollments) {
        io.to(`student-room:${slug}:${enr.studentId}`).emit("group-class-update", {
          type: "cancelled",
          title: "❌ Group Class Cancelled",
          message: `"${gc.title}" was cancelled. Your credits have been refunded.`,
          groupClassId: gc._id,
        });
      }
    } catch (_) {}

    res.json({
      success: true,
      message: `Group class cancelled. ${gc.enrollments.filter(e => e.creditCharged > 0).length} student(s) refunded.`,
    });
  } catch (err) {
    logger.error("Error cancelling group class:", { error: err?.message });
    serverError(res, "Error cancelling group class");
  }
});

// ─── PATCH /:id/start — begin class (changes status to in-progress) ───────────
router.patch("/:id/start", verifyToken, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && role !== "admin") return forbidden(res, "Not authorized to start this class");
    if (!["open", "full"].includes(gc.status))
      return badRequest(res, `Cannot start a class with status: ${gc.status}`);

    gc.status = "in-progress";
    await gc.save();
    res.json({ success: true, message: "Group class started", groupClass: gc });
  } catch (err) {
    logger.error("Error starting group class:", { error: err?.message });
    serverError(res, "Error starting group class");
  }
});

export default router;
