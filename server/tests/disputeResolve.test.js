// PATCH /api/disputes/:bookingId/resolve moves credits and teacher pay. Each starting
// state must end up charged/paid exactly once (or not at all), and a dispute can only
// be settled once even if two admins click at the same time.
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

const { default: disputeRouter } = await import('../routes/disputeRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')
const { payForCompletedClass } = await import('../utils/classPayment.js')
const { reverseCompletedClass } = await import('../utils/classReversal.js')

const app = express()
app.use(express.json())
app.use('/api/disputes', disputeRouter)

const START_CREDITS = 5
const RATE = 10
let db, Booking, Payment, Student, Teacher, student, teacher, adminToken

const resolve = (bookingId, resolution) => request(app)
  .patch(`/api/disputes/${bookingId}/resolve`)
  .set('Authorization', `Bearer ${adminToken}`)
  .send({ resolution })

const credits = async () => (await Student.findById(student._id)).classCredits
const earned = async () => (await Teacher.findById(teacher._id)).earned
const livePayments = (bookingId) => Payment.countDocuments({ bookingId, status: { $ne: 'cancelled' } })

const dispute = { disputeRaised: true, disputeStatus: 'pending', disputeReason: 'test' }

async function missedClass() {
  return Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Disputed', duration: 60,
    scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'missed', ...dispute,
  })
}

/** Completed (charged + paid) — then optionally admin-rejected (refunded + pay taken back). */
async function completedClass({ rejected = false } = {}) {
  const booking = await Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Disputed', duration: 60,
    scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'completed',
  })
  await payForCompletedClass(db, booking, { description: 'test' })
  if (rejected) await reverseCompletedClass(db, booking, { reason: 'test reject' })
  await Booking.updateOne({ _id: booking._id }, { $set: dispute })
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

describe('dispute resolution', () => {
  it('teacher wins on a missed class → student charged once, teacher paid once', async () => {
    const b = await missedClass()
    const res = await resolve(b._id, 'approve_teacher')
    expect(res.status).toBe(200)
    expect((await Booking.findById(b._id)).status).toBe('completed')
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await livePayments(b._id)).toBe(1)
  })

  it('student wins on a missed class → nothing charged or refunded', async () => {
    const b = await missedClass()
    expect((await resolve(b._id, 'approve_student')).status).toBe(200)
    expect(await credits()).toBe(START_CREDITS)
    expect(await earned()).toBe(0)
  })

  it('student wins on an admin-rejected class → credit NOT refunded a second time', async () => {
    const b = await completedClass({ rejected: true })
    expect(await credits()).toBe(START_CREDITS) // the rejection already refunded it
    expect((await resolve(b._id, 'approve_student')).status).toBe(200)
    expect(await credits()).toBe(START_CREDITS)
    expect(await earned()).toBe(0)
  })

  it('teacher wins on an admin-rejected class → teacher paid again, student charged again', async () => {
    const b = await completedClass({ rejected: true })
    expect((await resolve(b._id, 'approve_teacher')).status).toBe(200)
    const after = await Booking.findById(b._id)
    expect(after.status).toBe('completed')
    expect(after.adminRejected).toBe(false)
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await livePayments(b._id)).toBe(1)
  })

  it('student wins on a class that still counts → fully reversed', async () => {
    const b = await completedClass()
    expect((await resolve(b._id, 'approve_student')).status).toBe(200)
    expect((await Booking.findById(b._id)).adminRejected).toBe(true)
    expect(await credits()).toBe(START_CREDITS)
    expect(await earned()).toBe(0)
    expect(await livePayments(b._id)).toBe(0)
  })

  it('teacher wins on a class that still counts → no extra charge or pay', async () => {
    const b = await completedClass()
    expect((await resolve(b._id, 'approve_teacher')).status).toBe(200)
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await livePayments(b._id)).toBe(1)
  })

  it('two admins resolving at once → settled once', async () => {
    const b = await missedClass()
    const results = await Promise.all([resolve(b._id, 'approve_teacher'), resolve(b._id, 'approve_teacher')])
    expect(results.map(r => r.status).sort()).toEqual([200, 400])
    expect(await credits()).toBe(START_CREDITS - 1)
    expect(await earned()).toBe(RATE)
    expect(await livePayments(b._id)).toBe(1)
  })

  it('404 for an unknown booking, 400 when there is no pending dispute', async () => {
    expect((await resolve('64b7f0c2a1b2c3d4e5f60718', 'approve_teacher')).status).toBe(404)
    const b = await missedClass()
    await Booking.updateOne({ _id: b._id }, { $set: { disputeStatus: 'resolved_student' } })
    expect((await resolve(b._id, 'approve_teacher')).status).toBe(400)
  })
})
