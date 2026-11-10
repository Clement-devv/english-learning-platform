import { bookingSchema } from '../schemas/bookingSchema.js';
import { groupClassSchema } from '../schemas/groupClassSchema.js';
import { studentSchema } from '../schemas/studentSchema.js';
import { teacherSchema } from '../schemas/teacherSchema.js';
import { classroomSessionSchema } from '../schemas/classroomSessionSchema.js';

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
  const set = { status: 'completed', completedAt: now };
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
    await Class.updateOne({ _id: lesson._id, status: 'completed', completedAt: now }, { $set: { status: lesson.status, ...(group ? { enrollments: lesson.enrollments } : {}) }, $unset: { completedAt: '' } });
    throw error;
  }
  await model(db, 'Teacher', teacherSchema).updateOne({ _id: teacherId }, { $inc: { lessonsCompleted: 1 } });
  if (!group) await model(db, 'ClassroomSession', classroomSessionSchema).updateOne({ bookingId: lesson._id }, { $set: { status: 'completed', classEndedAt: now } });
  return claimed;
}
