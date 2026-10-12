// The 5-minute sweep settles classes the classroom never closed. A class that was
// actually attended must be completed (student charged, teacher paid) — it used to
// be marked "missed" regardless of attendance.
import { describe, it, expect, beforeAll } from 'vitest'
import { CREDENTIALS } from './setup.js'

const { sweepMissedClasses } = await import('../utils/missedClassScheduler.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { classroomSessionSchema } = await import('../schemas/classroomSessionSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

const MIN = 60 * 1000
let db, Booking, Session, Payment, Teacher, Student, teacher, student

async function endedClass({ session, studentId } = {}) {
  const start = new Date(Date.now() - 90 * MIN) // 60-min class, ended 30 min ago
  const booking = await Booking.create({
    teacherId: teacher._id, studentId: studentId || student._id, classTitle: 'Sweep test',
    scheduledTime: start, duration: 60, status: 'accepted',
  })
  if (session) await Session.create({ bookingId: booking._id, ...session })
  return booking
}

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Session = db.models.ClassroomSession || db.model('ClassroomSession', classroomSessionSchema)
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Teacher = db.models.Teacher
  Student = db.models.Student
  teacher = await Teacher.findOneAndUpdate({ email: CREDENTIALS.teacher.email }, { ratePerClass: 10 }, { new: true })
  student = await Student.findOne({ email: CREDENTIALS.student.email })
})

const joined = (bothActiveTime) => ({
  teacherJoinedAt: new Date(Date.now() - 89 * MIN),
  studentJoinedAt: new Date(Date.now() - 89 * MIN),
  bothActiveTime, requiredTime: Math.floor(60 * 60 * 0.83),
})

describe('missed-class sweep', () => {
  it('completes and pays a fully attended class the classroom never closed', async () => {
    await Student.updateOne({ _id: student._id }, { classCredits: 5, active: true })
    const booking = await endedClass({ session: joined(55 * 60) })

    await sweepMissedClasses(db)

    const after = await Booking.findById(booking._id).lean()
    expect(after.status).toBe('completed')
    expect((await Student.findById(student._id)).classCredits).toBe(4)
    const pay = await Payment.find({ bookingId: booking._id }).lean()
    expect(pay).toHaveLength(1)
    expect(pay[0].amount).toBe(10)
  })

  it('still marks a class missed when attendance was too short', async () => {
    const booking = await endedClass({ session: joined(20 * 60) })
    await sweepMissedClasses(db)
    const after = await Booking.findById(booking._id).lean()
    expect(after.status).toBe('missed')
    expect(after.missedReason).toMatch(/Insufficient attendance/)
    expect(await Payment.countDocuments({ bookingId: booking._id })).toBe(0)
  })

  it('still marks a class missed when nobody joined', async () => {
    const booking = await endedClass()
    await sweepMissedClasses(db)
    const after = await Booking.findById(booking._id).lean()
    expect(after.status).toBe('missed')
    expect(after.missedReason).toMatch(/Neither teacher nor student joined/)
  })

  it('pays only once when two sweeps run together', async () => {
    const booking = await endedClass({ session: joined(55 * 60) })
    await Promise.all([sweepMissedClasses(db), sweepMissedClasses(db)])
    expect((await Booking.findById(booking._id).lean()).status).toBe('completed')
    expect(await Payment.countDocuments({ bookingId: booking._id })).toBe(1)
  })

  it('asks the parent to confirm when the student is managed', async () => {
    const managed = await Student.create({
      email: 'managed-sweep@test.com', firstName: 'Kid', lastName: 'Managed', password: 'x',
      active: true, status: 'active', isManaged: true, classCredits: 3,
    })
    const booking = await endedClass({ session: joined(55 * 60), studentId: managed._id })
    await sweepMissedClasses(db)
    const after = await Booking.findById(booking._id).select('+shareLink.tokenHash').lean()
    expect(after.status).toBe('completed')
    expect(after.parentCheck?.status).toBe('waiting')
    expect(after.shareLink?.tokenHash).toBeTruthy()
  })
})
