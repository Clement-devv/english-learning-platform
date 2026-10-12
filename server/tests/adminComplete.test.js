// Admin "mark completed" buttons — PATCH /api/bookings/:id/complete and
// PATCH /api/classroom/admin-complete/:id — charge a credit and pay the teacher.
// A double click must pay once; trial classes are free.
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
vi.mock('../utils/emailService.js', () => {
  const ok = () => Promise.resolve({ success: true })
  return {
    sendEmail: ok, getCenterBaseUrl: () => ({ baseUrl: 'http://localhost' }),
    sendBookingRequestToTeacher: ok, sendBookingAcceptedToStudent: ok, sendBookingRejectedToStudent: ok,
    sendBookingCreatedToStudent: ok, sendClassCompletedNotification: ok,
  }
})
vi.mock('../utils/webPushService.js', () => ({ pushToUser: vi.fn(), pushToAllAdmins: vi.fn() }))

const { default: bookingRouter } = await import('../routes/bookingRoutes.js')
const { default: classroomRouter } = await import('../routes/classroomRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

const app = express()
app.use(express.json())
app.set('io', { to: () => ({ emit: () => {} }) })
app.use('/api/bookings', bookingRouter)
app.use('/api/classroom', classroomRouter)

const START_CREDITS = 5
const RATE = 10
let db, Booking, Payment, Student, Teacher, student, teacher, adminToken

const auth = (r) => r.set('Authorization', `Bearer ${adminToken}`)
const completeBooking = (id) => auth(request(app).patch(`/api/bookings/${id}/complete`)).send({})
const adminComplete = (id) => auth(request(app).patch(`/api/classroom/admin-complete/${id}`)).send({ adminNotes: 'ok' })

const credits = async () => (await Student.findById(student._id)).classCredits
const earned = async () => (await Teacher.findById(teacher._id)).earned

const makeBooking = (overrides = {}) => Booking.create({
  teacherId: teacher._id, studentId: student._id, classTitle: 'Admin complete', duration: 60,
  scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'accepted', ...overrides,
})

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

describe('PATCH /bookings/:id/complete', () => {
  it('completes, charges once, pays once', async () => {
    const b = await makeBooking()
    const res = await completeBooking(b._id)
    expect(res.status).toBe(200)
    const after = await Booking.findById(b._id)
    expect(after.status).toBe('completed')
    expect(after.markedBy).toBe('admin')
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    const pay = await Payment.findOne({ bookingId: b._id })
    expect(pay.amount).toBe(RATE)
    expect(pay.type).toBe('class_completion')
  })

  it('double click → paid once', async () => {
    const b = await makeBooking()
    const results = await Promise.all([completeBooking(b._id), completeBooking(b._id), completeBooking(b._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(1)
  })

  it('trial class → no charge, no pay', async () => {
    const b = await makeBooking({ isTrial: true })
    expect((await completeBooking(b._id)).status).toBe(200)
    expect(await credits()).toBe(START_CREDITS)
    expect(await earned()).toBe(0)
  })

  it('refuses a class that is not accepted', async () => {
    const b = await makeBooking({ status: 'missed' })
    expect((await completeBooking(b._id)).status).toBe(400)
    expect(await credits()).toBe(START_CREDITS)
  })
})

describe('PATCH /classroom/admin-complete/:id', () => {
  it('completes a missed class, records the outcome change, pays once', async () => {
    const b = await makeBooking({ status: 'missed' })
    const res = await adminComplete(b._id)
    expect(res.status).toBe(200)
    expect(res.body.teacherEarned).toBe(RATE)
    expect(res.body.studentClassesRemaining).toBe(START_CREDITS - 1)
    const after = await Booking.findById(b._id)
    expect(after.status).toBe('completed')
    expect(after.outcomeChanges.at(-1).to).toBe('completed')
    expect(await earned()).toBe(RATE)
  })

  it('double click → paid once', async () => {
    const b = await makeBooking({ status: 'missed' })
    const results = await Promise.all([adminComplete(b._id), adminComplete(b._id), adminComplete(b._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await Payment.countDocuments({ bookingId: b._id })).toBe(1)
  })
})
