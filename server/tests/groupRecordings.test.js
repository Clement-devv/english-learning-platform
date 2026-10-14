// Group class recordings: the class's teacher can upload (or save a Meet / Zoom
// link); students enrolled in that class can see and play it once the teacher
// shares it; nobody else can. One-to-one recordings keep working as before.
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: recordingRoutes } = await import('../routes/recordingRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { recordingSchema } = await import('../schemas/recordingSchema.js')

const app = express()
app.use(express.json())
app.use('/recordings', recordingRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (token) => ({
  get:   (u) => request(app).get(u).set('Authorization', `Bearer ${token}`),
  post:  (u, b = {}) => request(app).post(u).set('Authorization', `Bearer ${token}`).send(b),
  patch: (u, b = {}) => request(app).patch(u).set('Authorization', `Bearer ${token}`).send(b),
  upload: (fields) => {
    let r = request(app).post('/recordings/upload').set('Authorization', `Bearer ${token}`)
      .attach('recording', Buffer.from('fake webm bytes'), { filename: 'part.webm', contentType: 'video/webm' })
    for (const [k, v] of Object.entries(fields)) r = r.field(k, String(v))
    return r
  },
})

const RECORDINGS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../uploads/recordings')
const created = []
let gc, teacherApi, otherTeacherApi, studentApi, outsiderApi, Recording

beforeAll(async () => {
  const db = global.__TEST_DB__
  const GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  Recording = db.models.Recording || db.model('Recording', recordingSchema)
  const teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  const otherTeacher = await db.models.Teacher.create({ email: `rec-t-${Date.now()}@test.com`, firstName: 'O', lastName: 'T', password: 'x', active: true, status: 'active', continent: 'Africa' })
  const outsider = await db.models.Student.create({ email: `rec-s-${Date.now()}@test.com`, firstName: 'Not', lastName: 'In', password: 'x', active: true })
  gc = await GroupClass.create({ teacherId: teacher._id, title: 'Conversation club', scheduledTime: new Date(), status: 'completed',
    paymentType: 'points', enrollments: [{ studentId: student._id, pointsCharged: 1, attendance: 'attended' }] })
  teacherApi = as(sign(teacher._id, 'teacher'))
  otherTeacherApi = as(sign(otherTeacher._id, 'teacher'))
  studentApi = as(sign(student._id, 'student'))
  outsiderApi = as(sign(outsider._id, 'student'))
})

afterAll(async () => {
  for (const r of await Recording.find({ _id: { $in: created } }).lean()) {
    if (r.filename) fs.rmSync(path.join(RECORDINGS_DIR, r.filename), { force: true })
  }
})

describe('group class recordings', () => {
  it('only the class\'s teacher can upload a part', async () => {
    expect((await otherTeacherApi.upload({ groupClassId: gc._id, duration: 30, sessionId: 'session-group-1', partNumber: 1 })).status).toBe(403)
    expect((await studentApi.upload({ groupClassId: gc._id, duration: 30 })).status).toBe(403)
    const res = await teacherApi.upload({ groupClassId: gc._id, duration: 30, sessionId: 'session-group-1', partNumber: 1 })
    expect(res.status).toBe(201)
    created.push(res.body.recording._id)
    expect(String(res.body.recording.groupClassId)).toBe(String(gc._id))
    expect(res.body.recording.bookingId).toBeUndefined()
  })

  it('enrolled students see and play it only once shared; others never', async () => {
    const rec = await Recording.findOne({ groupClassId: gc._id })
    expect((await studentApi.get('/recordings')).body.recordings.map(r => String(r._id))).not.toContain(String(rec._id))
    expect((await studentApi.get(`/recordings/${rec._id}/stream`)).status).toBe(403)

    // the class-wide show/hide accepts the group class id
    const shared = await teacherApi.patch(`/recordings/booking/${gc._id}/visibility`, { visibleToStudent: true })
    expect(shared.status).toBe(200)

    const mine = await studentApi.get('/recordings')
    expect(mine.body.recordings.map(r => String(r._id))).toContain(String(rec._id))
    expect(mine.body.recordings.find(r => String(r._id) === String(rec._id)).groupClassId.title).toBe('Conversation club')
    expect((await studentApi.get(`/recordings/${rec._id}/stream`)).status).toBe(200)

    expect((await outsiderApi.get('/recordings')).body.recordings.map(r => String(r._id))).not.toContain(String(rec._id))
    expect((await outsiderApi.get(`/recordings/${rec._id}/stream`)).status).toBe(403)
  })

  it('teachers see group recordings under "Group classes"', async () => {
    const res = await teacherApi.get('/recordings/students')
    expect(res.body.students.find(s => s.id === '__group__')).toMatchObject({ name: 'Group classes', count: 1 })
    const list = await teacherApi.get('/recordings?page=1&studentId=__group__')
    expect(list.body.recordings.every(r => r.groupClassId)).toBe(true)
  })

  it('a Meet / Zoom recording link can be saved for the group class', async () => {
    expect((await otherTeacherApi.post('/recordings/external', { groupClassId: gc._id, url: 'https://zoom.us/rec/abc' })).status).toBe(404)
    const res = await teacherApi.post('/recordings/external', { groupClassId: gc._id, url: 'https://zoom.us/rec/abc' })
    expect(res.status).toBe(201)
    created.push(res.body.recording._id)
    expect(res.body.recording).toMatchObject({ source: 'external', externalUrl: 'https://zoom.us/rec/abc' })
    expect(res.body.recording.groupClassId.title).toBe('Conversation club')
  })
})
