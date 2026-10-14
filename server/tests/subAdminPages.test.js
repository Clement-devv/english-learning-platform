// Admin pages a sub-admin can be given (middleware/staffAccess.js): each needs its
// own permission, and a sub-admin only ever sees / acts on their own teachers
// (and those teachers' students). Approving a logged class — which pays the
// teacher — needs a separate permission.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: parentCheckRoutes } = await import('../routes/parentCheckRoutes.js')
const { default: shareLinkAdminRoutes } = await import('../routes/shareLinkAdminRoutes.js')
const { default: offlineClassRoutes } = await import('../routes/offlineClassRoutes.js')
const { default: groupClassRoutes } = await import('../routes/groupClassRoutes.js')
const { default: bookingRoutes } = await import('../routes/bookingRoutes.js')
const { default: classReportRoutes } = await import('../routes/classReportRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { subAdminSchema } = await import('../schemas/subAdminSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { assignmentSchema } = await import('../schemas/assignmentSchema.js')

const app = express()
app.use(express.json())
app.use('/parent-checks', parentCheckRoutes)
app.use('/share-links', shareLinkAdminRoutes)
app.use('/offline-classes', offlineClassRoutes)
app.use('/group-classes', groupClassRoutes)
app.use('/bookings', bookingRoutes)
app.use('/class-report', classReportRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })

let SubAdmin, Booking, GroupClass, Student, Teacher, sub, subToken, adminToken
let mine, other, student, otherStudent

const as = (token) => ({
  get:  (url) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
})
const grant = (perms) => SubAdmin.updateOne({ _id: sub._id }, { $set: Object.fromEntries(Object.entries(perms).map(([k, v]) => [`permissions.${k}`, v])) })

const hourAgo = () => new Date(Date.now() - 3 * 3600000)
async function teacherConfirmed(teacherId, studentId) {
  return Booking.create({ teacherId, studentId, classTitle: 'Checked', scheduledTime: hourAgo(), duration: 60,
    status: 'completed', attendanceConfirmedBy: 'teacher' })
}
async function logged(teacherId, studentId) {
  return Booking.create({ teacherId, studentId, classTitle: 'Logged', scheduledTime: hourAgo(), duration: 60,
    status: 'pending_confirmation', loggedByTeacher: true,
    offline: { platform: 'zoom', reason: 'site down', loggedAt: new Date(), approval: { status: 'pending' } } })
}

beforeAll(async () => {
  const db = global.__TEST_DB__
  SubAdmin   = db.models.SubAdmin   || db.model('SubAdmin', subAdminSchema)
  Booking    = db.models.Booking    || db.model('Booking', bookingSchema)
  GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  const Assignment = db.models.Assignment || db.model('Assignment', assignmentSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  mine    = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  other   = await Teacher.create({ email: 'pages-other@test.com', firstName: 'Other', lastName: 'Teacher', password: 'x', active: true, status: 'active', continent: 'Africa' })
  otherStudent = await Student.create({ email: 'pages-otherstu@test.com', firstName: 'Out', lastName: 'Side', password: 'x', active: true, classCredits: 5 })
  await Assignment.create({ teacherId: mine._id, studentId: student._id })
  await Assignment.create({ teacherId: other._id, studentId: otherStudent._id })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = sign(admin._id, 'admin')
  sub = await SubAdmin.create({ firstName: 'Page', lastName: 'Sub', email: 'pages-sub@test.com', status: 'active',
    createdBy: admin._id, assignmentType: 'manual', assignedTeachers: [mine._id] })
  subToken = sign(sub._id, 'sub-admin')
})

beforeEach(async () => {
  await SubAdmin.updateOne({ _id: sub._id }, { $set: {
    'permissions.canViewClassReport': false, 'permissions.canManageGroupClasses': false, 'permissions.canCreateBookings': false,
    'permissions.canManageParentChecks': false, 'permissions.canViewParentLinks': false,
    'permissions.canViewLoggedClasses': false, 'permissions.canApproveLoggedClasses': false,
  } })
  await Booking.deleteMany({})
  await GroupClass.deleteMany({})
  await Student.updateOne({ _id: student._id }, { classCredits: 5, active: true })
})

describe('sub-admin pages — permissions', () => {
  it('new pages are off by default', async () => {
    const s = as(subToken)
    for (const url of ['/parent-checks', '/share-links?kind=homework', '/offline-classes', '/class-report', '/group-classes'])
      expect((await s.get(url)).status, url).toBe(403)
    expect((await s.post('/bookings', { teacherId: String(mine._id), studentId: String(student._id), classTitle: 'x', scheduledTime: new Date(Date.now() + 86400000) })).status).toBe(403)
    const fresh = await SubAdmin.findById(sub._id).lean()
    expect(fresh.permissions.canApproveLoggedClasses).toBe(false)
  })

  it('admins keep full access', async () => {
    await teacherConfirmed(mine._id, student._id)
    await teacherConfirmed(other._id, otherStudent._id)
    const res = await as(adminToken).get('/parent-checks')
    expect(res.status).toBe(200)
    expect(res.body.checks).toHaveLength(2)
  })
})

describe('sub-admin pages — only their own teachers', () => {
  it('parent checks: lists and links only their teachers\' classes', async () => {
    await grant({ canManageParentChecks: true })
    const own = await teacherConfirmed(mine._id, student._id)
    const foreign = await teacherConfirmed(other._id, otherStudent._id)
    const list = await as(subToken).get('/parent-checks')
    expect(list.status).toBe(200)
    expect(list.body.checks.map(c => String(c._id))).toEqual([String(own._id)])
    expect(list.body.counts.waiting).toBe(1)
    expect((await as(subToken).post(`/parent-checks/${own._id}/link`)).status).toBe(200)
    expect((await as(subToken).post(`/parent-checks/${foreign._id}/link`)).status).toBe(404)
  })

  it('logged classes: viewing does not allow approving (it pays the teacher)', async () => {
    await grant({ canViewLoggedClasses: true })
    const own = await logged(mine._id, student._id)
    await logged(other._id, otherStudent._id)
    const list = await as(subToken).get('/offline-classes')
    expect(list.status).toBe(200)
    expect(list.body.classes).toHaveLength(1)
    expect((await as(subToken).post(`/offline-classes/${own._id}/approve`)).status).toBe(403)
    expect((await as(subToken).post(`/offline-classes/${own._id}/reject`, { reason: 'no' })).status).toBe(403)
  })

  it('logged classes: with the approve permission, only their own teachers\' classes', async () => {
    await grant({ canViewLoggedClasses: true, canApproveLoggedClasses: true })
    const own = await logged(mine._id, student._id)
    const foreign = await logged(other._id, otherStudent._id)
    expect((await as(subToken).post(`/offline-classes/${foreign._id}/approve`)).status).toBe(404)
    expect((await as(subToken).post(`/offline-classes/${foreign._id}/reject`, { reason: 'no' })).status).toBe(400)
    const res = await as(subToken).post(`/offline-classes/${own._id}/approve`)
    expect(res.status).toBe(200)
    const after = await Booking.findById(own._id).lean()
    expect(after.status).toBe('completed')
    expect(after.offline.approval.decidedByRole).toBe('sub-admin')
    expect((await Booking.findById(foreign._id).lean()).status).toBe('pending_confirmation')
  })

  it('group classes: list, create and enroll within scope only', async () => {
    await grant({ canManageGroupClasses: true })
    await GroupClass.create({ teacherId: other._id, title: 'Foreign', scheduledTime: new Date(Date.now() + 86400000) })
    const ok = await as(subToken).post('/group-classes', { teacherId: String(mine._id), title: 'Mine', scheduledTime: new Date(Date.now() + 86400000) })
    expect(ok.status).toBe(201)
    expect((await as(subToken).post('/group-classes', { teacherId: String(other._id), title: 'No', scheduledTime: new Date(Date.now() + 86400000) })).status).toBe(404)
    const list = await as(subToken).get('/group-classes')
    expect(list.body.classes.map(c => c.title)).toEqual(['Mine'])
    const id = ok.body.groupClass._id
    await Student.updateOne({ _id: student._id }, { groupPoints: 5 }) // new group classes cost group points
    expect((await as(subToken).post(`/group-classes/${id}/enroll`, { studentId: String(otherStudent._id) })).status).toBe(404)
    expect((await as(subToken).post(`/group-classes/${id}/enroll`, { studentId: String(student._id) })).status).toBe(200)
  })

  it('bookings: requests go out only for their own teachers and students', async () => {
    await grant({ canCreateBookings: true })
    const when = new Date(Date.now() + 86400000)
    const ok = await as(subToken).post('/bookings', { teacherId: String(mine._id), studentId: String(student._id), classTitle: 'Speaking', scheduledTime: when })
    expect(ok.status).toBe(201)
    const b = await Booking.findById(ok.body.booking._id).lean()
    expect(b.status).toBe('pending')
    expect(b.createdByUserModel).toBe('SubAdmin')
    expect((await as(subToken).post('/bookings', { teacherId: String(other._id), studentId: String(student._id), classTitle: 'x', scheduledTime: when })).status).toBe(404)
    expect((await as(subToken).post('/bookings', { teacherId: String(mine._id), studentId: String(otherStudent._id), classTitle: 'x', scheduledTime: when })).status).toBe(404)
  })

  it('class report: only their own teachers', async () => {
    await grant({ canViewClassReport: true })
    const today = new Date().toISOString().slice(0, 10)
    const at = new Date(); at.setUTCHours(Math.max(0, at.getUTCHours() - 2))
    await Booking.create({ teacherId: mine._id, studentId: student._id, classTitle: 'A', scheduledTime: at, duration: 30, status: 'completed' })
    await Booking.create({ teacherId: other._id, studentId: otherStudent._id, classTitle: 'B', scheduledTime: at, duration: 30, status: 'completed' })
    const full = await as(adminToken).get(`/class-report?date=${today}`)
    const scoped = await as(subToken).get(`/class-report?date=${today}`)
    expect(scoped.status).toBe(200)
    const teachers = (r) => [...r.body.data.completed, ...r.body.data.notCompleted].map(g => String(g.teacherId))
    expect(new Set(teachers(full))).toEqual(new Set([String(mine._id), String(other._id)]))
    expect(teachers(scoped)).toEqual([String(mine._id)])
  })

  it('parent links: only their own teachers\' links', async () => {
    await grant({ canViewParentLinks: true })
    const res = await as(subToken).get('/share-links?kind=homework&view=all')
    expect(res.status).toBe(200)
    expect(res.body.items.every(i => !i.teacher || i.teacher.name !== 'Other Teacher')).toBe(true)
  })
})
