// Phone / desktop pop-ups (web push): who gets one for which event, with a tag (one pop-up
// per thing) and a link to the right dashboard tab. web-push itself is mocked — everything
// above it (session lookup, the push-service allow-list, the payload) is real.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

process.env.VAPID_PUBLIC_KEY = 'BPushTestPublicKey'
process.env.VAPID_PRIVATE_KEY = 'push-test-private-key'

const sent = [] // { endpoint, payload }
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async (sub, body) => { sent.push({ endpoint: sub.endpoint, payload: JSON.parse(body) }) }),
  },
}))
vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))
vi.mock('../utils/emailService.js', async (orig) => {
  const real = await orig()
  return Object.fromEntries(Object.keys(real).map((k) => [k, typeof real[k] === 'function' ? vi.fn().mockResolvedValue({ success: true }) : real[k]]))
})
vi.mock('../utils/progressEmails.js', () => ({ emailHomeworkGraded: vi.fn(), emailDueDateChanged: vi.fn(), awardMilestonesAndNotify: vi.fn(async () => []) }))

const { default: bookingRouter } = await import('../routes/bookingRoutes.js')
const { default: homeworkRouter } = await import('../routes/homeworkRoutes.js')
const { notifyAdmins } = await import('../utils/adminNotify.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { homeworkSchema } = await import('../schemas/homeworkSchema.js')

const app = express()
app.use(express.json())
app.use('/api/bookings', bookingRouter)
app.use('/api/homework', homeworkRouter)

const EP = { teacher: 'https://fcm.googleapis.com/fcm/send/teacher-device', student: 'https://fcm.googleapis.com/fcm/send/student-device', admin: 'https://updates.push.services.mozilla.com/wpush/v2/admin-device' }
const sub = (endpoint) => ({ endpoint, keys: { p256dh: 'BKey', auth: 'auth' } })
const session = (endpoint, extra = {}) => ({ token: `t-${Math.random()}`, isActive: true, pushSubscription: sub(endpoint), ...extra })
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...claims }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const to = (ep) => sent.filter((s) => s.endpoint === ep).map((s) => s.payload)

let db, teacher, student, admin, adminToken, teacherToken, studentToken
beforeAll(async () => {
  db = global.__TEST_DB__
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  await db.models.Teacher.updateOne({ _id: teacher._id }, { $push: { sessions: session(EP.teacher) } })
  await db.models.Student.updateOne({ _id: student._id }, { $push: { sessions: session(EP.student) }, $set: { classCredits: 20 } })
  // A second admin session that signed out: must never get pop-ups
  await db.models.Admin.updateOne({ _id: admin._id }, { $push: { sessions: { $each: [session(EP.admin), session('https://fcm.googleapis.com/fcm/send/old-laptop', { isActive: false })] } } })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
  studentToken = sign({ id: String(student._id), role: 'student' })
})
beforeEach(() => { sent.length = 0 })
const settle = () => new Promise((r) => setTimeout(r, 150))
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString()

describe('class events', () => {
  it('admin books a class → the teacher gets "New class request", the student "requested"', async () => {
    const res = await request(app).post('/api/bookings').set('Authorization', `Bearer ${adminToken}`)
      .send({ teacherId: teacher._id, studentId: student._id, scheduledTime: inDays(2), duration: 60, classTitle: 'Push test class' })
    expect(res.status).toBe(201)
    await settle()
    const id = res.body.booking._id
    expect(to(EP.teacher)).toEqual([expect.objectContaining({ title: '📅 New class request', tag: `booking-${id}`, data: { url: '/teacher/dashboard?tab=bookings' } })])
    expect(to(EP.student)[0]).toMatchObject({ title: '📅 New class requested', tag: `booking-${id}` })
    expect(to(EP.student)[0].body).toMatch(/waiting for your teacher/)
  })

  it('teacher accepts → admins are told (Notifications tab entry + pop-up), signed-out devices are not', async () => {
    const b = await request(app).post('/api/bookings').set('Authorization', `Bearer ${adminToken}`)
      .send({ teacherId: teacher._id, studentId: student._id, scheduledTime: inDays(3), duration: 60, classTitle: 'Accept me' })
    await settle(); sent.length = 0
    expect((await request(app).patch(`/api/bookings/${b.body.booking._id}/accept`).set('Authorization', `Bearer ${teacherToken}`)).status).toBe(200)
    await settle()
    expect(to(EP.admin)[0]).toMatchObject({ title: '✅ Class accepted', data: { url: '/admin?tab=notifications' } })
    expect(to('https://fcm.googleapis.com/fcm/send/old-laptop')).toHaveLength(0)
    expect(to(EP.student)[0]).toMatchObject({ title: '✅ Class Confirmed!' })
  })

  it('student cancels → the teacher gets a pop-up (the student, who cancelled, does not)', async () => {
    const b = await request(app).post('/api/bookings').set('Authorization', `Bearer ${adminToken}`)
      .send({ teacherId: teacher._id, studentId: student._id, scheduledTime: inDays(4), duration: 60, classTitle: 'Cancel me' })
    await settle(); sent.length = 0
    expect((await request(app).patch(`/api/bookings/${b.body.booking._id}/cancel`).set('Authorization', `Bearer ${studentToken}`).send({ reason: 'sick' })).status).toBe(200)
    await settle()
    expect(to(EP.teacher)[0]).toMatchObject({ title: '🚫 Class cancelled', tag: `booking-${b.body.booking._id}` })
    expect(to(EP.student)).toHaveLength(0)
  })
})

describe('homework', () => {
  it('submitted → teacher pop-up; graded → student pop-up', async () => {
    const Homework = db.models.Homework || db.model('Homework', homeworkSchema)
    const hw = await Homework.create({ teacherId: teacher._id, studentId: student._id, title: 'Essay', dueDate: inDays(2) })
    const f = new FormData(); f.append('text', 'My answer')
    const sub1 = await request(app).post(`/api/homework/${hw._id}/submit`).set('Authorization', `Bearer ${studentToken}`).field('text', 'My answer')
    expect(sub1.status).toBe(200)
    await settle()
    expect(to(EP.teacher)[0]).toMatchObject({ title: '📬 Homework submitted', tag: `hw-sub-${hw._id}`, data: { url: '/teacher/dashboard?tab=homework' } })
    await settle(); sent.length = 0
    expect((await request(app).post(`/api/homework/${hw._id}/grade`).set('Authorization', `Bearer ${teacherToken}`).send({ score: 90, feedback: 'Good' })).status).toBe(200)
    await settle()
    expect(to(EP.student)[0]).toMatchObject({ title: '✅ Homework graded', body: '"Essay" — 90/100', tag: `hw-${hw._id}`, data: { url: '/student/dashboard?tab=homework' } })
  })
})

describe('delivery rules', () => {
  it('a subscription that is not a real push service is never contacted', async () => {
    await db.models.Admin.updateOne({ _id: admin._id }, { $push: { sessions: session('https://169.254.169.254/latest/meta-data') } })
    await notifyAdmins(db, { type: 'something', message: 'hello' })
    await settle()
    expect(sent.some((s) => s.endpoint.includes('169.254'))).toBe(false)
    expect(to(EP.admin)[0]).toMatchObject({ title: '🔔 New notification', body: 'hello' })
  })
})
