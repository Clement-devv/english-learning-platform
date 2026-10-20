// Parent-check and homework / quiz links emailed to managed students' families:
// automatic (once, following the switches) and "Email to family" (admin, any time).
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
const checkMails = [], linkMails = []
vi.mock('../emails/familyLinkEmails.js', () => ({
  sendParentCheckLinkEmail: vi.fn(async (a) => { checkMails.push(a) }),
  sendShareLinkEmail: vi.fn(async (a) => { linkMails.push(a) }),
}))
vi.mock('../models/master/Center.js', () => ({ default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }))

const { default: parentCheckRouter } = await import('../routes/parentCheckRoutes.js')
const { default: shareLinkRouter } = await import('../routes/shareLinkAdminRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { homeworkSchema } = await import('../schemas/homeworkSchema.js')
const { issueShareLink } = await import('../utils/shareLink.js')
const fam = await import('../utils/familyLinkEmails.js')
const prefs = await import('../utils/familyEmailPrefs.js')

const app = express()
app.use(express.json())
app.use('/api/parent-checks', parentCheckRouter)
app.use('/api/share-links', shareLinkRouter)

let db, Booking, Homework, Student, teacher, adminToken, kid
const sign = (c) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...c }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`)
const center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }

const waitingCheck = async () => {
  const b = new Booking({ teacherId: teacher._id, studentId: kid, classTitle: 'Phonics', scheduledTime: new Date(Date.now() - 2 * 3600e3),
    duration: 60, status: 'completed', attendanceConfirmedBy: 'teacher', parentCheck: { status: 'waiting' } })
  issueShareLink(b)
  await b.save({ validateBeforeSave: false })
  return b
}
const homeworkLink = async () => {
  const hw = new Homework({ teacherId: teacher._id, studentId: kid, title: 'Read p.4', description: '', dueDate: new Date(Date.now() + 3 * 86400e3) })
  issueShareLink(hw)
  await hw.save({ validateBeforeSave: false })
  return hw
}

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Homework = db.models.Homework || db.model('Homework', homeworkSchema)
  Student = db.models.Student
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
})

beforeEach(async () => {
  checkMails.length = 0; linkMails.length = 0
  await Promise.all([Booking.deleteMany({}), Homework.deleteMany({}), prefs.getCenterSettings(db).deleteMany({})])
  await Student.collection.deleteMany({ email: /@managed\.test$/ })
  kid = (await Student.collection.insertOne({ firstName: 'Lan', lastName: 'Vu', email: `lan-${Date.now()}@managed.test`,
    isManaged: true, notifyEmail: 'lan.parent@example.com', active: true })).insertedId
})

describe('parent check emails', () => {
  it('emails a waiting check once, with the /ac/ link', async () => {
    await waitingCheck()
    expect((await fam.sweepParentCheckEmails(db, center)).sent).toBe(1)
    expect(checkMails[0]).toMatchObject({ to: 'lan.parent@example.com', cls: { title: 'Phonics' } })
    expect(checkMails[0].url).toMatch(/\/ac\/[A-Za-z0-9_-]{43}$/)
    expect((await fam.sweepParentCheckEmails(db, center)).sent).toBe(0)
  })

  it('follows the switch (center off = everyone off; one student back on)', async () => {
    await waitingCheck()
    await prefs.setCenterPref(db, 'parentCheckEmails', false)
    expect((await fam.sweepParentCheckEmails(db, center)).sent).toBe(0)
    await Student.updateOne({ _id: kid }, { $set: { parentCheckEmails: true } })
    expect((await fam.sweepParentCheckEmails(db, center)).sent).toBe(1)
  })

  it('stops once the parent has answered', async () => {
    const b = await waitingCheck()
    await Booking.updateOne({ _id: b._id }, { $set: { 'parentCheck.status': 'confirmed' } })
    expect((await fam.sweepParentCheckEmails(db, center)).sent).toBe(0)
  })

  it('"Email to family" sends again even when the switch is off', async () => {
    const b = await waitingCheck()
    await fam.sweepParentCheckEmails(db, center)
    await prefs.setCenterPref(db, 'parentCheckEmails', false)
    const res = await asAdmin(request(app).post(`/api/parent-checks/${b._id}/email`))
    expect(res.status).toBe(200)
    expect(checkMails).toHaveLength(2)
    const saved = await Booking.findById(b._id).lean()
    expect(saved.parentCheck.emailedManual).toBe(true)
  })
})

describe('homework / quiz link emails', () => {
  it('emails the link once (automatic), and again on request', async () => {
    const hw = await homeworkLink()
    expect(await fam.emailShareLink(db, center, 'homework', hw._id)).toBe('sent')
    expect(linkMails[0]).toMatchObject({ kind: 'homework', to: 'lan.parent@example.com', title: 'Read p.4' })
    expect(linkMails[0].url).toMatch(/\/hw\/[A-Za-z0-9_-]{43}$/)
    expect(await fam.emailShareLink(db, center, 'homework', hw._id)).toBe('already')

    const res = await asAdmin(request(app).post(`/api/share-links/homework/${hw._id}/email`))
    expect(res.status).toBe(200)
    expect(linkMails).toHaveLength(2)

    const list = await asAdmin(request(app).get('/api/share-links?kind=homework'))
    expect(list.body.items[0]).toMatchObject({ emailedManual: true, student: { hasEmail: true } })
    expect(list.body.items[0].emailedAt).toBeTruthy()
  })

  it("doesn't send automatically when the family switched it off, or has no address", async () => {
    const hw = await homeworkLink()
    await Student.updateOne({ _id: kid }, { $set: { shareLinkEmails: false } })
    expect(await fam.emailShareLink(db, center, 'homework', hw._id)).toBe('off')
    await Student.updateOne({ _id: kid }, { $set: { shareLinkEmails: true, notifyEmail: '' } })
    expect(await fam.emailShareLink(db, center, 'homework', hw._id)).toBe('no-email')
    expect(linkMails).toHaveLength(0)
  })
})
