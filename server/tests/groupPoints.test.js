// Group-class points: the admin sells points, new group classes are paid in points
// (older ones keep class credits), leaving / cancelling refunds, and completing a
// class with someone attended pays the teacher's fixed fee — exactly once.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    req.app.set('io', { to: () => ({ emit: () => {} }) })
    next()
  },
}))

const { default: groupClassRoutes } = await import('../routes/groupClassRoutes.js')
const { default: groupPointsRoutes } = await import('../routes/groupPointsRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { classPricingSchema } = await import('../schemas/classPricingSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')
const { groupPointsLedgerSchema } = await import('../schemas/groupPointsLedgerSchema.js')
const { subAdminSchema } = await import('../schemas/subAdminSchema.js')

const app = express()
app.use(express.json())
app.use('/group-classes', groupClassRoutes)
app.use('/group-points', groupPointsRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (token) => ({
  get:   (u) => request(app).get(u).set('Authorization', `Bearer ${token}`),
  post:  (u, b = {}) => request(app).post(u).set('Authorization', `Bearer ${token}`).send(b),
  patch: (u, b = {}) => request(app).patch(u).set('Authorization', `Bearer ${token}`).send(b),
  del:   (u) => request(app).delete(u).set('Authorization', `Bearer ${token}`),
})

let GroupClass, Pricing, Tx, Ledger, Student, Teacher, student, teacher, admin, subToken
let adminApi, teacherApi, studentApi
const later = () => new Date(Date.now() + 86400000)

beforeAll(async () => {
  const db = global.__TEST_DB__
  GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  Pricing    = db.models.ClassPricing || db.model('ClassPricing', classPricingSchema)
  Tx         = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Ledger     = db.models.GroupPointsLedger || db.model('GroupPointsLedger', groupPointsLedgerSchema)
  const SubAdmin = db.models.SubAdmin || db.model('SubAdmin', subAdminSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  admin   = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminApi   = as(sign(admin._id, 'admin'))
  teacherApi = as(sign(teacher._id, 'teacher'))
  studentApi = as(sign(student._id, 'student'))
  const sub = await SubAdmin.create({ firstName: 'Gp', lastName: 'Sub', email: 'gp-sub@test.com', status: 'active', createdBy: admin._id,
    assignmentType: 'manual', assignedTeachers: [teacher._id], permissions: { canManageGroupClasses: true } })
  subToken = sign(sub._id, 'sub-admin')
  await Pricing.deleteMany({})
  await Pricing.create({ pricePerClass: 20, pricePerPoint: 2, defaultGroupFee: 15 })
})

beforeEach(async () => {
  await GroupClass.deleteMany({})
  await Tx.deleteMany({})
  await Ledger.deleteMany({})
  await Student.updateOne({ _id: student._id }, { groupPoints: 0, classCredits: 5, active: true })
  await Teacher.updateOne({ _id: teacher._id }, { earned: 0, lessonsCompleted: 0 })
})

const createAsAdmin = (extra = {}) => adminApi.post('/group-classes', {
  teacherId: String(teacher._id), title: 'Conversation club', scheduledTime: later(), pointsPerSeat: 3, teacherFee: 25, ...extra,
})
const points = async () => (await Student.findById(student._id).lean()).groupPoints
const credits = async () => (await Student.findById(student._id).lean()).classCredits
const earned = async () => (await Teacher.findById(teacher._id).lean()).earned

describe('selling points', () => {
  it('admin sells points; the student sees balance + history', async () => {
    const res = await adminApi.post(`/group-points/students/${student._id}/sell`, { points: 10, amountPaid: 20, method: 'cash' })
    expect(res.status).toBe(200)
    expect(res.body.balance).toBe(10)
    const me = await studentApi.get('/group-points/me')
    expect(me.body.balance).toBe(10)
    expect(me.body.history[0]).toMatchObject({ kind: 'purchase', points: 10, amountPaid: 20 })
  })

  it('only the admin can sell points', async () => {
    expect((await as(subToken).post(`/group-points/students/${student._id}/sell`, { points: 5 })).status).toBe(403)
    expect((await teacherApi.post(`/group-points/students/${student._id}/sell`, { points: 5 })).status).toBe(403)
    expect((await studentApi.post(`/group-points/students/${student._id}/sell`, { points: 5 })).status).toBe(403)
    expect((await adminApi.post(`/group-points/students/${student._id}/sell`, { points: 0 })).status).toBe(400)
  })
})

describe('group classes paid in points', () => {
  it('new classes use points; the admin sets the fee, others get the default', async () => {
    const a = await createAsAdmin()
    expect(a.status).toBe(201)
    expect(a.body.groupClass).toMatchObject({ paymentType: 'points', pointsPerSeat: 3, teacherFee: 25 })
    const t = await teacherApi.post('/group-classes', { title: 'Mine', scheduledTime: later(), pointsPerSeat: 2, teacherFee: 999 })
    expect(t.body.groupClass).toMatchObject({ paymentType: 'points', pointsPerSeat: 2, teacherFee: 15 })
    const s = await as(subToken).post('/group-classes', { teacherId: String(teacher._id), title: 'Sub', scheduledTime: later(), teacherFee: 999 })
    expect(s.body.groupClass.teacherFee).toBe(15)
    expect((await teacherApi.patch(`/group-classes/${t.body.groupClass._id}`, { teacherFee: 500 })).status).toBe(403)
  })

  it('enrolling spends points (not credits); leaving refunds them', async () => {
    const id = (await createAsAdmin()).body.groupClass._id
    expect((await studentApi.post(`/group-classes/${id}/enroll`)).status).toBe(400) // 0 points
    await adminApi.post(`/group-points/students/${student._id}/sell`, { points: 5 })
    const res = await studentApi.post(`/group-classes/${id}/enroll`)
    expect(res.status).toBe(200)
    expect(res.body.pointsRemaining).toBe(2)
    expect(await points()).toBe(2)
    expect(await credits()).toBe(5)
    const left = await studentApi.del(`/group-classes/${id}/enroll/${student._id}`)
    expect(left.body.pointsRefunded).toBe(3)
    expect(await points()).toBe(5)
  })

  it('cancelling refunds everyone\'s points', async () => {
    const id = (await createAsAdmin()).body.groupClass._id
    await adminApi.post(`/group-points/students/${student._id}/sell`, { points: 3 })
    await studentApi.post(`/group-classes/${id}/enroll`)
    expect(await points()).toBe(0)
    expect((await adminApi.patch(`/group-classes/${id}/cancel`, { reason: 'x' })).status).toBe(200)
    expect(await points()).toBe(3)
  })

  it('students never see the teacher fee', async () => {
    const id = (await createAsAdmin()).body.groupClass._id
    const list = await studentApi.get('/group-classes')
    expect(list.body.classes[0]).not.toHaveProperty('teacherFee')
    const one = await studentApi.get(`/group-classes/${id}`)
    expect(one.body.groupClass).not.toHaveProperty('teacherFee')
    expect((await teacherApi.get('/group-classes')).body.classes[0].teacherFee).toBe(25)
  })

  it('older classes (no payment type) keep using class credits', async () => {
    const gc = await GroupClass.create({ teacherId: teacher._id, title: 'Old', scheduledTime: later(), pricePerSeat: 2 })
    expect((await studentApi.post(`/group-classes/${gc._id}/enroll`)).status).toBe(200)
    expect(await credits()).toBe(3)
    expect(await points()).toBe(0)
  })
})

describe('picking students when creating a class', () => {
  it('only the picked students see and can enroll in an invite-only class', async () => {
    const other = await Student.create({ email: `gp-other-${Date.now()}@test.com`, firstName: 'Not', lastName: 'Picked', password: 'x', active: true, groupPoints: 10 })
    await Student.updateOne({ _id: student._id }, { groupPoints: 10 })
    const res = await createAsAdmin({ enrollmentMode: 'invite-only', invitedStudents: [String(student._id), 'not-an-id'] })
    expect(res.status).toBe(201)
    expect(res.body.groupClass.invitedStudents.map(String)).toEqual([String(student._id)])
    const id = res.body.groupClass._id

    const otherApi = as(sign(other._id, 'student'))
    expect((await otherApi.get('/group-classes')).body.classes.map(c => c._id)).not.toContain(id)
    expect((await otherApi.post(`/group-classes/${id}/enroll`)).status).toBe(403)
    expect((await studentApi.get('/group-classes')).body.classes.map(c => c._id)).toContain(id)
    expect((await studentApi.post(`/group-classes/${id}/enroll`)).status).toBe(200)
  })

  it('a sub-admin can only pick their own teachers\' students', async () => {
    const outsider = await Student.create({ email: `gp-out-${Date.now()}@test.com`, firstName: 'Out', lastName: 'Side', password: 'x', active: true })
    const db = global.__TEST_DB__
    const { assignmentSchema } = await import('../schemas/assignmentSchema.js')
    const Assignment = db.models.Assignment || db.model('Assignment', assignmentSchema)
    await Assignment.updateOne({ teacherId: teacher._id, studentId: student._id }, { $set: { teacherId: teacher._id, studentId: student._id } }, { upsert: true })
    const res = await as(subToken).post('/group-classes', { teacherId: String(teacher._id), title: 'Picked', scheduledTime: later(),
      enrollmentMode: 'invite-only', invitedStudents: [String(student._id), String(outsider._id)] })
    expect(res.status).toBe(201)
    expect(res.body.groupClass.invitedStudents.map(String)).toEqual([String(student._id)])
  })
})

describe('class platform (Agora / Google Meet / Zoom)', () => {
  const MEET = 'https://meet.google.com/abc-defg-hij'

  it('Meet / Zoom need a link: the class\'s own, or the teacher\'s saved one', async () => {
    await Teacher.updateOne({ _id: teacher._id }, { googleMeetLink: '', zoomLink: '' })
    expect((await createAsAdmin({ platform: 'googlemeet' })).status).toBe(400)
    expect((await createAsAdmin({ platform: 'googlemeet', meetingLink: 'https://evil.example.com/x' })).status).toBe(400)
    expect((await createAsAdmin({ platform: 'teams' })).status).toBe(400)
    const ok = await createAsAdmin({ platform: 'googlemeet', meetingLink: MEET })
    expect(ok.body.groupClass).toMatchObject({ platform: 'googlemeet', meetingLink: MEET })
    await Teacher.updateOne({ _id: teacher._id }, { zoomLink: 'https://us02web.zoom.us/j/123' })
    const z = await teacherApi.post('/group-classes', { title: 'Zoom one', scheduledTime: later(), platform: 'zoom' })
    expect(z.status).toBe(201)
    expect(z.body.groupClass.platform).toBe('zoom')
    expect((await createAsAdmin()).body.groupClass.platform).toBe('agora') // default
  })

  it('students get the link only when enrolled and the class has started', async () => {
    await Student.updateOne({ _id: student._id }, { groupPoints: 10 })
    const id = (await createAsAdmin({ platform: 'googlemeet', meetingLink: MEET })).body.groupClass._id
    expect((await studentApi.get('/group-classes')).body.classes[0]).not.toHaveProperty('meetingLink')
    expect((await studentApi.get(`/group-classes/${id}/join`)).status).toBe(403)   // not enrolled
    await studentApi.post(`/group-classes/${id}/enroll`)
    expect((await studentApi.get(`/group-classes/${id}/join`)).status).toBe(400)   // not started
    await teacherApi.patch(`/group-classes/${id}/start`)
    const join = await studentApi.get(`/group-classes/${id}/join`)
    expect(join.body).toMatchObject({ platform: 'googlemeet', link: MEET })
    expect((await teacherApi.get(`/group-classes/${id}/join`)).body.link).toBe(MEET)
  })

  it('Agora classes join in the app (no link)', async () => {
    const id = (await createAsAdmin()).body.groupClass._id
    const join = await teacherApi.get(`/group-classes/${id}/join`)
    expect(join.body).toEqual({ success: true, platform: 'agora' })
  })
})

describe('teacher fee', () => {
  async function runClass() {
    const id = (await createAsAdmin()).body.groupClass._id
    await adminApi.post(`/group-points/students/${student._id}/sell`, { points: 3 })
    await studentApi.post(`/group-classes/${id}/enroll`)
    await teacherApi.patch(`/group-classes/${id}/start`)
    return id
  }

  it('completing with someone attended pays the fee once', async () => {
    const id = await runClass()
    const done = await teacherApi.patch(`/group-classes/${id}/complete`, { attendance: [{ studentId: String(student._id), status: 'attended' }] })
    expect(done.status).toBe(200)
    expect(done.body.feePaid).toBe(25)
    expect(await earned()).toBe(25)
    // attendance edited afterwards: no second payment
    await teacherApi.patch(`/group-classes/${id}/attendance`, { attendance: [{ studentId: String(student._id), status: 'attended' }] })
    expect(await earned()).toBe(25)
    const txs = await Tx.find({ groupClassId: id }).lean()
    expect(txs).toHaveLength(1)
    expect(txs[0]).toMatchObject({ amount: 25, status: 'pending', teacherId: teacher._id })
  })

  it('no attendee, no fee — until attendance shows someone came', async () => {
    const id = await runClass()
    const done = await teacherApi.patch(`/group-classes/${id}/complete`, { attendance: [{ studentId: String(student._id), status: 'absent' }] })
    expect(done.body.feePaid).toBe(0)
    expect(await earned()).toBe(0)
    const fixed = await teacherApi.patch(`/group-classes/${id}/attendance`, { attendance: [{ studentId: String(student._id), status: 'attended' }] })
    expect(fixed.body.feePaid).toBe(25)
    expect(await earned()).toBe(25)
  })
})
