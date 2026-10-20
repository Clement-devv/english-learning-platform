// Parent links to class recordings: staff create / switch off / email links, the family
// confirms names and plays the parts, and the sweep emails each class once.
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import fs from 'fs'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))
// No real email — record what would be sent
const sent = []
vi.mock('../emails/recordingEmails.js', () => ({
  sendRecordingLinkEmail: vi.fn(async (args) => { sent.push(args) }),
}))
// The test runs without the master DB — the sweep only needs a center object
vi.mock('../models/master/Center.js', () => ({ default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }))

const { default: linkRouter } = await import('../routes/recordingLinkRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { recordingSchema } = await import('../schemas/recordingSchema.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const links = await import('../utils/recordingLinks.js')

const app = express()
app.use(express.json())
app.use('/api/recording-links', linkRouter)

let db, Recording, Booking, Student, teacher, admin, student, booking, rec, teacherToken, adminToken, otherTeacherToken
const DAY = 86400000
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...claims }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (tok, r) => r.set('Authorization', `Bearer ${tok}`)
const FILE = `test_rec_${Date.now()}.webm`

beforeAll(async () => {
  db = global.__TEST_DB__
  Recording = db.models.Recording || db.model('Recording', recordingSchema)
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Student = db.models.Student
  await links.getRecordingLink(db).syncIndexes()
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  await db.models.Teacher.updateOne({ _id: teacher._id }, { firstName: 'Anna', lastName: 'Smith' })
  admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
  otherTeacherToken = sign({ id: String(new mongoose.Types.ObjectId()), role: 'teacher' })
  // Local-disk storage (no S3 in tests): a tiny file to stream
  fs.mkdirSync(links.RECORDINGS_DIR, { recursive: true })
  fs.writeFileSync(links.localRecordingPath(FILE), Buffer.from('0123456789'))
})
afterAll(() => { try { fs.unlinkSync(links.localRecordingPath(FILE)) } catch { /* gone */ } })

beforeEach(async () => {
  sent.length = 0
  await Promise.all([
    links.getRecordingLink(db).deleteMany({}), links.getCenterSettings(db).deleteMany({}),
    Recording.deleteMany({}), Booking.deleteMany({}),
  ])
  await Student.collection.deleteMany({ email: /@managed\.test$/ })
  const s = await Student.collection.insertOne({
    firstName: 'Minh', lastName: 'Tran', email: `minh-${Date.now()}@managed.test`, isManaged: true,
    notifyEmail: 'parent@example.com', emailLanguage: 'vi', active: true,
  })
  student = { _id: s.insertedId }
  const b = await Booking.collection.insertOne({
    teacherId: teacher._id, studentId: student._id, classTitle: 'Phonics 1',
    scheduledTime: new Date(Date.now() - 2 * 3600000), duration: 60, status: 'completed',
  })
  booking = { _id: b.insertedId }
  rec = await Recording.create({
    bookingId: booking._id, teacherId: teacher._id, studentId: student._id, filename: FILE, mimeType: 'video/webm',
    autoDeleteAt: new Date(Date.now() + 30 * DAY), sessionId: 'sess_abcdefgh', partNumber: 1,
  })
  await Recording.collection.updateOne({ _id: rec._id }, { $set: { createdAt: new Date(Date.now() - 20 * 60000) } })
})

const createLink = async () => {
  const res = await as(teacherToken, request(app).post('/api/recording-links/class')).send({ bookingId: String(booking._id), studentId: String(student._id) })
  expect(res.status).toBe(200)
  return res.body.data.students[0].link
}
const unlock = (token, studentName = 'Minh', teacherName = 'Teacher Anna') =>
  request(app).post(`/api/recording-links/link/${token}/unlock`).send({ studentName, teacherName })

describe('staff', () => {
  it('lists the class, creates a link, and hides the address from teachers', async () => {
    const list = await as(teacherToken, request(app).get(`/api/recording-links/class?bookingId=${booking._id}`))
    expect(list.status).toBe(200)
    expect(list.body.data.students[0]).toMatchObject({ studentName: 'Minh Tran', isManaged: true, hasEmail: true, link: null })
    expect(list.body.data.students[0].email).toBeUndefined()
    expect(list.body.data.autoEmail).toBe(true)

    const link = await createLink()
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(link.enabled).toBe(true)
    // Same link the second time
    expect((await createLink()).token).toBe(link.token)

    const adminView = await as(adminToken, request(app).get(`/api/recording-links/class?bookingId=${booking._id}`))
    expect(adminView.body.data.students[0].email).toBe('parent@example.com')
  })

  it("won't let another teacher see or make links for the class", async () => {
    const res = await as(otherTeacherToken, request(app).get(`/api/recording-links/class?bookingId=${booking._id}`))
    expect(res.status).toBe(404)
  })
})

describe('family page', () => {
  it('needs the right names, then lists the parts and streams them', async () => {
    const { token } = await createLink()
    expect((await unlock(token, 'Wrong', 'Anna')).status).toBe(400)
    const ok = await unlock(token)
    expect(ok.status).toBe(200)
    expect(ok.body.video).toMatchObject({ studentName: 'Minh', teacherName: 'Anna Smith', classTitle: 'Phonics 1' })
    expect(ok.body.video.videos).toHaveLength(1)
    const v = ok.body.video.videos[0]
    expect(v).toMatchObject({ local: true, external: false, part: 1, parts: 1 })
    expect(v.url).toContain('&c=testcenter') // <video> can't send the center header

    // Page reload with the access token
    const again = await request(app).get(`/api/recording-links/link/${token}`).set('x-share-access', ok.body.accessToken)
    expect(again.status).toBe(200)
    expect((await request(app).get(`/api/recording-links/link/${token}`)).status).toBe(403)

    // The local stream (S3 would hand out a presigned URL instead)
    const stream = await request(app).get(`/api${v.url}`).set('Range', 'bytes=0-3')
    expect(stream.status).toBe(206)
    expect(stream.headers['content-range']).toBe('bytes 0-3/10')
    expect((await request(app).get(`/api/recording-links/link/${token}/stream/${v.id}?a=bad`)).status).toBe(403)
  })

  it('stops working when switched off, and when the videos are deleted', async () => {
    const link = await createLink()
    const off = await as(teacherToken, request(app).patch(`/api/recording-links/${link.id}`)).send({ enabled: false })
    expect(off.status).toBe(200)
    expect((await unlock(link.token)).status).toBe(410)

    await as(teacherToken, request(app).patch(`/api/recording-links/${link.id}`)).send({ enabled: true })
    expect((await unlock(link.token)).status).toBe(200)

    await Recording.updateMany({}, { $set: { autoDeleteAt: new Date(Date.now() - 1000) } })
    expect((await unlock(link.token)).status).toBe(410)
  })

  it('rejects a made-up token', async () => {
    expect((await unlock('a'.repeat(43))).status).toBe(404)
  })
})

describe('automatic email', () => {
  it('emails each recorded class once to the managed student', async () => {
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(1)
    expect(sent[0]).toMatchObject({ to: 'parent@example.com', teacherName: 'Anna Smith', cls: { title: 'Phonics 1' } })
    expect(sent[0].url).toMatch(/\/rv\/[A-Za-z0-9_-]{43}$/)
    expect(sent[0].student.emailLanguage).toBe('vi')
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)
  })

  it('waits until the upload has been quiet for 15 minutes', async () => {
    await Recording.collection.updateMany({}, { $set: { createdAt: new Date() } })
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)
  })

  it('sends nothing when the center switches it off', async () => {
    const res = await as(adminToken, request(app).put('/api/recording-links/settings')).send({ recordingLinkEmails: false })
    expect(res.status).toBe(200)
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)
  })

  it('skips switched-off links and students without an address', async () => {
    const link = await createLink()
    await as(teacherToken, request(app).patch(`/api/recording-links/${link.id}`)).send({ enabled: false })
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)
    await links.getRecordingLink(db).deleteMany({})
    await Student.collection.updateOne({ _id: student._id }, { $set: { notifyEmail: '' } })
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)
  })

  it('"Email now" sends again on request', async () => {
    const link = await createLink()
    const res = await as(teacherToken, request(app).post(`/api/recording-links/${link.id}/email`))
    expect(res.status).toBe(200)
    expect(sent).toHaveLength(1)
    expect(res.body.data.students[0].link.emailedAt).toBeTruthy()
  })
})
