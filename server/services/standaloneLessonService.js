import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { classroomSessionSchema } from '../schemas/classroomSessionSchema.js';
import { teacherModeModels } from '../schemas/teacherModeSchemas.js';

const model = (db, name, schema) => db.models[name] || db.model(name, schema);
const invalid = message => Object.assign(new Error(message), { statusCode: 400 });

// Every standalone completion entry point uses the same atomic claim. A retry
// cannot charge twice, and the booked rate/credit policy survives later edits.
export async function completeStandaloneLesson(db, lesson, teacherId, attendance) {
  if (String(lesson.teacherId?._id || lesson.teacherId) !== String(teacherId) || !lesson.standalonePay?.currency)
    throw invalid('This is not your standalone lesson.');
  const group = !!lesson.enrollments;
  const Class = model(db, group ? 'GroupClass' : 'Booking', group ? groupClassSchema : bookingSchema);
  const allowed = group ? ['open', 'full', 'in-progress', 'missed'] : ['accepted', 'missed'];
  if (lesson.status === 'completed') return lesson;
  if (!allowed.includes(lesson.status)) throw invalid('This lesson cannot be completed.');
  const now = new Date();
  const set = { status: 'completed', completedAt: now, standaloneCompletion: { state: 'applying', chargedStudentIds: [] }, missedReason: '' };
  if (group) {
    const choices = new Map((Array.isArray(attendance) ? attendance : []).map(e => [String(e.studentId), e.status]));
    set.enrollments = lesson.enrollments.map(e => ({ ...e.toObject(), attendance: (choices.get(String(e.studentId)) || e.attendance) === 'absent' ? 'absent' : 'attended' }));
  } else Object.assign(set, { markedBy: 'teacher', attendanceConfirmedBy: 'teacher' });
  const claimed = await Class.findOneAndUpdate({ _id: lesson._id, teacherId, status: lesson.status }, { $set: set }, { new: true });
  if (!claimed) return Class.findById(lesson._id);
  const Student = model(db, 'Student', studentSchema), charged = [];
  try {
    const ids = group ? claimed.enrollments.filter(e => e.attendance === 'attended').map(e => e.studentId) : [claimed.studentId];
    for (const id of ids) {
      const strict = claimed.standalonePay.credits === true;
      const updated = await Student.findOneAndUpdate({ _id: id, standaloneManaged: true, classCredits: { $gt: 0 }, ...(strict ? {} : { standaloneClassTracking: true }) }, { $inc: { classCredits: -1 } });
      if (!updated && strict) throw invalid('An attending student needs a prepaid credit. Top up first.');
      if (updated) charged.push(id);
    }
  } catch (error) {
    for (const id of charged) await Student.updateOne({ _id: id }, { $inc: { classCredits: 1 } });
    await Class.updateOne({ _id: lesson._id, status: 'completed', completedAt: now }, { $set: { status: lesson.status, missedReason: lesson.missedReason || '', ...(group ? { enrollments: lesson.enrollments } : {}) }, $unset: { completedAt: '', standaloneCompletion: '' } });
    throw error;
  }
  await model(db, 'Teacher', teacherSchema).updateOne({ _id: teacherId }, { $inc: { lessonsCompleted: 1 } });
  if (!group) await model(db, 'ClassroomSession', classroomSessionSchema).updateOne({ bookingId: lesson._id }, { $set: { status: 'completed', classEndedAt: now } });
  await Class.updateOne({ _id: lesson._id, 'standaloneCompletion.state': 'applying' }, { $set: { standaloneCompletion: { state: 'applied', chargedStudentIds: charged } } });
  return claimed;
}

export async function uncompleteStandaloneLesson(db, lesson, teacherId, reason) {
  if (String(lesson.teacherId?._id || lesson.teacherId) !== String(teacherId) || !lesson.standalonePay?.currency) throw invalid('This is not your standalone lesson.');
  if (lesson.status === 'missed') return lesson;
  if (lesson.status !== 'completed') throw invalid('Only a completed class can be unmarked.');
  if (!lesson.standaloneCompletion?.state) throw invalid('This older class has no credit deduction audit. Its credits must be reviewed before completion can be reversed.');
  if (lesson.standaloneCompletion.state !== 'applied') throw invalid('This class is still being updated. Please retry.');
  const group = !!lesson.enrollments, Class = model(db, group ? 'GroupClass' : 'Booking', group ? groupClassSchema : bookingSchema);
  const claim = await Class.findOneAndUpdate({ _id: lesson._id, teacherId, status: 'completed', 'standaloneCompletion.state': 'applied' }, { $set: { 'standaloneCompletion.state': 'reversing' } }, { new: true });
  if (!claim) throw invalid('This class is being updated. Please retry.');
  const Student = model(db, 'Student', studentSchema), refunded = [];
  try {
    for (const id of claim.standaloneCompletion.chargedStudentIds) {
      const r = await Student.updateOne({ _id: id }, { $inc: { classCredits: 1 } });
      if (!r.matchedCount) throw invalid('A charged student could not be found. Please review this class.');
      refunded.push(id);
    }
  } catch (error) {
    for (const id of refunded) await Student.updateOne({ _id: id }, { $inc: { classCredits: -1 } });
    await Class.updateOne({ _id: lesson._id, 'standaloneCompletion.state': 'reversing' }, { $set: { 'standaloneCompletion.state': 'applied' } });
    throw error;
  }
  await teacherModeModels(db).TeacherWork.updateMany({ bookingId: lesson._id }, { $set: { published: false, summary: '', attended: 'unanswered', parentComment: '' } });
  await Class.updateOne({ _id: lesson._id, 'standaloneCompletion.state': 'reversing' }, { $set: { status: 'missed', missedReason: reason || 'Teacher unmarked this class as taught.', 'standaloneCompletion.state': 'reversed', ...(group ? { 'enrollments.$[].attendance': 'pending' } : {}) }, $unset: { completedAt: '', classSummary: '' } });
  await model(db, 'Teacher', teacherSchema).updateOne({ _id: teacherId, lessonsCompleted: { $gt: 0 } }, { $inc: { lessonsCompleted: -1 } });
  if (!group) await model(db, 'ClassroomSession', classroomSessionSchema).updateOne({ bookingId: lesson._id }, { $set: { status: 'missed' } });
  return Class.findById(lesson._id);
}

// Only unattended bookings are auto-closed; joined/active classrooms keep their
// normal classroom completion flow. The conditional update cannot overwrite a completion.
export async function sweepUnattendedStandaloneLessons(db, now = new Date()) {
  const due = { 'standalonePay.currency': { $exists: true }, $expr: { $lte: [{ $add: ['$scheduledTime', { $multiply: [{ $ifNull: ['$duration', 60] }, 60000] }] }, now] } };
  const Booking = model(db, 'Booking', bookingSchema), Group = model(db, 'GroupClass', groupClassSchema), Session = model(db, 'ClassroomSession', classroomSessionSchema);
  const books = await Booking.aggregate([
    { $match: { ...due, status: 'accepted' } },
    { $lookup: { from: Session.collection.name, localField: '_id', foreignField: 'bookingId', as: 'joined', pipeline: [{ $match: { $or: [{ teacherJoinedAt: { $ne: null } }, { studentJoinedAt: { $ne: null } }] } }, { $project: { _id: 1 } }] } },
    { $match: { 'joined.0': { $exists: false } } }, { $limit: 1000 }, { $project: { _id: 1 } },
  ]);
  const changed = books.length ? (await Booking.updateMany({ ...due, _id: { $in: books.map(b => b._id) }, status: 'accepted' }, { $set: { status: 'missed', markedBy: 'system', missedReason: 'No one joined before the scheduled class ended.' } })).modifiedCount : 0;
  const groups = await Group.updateMany({ ...due, status: { $in: ['open', 'full'] }, teacherJoinedAt: null, 'enrollments.joinedAt': { $exists: false } }, { $set: { status: 'missed', missedReason: 'No one joined before the scheduled class ended.' } });
  return changed + groups.modifiedCount;
}
