// server/routes/groupClassRoutes.js
import express from "express";
import mongoose from "mongoose";
import { verifyToken, verifyAdmin, verifyAdminOrTeacher } from "../middleware/authMiddleware.js";
import { tenantMiddleware }       from "../middleware/tenantMiddleware.js";
import { groupClassSchema }       from "../schemas/groupClassSchema.js";
import { teacherSchema }          from "../schemas/teacherSchema.js";
import { studentSchema }          from "../schemas/studentSchema.js";
import logger from "../utils/logger.js";
import { badRequest, forbidden, notFound, conflict, serverError } from "../utils/apiResponse.js";
import { validateObjectId }  from "../middleware/validateObjectId.js";
import { parsePagination }   from "../utils/pagination.js";
import { toStr, toObjectId } from "../utils/inputSanitizer.js";
import { subAdminNeeds, isSubAdmin, inScope, scopeFilter, scopedStudentIds } from "../middleware/staffAccess.js";
import { classPricingSchema } from "../schemas/classPricingSchema.js";
import { usesPoints, spendPoints, refundEnrollment, payGroupClassFee } from "../utils/groupPoints.js";

const router = express.Router();
router.use(tenantMiddleware);

const getGroupClass = (db) => db.models.GroupClass || db.model("GroupClass", groupClassSchema);
const getTeacher    = (db) => db.models.Teacher    || db.model("Teacher",    teacherSchema);
const getStudent    = (db) => db.models.Student    || db.model("Student",    studentSchema);
const getPricing    = (db) => db.models.ClassPricing || db.model("ClassPricing", classPricingSchema);

// Seat price in group points / teacher fee from a request body
const wholeNumber = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
const moneyValue  = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };

// ── Class platform: Agora (in the app), Google Meet or Zoom ──────────────────
const PLATFORMS = { agora: "agora", googlemeet: "googleMeet", zoom: "zoom" }; // → center.features key
const LINK_HOSTS = { googlemeet: /(^|\.)meet\.google\.com$/i, zoom: /(^|\.)zoom\.(us|com)$/i };
const PLATFORM_NAMES = { googlemeet: "Google Meet", zoom: "Zoom" };
const teacherLinkFor = (teacher, platform) => (platform === "googlemeet" ? teacher?.googleMeetLink : platform === "zoom" ? teacher?.zoomLink : "") || "";
function validLink(platform, link) {
  try {
    const u = new URL(String(link).trim());
    return u.protocol === "https:" && LINK_HOSTS[platform].test(u.hostname);
  } catch { return false; }
}
/** { platform, meetingLink } from a request body, or { error } */
function readPlatform(req, body, teacher, current = {}) {
  const platform = body.platform === undefined ? (current.platform || "agora") : body.platform;
  if (!PLATFORMS[platform]) return { error: "Platform must be agora, googlemeet or zoom" };
  if (req.center?.features?.[PLATFORMS[platform]] === false) return { error: "This platform is turned off for your center" };
  if (platform === "agora") return { platform, meetingLink: "" };
  const typed = typeof body.meetingLink === "string" ? body.meetingLink.trim() : undefined;
  const meetingLink = typed !== undefined ? typed : (current.platform === platform ? current.meetingLink || "" : "");
  if (meetingLink && !validLink(platform, meetingLink))
    return { error: `Paste a valid ${PLATFORM_NAMES[platform]} link (https://…)` };
  if (!meetingLink && !validLink(platform, teacherLinkFor(teacher, platform)))
    return { error: `Add a ${PLATFORM_NAMES[platform]} link for this class, or save one on the teacher's profile` };
  return { platform, meetingLink };
}

// Sub-admins with "Group classes" manage the classes of their own teachers.
// subAdminNeeds() checks the permission and loads req.teacherScope for them.
const staffOrTeacher = (req, res, next) => (isSubAdmin(req) ? next() : verifyAdminOrTeacher(req, res, next));
// Admin, the class's own teacher, or a sub-admin covering that teacher
const canStaff = (req, gc) => req.user.role === "admin"
  || (req.user.role === "teacher" && String(gc.teacherId?._id || gc.teacherId) === req.user.id)
  || (isSubAdmin(req) && inScope(req, gc.teacherId));

// ─── GET / — list group classes ───────────────────────────────────────────────
// admin: all | teacher: own | student: enrolled + open
router.get("/", verifyToken, subAdminNeeds("canManageGroupClasses"), async (req, res) => {
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
        { status: "open", enrollmentMode: "open" },
        { status: "open", enrollmentMode: { $exists: false } },
        { status: "open", enrollmentMode: "invite-only", invitedStudents: req.user.id },
      ];
    } else if (req.user.role === "admin" || req.user.role === "sub-admin") {
      filter = scopeFilter(req); // sub-admin: own teachers only
      if (typeof qTeacherId === "string" && inScope(req, qTeacherId)) filter.teacherId = qTeacherId;
    } else {
      return forbidden(res, "Not authorized to view group classes");
    }

    // "active" = not finished yet (finished ones live in class history: Completed / Not completed)
    if (status === "active") filter.status = { $in: ["open", "full", "in-progress"] };
    else if (typeof status === "string" && status) filter.status = status;

    const [classes, total] = await Promise.all([
      getGroupClass(req.db).find(filter)
        .select(req.user.role === "student" ? "-teacherFee -feePaid -meetingLink" : "") // staff-only: the teacher's pay; the link comes from /:id/join
        .populate("teacherId", "firstName lastName email")
        .sort({ scheduledTime: -1 }).skip(skip).limit(limit).lean(),
      getGroupClass(req.db).countDocuments(filter),
    ]);
    res.json({ success: true, classes, total, limit, skip });
  } catch (err) {
    logger.error("Error fetching group classes:", { error: err?.message });
    serverError(res, "Error fetching group classes", err);
  }
});

// ─── POST / — create ──────────────────────────────────────────────────────────
router.post("/", verifyToken, subAdminNeeds("canManageGroupClasses"), staffOrTeacher, async (req, res) => {
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
    if (!teacher || !inScope(req, teacher._id)) return notFound(res, "Teacher not found");

    const enrollmentMode = ["open", "invite-only"].includes(req.body.enrollmentMode)
      ? req.body.enrollmentMode : "open";

    // Students picked in the create window (invite-only classes). Only real students —
    // and for a sub-admin only their own teachers' students.
    let invitedStudents = [];
    if (enrollmentMode === "invite-only" && Array.isArray(req.body.invitedStudents)) {
      const wanted = [...new Set(req.body.invitedStudents.map(String))].filter(id => mongoose.isValidObjectId(id)).slice(0, 100);
      const allowed = await scopedStudentIds(req);
      const found = await getStudent(req.db).find({ _id: { $in: wanted } }).select("_id").lean();
      invitedStudents = found.map(s => String(s._id)).filter(id => !allowed || allowed.has(id));
    }

    const where = readPlatform(req, req.body, teacher);
    if (where.error) return badRequest(res, where.error);

    // New group classes are paid with group points (not class credits)
    const pointsPerSeat = req.body.pointsPerSeat === undefined ? 1 : wholeNumber(req.body.pointsPerSeat, 1, 1000);
    if (pointsPerSeat === null) return badRequest(res, "Points per student must be a whole number from 1 to 1000");
    // Teacher fee: the admin sets it; teacher- and sub-admin-created classes get the center default
    let teacherFee;
    if (req.user.role === "admin" && req.body.teacherFee !== undefined && req.body.teacherFee !== "") {
      teacherFee = moneyValue(req.body.teacherFee);
      if (teacherFee === null) return badRequest(res, "Teacher fee must be 0 or more");
    } else {
      teacherFee = (await getPricing(req.db).findOne().select("defaultGroupFee").lean())?.defaultGroupFee || 0;
    }

    const groupClass = await getGroupClass(req.db).create({
      teacherId,
      title,
      description:     description || "",
      level:           level || "Mixed",
      maxSeats:        maxSeats || 8,
      pricePerSeat:    pricePerSeat || 1,
      paymentType:     "points",
      pointsPerSeat,
      teacherFee,
      platform:        where.platform,
      meetingLink:     where.meetingLink,
      scheduledTime:   new Date(scheduledTime),
      teacherTimezone: teacher.timezone || "",
      duration:        duration || 60,
      enrollmentMode,
      invitedStudents,
      notes:           notes || "",
      tags:            Array.isArray(tags) ? tags : [],
      createdBy:       req.user.role === "teacher" ? "teacher" : "admin", // sub-admins act for the admin
    });

    // Tell the invited students (live, if they are online)
    if (invitedStudents.length) {
      try {
        const io = req.app.get("io");
        for (const sid of invitedStudents) io?.to(`student-room:${req.center.slug}:${sid}`).emit("group-class-update", {
          type: "invited", title: "📩 You've been invited to a group class",
          message: `You can now enroll in "${groupClass.title}"`, groupClassId: groupClass._id,
        });
      } catch (_) {}
    }

    res.status(201).json({ success: true, message: "Group class created", groupClass });
  } catch (err) {
    logger.error("Error creating group class:", { error: err?.message });
    serverError(res, "Error creating group class", err);
  }
});

// ─── GET /students/search — teacher searches students for inviting ─────────────
// Must be defined before /:id to avoid ObjectId match on "students"
router.get("/students/search", verifyToken, subAdminNeeds("canManageGroupClasses"), staffOrTeacher, async (req, res) => {
  try {
    // Escape + cap the search text: a raw RegExp from the query string lets a
    // caller send a catastrophic pattern like (a+)+$ and stall the server (ReDoS).
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (!q) return res.json({ success: true, students: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const allowed = await scopedStudentIds(req); // sub-admin: their teachers' students only
    const students = await getStudent(req.db)
      .find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }], ...(allowed ? { _id: { $in: [...allowed] } } : {}) })
      .select("firstName lastName email _id classCredits groupPoints")
      .limit(20).lean();
    res.json({ success: true, students });
  } catch (err) {
    logger.error("Error searching students:", { error: err?.message });
    serverError(res, "Error searching students", err);
  }
});

// ─── GET /:id/join — where to join: { platform, link } ───────────────────────
// Agora: no link (the app's own room). Meet / Zoom: the class link, else the
// teacher's saved one. Students: only when enrolled and the class has started.
router.get("/:id/join", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id).select("teacherId status enrollments platform meetingLink title").lean();
    if (!gc) return notFound(res, "Group class not found");
    const { role, id } = req.user;
    if (role === "student") {
      if (!gc.enrollments.some(e => String(e.studentId) === id)) return forbidden(res, "You are not enrolled in this class");
      if (gc.status !== "in-progress") return badRequest(res, "The teacher hasn't started this class yet");
    } else if (!canStaff(req, gc)) {
      return forbidden(res, "Not authorized to join this class");
    }
    // Who actually came — the auto-close after class time (utils/groupClassSweep.js) uses it
    const now = new Date();
    if (role === "student") {
      await getGroupClass(req.db).updateOne(
        { _id: gc._id, enrollments: { $elemMatch: { studentId: new mongoose.Types.ObjectId(id), joinedAt: { $exists: false } } } },
        { $set: { "enrollments.$.joinedAt": now } },
      );
    } else if (role === "teacher") {
      await getGroupClass(req.db).updateOne({ _id: gc._id, teacherJoinedAt: { $exists: false } }, { $set: { teacherJoinedAt: now } });
    }

    const platform = gc.platform || "agora";
    if (platform === "agora") return res.json({ success: true, platform });
    const teacher = await getTeacher(req.db).findById(gc.teacherId).select("googleMeetLink zoomLink").lean();
    const link = gc.meetingLink || teacherLinkFor(teacher, platform);
    if (!validLink(platform, link)) return badRequest(res, `This class has no ${PLATFORM_NAMES[platform]} link yet — ask the teacher`);
    res.json({ success: true, platform, link });
  } catch (err) {
    logger.error("Group class join error:", { error: err?.message });
    serverError(res, "Could not open the class", err);
  }
});

// ─── GET /:id — single ────────────────────────────────────────────────────────
router.get("/:id", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    getTeacher(req.db);
    getStudent(req.db);
    const gc = await getGroupClass(req.db).findById(req.params.id)
      .select(req.user.role === "student" ? "-teacherFee -feePaid -meetingLink" : "") // staff-only: the teacher's pay; the link comes from /:id/join
      .populate("teacherId", "firstName lastName email")
      .populate("enrollments.studentId", "firstName lastName email classCredits groupPoints");
    if (!gc) return notFound(res, "Group class not found");

    const { role, id } = req.user;
    if (
      role !== "admin" && !(role === "sub-admin" && inScope(req, gc.teacherId)) &&
      !(role === "teacher" && gc.teacherId._id.toString() === id) &&
      !(role === "student" && gc.enrollments.some(e => e.studentId?._id?.toString() === id)) &&
      gc.status !== "open"
    ) return forbidden(res, "Not authorized to view this class");

    res.json({ success: true, groupClass: gc });
  } catch (err) {
    logger.error("Error fetching group class:", { error: err?.message });
    serverError(res, "Error fetching group class", err);
  }
});

// ─── PATCH /:id — update metadata ────────────────────────────────────────────
router.patch("/:id", verifyToken, subAdminNeeds("canManageGroupClasses"), staffOrTeacher, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    if (!canStaff(req, gc))
      return forbidden(res, "You can only edit your own group classes");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, "Cannot edit a completed or cancelled class");

    const allowed = ["title", "description", "level", "maxSeats", "pricePerSeat",
                     "scheduledTime", "duration", "notes", "tags", "enrollmentMode"];
    if (req.body.pointsPerSeat !== undefined && usesPoints(gc)) {
      const p = wholeNumber(req.body.pointsPerSeat, 1, 1000);
      if (p === null) return badRequest(res, "Points per student must be a whole number from 1 to 1000");
      gc.pointsPerSeat = p; // students already enrolled keep what they paid
    }
    if (req.body.platform !== undefined || req.body.meetingLink !== undefined) {
      const teacher = await getTeacher(req.db).findById(gc.teacherId).select("googleMeetLink zoomLink").lean();
      const where = readPlatform(req, req.body, teacher, gc);
      if (where.error) return badRequest(res, where.error);
      gc.platform = where.platform;
      gc.meetingLink = where.meetingLink;
    }
    if (req.body.teacherFee !== undefined) {
      if (req.user.role !== "admin") return forbidden(res, "Only the admin can change the teacher fee");
      const fee = moneyValue(req.body.teacherFee);
      if (fee === null) return badRequest(res, "Teacher fee must be 0 or more");
      gc.teacherFee = fee;
    }
    allowed.forEach(field => {
      if (req.body[field] !== undefined) gc[field] = req.body[field];
    });
    if (req.body.scheduledTime) gc.scheduledTime = new Date(req.body.scheduledTime);

    await gc.save();
    res.json({ success: true, message: "Group class updated", groupClass: gc });
  } catch (err) {
    logger.error("Error updating group class:", { error: err?.message });
    serverError(res, "Error updating group class", err);
  }
});

// ─── DELETE /:id — admin only ─────────────────────────────────────────────────
router.delete("/:id", verifyToken, verifyAdmin, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");
    const unfinished = !["completed", "cancelled"].includes(gc.status);
    await gc.deleteOne();
    // Students in a class that never happened get their points / credits back
    if (unfinished) for (const e of gc.enrollments) await refundEnrollment(req.db, gc, e, { user: req.user, note: "Class deleted" });
    res.json({ success: true, message: "Group class deleted" });
  } catch (err) {
    logger.error("Error deleting group class:", { error: err?.message });
    serverError(res, "Error deleting group class", err);
  }
});

// Staff who may manage a group class's roster: admins, the class's own teacher,
// and sub-admins whose teacher scope includes that teacher.
const canManageRoster = (req, gc) => canStaff(req, gc);

// ─── POST /:id/enroll — add a student ────────────────────────────────────────
// Admin passes { studentId }; student self-enrolls (no body needed beyond auth)
router.post("/:id/enroll", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
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
    if (role !== "student" && !canManageRoster(req, gc))
      return forbidden(res, "You can only enroll students in your own classes");
    if (!student) return notFound(res, "Student not found");
    if (isSubAdmin(req) && !(await scopedStudentIds(req)).has(String(student._id)))
      return notFound(res, "Student not found");

    if (gc.status !== "open") return badRequest(res, `Class is ${gc.status} — enrollment is closed`);

    // Invite-only check: students must be on the invited list
    if (role === "student" && gc.enrollmentMode === "invite-only") {
      const isInvited = gc.invitedStudents.some(id => id.toString() === studentId.toString());
      if (!isInvited) return forbidden(res, "This class is invite-only. Contact your teacher to be added.");
    }

    const alreadyEnrolled = gc.enrollments.some(
      e => e.studentId.toString() === studentId.toString()
    );
    if (alreadyEnrolled) return conflict(res, "Student is already enrolled");
    if (gc.enrollments.length >= gc.maxSeats) return conflict(res, "Class is full");

    const Student = getStudent(req.db);
    const GroupClass = getGroupClass(req.db);
    const points = usesPoints(gc);
    const price = points ? (gc.pointsPerSeat || 1) : (gc.pricePerSeat || 1);

    // 1) Take the price atomically — only if the student still has enough right now
    //    (two enrollments at once can't both spend the same points / credit)
    let remaining;
    if (points) {
      remaining = await spendPoints(req.db, studentId, price, { groupClassId: gc._id, classTitle: gc.title, user: req.user });
      if (remaining === null)
        return badRequest(res, `Student needs ${price} group point(s) but only has ${student.groupPoints || 0}`);
    } else {
      const charged = await Student.findOneAndUpdate(
        { _id: studentId, classCredits: { $gte: price } },
        { $inc: { classCredits: -price } },
        { new: true },
      ).select("classCredits").lean();
      if (!charged)
        return badRequest(res, `Student needs ${price} credit(s) but only has ${student.classCredits || 0}`);
      remaining = charged.classCredits;
    }
    const enrollment = points ? { studentId, pointsCharged: price } : { studentId, creditCharged: price };

    // 2) Claim the seat atomically — still open, not already enrolled, a seat left
    const seated = await GroupClass.findOneAndUpdate(
      {
        _id: gc._id, status: "open",
        "enrollments.studentId": { $ne: studentId },
        $expr: { $lt: [{ $size: "$enrollments" }, "$maxSeats"] },
      },
      { $push: { enrollments: enrollment } },
      { new: true },
    );
    if (!seated) {
      // Lost the race (enrolled twice at once, last seat taken, class closed) — give it back
      await refundEnrollment(req.db, gc, enrollment, { user: req.user, note: "Seat not available" });
      const now = await GroupClass.findById(gc._id).select("status enrollments maxSeats").lean();
      if (now?.enrollments?.some(e => String(e.studentId) === String(studentId))) return conflict(res, "Student is already enrolled");
      if (now?.status !== "open") return badRequest(res, `Class is ${now?.status} — enrollment is closed`);
      return conflict(res, "Class is full");
    }
    if (seated.enrollments.length >= seated.maxSeats) {
      await GroupClass.updateOne({ _id: gc._id, status: "open" }, { $set: { status: "full" } });
    }
    gc.enrollments = seated.enrollments;

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
      ...(points ? { pointsRemaining: remaining } : { creditsRemaining: remaining }),
      seatsLeft: gc.maxSeats - gc.enrollments.length,
    });
  } catch (err) {
    logger.error("Error enrolling student:", { error: err?.message });
    serverError(res, "Error enrolling student", err);
  }
});

// ─── DELETE /:id/enroll/:studentId — remove enrollment + refund ───────────────
router.delete("/:id/enroll/:studentId", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), validateObjectId("studentId"), async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const { studentId } = req.params;

    // Student may only remove themselves; staff only from classes they manage
    if (role === "student" && userId !== studentId)
      return forbidden(res, "You can only remove your own enrollment");

    const GroupClass = getGroupClass(req.db);
    const gc = await GroupClass.findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");
    if (role !== "student" && !canManageRoster(req, gc))
      return forbidden(res, "You can only manage enrollments in your own classes");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, "Cannot remove enrollment from a completed or cancelled class");

    // Remove the enrollment atomically and read what was charged from the removed entry —
    // a double click (or a cancel at the same moment) can't refund twice
    const before = await GroupClass.findOneAndUpdate(
      { _id: gc._id, status: { $nin: ["completed", "cancelled"] }, "enrollments.studentId": studentId },
      { $pull: { enrollments: { studentId } } },
      { new: false },
    ).lean();
    if (!before) return notFound(res, "Student is not enrolled in this class");

    const removed = before.enrollments.find(e => String(e.studentId) === String(studentId));
    const creditCharged = removed?.creditCharged || 0;
    // A seat opened up
    await GroupClass.updateOne(
      { _id: gc._id, status: "full", $expr: { $lt: [{ $size: "$enrollments" }, "$maxSeats"] } },
      { $set: { status: "open" } },
    );

    // Refund what this enrollment paid — points or (older classes) credits
    await refundEnrollment(req.db, gc, removed, { user: req.user, note: "Left the class" });

    res.json({
      success: true,
      message: removed?.pointsCharged ? "Enrollment removed and points refunded" : "Enrollment removed and credits refunded",
      creditsRefunded: creditCharged,
      pointsRefunded: removed?.pointsCharged || 0,
    });
  } catch (err) {
    logger.error("Error removing enrollment:", { error: err?.message });
    serverError(res, "Error removing enrollment", err);
  }
});

// ─── PATCH /:id/attendance — teacher marks per-student attendance ─────────────
// Body: { attendance: [{ studentId, status: 'attended'|'absent' }] }
router.patch("/:id/attendance", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && !canStaff(req, gc)) return forbidden(res, "Not authorized to mark attendance");
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

    // Attendance marked after completing — the fee becomes due once someone attended
    let feePaid = 0;
    if (gc.status === "completed") {
      feePaid = await payGroupClassFee(req.db, gc._id)
        .catch(err => { logger.error("Group class fee error:", { error: err?.message }); return 0; });
    }

    res.json({ success: true, message: "Attendance updated", enrollments: gc.enrollments, feePaid });
  } catch (err) {
    logger.error("Error marking attendance:", { error: err?.message });
    serverError(res, "Error marking attendance", err);
  }
});

// ─── PATCH /:id/complete — teacher/admin marks class as done ─────────────────
router.patch("/:id/complete", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && !canStaff(req, gc)) return forbidden(res, "Not authorized to complete this class");
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

    // Only from a still-running state: a cancel at the same moment (which refunds
    // everyone) must not be overwritten to "completed"
    const completedAt = new Date();
    const done = await getGroupClass(req.db).updateOne(
      { _id: gc._id, status: { $in: ["open", "full", "in-progress"] } },
      { $set: { status: "completed", completedAt, enrollments: gc.enrollments } },
    );
    if (done.modifiedCount === 0) return conflict(res, "This class was just cancelled or completed — please refresh");
    Object.assign(gc, { status: "completed", completedAt });

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

    // Teacher fee → their earnings + salary record (once; needs at least one attended student)
    const feePaid = await payGroupClassFee(req.db, gc._id)
      .catch(err => { logger.error("Group class fee error:", { error: err?.message }); return 0; });

    res.json({ success: true, message: "Group class completed", groupClass: gc, feePaid });
  } catch (err) {
    logger.error("Error completing group class:", { error: err?.message });
    serverError(res, "Error completing group class", err);
  }
});

// ─── PATCH /:id/cancel — admin or teacher cancels + full refund ───────────────
router.patch("/:id/cancel", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && !canStaff(req, gc)) return forbidden(res, "Not authorized to cancel this class");
    if (["completed", "cancelled"].includes(gc.status))
      return badRequest(res, `Class is already ${gc.status}`);

    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";

    // Cancel FIRST, atomically, and refund exactly the enrollments it had at that
    // moment — a double click can't refund twice, and an unenroll racing this
    // (which refunds its own seat) is never refunded again here.
    const claimed = await getGroupClass(req.db).findOneAndUpdate(
      { _id: gc._id, status: { $nin: ["completed", "cancelled"] } },
      { $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason } },
      { new: false },
    ).lean();
    if (!claimed) return badRequest(res, "Class is already cancelled or completed");

    for (const e of claimed.enrollments) await refundEnrollment(req.db, claimed, e, { user: req.user, note: "Class cancelled" });
    gc.enrollments = claimed.enrollments;
    Object.assign(gc, { status: "cancelled", cancelReason: reason });

    // Notify students
    try {
      const io   = req.app.get("io");
      const slug = req.center?.slug;
      for (const enr of gc.enrollments) {
        io.to(`student-room:${slug}:${enr.studentId}`).emit("group-class-update", {
          type: "cancelled",
          title: "❌ Group Class Cancelled",
          message: `"${gc.title}" was cancelled. You have been refunded.`,
          groupClassId: gc._id,
        });
      }
    } catch (_) {}

    res.json({
      success: true,
      message: `Group class cancelled. ${gc.enrollments.filter(e => e.creditCharged > 0 || e.pointsCharged > 0).length} student(s) refunded.`,
    });
  } catch (err) {
    logger.error("Error cancelling group class:", { error: err?.message });
    serverError(res, "Error cancelling group class", err);
  }
});

// ─── PATCH /:id/start — begin class (changes status to in-progress) ───────────
router.patch("/:id/start", verifyToken, subAdminNeeds("canManageGroupClasses"), validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    const { role, id: userId } = req.user;
    const isTeacher = role === "teacher" && gc.teacherId.toString() === userId;
    if (!isTeacher && !canStaff(req, gc)) return forbidden(res, "Not authorized to start this class");
    if (!["open", "full"].includes(gc.status))
      return badRequest(res, `Cannot start a class with status: ${gc.status}`);

    gc.status = "in-progress";
    await gc.save();
    res.json({ success: true, message: "Group class started", groupClass: gc });
  } catch (err) {
    logger.error("Error starting group class:", { error: err?.message });
    serverError(res, "Error starting group class", err);
  }
});

// ─── PATCH /:id/invite — teacher adds/removes invited students ────────────────
router.patch("/:id/invite", verifyToken, subAdminNeeds("canManageGroupClasses"), staffOrTeacher, validateObjectId("id"), async (req, res) => {
  try {
    const gc = await getGroupClass(req.db).findById(req.params.id);
    if (!gc) return notFound(res, "Group class not found");

    if (!canStaff(req, gc))
      return forbidden(res, "You can only manage your own group classes");

    const { add, remove } = req.body;

    if (add) {
      const addId = add.toString();
      if (!gc.invitedStudents.some(id => id.toString() === addId)) {
        gc.invitedStudents.push(addId);
      }
    }

    if (remove) {
      const removeId = remove.toString();
      gc.invitedStudents = gc.invitedStudents.filter(id => id.toString() !== removeId);
    }

    await gc.save();

    // Notify added student via socket
    if (add) {
      try {
        const io   = req.app.get("io");
        const slug = req.center?.slug;
        io.to(`student-room:${slug}:${add}`).emit("group-class-update", {
          type: "invited",
          title: "📩 You've been invited to a group class",
          message: `You can now enroll in "${gc.title}"`,
          groupClassId: gc._id,
        });
      } catch (_) {}
    }

    res.json({ success: true, invitedStudents: gc.invitedStudents });
  } catch (err) {
    logger.error("Error updating invite list:", { error: err?.message });
    serverError(res, "Error updating invite list", err);
  }
});

export default router;
