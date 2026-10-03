// Regression tests for role allow-lists and per-center class access.
// Parent and sub-admin tokens are signed with the same center key as everyone
// else, so they pass verifyToken — each route must allow-list the roles it serves.
import { vi, describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

// Agora reads its credentials when agoraRoutes.js loads
process.env.AGORA_APP_ID          = 'a'.repeat(32)
process.env.AGORA_APP_CERTIFICATE = 'b'.repeat(32)

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: recordingRouter }   = await import('../routes/recordingRoutes.js')
const { default: studentRouter }     = await import('../routes/studentRoutes.js')
const { default: bookingRouter }     = await import('../routes/bookingRoutes.js')
const { default: certificateRouter } = await import('../routes/certificateRoutes.js')
const { default: groupClassRouter }  = await import('../routes/groupClassRoutes.js')
const { default: agoraRouter }       = await import('../routes/agoraRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret }     = await import('../utils/jwtUtils.js')
const { tenantChannel }       = await import('../utils/classAccess.js')
const { recordingSchema }     = await import('../schemas/recordingSchema.js')
const { bookingSchema }       = await import('../schemas/bookingSchema.js')
const { groupClassSchema }    = await import('../schemas/groupClassSchema.js')

const app = express()
app.use(express.json())
app.use('/api/recordings', recordingRouter)
app.use('/api/students', studentRouter)
app.use('/api/bookings', bookingRouter)
app.use('/api/certificates', certificateRouter)
app.use('/api/group-classes', groupClassRouter)
app.use('/api/agora', agoraRouter)

const auth = (role, id, extra = {}) => `Bearer ${jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter', ...extra },
  getCenterSecret('testcenter'),
  { expiresIn: '5m' },
)}`

let db, teacher, student, otherTeacherId, parentId, subAdminId, adminId, booking, recording, groupClass

beforeAll(async () => {
  db = global.__TEST_DB__
  const Recording  = db.models.Recording  || db.model('Recording',  recordingSchema)
  const Booking    = db.models.Booking    || db.model('Booking',    bookingSchema)
  const GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  adminId = (await db.models.Admin.findOne({ username: CREDENTIALS.admin.username }))._id
  otherTeacherId = new mongoose.Types.ObjectId()
  parentId       = new mongoose.Types.ObjectId()
  subAdminId     = new mongoose.Types.ObjectId()

  booking = await Booking.create({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Access test',
    scheduledTime: new Date(), duration: 60, status: 'accepted',
  })
  recording = await Recording.create({
    bookingId: booking._id, teacherId: teacher._id, studentId: student._id,
    source: 'external', externalUrl: 'https://example.com/rec', visibleToStudent: false,
  })
  groupClass = await GroupClass.create({
    teacherId: teacher._id, title: 'Group test', scheduledTime: new Date(), maxSeats: 5,
    enrollments: [{ studentId: student._id, creditCharged: 1 }],
  })
})

describe('parent and sub-admin tokens are not treated as staff', () => {
  it('parent cannot delete a recording', async () => {
    const res = await request(app).delete(`/api/recordings/${recording._id}`).set('Authorization', auth('parent', parentId))
    expect(res.status).toBe(403)
    expect(await db.models.Recording.exists({ _id: recording._id })).toBeTruthy()
  })

  it('parent and sub-admin cannot stream a recording', async () => {
    for (const [role, id] of [['parent', parentId], ['sub-admin', subAdminId]]) {
      const res = await request(app).get(`/api/recordings/${recording._id}/stream`).set('Authorization', auth(role, id))
      expect(res.status).toBe(403)
    }
  })

  it('student cannot stream a recording the teacher has not shared', async () => {
    const res = await request(app).get(`/api/recordings/${recording._id}/stream`).set('Authorization', auth('student', student._id))
    expect(res.status).toBe(403)
  })

  it('owning teacher can still stream their recording', async () => {
    const res = await request(app).get(`/api/recordings/${recording._id}/stream`).set('Authorization', auth('teacher', teacher._id))
    expect(res.status).toBe(200)
    expect(res.body.url).toBe('https://example.com/rec')
  })

  it("parent and teacher cannot read a student's payment history; the student can", async () => {
    for (const [role, id] of [['parent', parentId], ['teacher', teacher._id]]) {
      const res = await request(app).get(`/api/students/${student._id}/payments`).set('Authorization', auth(role, id))
      expect(res.status).toBe(403)
    }
    const self = await request(app).get(`/api/students/${student._id}/payments`).set('Authorization', auth('student', student._id))
    expect(self.status).toBe(200)
  })

  it('parent cannot read a student profile or change their timezone', async () => {
    const get = await request(app).get(`/api/students/${student._id}`).set('Authorization', auth('parent', parentId))
    expect(get.status).toBe(403)
    const tz = await request(app).patch(`/api/students/${student._id}/timezone`)
      .set('Authorization', auth('parent', parentId)).send({ timezone: 'Asia/Tokyo' })
    expect(tz.status).toBe(403)
  })

  it('parent cannot list teacher/student bookings, certificates or group classes', async () => {
    const urls = [
      `/api/bookings/teacher/${teacher._id}`,
      `/api/bookings/student/${student._id}`,
      '/api/certificates',
      '/api/group-classes',
    ]
    for (const url of urls) {
      const res = await request(app).get(url).set('Authorization', auth('parent', parentId))
      expect(res.status, url).toBe(403)
    }
  })

  it("a teacher cannot remove students from another teacher's group class", async () => {
    const res = await request(app).delete(`/api/group-classes/${groupClass._id}/enroll/${student._id}`)
      .set('Authorization', auth('teacher', otherTeacherId))
    expect(res.status).toBe(403)
    const gc = await db.models.GroupClass.findById(groupClass._id)
    expect(gc.enrollments).toHaveLength(1)
  })
})

describe('student search (ReDoS)', () => {
  it('treats the search text literally and answers quickly', async () => {
    const started = Date.now()
    const evil = await request(app).get('/api/group-classes/students/search')
      .query({ q: '(a+)+$' + 'a'.repeat(40) + '!' })
      .set('Authorization', auth('teacher', teacher._id))
    expect(evil.status).toBe(200)
    expect(evil.body.students).toEqual([])
    expect(Date.now() - started).toBeLessThan(2000)

    // Normal searches still work, including names with regex characters
    const ok = await request(app).get('/api/group-classes/students/search')
      .query({ q: student.firstName })
      .set('Authorization', auth('teacher', teacher._id))
    expect(ok.body.students.map(s => String(s._id))).toContain(String(student._id))
  })
})

describe('Agora tokens are scoped to the center', () => {
  it('admin cannot get a token for a class that is not in this center', async () => {
    const foreignId = new mongoose.Types.ObjectId()
    const res = await request(app).get(`/api/agora/token?channel=class-${foreignId}`).set('Authorization', auth('admin', adminId))
    expect(res.status).toBe(403)
  })

  it('token is issued for the center-scoped channel name', async () => {
    const res = await request(app).get(`/api/agora/token?channel=class-${booking._id}`).set('Authorization', auth('teacher', teacher._id))
    expect(res.status).toBe(200)
    expect(res.body.channel).toBe(tenantChannel('testcenter', `class-${booking._id}`))
    expect(res.body.channel).not.toBe(`class-${booking._id}`)
    expect(res.body.channel.length).toBeLessThanOrEqual(64)
    expect(tenantChannel('othercenter', `class-${booking._id}`)).not.toBe(res.body.channel)
  })
})
