// POST /api/admin/lessons/unmark reverses a completed class: credit back to the
// student, pay taken from the teacher. A double click / two admins must not
// reverse it twice.
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
vi.mock('../utils/emailService.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))

const { default: lessonRouter } = await import('../routes/adminLessonRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')
const { payForCompletedClass } = await import('../utils/classPayment.js')

const app = express()
app.use(express.json())
app.use('/api/admin/lessons', lessonRouter)

const START_CREDITS = 5
const RATE = 10
let db, Booking, Payment, Student, Teacher, student, teacher, adminToken

const unmark = (bookingId) => request(app)
  .post('/api/admin/lessons/unmark')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({ bookingId: String(bookingId), reason: 'test' })

async function paidCompletedClass() {
  const booking = await Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Unmark me', duration: 60,
    scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'completed',
  })
  await payForCompletedClass(db, booking, { description: 'test' })
  return booking
}

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = jwt.sign(
    { ...JWT_STANDARD_CLAIMS, id: String(admin._id), role: 'admin', centerId: 'testcenter' },
    getCenterSecret('testcenter'), { expiresIn: '5m' },
  )
})

beforeEach(async () => {
  await Student.updateOne({ _id: student._id }, { classCredits: START_CREDITS, active: true })
  await Teacher.updateOne({ _id: teacher._id }, { ratePerClass: RATE, earned: 0, lessonsCompleted: 0 })
})

describe('admin unmark lesson', () => {
  it('reverses a completed class once', async () => {
    const b = await paidCompletedClass()
    expect((await Student.findById(student._id)).classCredits).toBe(START_CREDITS - 1)

    const res = await unmark(b._id)
    expect(res.status).toBe(200)
    expect((await Booking.findById(b._id)).adminRejected).toBe(true)
    expect((await Student.findById(student._id)).classCredits).toBe(START_CREDITS)
    expect((await Teacher.findById(teacher._id)).earned).toBe(0)
    expect((await Payment.findOne({ bookingId: b._id })).status).toBe('cancelled')
  })

  it('two clicks at once → reversed only once', async () => {
    const b = await paidCompletedClass()
    await Teacher.updateOne({ _id: teacher._id }, { earned: 50 }) // other classes' pay must survive
    const results = await Promise.all([unmark(b._id), unmark(b._id), unmark(b._id)])

    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect((await Student.findById(student._id)).classCredits).toBe(START_CREDITS)
    expect((await Teacher.findById(teacher._id)).earned).toBe(50 - RATE)
  })

  it('a second unmark later is refused', async () => {
    const b = await paidCompletedClass()
    expect((await unmark(b._id)).status).toBe(200)
    expect((await unmark(b._id)).status).toBe(400)
    expect((await Student.findById(student._id)).classCredits).toBe(START_CREDITS)
  })
})
