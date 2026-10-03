// Regression tests for POST /api/classroom/auto-complete — the endpoint that
// charges the student a credit and pays the teacher. A caller must not be able
// to get a class paid with forged client time, skip admin approval, or get
// paid twice by racing two requests.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: classroomRouter } = await import('../routes/classroomRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { classroomSessionSchema } = await import('../schemas/classroomSessionSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

const app = express()
app.use(express.json())
app.use('/api/classroom', classroomRouter)

const MIN = 60 * 1000
let db, Booking, Session, Payment, Teacher, Student, teacher, student

const tokenFor = (role, user) => jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(user._id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'),
  { expiresIn: '5m' },
)

const autoComplete = (role, user, body) => request(app)
  .post('/api/classroom/auto-complete')
  .set('Authorization', `Bearer ${tokenFor(role, user)}`)
  .send(body)

async function makeBooking(overrides = {}) {
  return Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Test class',
    scheduledTime: new Date(Date.now() - 60 * MIN), duration: 60, status: 'accepted',
    ...overrides,
  })
}

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Session = db.models.ClassroomSession || db.model('ClassroomSession', classroomSessionSchema)
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Teacher = db.models.Teacher
  Student = db.models.Student
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  await Teacher.updateOne({ _id: teacher._id }, { $set: { ratePerClass: 10, earned: 0 } })
})

beforeEach(async () => {
  await Student.updateOne({ _id: student._id }, { $set: { classCredits: 10, active: true } })
  await Payment.deleteMany({})
})

describe('POST /api/classroom/auto-complete', () => {
  it('does not pay when the teacher forges time and the student never joined', async () => {
    const b = await makeBooking()
    await Session.create({ bookingId: b._id, requiredTime: 2988, teacherJoinedAt: new Date(Date.now() - 55 * MIN) })

    const res = await autoComplete('teacher', teacher, { bookingId: String(b._id), clientBothActiveTime: 99999 })

    expect(res.body.completed).toBe(false)
    expect((await Booking.findById(b._id)).status).toBe('missed')
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(0)
  })

  it('caps forged time at the real overlap (student left after 2 minutes)', async () => {
    const b = await makeBooking()
    const start = new Date(Date.now() - 55 * MIN)
    await Session.create({
      bookingId: b._id, requiredTime: 2988, classStartedAt: start,
      teacherJoinedAt: start, studentJoinedAt: start, studentLeftAt: new Date(start.getTime() + 2 * MIN),
    })

    const res = await autoComplete('teacher', teacher, { bookingId: String(b._id), clientBothActiveTime: 99999 })

    expect(res.body.completed).toBe(false)
    expect(res.body.bothActiveTime).toBeLessThanOrEqual(120)
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(0)
  })

  it('refuses teacher-logged classes waiting for admin approval', async () => {
    const b = await makeBooking({ status: 'pending_confirmation', loggedByTeacher: true })

    const res = await autoComplete('teacher', teacher, { bookingId: String(b._id), clientBothActiveTime: 99999 })

    expect(res.status).toBe(400)
    expect((await Booking.findById(b._id)).status).toBe('pending_confirmation')
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(0)
  })

  it('completes and pays once for a real class, even when both sides call at the same time', async () => {
    const b = await makeBooking()
    const start = new Date(Date.now() - 55 * MIN)
    await Session.create({
      bookingId: b._id, requiredTime: 2988, classStartedAt: start,
      teacherJoinedAt: start, studentJoinedAt: start, bothActiveTime: 3000,
    })

    const [r1, r2] = await Promise.all([
      autoComplete('teacher', teacher, { bookingId: String(b._id), clientBothActiveTime: 3000 }),
      autoComplete('student', student, { bookingId: String(b._id), clientBothActiveTime: 3000 }),
    ])

    expect(r1.body.completed || r2.body.completed).toBe(true)
    expect((await Booking.findById(b._id)).status).toBe('completed')
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(1)
    expect((await Student.findById(student._id)).classCredits).toBe(9)
  })

  it('can still complete a class first marked missed (re-check after a time extension)', async () => {
    const b = await makeBooking({ status: 'missed' })
    const start = new Date(Date.now() - 55 * MIN)
    await Session.create({
      bookingId: b._id, requiredTime: 2988, classStartedAt: start,
      teacherJoinedAt: start, studentJoinedAt: start, bothActiveTime: 3000,
    })

    const res = await autoComplete('student', student, { bookingId: String(b._id), clientBothActiveTime: 3000 })

    expect(res.body.completed).toBe(true)
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(1)
  })
})
