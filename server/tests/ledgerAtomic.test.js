// Credits and teacher earnings must survive several classes settling at the same
// moment (e.g. a teacher's group of bookings auto-completing together). They used
// to be read → changed → saved, so concurrent updates overwrote each other.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { CREDENTIALS } from './setup.js'

const { completeClass } = await import('../services/classCompletionService.js')
const { payForCompletedClass } = await import('../utils/classPayment.js')
const { reverseCompletedClass } = await import('../utils/classReversal.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { classroomSessionSchema } = await import('../schemas/classroomSessionSchema.js')

let db, Booking, Session, Student, Teacher, student, teacher

const N = 6

async function attendedBooking(status = 'accepted') {
  const b = await Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Concurrent', duration: 60,
    scheduledTime: new Date(Date.now() - 2 * 3600000), status,
  })
  await Session.create({
    bookingId: b._id, teacherJoinedAt: new Date(), studentJoinedAt: new Date(),
    bothActiveTime: 3600, requiredTime: 2988,
  })
  return b
}

const state = async () => ({
  credits: (await Student.findById(student._id)).classCredits,
  active: (await Student.findById(student._id)).active,
  earned: (await Teacher.findById(teacher._id)).earned,
  lessons: (await Teacher.findById(teacher._id)).lessonsCompleted,
})

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Session = db.models.ClassroomSession || db.model('ClassroomSession', classroomSessionSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
})

beforeEach(async () => {
  await Student.updateOne({ _id: student._id }, { classCredits: 20, active: true })
  await Teacher.updateOne({ _id: teacher._id }, { ratePerClass: 10, earned: 0, lessonsCompleted: 0 })
})

describe('atomic credits + earnings', () => {
  it(`completeClass: ${N} classes at once → every charge and payment counted`, async () => {
    const bookings = await Promise.all(Array.from({ length: N }, () => attendedBooking()))
    await Promise.all(bookings.map(b => completeClass(db, b._id, 'system')))
    expect(await state()).toMatchObject({ credits: 20 - N, earned: 10 * N, lessons: N })
  })

  it(`payForCompletedClass: ${N} at once → every charge and payment counted`, async () => {
    const bookings = await Promise.all(Array.from({ length: N }, () => attendedBooking('completed')))
    await Promise.all(bookings.map(b => payForCompletedClass(db, b, { description: 't' })))
    expect(await state()).toMatchObject({ credits: 20 - N, earned: 10 * N, lessons: N })
  })

  it(`reverseCompletedClass: ${N} at once → every refund and deduction counted`, async () => {
    const bookings = await Promise.all(Array.from({ length: N }, () => attendedBooking('completed')))
    for (const b of bookings) await payForCompletedClass(db, b, { description: 't' })
    await Promise.all(bookings.map(b => reverseCompletedClass(db, b, { reason: 't' })))
    expect(await state()).toMatchObject({ credits: 20, earned: 0, lessons: 0 })
  })

  it('credits never go below 0, and the student is deactivated at 0', async () => {
    await Student.updateOne({ _id: student._id }, { classCredits: 2 })
    const bookings = await Promise.all(Array.from({ length: 4 }, () => attendedBooking()))
    await Promise.all(bookings.map(b => completeClass(db, b._id, 'system')))
    const s = await state()
    expect(s.credits).toBe(0)
    expect(s.active).toBe(false)
  })

  it('earnings stay rounded to 2dp (no 0.30000000000000004)', async () => {
    await Teacher.updateOne({ _id: teacher._id }, { ratePerClass: 0.1 })
    const bookings = await Promise.all(Array.from({ length: 3 }, () => attendedBooking()))
    for (const b of bookings) await completeClass(db, b._id, 'system')
    expect((await state()).earned).toBe(0.3)
  })

  it('earnings never go below 0 on reversal', async () => {
    const b = await attendedBooking('completed')
    await payForCompletedClass(db, b, { description: 't' })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 4 }) // e.g. already paid out
    await reverseCompletedClass(db, b, { reason: 't' })
    expect((await state()).earned).toBe(0)
  })
})
