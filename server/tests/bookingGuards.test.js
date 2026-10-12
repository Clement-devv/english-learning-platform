// A teacher must not be able to reject a class they were already paid for, or
// delete completed / disputed / missed classes (removing the payment trail or
// the evidence). Reject is only for pending requests.
import { vi, describe, it, expect, beforeAll } from 'vitest'
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
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')

const app = express()
app.use(express.json())
app.set('io', { to: () => ({ emit: () => {} }) })
app.use('/api/bookings', bookingRouter)

let Booking, teacher, student, teacherToken, adminToken
const HOUR = 3600000

const sign = (id, role) => jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' },
)
const reject = (id, token = teacherToken) => request(app).patch(`/api/bookings/${id}/reject`).set('Authorization', `Bearer ${token}`).send({ reason: 'busy' })
const del = (id, token = teacherToken) => request(app).delete(`/api/bookings/${id}`).set('Authorization', `Bearer ${token}`)

const booking = (overrides = {}) => Booking.create({
  teacherId: teacher._id, studentId: student._id, classTitle: 'Guarded', duration: 60,
  scheduledTime: new Date(Date.now() + 24 * HOUR), status: 'pending', ...overrides,
})
const exists = async (b) => !!(await Booking.exists({ _id: b._id }))

beforeAll(async () => {
  const db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  teacherToken = sign(teacher._id, 'teacher')
  adminToken = sign(admin._id, 'admin')
})

describe('PATCH /bookings/:id/reject', () => {
  it('rejects a pending request', async () => {
    const b = await booking()
    expect((await reject(b._id)).status).toBe(200)
    expect((await Booking.findById(b._id)).status).toBe('rejected')
  })

  it.each(['completed', 'accepted', 'missed', 'cancelled'])('refuses a %s booking', async (status) => {
    const b = await booking({ status })
    expect((await reject(b._id)).status).toBe(400)
    expect((await Booking.findById(b._id)).status).toBe(status)
  })

  it('admin also cannot reject a completed class', async () => {
    const b = await booking({ status: 'completed' })
    expect((await reject(b._id, adminToken)).status).toBe(400)
  })
})

describe('DELETE /bookings/:id', () => {
  it('teacher can delete a pending, upcoming accepted, rejected or cancelled class', async () => {
    for (const status of ['pending', 'accepted', 'rejected', 'cancelled']) {
      const b = await booking({ status })
      expect((await del(b._id)).status).toBe(200)
      expect(await exists(b)).toBe(false)
    }
  })

  it.each([
    ['completed', { status: 'completed' }],
    ['admin-rejected', { status: 'completed', adminRejected: true }],
    ['missed', { status: 'missed' }],
    ['awaiting approval', { status: 'pending_confirmation' }],
    ['disputed', { status: 'missed', disputeRaised: true, disputeStatus: 'pending' }],
    ['already started', { status: 'accepted', scheduledTime: new Date(Date.now() - 10 * 60000) }],
  ])('teacher cannot delete a %s class', async (_label, overrides) => {
    const b = await booking(overrides)
    expect((await del(b._id)).status).toBe(400)
    expect(await exists(b)).toBe(true)
  })

  it('admin can delete a missed class but not a completed or disputed one', async () => {
    const missed = await booking({ status: 'missed' })
    expect((await del(missed._id, adminToken)).status).toBe(200)
    const done = await booking({ status: 'completed' })
    expect((await del(done._id, adminToken)).status).toBe(400)
    const disputed = await booking({ status: 'missed', disputeRaised: true, disputeStatus: 'pending' })
    expect((await del(disputed._id, adminToken)).status).toBe(400)
  })
})
