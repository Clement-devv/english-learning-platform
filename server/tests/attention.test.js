// Dashboard attention counts: logged classes awaiting approval, parent checks waiting
// or disputed, open disputes — and admin only.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: attentionRouter } = await import('../routes/attentionRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')

const app = express()
app.use(express.json())
app.use('/api/admin/attention', attentionRouter)

let Booking, teacher, student, adminToken, teacherToken
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...claims }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const counts = () => request(app).get('/api/admin/attention').set('Authorization', `Bearer ${adminToken}`)

// Raw inserts skip the schema's validators/hooks — these rows only need the counted fields
const book = (fields) => Booking.collection.insertOne({
  _id: new mongoose.Types.ObjectId(), teacherId: teacher._id, studentId: student._id,
  scheduledTime: new Date(), duration: 60, status: 'completed', ...fields,
})

beforeAll(async () => {
  const db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
})

beforeEach(() => Booking.deleteMany({}))

describe('GET /admin/attention', () => {
  it('counts what each tab shows as waiting', async () => {
    // Logged classes: pending + processing count, approved doesn't
    await book({ loggedByTeacher: true, offline: { approval: { status: 'pending' } } })
    await book({ loggedByTeacher: true, offline: { approval: { status: 'processing' } } })
    await book({ loggedByTeacher: true, offline: { approval: { status: 'approved' } } })
    // Parent checks: no check yet + waiting + disputed count; confirmed doesn't
    const pc = { attendanceConfirmedBy: 'teacher' }
    await book({ ...pc })
    await book({ ...pc, parentCheck: { status: 'waiting' } })
    await book({ ...pc, parentCheck: { status: 'denied' }, disputeRaised: true, disputeStatus: 'pending' })
    await book({ ...pc, parentCheck: { status: 'confirmed' } })
    // Disputes: open only (the denied parent check above is one too)
    await book({ disputeRaised: true, disputeStatus: 'resolved_teacher' })

    const res = await counts()
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ loggedClasses: 2, parentChecks: 3, disputes: 1 })
  })

  it('is zero when nothing waits', async () => {
    expect((await counts()).body.data).toEqual({ loggedClasses: 0, parentChecks: 0, disputes: 0 })
  })

  it('is admin only', async () => {
    const res = await request(app).get('/api/admin/attention').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })
})
