// After-class emails to families: the center switch sets every managed student, one
// student can then be switched back on; class summaries are emailed once (automatic)
// or on demand ("Email to family"); admins see every summary.
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
const videoMails = [], summaryMails = []
vi.mock('../emails/recordingEmails.js', () => ({ sendRecordingLinkEmail: vi.fn(async (a) => { videoMails.push(a) }) }))
vi.mock('../emails/summaryEmails.js', () => ({ sendClassSummaryEmail: vi.fn(async (a) => { summaryMails.push(a) }) }))
vi.mock('../models/master/Center.js', () => ({ default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }))

const { default: linkRouter } = await import('../routes/recordingLinkRoutes.js')
const { default: summaryRouter } = await import('../routes/classSummaryRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { recordingSchema } = await import('../schemas/recordingSchema.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const links = await import('../utils/recordingLinks.js')
const summaries = await import('../utils/classSummaryEmails.js')

const app = express()
app.use(express.json())
app.use('/api/recording-links', linkRouter)
app.use('/api/class-summaries', summaryRouter)

let db, Recording, Booking, Student, teacher, teacherToken, adminToken, otherTeacherToken
const sign = (c) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...c }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (tok, r) => r.set('Authorization', `Bearer ${tok}`)
const setSwitch = (body) => as(adminToken, request(app).put('/api/recording-links/settings')).send(body)

// Two managed families with addresses, one class each (recorded + summary written 20 min ago)
let kids
const makeKid = async (name, email) => {
  const s = await Student.collection.insertOne({ firstName: name, lastName: 'Fam', email: `${name}-${Date.now()}@managed.test`,
    isManaged: true, notifyEmail: email, active: true })
  const b = await Booking.collection.insertOne({ teacherId: teacher._id, studentId: s.insertedId, classTitle: `Class ${name}`,
    scheduledTime: new Date(Date.now() - 3 * 3600e3 - Math.random() * 1e6), duration: 60, status: 'completed',
    classSummary: { text: `${name} practised vowels.`, updatedAt: new Date(Date.now() - 20 * 60e3) } })
  const r = await Recording.create({ bookingId: b.insertedId, teacherId: teacher._id, studentId: s.insertedId,
    filename: 'x.webm', autoDeleteAt: new Date(Date.now() + 30 * 86400e3) })
  await Recording.collection.updateOne({ _id: r._id }, { $set: { createdAt: new Date(Date.now() - 20 * 60e3) } })
  return { id: s.insertedId, bookingId: b.insertedId }
}

beforeAll(async () => {
  db = global.__TEST_DB__
  Recording = db.models.Recording || db.model('Recording', recordingSchema)
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Student = db.models.Student
  await summaries.getSummaryEmail(db).syncIndexes()
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
  otherTeacherToken = sign({ id: String(new mongoose.Types.ObjectId()), role: 'teacher' })
})

beforeEach(async () => {
  videoMails.length = 0; summaryMails.length = 0
  await Promise.all([
    links.getRecordingLink(db).deleteMany({}), links.getCenterSettings(db).deleteMany({}),
    summaries.getSummaryEmail(db).deleteMany({}), Recording.deleteMany({}), Booking.deleteMany({}),
  ])
  await Student.collection.deleteMany({ email: /@managed\.test$/ })
  kids = { an: await makeKid('An', 'an@example.com'), bao: await makeKid('Bao', 'bao@example.com') }
})

describe('center switch + per-student switch', () => {
  it('turning the center switch off turns every family off; one can be turned back on', async () => {
    const off = await setSwitch({ recordingLinkEmails: false })
    expect(off.status).toBe(200)
    expect(off.body.data).toMatchObject({ recordingLinkEmails: false, counts: { recordingLinkEmails: { on: 0 } } })
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(0)

    // Admin turns An back on (Students → Notifications & reminders)
    await Student.updateOne({ _id: kids.an.id }, { $set: { recordingLinkEmails: true } })
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(1)
    expect(videoMails[0].to).toBe('an@example.com')
  })

  it('turning it back on turns everyone on again', async () => {
    await setSwitch({ classSummaryEmails: false })
    const on = await setSwitch({ classSummaryEmails: true })
    expect(on.body.data.counts.classSummaryEmails.on).toBeGreaterThanOrEqual(2)
    expect((await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })).sent).toBe(2)
  })

  it('the two switches are separate', async () => {
    await setSwitch({ classSummaryEmails: false })
    expect((await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })).sent).toBe(0)
    expect((await links.sweepRecordingEmails(db, { slug: 'testcenter' })).sent).toBe(2)
  })
})

describe('class summary emails', () => {
  it('emails each summary once, after the teacher has stopped editing', async () => {
    expect((await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })).sent).toBe(2)
    expect(summaryMails.map((m) => m.to).sort()).toEqual(['an@example.com', 'bao@example.com'])
    expect(summaryMails.find((m) => m.to === 'an@example.com').cls.text).toBe('An practised vowels.')
    expect((await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })).sent).toBe(0)

    // A summary written a minute ago waits
    await Booking.updateMany({}, { $set: { 'classSummary.updatedAt': new Date() } })
    await summaries.getSummaryEmail(db).deleteMany({})
    expect((await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })).sent).toBe(0)
  })

  it('"Email to family" sends now (teacher of the class or admin only)', async () => {
    const r = await as(teacherToken, request(app).post(`/api/class-summaries/${kids.an.bookingId}/email`))
    expect(r.status).toBe(200)
    expect(r.body.sent).toBe(1)
    expect(summaryMails).toHaveLength(1)
    expect((await as(otherTeacherToken, request(app).post(`/api/class-summaries/${kids.an.bookingId}/email`))).status).toBe(404)
    expect((await as(adminToken, request(app).post(`/api/class-summaries/${kids.an.bookingId}/email`))).status).toBe(200)

    // The teacher's list shows it was emailed
    const list = await as(teacherToken, request(app).get('/api/class-summaries/teacher?view=written'))
    const row = list.body.classes.find((c) => c.title === 'Class An')
    expect(row.students[0]).toMatchObject({ hasEmail: true, emailedManual: true })
    expect(row.students[0].emailedAt).toBeTruthy()
  })

  it('explains when the family has no address', async () => {
    await Student.updateOne({ _id: kids.an.id }, { $set: { notifyEmail: '' } })
    const r = await as(teacherToken, request(app).post(`/api/class-summaries/${kids.an.bookingId}/email`))
    expect(r.status).toBe(400)
    expect(r.body.message).toMatch(/No family email/)
  })
})

describe('admin class summaries list', () => {
  it('lists every written summary with each family and email status (admin only)', async () => {
    await summaries.sweepSummaryEmails(db, { slug: 'testcenter' })
    const r = await as(adminToken, request(app).get('/api/class-summaries/admin'))
    expect(r.status).toBe(200)
    expect(r.body.pagination.total).toBe(2)
    const an = r.body.summaries.find((x) => x.title === 'Class An')
    expect(an).toMatchObject({ summary: 'An practised vowels.' })
    expect(an.students[0]).toMatchObject({ name: 'An Fam', email: 'an@example.com' })
    expect(an.students[0].emailedAt).toBeTruthy()

    const search = await as(adminToken, request(app).get('/api/class-summaries/admin?q=bao'))
    expect(search.body.summaries.map((x) => x.title)).toEqual(['Class Bao'])
    expect((await as(teacherToken, request(app).get('/api/class-summaries/admin'))).status).toBe(403)
  })
})
