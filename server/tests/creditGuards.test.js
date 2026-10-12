// #14 — a student can't book classes they have no credits for (self-requests and
//        teacher accepts both check).
// #15 — group-class enroll / unenroll / cancel move credits atomically: no double
//        spend, no double enroll, no double refund.
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
const { default: groupRouter } = await import('../routes/groupClassRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')

const app = express()
app.use(express.json())
app.set('io', { to: () => ({ emit: () => {} }) })
app.use('/api/bookings', bookingRouter)
app.use('/api/group-classes', groupRouter)

const HOUR = 3600000
let db, Booking, GroupClass, Student, Teacher, student, teacher, studentToken, teacherToken, adminToken

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })
const credits = async () => (await Student.findById(student._id)).classCredits
let slot = 0
const nextSlot = () => new Date(Date.now() + (48 + 2 * slot++) * HOUR).toISOString()

const requestClass = () => request(app).post('/api/bookings/student-request')
  .set('Authorization', `Bearer ${studentToken}`)
  .send({ teacherId: String(teacher._id), scheduledTime: nextSlot(), duration: 60 })

const groupClass = (overrides = {}) => GroupClass.create({
  teacherId: teacher._id, title: 'Group', scheduledTime: new Date(Date.now() + 72 * HOUR),
  maxSeats: 4, pricePerSeat: 1, ...overrides,
})
const enroll = (gcId, token = studentToken, body = {}) =>
  request(app).post(`/api/group-classes/${gcId}/enroll`).set('Authorization', `Bearer ${token}`).send(body)
const unenroll = (gcId) => request(app).delete(`/api/group-classes/${gcId}/enroll/${student._id}`)
  .set('Authorization', `Bearer ${studentToken}`)
const cancelGc = (gcId) => request(app).patch(`/api/group-classes/${gcId}/cancel`)
  .set('Authorization', `Bearer ${adminToken}`).send({ reason: 'test' })

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  studentToken = sign(student._id, 'student')
  teacherToken = sign(teacher._id, 'teacher')
  adminToken = sign(admin._id, 'admin')
  await Teacher.updateOne({ _id: teacher._id }, { workingHours: [] })
})

beforeEach(async () => {
  await Booking.deleteMany({ studentId: student._id })
  await GroupClass.deleteMany({})
  await Student.updateOne({ _id: student._id }, { classCredits: 2, active: true })
})

describe('#14 student self-booking needs credits', () => {
  it('a student with no credits cannot request a class', async () => {
    await Student.updateOne({ _id: student._id }, { classCredits: 0 })
    const res = await requestClass()
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/no classes left/)
  })

  it('cannot request more classes than credits (pending requests count)', async () => {
    expect((await requestClass()).status).toBe(201)
    expect((await requestClass()).status).toBe(201)
    const third = await requestClass()
    expect(third.status).toBe(400)
    expect(third.body.message).toMatch(/already booked/)
  })

  it('a teacher cannot accept a request once the student has no credits', async () => {
    const res = await requestClass()
    await Student.updateOne({ _id: student._id }, { classCredits: 0 })
    const accept = await request(app).patch(`/api/bookings/${res.body.booking._id}/accept`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(accept.status).toBe(400)
    expect((await Booking.findById(res.body.booking._id)).status).toBe('pending')
  })

  it('a trial class can still be accepted without credits', async () => {
    const b = await Booking.create({
      teacherId: teacher._id, studentId: student._id, classTitle: 'Trial', duration: 60,
      scheduledTime: new Date(nextSlot()), status: 'pending', isTrial: true,
    })
    await Student.updateOne({ _id: student._id }, { classCredits: 0 })
    const accept = await request(app).patch(`/api/bookings/${b._id}/accept`).set('Authorization', `Bearer ${teacherToken}`)
    expect(accept.status).toBe(200)
  })
})

describe('#15 group classes', () => {
  it('enroll charges the seat price once', async () => {
    const gc = await groupClass()
    const res = await enroll(gc._id)
    expect(res.status).toBe(200)
    expect(await credits()).toBe(1)
    const after = await GroupClass.findById(gc._id)
    expect(after.enrollments).toHaveLength(1)
    expect(after.enrollments[0].attendance).toBe('pending') // subdocument defaults applied
  })

  it('double click on enroll → enrolled and charged once', async () => {
    const gc = await groupClass()
    const results = await Promise.all([enroll(gc._id), enroll(gc._id), enroll(gc._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect((await GroupClass.findById(gc._id)).enrollments).toHaveLength(1)
    expect(await credits()).toBe(1)
  })

  it('one credit can\'t pay for two classes enrolled at the same time', async () => {
    await Student.updateOne({ _id: student._id }, { classCredits: 1 })
    const [a, b] = await Promise.all([groupClass(), groupClass()])
    const results = await Promise.all([enroll(a._id), enroll(b._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await credits()).toBe(0)
  })

  it('the last seat goes to one student only; the other gets their credit back', async () => {
    const other = await Student.create({ email: 'gc-other@test.com', firstName: 'O', lastName: 'S', password: 'x', active: true, status: 'active', classCredits: 2 })
    const gc = await groupClass({ maxSeats: 2 })
    await GroupClass.updateOne({ _id: gc._id }, { $push: { enrollments: { studentId: teacher._id, creditCharged: 0 } } }) // one seat taken
    const results = await Promise.all([enroll(gc._id), enroll(gc._id, sign(other._id, 'student'))])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    const after = await GroupClass.findById(gc._id)
    expect(after.enrollments).toHaveLength(2)
    expect(after.status).toBe('full')
    const total = (await credits()) + (await Student.findById(other._id)).classCredits
    expect(total).toBe(3) // 4 credits between them, exactly one spent
  })

  it('double click on unenroll → refunded once', async () => {
    const gc = await groupClass()
    await enroll(gc._id)
    const results = await Promise.all([unenroll(gc._id), unenroll(gc._id), unenroll(gc._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await credits()).toBe(2)
  })

  it('unenrolling from a full class reopens it', async () => {
    const gc = await groupClass({ maxSeats: 2 })
    await GroupClass.updateOne({ _id: gc._id }, { $push: { enrollments: { studentId: teacher._id, creditCharged: 0 } } })
    await enroll(gc._id)
    expect((await GroupClass.findById(gc._id)).status).toBe('full')
    await unenroll(gc._id)
    expect((await GroupClass.findById(gc._id)).status).toBe('open')
  })

  it('double click on cancel → everyone refunded once', async () => {
    const gc = await groupClass()
    await enroll(gc._id)
    expect(await credits()).toBe(1)
    const results = await Promise.all([cancelGc(gc._id), cancelGc(gc._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await credits()).toBe(2)
  })

  it('cancel and unenroll at the same moment → refunded once', async () => {
    const gc = await groupClass()
    await enroll(gc._id)
    await Promise.all([cancelGc(gc._id), unenroll(gc._id)])
    expect(await credits()).toBe(2)
  })
})
