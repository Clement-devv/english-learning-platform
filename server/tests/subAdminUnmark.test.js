// Sub-admin "unmark" must reverse a completed class the same way the admin unmark
// does: the class stays completed + adminRejected (it used to go back to
// "accepted", and the missed-class sweep then re-marked it "missed"), trial
// classes don't refund a credit, pay is taken back once, and only in scope.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: scopeRouter } = await import('../routes/subAdminScopeRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { subAdminSchema } = await import('../schemas/subAdminSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')
const { payForCompletedClass } = await import('../utils/classPayment.js')
const { sweepMissedClasses } = await import('../utils/missedClassScheduler.js')

const app = express()
app.use(express.json())
app.use('/api/sub-admin-scope', scopeRouter)

const START = 5, RATE = 10
let db, Booking, Payment, Student, Teacher, student, teacher, token, outOfScopeTeacher

const unmark = (bookingId) => request(app).post('/api/sub-admin-scope/classes/unmark')
  .set('Authorization', `Bearer ${token}`).send({ bookingId: String(bookingId) })

async function paidClass(overrides = {}) {
  const b = await Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Sub-admin unmark', duration: 60,
    scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'completed', ...overrides,
  })
  await payForCompletedClass(db, b, { description: 't' })
  return b
}
const state = async () => ({
  credits: (await Student.findById(student._id)).classCredits,
  earned: (await Teacher.findById(teacher._id)).earned,
})

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  const SubAdmin = db.models.SubAdmin || db.model('SubAdmin', subAdminSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  outOfScopeTeacher = await Teacher.create({ email: 'other-teacher@test.com', firstName: 'Other', lastName: 'Teacher', password: 'x', active: true, status: 'active', continent: 'Africa' })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  const sub = await SubAdmin.create({
    firstName: 'Sub', lastName: 'Admin', email: 'sub@test.com', status: 'active', createdBy: admin._id,
    assignmentType: 'manual', assignedTeachers: [teacher._id], permissions: { canMarkLessons: true },
  })
  token = jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(sub._id), role: 'sub-admin', centerId: 'testcenter' },
    getCenterSecret('testcenter'), { expiresIn: '5m' })
})

beforeEach(async () => {
  await Student.updateOne({ _id: student._id }, { classCredits: START, active: true })
  await Teacher.updateOne({ _id: teacher._id }, { ratePerClass: RATE, earned: 0, lessonsCompleted: 0 })
})

describe('sub-admin unmark', () => {
  it('reverses the class and keeps it settled (not back to "accepted")', async () => {
    const b = await paidClass()
    expect(await state()).toEqual({ credits: START - 1, earned: RATE })

    const res = await unmark(b._id)
    expect(res.status).toBe(200)
    const after = await Booking.findById(b._id)
    expect(after.status).toBe('completed')
    expect(after.adminRejected).toBe(true)
    expect(await state()).toEqual({ credits: START, earned: 0 })
    expect((await Payment.findOne({ bookingId: b._id })).status).toBe('cancelled')
  })

  it('the missed-class sweep leaves an unmarked class alone', async () => {
    const b = await paidClass()
    await unmark(b._id)
    await sweepMissedClasses(db)
    expect((await Booking.findById(b._id)).status).toBe('completed')
  })

  it('a trial class does not refund a credit', async () => {
    const b = await paidClass({ isTrial: true })
    expect((await unmark(b._id)).status).toBe(200)
    expect(await state()).toEqual({ credits: START, earned: 0 })
  })

  it('double click → reversed once', async () => {
    const b = await paidClass()
    await Teacher.updateOne({ _id: teacher._id }, { earned: 50 })
    const results = await Promise.all([unmark(b._id), unmark(b._id), unmark(b._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await state()).toEqual({ credits: START, earned: 50 - RATE })
  })

  it('refuses a teacher outside the sub-admin scope', async () => {
    const b = await Booking.create({
      teacherId: outOfScopeTeacher._id, studentId: student._id, classTitle: 'Not mine', duration: 60,
      scheduledTime: new Date(Date.now() - 3 * 3600000), status: 'completed',
    })
    expect((await unmark(b._id)).status).toBe(403)
    expect((await Booking.findById(b._id)).adminRejected).not.toBe(true)
  })

  it('400 for an invalid id', async () => {
    expect((await unmark('not-an-id')).status).toBe(400)
    expect((await unmark(new mongoose.Types.ObjectId())).status).toBe(404)
  })
})
