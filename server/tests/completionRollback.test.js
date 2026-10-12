// completeClass() must be all-or-nothing: if a write fails partway, the money
// already moved is undone and the booking goes back to its original status —
// never "completed" with the student uncharged or the teacher unpaid.
import { vi, describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

const { completeClass } = await import('../services/classCompletionService.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { classroomSessionSchema } = await import('../schemas/classroomSessionSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

let db, Booking, Session, Payment, Student, Teacher, student, teacher

const makeBooking = (overrides = {}) => Booking.create({
  teacherId: teacher._id, studentId: student._id, classTitle: 'Rollback', duration: 60,
  scheduledTime: new Date(Date.now() - 2 * 3600000), status: 'accepted', ...overrides,
})

const snapshot = async () => {
  const s = await Student.findById(student._id).lean()
  const t = await Teacher.findById(teacher._id).lean()
  return { credits: s.classCredits, active: s.active, earned: t.earned, lessons: t.lessonsCompleted }
}
const untouched = { credits: 1, active: true, earned: 0, lessons: 0 }

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Session = db.models.ClassroomSession || db.model('ClassroomSession', classroomSessionSchema)
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
})

beforeEach(async () => {
  // 1 credit → charging it also deactivates the student; the undo must reactivate
  await Student.updateOne({ _id: student._id }, { classCredits: 1, active: true })
  await Teacher.updateOne({ _id: teacher._id }, { ratePerClass: 10, earned: 0, lessonsCompleted: 0 })
})
afterEach(() => vi.restoreAllMocks())

describe('completeClass rollback', () => {
  it('payment record fails → credit + pay undone, booking back to "accepted"', async () => {
    const b = await makeBooking()
    vi.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('db down'))

    await expect(completeClass(db, b._id, 'admin', { skipAttendanceCheck: true })).rejects.toThrow('db down')

    expect((await Booking.findById(b._id)).status).toBe('accepted')
    expect(await snapshot()).toEqual(untouched)
    expect(await Payment.countDocuments({ bookingId: b._id, status: 'pending' })).toBe(0)
  })

  it('final booking write fails → everything undone, booking back to its original status', async () => {
    const b = await makeBooking({ status: 'missed' })
    vi.spyOn(Booking, 'updateOne').mockRejectedValueOnce(new Error('write conflict'))

    await expect(completeClass(db, b._id, 'admin', { skipAttendanceCheck: true })).rejects.toThrow('write conflict')

    expect((await Booking.findById(b._id)).status).toBe('missed')
    expect(await snapshot()).toEqual(untouched)
    expect(await Payment.countDocuments({ bookingId: b._id, status: 'pending' })).toBe(0)
  })

  it('a retry after a failure completes normally (charged + paid once)', async () => {
    const b = await makeBooking()
    vi.spyOn(Payment, 'create').mockRejectedValueOnce(new Error('db down'))
    await expect(completeClass(db, b._id, 'admin', { skipAttendanceCheck: true })).rejects.toThrow()
    vi.restoreAllMocks()

    const r = await completeClass(db, b._id, 'admin', { skipAttendanceCheck: true })
    expect(r.completed).toBe(true)
    expect(await snapshot()).toEqual({ credits: 0, active: false, earned: 10, lessons: 1 })
    expect(await Payment.countDocuments({ bookingId: b._id, status: 'pending' })).toBe(1)
  })

  it('deleted teacher → nothing charged and the booking is not stuck in "processing"', async () => {
    const b = await makeBooking({ teacherId: new mongoose.Types.ObjectId() })
    await expect(completeClass(db, b._id, 'admin', { skipAttendanceCheck: true })).rejects.toThrow(/teacher/)
    expect((await Booking.findById(b._id)).status).toBe('accepted')
    expect(await snapshot()).toEqual(untouched)
  })

  it('missed path: a failing session update does not leave the booking stuck', async () => {
    const b = await makeBooking()
    await Session.create({ bookingId: b._id, teacherJoinedAt: new Date(), requiredTime: 2988 }) // student never joined
    vi.spyOn(Session, 'updateOne').mockRejectedValueOnce(new Error('session write failed'))

    const r = await completeClass(db, b._id, 'system')
    expect(r.missed).toBe(true)
    expect((await Booking.findById(b._id)).status).toBe('missed')
  })
})
