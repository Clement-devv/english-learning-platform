import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'

const sent = vi.hoisted(() => [])
vi.mock('../emails/core.js', async orig => ({ ...await orig(), sendEmail: vi.fn(async data => { sent.push(data); return { success: true } }) }))
vi.mock('../utils/auditLog.js', () => ({ writeAuditLog: vi.fn(async () => {}) }))
vi.mock('../utils/familyLinkEmails.js', async orig => ({ ...await orig(), emailShareLinkLater: vi.fn() }))
vi.mock('../middleware/superAdminMiddleware.js', () => ({ verifySuperAdmin: (req, res, next) => {
  if (req.headers.authorization !== 'Bearer test-platform-owner') return res.status(403).json({ message: 'Forbidden' })
  req.superAdmin = { _id: new mongoose.Types.ObjectId('111111111111111111111111') }; next()
} }))
vi.mock('../middleware/rateLimiter.js', async orig => ({ ...await orig(),
  loginLimiter: (_q, _s, n) => n(), passwordResetLimiter: (_q, _s, n) => n(), strictLimiter: (_q, _s, n) => n(),
  trackFailedLogin: vi.fn(), clearFailedAttempts: vi.fn(), isAccountLocked: async () => ({ isLocked: false }),
}))
vi.mock('../models/master/TeacherWorkspace.js', async orig => {
  const real = await orig()
  return { default: new Proxy({}, { get: (_target, key) => (...args) => {
    const db = global.__TEST_DB__, M = db.models.TestTeacherWorkspace || db.model('TestTeacherWorkspace', real.default.schema)
    return M[key](...args)
  } }) }
})
vi.mock('../models/master/TeacherFamilyGrant.js', async orig => {
  const real = await orig()
  return { default: new Proxy({}, { get: (_target, key) => (...args) => {
    const db = global.__TEST_DB__, M = db.models.TestFamilyGrant || db.model('TestFamilyGrant', real.default.schema)
    return M[key](...args)
  } }) }
})
vi.mock('../config/dbManager.js', () => ({ getDb: async slug => global.__TEST_DB__.useDb(slug, { useCache: true }), closeAllConnections: async () => {} }))
const { default: routes } = await import('../routes/teacherModeRoutes.js')
const { default: homeworkRoutes } = await import('../routes/homeworkRoutes.js')
const { default: quizRoutes } = await import('../routes/quizRoutes.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const app = express(); app.use(express.json()); app.use('/api/v1/teacher-mode', routes); app.use('/api/v1/homework', homeworkRoutes); app.use('/api/v1/quiz', quizRoutes)
const root = '/api/v1/teacher-mode'
const admin = (method, url) => request(app)[method](root + url).set('Authorization', 'Bearer test-platform-owner')
let teacher, other, center, secondCenter, student, classId, familyUrl, access
async function invite(address) {
  expect((await admin('post', '/admin/workspaces').send({ name: 'Amara', email: address })).status).toBe(200)
  const raw = sent.at(-1).html.match(/teacher-mode\/setup\/([A-Za-z0-9_-]{43})/)[1]
  const setup = await request(app).post(`${root}/setup/${raw}`).send({ password: 'Teacher@56789', acceptTerms: true, continent: 'Africa', gender: 'Prefer not to say' })
  expect(setup.status).toBe(200)
  const login = await request(app).post(`${root}/login`).send({ email: address, password: 'Teacher@56789' })
  expect(login.status).toBe(200)
  expect(login.body.token).toBeTruthy()
  return { token: login.body.token, user: login.body.teacher || login.body.user, invite: raw }
}
const call = (who, method, url) => request(app)[method](root + '/app' + url).set('Authorization', `Bearer ${who.token}`)
beforeAll(async () => { teacher = await invite('solo1@test.com'); other = await invite('solo2@test.com') })
afterAll(async () => { for (const db of Object.values(global.__TEST_DB__?.relatedDbs || {})) await db.dropDatabase() })

describe('Teacher Mode boundaries and invitations', () => {
  it('separates both class outcomes by center for individual and group lessons', async () => {
    const teacherId = jwt.decode(teacher.token).id;
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true });
    const a = (await call(teacher, 'post', '/managed-centers').send({ name: 'History A', currency: 'USD', payBasis: 'class', rateMinor: 1000 })).body.data;
    const b = (await call(teacher, 'post', '/managed-centers').send({ name: 'History B', currency: 'USD', payBasis: 'hour', rateMinor: 3000 })).body.data;
    for (const c of [a,b]) for (const status of ['completed','missed']) {
      const base = { teacherId: new mongoose.Types.ObjectId(teacherId), managedCenterId: new mongoose.Types.ObjectId(c._id), scheduledTime: new Date('2026-01-05T10:00:00Z'), duration: 45, status };
      await db.collection('bookings').insertOne({ ...base, classTitle: 'Center history isolation' });
      await db.collection('groupclasses').insertOne({ ...base, title: 'Center history isolation group', enrollments: [] });
    }
    for (const c of [a,b]) for (const view of ['completed','not_completed']) {
      const r = await call(teacher, 'get', `/bookings/teacher/${teacherId}/history`).query({ managedCenterId: c._id, view, q: 'Center history isolation' });
      expect(r.status).toBe(200);
      expect(r.body.classes).toHaveLength(2);
      expect(r.body.classes.every(row => row.managedCenterId === c._id)).toBe(true);
      expect(r.body.classes.every(row => row.officiallyCompleted === (view === 'completed'))).toBe(true);
    }
  })
  it('protects date-filtered statements and returns a downloadable PDF', async () => {
    expect((await request(app).get(root + '/app/earnings/statement').query({ from: '2026-01-01', to: '2026-01-31' })).status).toBe(401)
    expect((await call(teacher, 'get', '/earnings/statement').query({ from: '2026-02-30', to: '2026-03-01' })).status).toBe(400)
    const response = await call(teacher, 'get', '/earnings/statement').query({ from: '2026-01-01', to: '2026-01-31' })
    expect(response.status).toBe(200)
    expect(response.body.data.entries).toEqual([])
    const pdf = await call(teacher, 'get', '/earnings/statement.pdf').query({ from: '2026-01-01', to: '2026-01-31' })
    expect(pdf.status).toBe(200)
    expect(pdf.headers['content-type']).toContain('application/pdf')
    expect(pdf.headers['cache-control']).toBe('private, no-store')
  })
  it('requires Super Admin to invite and consumes invitations once', async () => {
    expect((await request(app).post(root + '/admin/workspaces').send({ name: 'X', email: 'x@test.com' })).status).toBe(403)
    expect((await request(app).post(`${root}/setup/${teacher.invite}`).send({ password: 'Teacher@99999', acceptTerms: true, continent: 'Africa', gender: 'Prefer not to say' })).status).toBe(400)
    expect(jwt.decode(teacher.token).realm).toBe('teacher-mode')
  })
  it('grants Super Admin a short-lived read-only view of an active teacher workspace', async () => {
    const workspace = (await admin('get', '/admin/workspaces')).body.data.find(w => w.email === 'solo1@test.com')
    expect((await request(app).post(`${root}/admin/workspaces/${workspace._id}/view`)).status).toBe(403)
    const response = await admin('post', `/admin/workspaces/${workspace._id}/view`)
    expect(response.status).toBe(200)
    const claims = jwt.decode(response.body.data.token)
    expect(claims).toMatchObject({ teacherInspection: true, id: jwt.decode(teacher.token).id, realm: 'teacher-mode' })
    expect(claims.exp - claims.iat).toBe(600)
    const viewer = { token: response.body.data.token }
    expect((await call(viewer, 'get', '/workspace')).status).toBe(200)
    expect((await call(viewer, 'post', '/managed-centers').send({ name: 'Forbidden' })).status).toBe(403)
    expect((await call(viewer, 'post', '/auth/refresh').send({ expiredToken: viewer.token })).status).toBe(403)
    expect((await call(viewer, 'get', `/reviews/teacher/${claims.id}`)).status).toBe(200)
  })
  it('rejects a normal center-teacher token even when correctly signed', async () => {
    const p = jwt.decode(teacher.token)
    const token = jwt.sign({ ...JWT_STANDARD_CLAIMS, id: p.id, centerId: p.centerId, role: 'teacher' }, getCenterSecret(p.centerId), { expiresIn: '5m' })
    expect((await call({ token }, 'get', '/workspace')).status).toBe(401)
  })
  it('creates separate managed centers and students without credits or logins', async () => {
    const c = await call(teacher, 'post', '/managed-centers').send({ name: 'Sunrise', currency: 'USD', rateMinor: 800, payBasis: 'class', prepaid: false })
    expect(c.status).toBe(200); center = c.body.data
    secondCenter = (await call(teacher, 'post', '/managed-centers').send({ name: 'River', currency: 'EUR', rateMinor: 1200, payBasis: 'hour' })).body.data
    const s = await call(teacher, 'post', '/managed-students').send({ centerId: center._id, name: 'Linh', classCount: 1, notifyEmail: 'family@test.com' })
    expect(s.status).toBe(200); student = s.body.data.id
    expect((await call(other, 'get', '/managed-students')).body.data).toHaveLength(0)
    expect((await call(other, 'patch', `/managed-students/${student}`).send({ addCredits: 10 })).status).toBe(400)
  })
})
describe('work, rates and scheduling', () => {
  it('reuses quiz templates within the teacher workspace without exposing another teacher’s templates', async () => {
    const r = await call(teacher, 'post', '/quiz-templates').send({ name: 'Reading practice', questions: [{ question: 'Choose the word.', options: [{ text: 'read' }, { text: 'reads' }], correctIndex: 0 }] })
    expect(r.status).toBe(201)
    expect((await call(teacher, 'get', '/quiz-templates')).body.templates).toHaveLength(1)
    expect((await call(other, 'get', '/quiz-templates')).body.templates).toHaveLength(0)
    expect((await call(other, 'delete', `/quiz-templates/${r.body.template._id}`)).status).toBe(404)
  })
  it('records work and rejects mixed-center students and calendar clashes', async () => {
    const payload = { centerId: center._id, studentId: student, title: 'Unit 1', duration: 60, scheduledTime: new Date(Date.now() + 86400000).toISOString() }
    expect((await call(teacher, 'post', '/work').send({ ...payload, centerId: secondCenter._id })).status).toBe(400)
    const r = await call(teacher, 'post', '/work').send(payload)
    expect(r.status).toBe(200); classId = r.body.data._id
    expect((await call(teacher, 'post', '/work').send({ ...payload, scheduledTime: new Date(new Date(payload.scheduledTime).getTime() + 1800000).toISOString() })).status).toBe(400)
  })
  it('completes once with one paid class and preserves the booked rate', async () => {
    await call(teacher, 'put', `/managed-centers/${center._id}`).send({ ...center, rateMinor: 9900 })
    const completion = await call(teacher, 'patch', `/work/${classId}`).send({ complete: true, published: true, summary: 'Practised greetings and reading.' })
    expect(completion.status).toBe(200)
    expect((await call(teacher, 'patch', `/work/${classId}`).send({ complete: true })).status).toBe(200)
    const totals = (await call(teacher, 'get', '/earnings')).body.data.find(c => c._id === center._id).totals[0]
    expect(totals).toMatchObject({ currency: 'USD', earned: 800, received: 0, outstanding: 800 })
    const pupils = (await call(teacher, 'get', '/managed-students')).body.data
    expect(pupils[0]).toMatchObject({ active: true, classCredits: 0 })
  })
})
describe('private parent learning pages', () => {
  it('creates an opaque no-slug link and requires an access confirmation', async () => {
    const r = await call(teacher, 'post', `/managed-students/${student}/parent-link`).send({})
    expect(r.status).toBe(200)
    familyUrl = root + '/family/' + r.body.data.url.split('/').at(-1)
    expect((await request(app).get(familyUrl)).status).toBe(403)
    expect((await request(app).get(familyUrl + '/preview')).body.data).toEqual({ studentName: 'Linh', center: 'Sunrise' })
    const unlock = await request(app).post(familyUrl + '/unlock').send({})
    expect(unlock.status).toBe(200); access = unlock.body.data.access
    const view = await request(app).get(familyUrl).set('x-share-access', access)
    expect(view.status).toBe(200)
    expect(view.body.data.work[0].summary).toContain('greetings')
    expect(JSON.stringify(view.body)).not.toMatch(/rateMinor|amountMinor|password|sessionToken/)
  })
  it('delivers parent questions, teacher replies and attendance responses', async () => {
    expect((await request(app).post(familyUrl + '/messages').set('x-share-access', access).send({ text: 'What should we practise?' })).status).toBe(200)
    expect((await call(teacher, 'get', '/messages')).body.data.some(m => m.sender === 'family' && m.readAt == null)).toBe(true)
    expect((await call(teacher, 'post', '/messages').send({ studentId: student, text: 'Please read page 4.' })).status).toBe(200)
    const view = (await request(app).get(familyUrl).set('x-share-access', access)).body.data
    expect(view.messages.some(m => m.text === 'Please read page 4.')).toBe(true)
    expect((await request(app).post(`${familyUrl}/work/${view.work[0]._id}/attendance`).set('x-share-access', access).send({ attended: 'yes' })).status).toBe(200)
  })
  it('pages published class reviews without exposing unpublished updates', async () => {
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const Work = db.models.TeacherWork
    const created = await Work.create(['Older', 'Newer', 'Hidden'].map((title, i) => ({ centerId: center._id, studentId: student, bookingId: new mongoose.Types.ObjectId(), title, published: i !== 2 })))
    await db.collection('bookings').insertMany(created.map(w => ({ _id: w.bookingId, studentId: new mongoose.Types.ObjectId(student), teacherId: new mongoose.Types.ObjectId(jwt.decode(teacher.token).id), status: 'completed', classTitle: w.title, scheduledTime: new Date(), duration: 30 })))
    const first = await request(app).get(`${familyUrl}/work?page=1`).set('x-share-access', access)
    const next = await request(app).get(`${familyUrl}/work?page=2`).set('x-share-access', access)
    expect(first.status).toBe(200); expect(first.body.data.items).toHaveLength(2); expect(first.body.data.hasMore).toBe(true)
    expect(next.body.data.items).toHaveLength(1); expect(next.body.data.hasMore).toBe(false)
    expect([...first.body.data.items, ...next.body.data.items].some(w => w.title === 'Hidden')).toBe(false)
    expect((await request(app).get(`${familyUrl}/work?page=1`)).status).toBe(403)
    await Work.deleteMany({ _id: { $in: created.map(w => w._id) } })
  })
  it('shows shared recordings for this student even without a published class review', async () => {
    expect((await call(teacher, 'patch', '/managed-students/' + student).send({ addCredits: 30 })).status).toBe(200)
    const lesson = await call(teacher, 'post', '/work').send({ centerId: center._id, studentId: student, title: 'Private review recording', duration: 30, scheduledTime: new Date(Date.now() + 43 * 86400000).toISOString() })
    expect(lesson.status).toBe(200)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const { recordingSchema } = await import('../schemas/recordingSchema.js')
    const Recording = db.models.Recording || db.model('Recording', recordingSchema)
    const shared = await Recording.create({ teacherId: jwt.decode(teacher.token).id, bookingId: lesson.body.data._id, source: 'external', externalUrl: 'https://zoom.us/rec/share/family', title: 'Shared lesson video', visibleToStudent: true })
    const hidden = await Recording.create({ teacherId: jwt.decode(teacher.token).id, bookingId: lesson.body.data._id, source: 'external', externalUrl: 'https://zoom.us/rec/share/private', title: 'Private video', visibleToStudent: false })
    expect((await request(app).get(`${familyUrl}/recordings`)).status).toBe(403)
    const videos = await request(app).get(`${familyUrl}/recordings`).set('x-share-access', access)
    expect(videos.status).toBe(200)
    expect(videos.body.data.some(v => v.id === String(shared._id))).toBe(true)
    expect(videos.body.data.some(v => v.id === String(hidden._id))).toBe(false)
    const extra = await Recording.create([
      { teacherId: jwt.decode(teacher.token).id, bookingId: lesson.body.data._id, source: 'external', externalUrl: 'https://zoom.us/rec/share/1', title: 'Part one', sessionId: 'pagination-session', partNumber: 1, visibleToStudent: true },
      { teacherId: jwt.decode(teacher.token).id, bookingId: lesson.body.data._id, source: 'external', externalUrl: 'https://zoom.us/rec/share/2', title: 'Part two', sessionId: 'pagination-session', partNumber: 2, visibleToStudent: true },
      { teacherId: jwt.decode(teacher.token).id, bookingId: lesson.body.data._id, source: 'external', externalUrl: 'https://zoom.us/rec/share/3', title: 'Another session', visibleToStudent: true },
    ])
    const first = await request(app).get(`${familyUrl}/recordings?page=1`).set('x-share-access', access)
    const next = await request(app).get(`${familyUrl}/recordings?page=2`).set('x-share-access', access)
    expect(first.status).toBe(200); expect(first.body.data.hasMore).toBe(true)
    expect(first.body.data.items.filter(v => v.sessionId === 'pagination-session')).toHaveLength(2)
    expect(next.body.data.items.some(v => v.id === String(shared._id))).toBe(true)
    expect(next.body.data.hasMore).toBe(false)
    await Recording.deleteMany({ _id: { $in: extra.map(v => v._id) } })
    await Recording.deleteMany({ _id: { $in: [shared._id, hidden._id] } })
  })
  it('attaches only shared class reviews and recordings to the linked completed class', async () => {
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const { recordingSchema } = await import('../schemas/recordingSchema.js')
    const Recording = db.models.Recording || db.model('Recording', recordingSchema)
    const record = await Recording.create({ teacherId: jwt.decode(teacher.token).id, bookingId: classId, source: 'external', externalUrl: 'https://zoom.us/rec/share/lesson', visibleToStudent: true, title: 'Lesson replay' })
    const schedule = await request(app).get(`${familyUrl}/schedule`).set('x-share-access', access)
    expect(schedule.body.data.classes.find(c => c.id === classId)).toMatchObject({ hasReview: true, hasRecordings: true })
    const route = `${familyUrl}/schedule/${classId}/materials?group=false`
    expect((await request(app).get(route)).status).toBe(403)
    const materials = await request(app).get(route).set('x-share-access', access)
    expect(materials.status).toBe(200)
    expect(materials.body.data.review).toContain('greetings')
    expect(materials.body.data.recordings[0].title).toBe('Lesson replay')
    await db.models.TeacherWork.updateOne({ bookingId: classId, studentId: student }, { $set: { published: false } })
    expect((await request(app).get(route).set('x-share-access', access)).body.data.review).toBe('')
    await db.models.TeacherWork.updateOne({ bookingId: classId, studentId: student }, { $set: { published: true } })
    await Recording.deleteOne({ _id: record._id })
  })
  it('shows published materials for a missed class and honors its recording share link', async () => {
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const { recordingSchema } = await import('../schemas/recordingSchema.js')
    const { recordingLinkSchema } = await import('../schemas/recordingLinkSchema.js')
    const { issueShareLink } = await import('../utils/shareLink.js')
    const Recording = db.models.Recording || db.model('Recording', recordingSchema)
    const Link = db.models.RecordingLink || db.model('RecordingLink', recordingLinkSchema)
    const owner = jwt.decode(teacher.token).id
    const video = await Recording.create({ teacherId: owner, bookingId: classId, source: 'external', externalUrl: 'https://zoom.us/rec/share/missed', visibleToStudent: false })
    const link = { teacherId: owner, studentId: student, bookingId: classId, enabled: true, purgeAt: new Date(Date.now() + 86400000) }; issueShareLink(link)
    const saved = await Link.create(link)
    await db.models.Booking.updateOne({ _id: classId }, { $set: { status: 'missed' } })
    const schedule = await request(app).get(`${familyUrl}/schedule`).set('x-share-access', access)
    expect(schedule.body.data.classes.find(c => c.id === classId)).toMatchObject({ status: 'missed', hasReview: false, hasRecordings: true })
    const materials = await request(app).get(`${familyUrl}/schedule/${classId}/materials?group=false`).set('x-share-access', access)
    expect(materials.body.data.review).toBe('')
    expect(materials.body.data.recordings[0].url).toContain('/rv/')
    await Link.updateOne({ _id: saved._id }, { $set: { enabled: false } })
    expect((await request(app).get(`${familyUrl}/schedule/${classId}/materials?group=false`).set('x-share-access', access)).body.data.recordings).toHaveLength(0)
    await db.models.Booking.updateOne({ _id: classId }, { $set: { status: 'completed' } })
    await Recording.deleteOne({ _id: video._id }); await Link.deleteOne({ _id: saved._id })
  })
  it('shows future classes and lets only the linked family report an absence once', async () => {
    const lesson = await call(teacher, 'post', '/work').send({ centerId: center._id, studentId: student, title: 'Parent schedule test', duration: 30, scheduledTime: new Date(Date.now() + 40 * 86400000).toISOString() })
    expect(lesson.status).toBe(200)
    const schedule = await request(app).get(familyUrl + '/schedule').set('x-share-access', access)
    expect(schedule.status).toBe(200)
    expect(schedule.body.data.classes.some(c => c.id === lesson.body.data._id)).toBe(true)
    const completed = await request(app).get(familyUrl + '/schedule?view=completed').set('x-share-access', access)
    expect(completed.body.data.classes.some(c => c.id === lesson.body.data._id)).toBe(false)
    expect(completed.body.data.classes.some(c => c.id === classId)).toBe(true)
    const boundary = encodeURIComponent(new Date(Date.now() + 20 * 86400000).toISOString())
    const upcoming = await request(app).get(`${familyUrl}/schedule?view=upcoming&dayStart=${boundary}`).set('x-share-access', access)
    expect(upcoming.body.data.classes.some(c => c.id === lesson.body.data._id)).toBe(true)
    expect(upcoming.body.data.classes.every((c, i, arr) => !i || new Date(arr[i - 1].scheduledTime) <= new Date(c.scheduledTime))).toBe(true)
    const previous = await request(app).get(`${familyUrl}/schedule?view=previous&dayStart=${boundary}`).set('x-share-access', access)
    expect(previous.body.data.classes.some(c => c.id === lesson.body.data._id)).toBe(false)
    expect(previous.body.data.classes.some(c => c.id === classId)).toBe(true)
    const url = `${familyUrl}/schedule/${lesson.body.data._id}/absence`
    expect((await request(app).post(url).send({ group: false })).status).toBe(403)
    const absence = await request(app).post(url).set('x-share-access', access).send({ group: false, reason: 'Family trip' })
    expect(absence.status).toBe(200); expect(absence.body.data.emailSent).toBe(true)
    expect(sent.at(-1).subject).toBe('Student absence notification')
    expect((await request(app).post(url).set('x-share-access', access).send({ group: false })).status).toBe(409)
    const booking = await call(teacher, 'get', `/bookings/${lesson.body.data._id}`)
    expect(booking.body.booking.status).toBe('cancelled')
    expect((await call(teacher, 'get', '/messages')).body.data.some(m => m.text.includes('Family trip'))).toBe(true)
  })
  it('gives the linked family the teacher-selected meeting link only when the classroom is open', async () => {
    const update = await call(teacher, 'put', `/managed-centers/${center._id}`).send({ ...center, rateMinor: 9900, meetingUrl: 'https://meet.google.com/abc-defg-hij' })
    expect(update.status).toBe(200)
    const lesson = await call(teacher, 'post', '/work').send({ centerId: center._id, studentId: student, title: 'Join link test', duration: 30, scheduledTime: new Date(Date.now() + 60 * 86400000).toISOString() })
    const id = lesson.body.data._id, route = `${familyUrl}/schedule/${id}/join?group=false`
    expect((await request(app).get(route)).status).toBe(403)
    expect((await request(app).get(route).set('x-share-access', access)).body.data.ready).toBe(false)
    expect((await call(teacher, 'post', '/classroom/attendance').send({ bookingId: id, action: 'join' })).status).toBe(200)
    expect((await call(teacher, 'patch', `/classroom/session/${id}/video-provider`).send({ videoProvider: 'googlemeet' })).status).toBe(200)
    const link = await request(app).get(route).set('x-share-access', access)
    expect(link.body.data).toMatchObject({ ready: true, provider: 'googlemeet', url: 'https://meet.google.com/abc-defg-hij' })
    expect((await request(app).post(`${familyUrl}/schedule/${id}/absence`).set('x-share-access', access).send({ group: false })).status).toBe(200)
    expect((await request(app).get(route).set('x-share-access', access)).status).toBe(404)
    await call(teacher, 'put', `/managed-centers/${center._id}`).send({ ...center, rateMinor: 9900, meetingUrl: '' })
  })
  it('keeps group lessons scheduled for other students after an absence', async () => {
    const second = await call(teacher, 'post', '/managed-students').send({ centerId: center._id, name: 'Group pupil', classCount: 4 })
    expect(second.body.data.parentLink).toContain('/teacher-mode/family/')
    const lesson = await call(teacher, 'post', '/work').send({ centerId: center._id, studentIds: [student, second.body.data.id], group: true, title: 'Group absence', duration: 30, scheduledTime: new Date(Date.now() + 41 * 86400000).toISOString() })
    expect(lesson.status).toBe(200)
    const absence = await request(app).post(`${familyUrl}/schedule/${lesson.body.data._id}/absence`).set('x-share-access', access).send({ group: true })
    expect(absence.status).toBe(200)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const group = await db.models.GroupClass.findById(lesson.body.data._id).lean()
    expect(group.status).toBe('open')
    expect(group.enrollments.find(e => String(e.studentId) === student).attendance).toBe('absent')
    expect(group.enrollments.find(e => String(e.studentId) === second.body.data.id).attendance).toBe('pending')
    expect((await call(teacher, 'patch', `/work/${group._id}`).send({ complete: true })).status).toBe(200)
    const completed = await db.models.GroupClass.findById(group._id).lean()
    expect(completed.enrollments.find(e => String(e.studentId) === student).attendance).toBe('absent')
  })
  it('supports actual existing homework links with workspace routing and submissions', async () => {
    const assigned = await call(teacher, 'post', '/homework').field('studentId', student).field('title', 'Read page 4').field('description', 'Read aloud.').field('dueDate', new Date(Date.now() + 5 * 86400000).toISOString())
    expect(assigned.status).toBe(201)
    const homework = assigned.body.homework
    expect(homework.shareToken).toBeTruthy()
    const link = await call(teacher, 'post', `/homework/${homework._id}/share-link`).send({})
    expect(link.status).toBe(200)
    const key = jwt.decode(teacher.token).centerId
    const path = `/api/v1/homework/link/${link.body.homework.shareToken}?workspace=${key}`
    const unlock = await request(app).post(path.replace('?', '/unlock?')).send({ studentName: 'Linh', teacherName: 'Amara' })
    expect(unlock.status).toBe(200)
    const submitted = await request(app).post(path.replace('?', '/submit?')).set('x-share-access', unlock.body.accessToken).field('text', 'We read page 4 together.')
    expect(submitted.status).toBe(200)
    const beforeGrade = (await request(app).get(familyUrl).set('x-share-access', access)).body.data.activities.find(a => a.id === homework._id)
    expect(beforeGrade).toMatchObject({ status: 'submitted', kind: 'hw' })
    expect((await call(teacher, 'post', `/homework/${homework._id}/grade`).send({ score: 88, feedback: 'Well done reading.' })).status).toBe(200)
    const graded = (await request(app).get(familyUrl).set('x-share-access', access)).body.data.activities.find(a => a.id === homework._id)
    expect(graded).toMatchObject({ status: 'graded', grade: { score: 88, feedback: 'Well done reading.' } })
  })
  it('shows a completed quiz score on the student family page', async () => {
    const created = await call(teacher, 'post', '/quiz').send({ studentId: student, title: 'Family quiz', timeLimit: 10, dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), questions: [{ question: 'Pick yes', options: [{ text: 'Yes' }, { text: 'No' }], correctIndex: 0 }] })
    expect(created.status).toBe(201)
    const quiz = created.body.quiz, key = jwt.decode(teacher.token).centerId
    expect(quiz.shareToken).toBeTruthy()
    const path = `/api/v1/quiz/link/${quiz.shareToken}?workspace=${key}`
    const unlock = await request(app).post(path.replace('?', '/unlock?')).send({ studentName: 'Linh', teacherName: 'Amara' })
    expect(unlock.status).toBe(200)
    expect((await request(app).post(path.replace('?', '/start?')).set('x-share-access', unlock.body.accessToken)).status).toBe(200)
    expect((await request(app).post(path.replace('?', '/submit?')).set('x-share-access', unlock.body.accessToken).send({ answers: [0] })).status).toBe(200)
    const item = (await request(app).get(familyUrl).set('x-share-access', access)).body.data.activities.find(a => a.id === quiz._id)
    expect(item).toMatchObject({ status: 'attempted', result: { score: 1, totalQuestions: 1, percentage: 100 } })
    expect(JSON.stringify(item)).not.toMatch(/correctIndex|answers/)
    const db = global.__TEST_DB__.useDb(key, { useCache: true })
    await db.models.QuizAttempt.deleteOne({ quizId: quiz._id }); await db.models.Quiz.deleteOne({ _id: quiz._id })
  })
  it('collects persisted learning, homework, quiz, game and recording links with student and center ownership', async () => {
    const key = jwt.decode(teacher.token).centerId
    const first = await call(teacher, 'get', '/parent-links')
    expect(first.status).toBe(200)
    const saved = first.body.data.find(l => l.kind === 'homework')
    expect(saved.student).toMatchObject({ id: student, name: 'Linh', centerId: center._id, centerName: 'Sunrise' })
    expect(saved.url).toContain(`/hw/`)
    expect(saved.url).toContain(`?workspace=${key}`)
    expect(first.body.data.some(l => l.kind === 'family')).toBe(true)
    expect(JSON.stringify(first.body)).not.toMatch(/tokenHash|tokenEnc|password|notifyEmail/)
    const again = await call(teacher, 'get', '/parent-links?kind=homework')
    expect(again.body.data[0].url).toBe(saved.url)
    expect((await call(other, 'get', '/parent-links')).body.data).toHaveLength(0)
    expect((await call(teacher, 'get', `/parent-links?centerId=${secondCenter._id}`)).body.data).toHaveLength(0)
    expect((await call(other, 'get', `/parent-links?centerId=${center._id}`)).status).toBe(400)
    expect((await call(teacher, 'get', '/parent-links?page=-1')).status).toBe(400)
    const quiz = await call(teacher, 'post', '/quiz').send({ studentId: student, title: 'Reading words', dueDate: new Date(Date.now() + 4 * 86400000).toISOString(), timeLimit: 10, questions: [{ question: 'Choose a word', options: [{ text: 'read' }, { text: 'reads' }], correctIndex: 0 }] })
    expect(quiz.status).toBe(201)
    expect((await call(teacher, 'post', `/quiz/${quiz.body.quiz._id}/share-link`).send({})).status).toBe(200)
    const quizzes = await call(teacher, 'get', '/parent-links?kind=quiz')
    expect(quizzes.body.data[0]).toMatchObject({ kind: 'quiz', title: 'Reading words', status: 'active' })
    expect(quizzes.body.data[0].url).toContain(`/q/`)
    const db = global.__TEST_DB__.useDb(key, { useCache: true })
    const owner = jwt.decode(teacher.token).id
    const { issueShareLink } = await import('../utils/shareLink.js')
    const set = await db.models.QuestionSet.create({ title: 'Word practice', createdBy: { role: 'teacher', id: owner } })
    const assignment = await db.models.GameAssignment.create({ setId: set._id, studentIds: [student], createdBy: { role: 'teacher', id: owner } })
    const game = { assignmentId: assignment._id, studentId: student, teacherId: owner }; issueShareLink(game)
    await db.models.GameLink.create(game)
    const games = await call(teacher, 'get', '/parent-links?kind=game')
    expect(games.body.data[0]).toMatchObject({ kind: 'game', title: 'Word practice', status: 'active' })
    expect(games.body.data[0].url).toContain(`/g/`)
    const { recordingSchema } = await import('../schemas/recordingSchema.js')
    const Recording = db.models.Recording || db.model('Recording', recordingSchema)
    await Recording.create({ bookingId: classId, teacherId: owner, studentId: student, source: 'external', externalUrl: 'https://zoom.us/rec/share/test', visibleToStudent: true })
    expect((await call(teacher, 'post', '/recording-links/class').send({ bookingId: classId, studentId: student })).status).toBe(200)
    const recordings = await call(teacher, 'get', '/parent-links?kind=recording')
    expect(recordings.status).toBe(200)
    expect(recordings.body.data[0]).toMatchObject({ kind: 'recording', title: 'Unit 1', status: 'active' })
    expect(recordings.body.data[0].url).toContain(`/rv/`)
    expect((await call(teacher, 'get', '/parent-links')).body.pagination.total).toBe(7)
  })
  it('paginates the combined library without duplicates and removes revoked activity URLs', async () => {
    const key = jwt.decode(teacher.token).centerId, owner = jwt.decode(teacher.token).id
    const db = global.__TEST_DB__.useDb(key, { useCache: true })
    const { issueShareLink } = await import('../utils/shareLink.js')
    const docs = Array.from({ length: 31 }, (_, i) => { const doc = { teacherId: owner, studentId: student, title: `Practice ${i}`, dueDate: new Date(Date.now() + 86400000) }; issueShareLink(doc); return doc })
    await db.models.Homework.insertMany(docs)
    const first = (await call(teacher, 'get', '/parent-links?page=1')).body
    const second = (await call(teacher, 'get', '/parent-links?page=2')).body
    expect(first.pagination).toMatchObject({ total: 38, totalPages: 2, limit: 30 })
    expect(first.data).toHaveLength(30)
    expect(second.data).toHaveLength(8)
    expect(new Set([...first.data, ...second.data].map(l => l.id)).size).toBe(38)
    const picked = first.data.find(l => l.kind === 'homework')
    expect((await call(teacher, 'delete', `/homework/${picked.id.split(':')[1]}/share-link`)).status).toBe(200)
    const remaining = await call(teacher, 'get', '/parent-links?kind=homework')
    expect(remaining.body.pagination.total).toBe(31)
    expect(remaining.body.data.some(l => l.id === picked.id)).toBe(false)
  })
  it('revokes both the family URL and previously issued access tokens', async () => {
    await call(teacher, 'post', `/managed-students/${student}/parent-link`).send({ revoke: true })
    expect((await request(app).get(familyUrl).set('x-share-access', access)).status).toBe(410)
    const library = await call(teacher, 'get', '/parent-links?kind=family')
    expect(library.status).toBe(200)
    expect(library.body.data.find(l => l.student.id === student)).toMatchObject({ status: 'disabled', url: null })
  })
  it('deletes only expired or disabled parent links and keeps their content', async () => {
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const getLink = async kind => (await call(teacher, 'get', `/parent-links?kind=${kind}`)).body.data[0]
    const homework = await getLink('homework'), quiz = await getLink('quiz'), game = await getLink('game'), recording = await getLink('recording')
    const family = (await call(teacher, 'get', '/parent-links?kind=family')).body.data.find(link => link.student.id === student && link.status === 'disabled')
    const id = link => link.id.split(':')[1]
    const remove = (user, link) => call(user, 'delete', `/parent-links/${link.kind}/${id(link)}`)
    expect((await remove(teacher, homework)).status).toBe(409)
    expect((await remove(other, homework)).status).toBe(404)
    const past = new Date(Date.now() - 3 * 86400000)
    await db.models.Homework.updateOne({ _id: id(homework) }, { $set: { dueDate: past } })
    await db.models.Quiz.updateOne({ _id: id(quiz) }, { $set: { dueDate: past } })
    const gameDoc = await db.models.GameLink.findById(id(game))
    await db.models.GameAssignment.updateOne({ _id: gameDoc.assignmentId }, { $set: { active: false } })
    await db.models.RecordingLink.updateOne({ _id: id(recording) }, { $set: { enabled: false } })
    for (const link of [homework, quiz, game, recording, family]) {
      const response = await remove(teacher, link)
      expect(response.status, `${link.kind}: ${JSON.stringify(response.body)}`).toBe(200)
      expect((await call(teacher, 'get', `/parent-links?kind=${link.kind}`)).body.data.some(row => row.id === link.id)).toBe(false)
    }
    expect(await db.models.Homework.exists({ _id: id(homework) })).toBeTruthy()
    expect(await db.models.Quiz.exists({ _id: id(quiz) })).toBeTruthy()
    expect(await db.models.GameAssignment.exists({ _id: gameDoc.assignmentId })).toBeTruthy()
    expect(await db.models.Recording.exists({ bookingId: classId })).toBeTruthy()
    expect(await db.models.Student.exists({ _id: student })).toBeTruthy()
    expect((await request(app).get(familyUrl).set('x-share-access', access)).status).toBe(410)
  })
  it('keeps Super Admin conversations out of the family conversation', async () => {
    expect((await call(teacher, 'post', '/messages').send({ text: 'Private platform question' })).status).toBe(200)
    const w = (await admin('get', '/admin/workspaces')).body.data.find(w => w.email === 'solo1@test.com')
    const r = await admin('get', `/admin/workspaces/${w._id}/messages`)
    expect(r.body.data.some(m => m.text === 'Private platform question')).toBe(true)
    expect(r.body.data.some(m => m.sender === 'family')).toBe(false)
  })
  it('supports groups from one center and counts the group fee once', async () => {
    const s = await call(teacher, 'post', '/managed-students').send({ centerId: center._id, name: 'Mai', classCount: 4 })
    const r = await call(teacher, 'post', '/work').send({ centerId: center._id, studentIds: [student, s.body.data.id], group: true, title: 'Conversation club', duration: 30, scheduledTime: new Date(Date.now() + 4 * 86400000).toISOString() })
    expect(r.status).toBe(200)
    expect(r.body.data.enrollments).toHaveLength(2)
    expect((await call(teacher, 'patch', `/work/${r.body.data._id}`).send({ complete: true, published: true, summary: 'Group speaking practice' })).status).toBe(200)
    const totals = (await call(teacher, 'get', '/earnings')).body.data.find(c => c._id === center._id).totals[0]
    expect(totals.earned).toBe(20600) // individual plus two completed groups
  })
  it('uploads, downloads and removes a private PDF resource with ownership checks', async () => {
    const body = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF')
    const r = await call(teacher, 'post', `/resources?managedCenterId=${center._id}`).field('title', 'Reading worksheet').field('rightsConfirmed', 'true').attach('pdf', body, { filename: 'reading.pdf', contentType: 'application/pdf' })
    expect(r.status).toBe(201)
    expect((await call(other, 'get', `/resources/${r.body.data.id}/download`)).status).toBe(404)
    expect((await call(teacher, 'get', `/resources/${r.body.data.id}/download`)).status).toBe(200)
    expect((await call(teacher, 'delete', `/resources/${r.body.data.id}`)).status).toBe(200)
  })
  it('runs the classroom to completion without center approval and synchronizes summaries', async () => {
    const created = await call(teacher, 'post', '/work').send({ centerId: center._id, studentId: student, title: 'Classroom flow', duration: 15, scheduledTime: new Date(Date.now() + 10 * 86400000).toISOString() })
    expect(created.status).toBe(200)
    const id = created.body.data._id, teacherId = jwt.decode(teacher.token).id
    expect((await call(other, 'get', '/bookings/' + id)).status).toBe(404)
    expect((await call(teacher, 'post', '/classroom/attendance').send({ bookingId: id, action: 'join' })).status).toBe(200)
    expect((await call(teacher, 'post', '/classroom/managed-presence').send({ bookingId: id, present: true })).status).toBe(200)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    await db.models.ClassroomSession.updateOne({ bookingId: id }, { $set: { classStartedAt: new Date(Date.now() - 900000), bothActiveTime: 900 } })
    const complete = await call(teacher, 'post', '/classroom/auto-complete').send({ bookingId: id, clientBothActiveTime: 900 })
    expect(complete.status).toBe(200); expect(complete.body.completed).toBe(true)
    expect((await call(teacher, 'post', '/classroom/auto-complete').send({ bookingId: id })).body.alreadyProcessed).toBe(true)
    const saved = await db.models.Booking.findById(id).lean()
    expect(saved.status).toBe('completed'); expect(saved.parentCheck?.status).not.toBe('waiting')
    expect((await call(teacher, 'get', '/bookings/teacher/' + teacherId + '/history?q=Classroom')).body.classes).toHaveLength(1)
    expect((await call(teacher, 'get', '/bookings/teacher/' + teacherId + '/history?managedCenterId=' + secondCenter._id)).body.classes.some(c => c.id === id)).toBe(false)
    expect((await call(teacher, 'put', '/class-summaries/' + id).send({ text: 'Reading with confidence.' })).status).toBe(200)
    const work = (await call(teacher, 'get', '/work')).body.data.find(c => c._id === id)
    expect(work.update).toMatchObject({ summary: 'Reading with confidence.', published: true })
    expect((await call(teacher, 'get', '/class-summaries/teacher?view=written')).body.classes.some(c => c.id === id)).toBe(true)
    expect((await call(teacher, 'get', '/class-summaries/teacher?view=written&managedCenterId=' + secondCenter._id)).body.classes.some(c => c.id === id)).toBe(false)
    const w = (await admin('get', '/admin/workspaces')).body.data.find(w => w.email === 'solo1@test.com')
    const oversight = await admin('get', '/admin/workspaces/' + w._id + '/activity')
    expect(oversight.status).toBe(200); expect(oversight.body.data.classes.find(c => c._id === id).classSummary.text).toBe('Reading with confidence.')
    expect((await request(app).get(root + '/admin/workspaces/' + w._id + '/activity').set('Authorization', 'Bearer ' + teacher.token)).status).toBe(403)
  })
  it('reschedules, cancels and records missed lessons under the teacher’s control', async () => {
    const r = await call(teacher, 'post', '/work').send({ centerId: center._id, studentId: student, title: 'Reschedule me', duration: 30, scheduledTime: new Date(Date.now() + 15 * 86400000).toISOString() })
    const id = r.body.data._id
    expect((await call(teacher, 'patch', '/work/' + id).send({ action: 'edit', title: 'Moved lesson', duration: 60, scheduledTime: new Date(Date.now() + 16 * 86400000).toISOString() })).status).toBe(200)
    expect((await call(teacher, 'patch', '/work/' + id).send({ action: 'missed', reason: 'Student unavailable' })).status).toBe(200)
    expect((await call(teacher, 'patch', '/work/' + id).send({ action: 'cancel' })).status).toBe(200)
    expect((await call(teacher, 'patch', '/work/' + id).send({ complete: true })).status).toBe(400)
  })
  it('can correct a missed group lesson to taught without charging twice', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Group recovery', currency: 'USD', rateMinor: 1000, payBasis: 'class', prepaid: true })).body.data
    const ids = []
    for (const name of ['Recovery One', 'Recovery Two']) ids.push((await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name, classCount: 2 })).body.data.id)
    const created = await call(teacher, 'post', '/work').send({ centerId: c._id, studentIds: ids, group: true, title: 'Recovered group', duration: 30, scheduledTime: new Date(Date.now() + 45 * 86400000).toISOString() })
    expect(created.status).toBe(200)
    const id = created.body.data._id
    expect((await call(teacher, 'patch', `/work/${id}`).send({ action: 'missed' })).status).toBe(200)
    expect((await call(teacher, 'patch', `/work/${id}`).send({ complete: true })).status).toBe(200)
    expect((await call(teacher, 'patch', `/work/${id}`).send({ complete: true })).status).toBe(200)
    const pupils = (await call(teacher, 'get', '/managed-students')).body.data.filter(s => ids.includes(s._id))
    expect(pupils.map(s => s.classCredits)).toEqual([1, 1])
    expect((await call(teacher, 'get', '/work')).body.data.find(w => w._id === id).status).toBe('completed')
  })
  it('uses the booked prepaid policy and charges group classroom completion only once', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Prepaid', currency: 'GBP', rateMinor: 2000, payBasis: 'class', prepaid: true })).body.data
    const ids = []
    for (const name of ['One', 'Two']) ids.push((await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name, classCount: 2 })).body.data.id)
    const group = await call(teacher, 'post', '/work').send({ centerId: c._id, studentIds: ids, group: true, title: 'Prepaid group', duration: 30, scheduledTime: new Date(Date.now() + 20 * 86400000).toISOString() })
    const id = group.body.data._id

    await call(teacher, 'put', '/managed-centers/' + c._id).send({ ...c, prepaid: false })
    expect((await call(teacher, 'patch', '/group-classes/' + id + '/complete').send({})).status).toBe(200)
    expect((await call(teacher, 'patch', '/work/' + id).send({ complete: true })).status).toBe(200)
    const pupils = (await call(teacher, 'get', '/managed-students')).body.data.filter(s => ids.includes(s._id))
    expect(pupils.map(s => s.classCredits)).toEqual([1, 1])
    expect((await call(teacher, 'put', '/class-summaries/group/' + id).send({ text: 'Group progress.' })).status).toBe(200)
    expect((await call(teacher, 'get', '/work')).body.data.find(c => c._id === id).update.summary).toBe('Group progress.')
  })
  it('keeps all receipt totals and provides center-scoped paginated salary history', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Salary test', currency: 'USD', rateMinor: 1000, payBasis: 'class' })).body.data
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    await db.models.TeacherReceipt.insertMany(Array.from({ length: 501 }, () => ({ centerId: c._id, currency: 'USD', amountMinor: 100, receivedAt: new Date() })))
    const totals = (await call(teacher, 'get', '/earnings')).body.data.find(x => x._id === c._id).totals[0]
    expect(totals.received).toBe(50100)
    const history = await call(teacher, 'get', '/earnings/history?centerId=' + c._id)
    expect(history.status).toBe(200); expect(history.body.data).toMatchObject({ total: 501, totalPages: 26 })
    expect(history.body.data.entries).toHaveLength(20)
    expect((await call(other, 'get', '/earnings/history?centerId=' + c._id)).status).toBe(400)
  })
  it('starts a fresh center salary period on payday and preserves prior earnings', async () => {
    const created = await call(teacher, 'post', '/managed-centers').send({ name: 'Midmonth', currency: 'USD', rateMinor: 1000, payBasis: 'class', salaryDay: 15 })
    expect(created.status).toBe(200)
    const c = created.body.data
    expect(c.salaryDay).toBe(15)
    expect((await call(teacher, 'post', '/managed-centers').send({ name: 'Bad day', currency: 'USD', rateMinor: 1000, payBasis: 'class', salaryDay: 32 })).status).toBe(400)
    const existing = (await call(teacher, 'get', '/earnings')).body.data.find(x => x._id === c._id)
    expect(new Date(existing.salaryPeriod.payDate).getUTCDate()).toBe(15)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const pupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Period pupil' })).body.data.id
    const base = { teacherId: jwt.decode(teacher.token).id, studentId: pupil, managedCenterId: c._id, classTitle: 'Period lesson', duration: 60, status: 'completed', standalonePay: { currency: 'USD', basis: 'class', rateMinor: 1000, amountMinor: 1000, credits: false } }
    const { localDayRange } = await import('../utils/dailyClassReport.js')
    const { start } = localDayRange(existing.salaryPeriod.start.slice(0, 10), existing.salaryPeriod.timezone)
    await db.models.Booking.create({ ...base, scheduledTime: start, completedAt: start })
    await db.models.Booking.create({ ...base, scheduledTime: new Date(+start - 1), completedAt: new Date(+start - 1) })
    const periodReport = (await call(teacher, 'get', '/earnings')).body.data.find(x => x._id === c._id)
    const totals = periodReport.totals[0]
    expect(periodReport.currentTotals[0]).toMatchObject({ earned: 1000, lessons: 1 })
    expect(periodReport.periodHistory[0]).toMatchObject({ earned: 1000, lessons: 1 })
    expect(totals).toMatchObject({ earned: 2000, periodEarned: 1000, periodLessons: 1 })
    expect((await call(teacher, 'put', `/managed-centers/${c._id}`).send({ ...c, salaryDay: 30 })).body.data.salaryDay).toBe(30)
  })
  it('applies Super Admin charges per center and keeps earlier month rules', async () => {
    const w = (await admin('get', '/admin/workspaces')).body.data.find(x => x.email === 'solo1@test.com')
    const rules = [{ name: 'Platform', kind: 'percent', value: 1000 }, { name: 'Service', kind: 'fixed', value: 100, currency: 'USD' }]
    expect((await request(app).put(`${root}/admin/workspaces/${w._id}/charges`).set('Authorization', `Bearer ${teacher.token}`).send({ rules })).status).toBe(403)
    expect((await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules })).status).toBe(200)
    expect((await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules: [{ name: 'Invalid', kind: 'percent', value: 10001 }] })).status).toBe(400)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    const version = await db.models.TeacherChargeVersion.findOne().sort({ effectiveAt: -1 })
    if (!db.models.Booking) db.model('Booking', (await import('../schemas/bookingSchema.js')).bookingSchema)
    const now = new Date(), old = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15))
    await db.models.TeacherChargeVersion.updateOne({ _id: version._id }, { $set: { effectiveAt: new Date(Date.UTC(old.getUTCFullYear(), old.getUTCMonth(), 1)) } })
    const c1 = (await call(teacher, 'post', '/managed-centers').send({ name: 'Charges A', currency: 'USD', rateMinor: 1000, payBasis: 'class' })).body.data
    const c2 = (await call(teacher, 'post', '/managed-centers').send({ name: 'Charges B', currency: 'USD', rateMinor: 2000, payBasis: 'class' })).body.data
    for (const [c, amount] of [[c1, 1000], [c2, 2000]]) {
      const pupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Test pupil' })).body.data.id
      await db.models.Booking.create({ teacherId: jwt.decode(teacher.token).id, studentId: pupil, managedCenterId: c._id, classTitle: 'Past lesson', scheduledTime: old, completedAt: old, duration: 60, status: 'completed', standalonePay: { currency: 'USD', basis: 'class', rateMinor: amount, amountMinor: amount, credits: false } })
    }
    expect((await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules: [] })).status).toBe(200)
    const earnings = (await call(teacher, 'get', '/earnings')).body.data
    expect(earnings.find(c => c._id === c1._id).totals[0]).toMatchObject({ earned: 1000, chargesTotal: 200, net: 800 })
    expect(earnings.find(c => c._id === c2._id).totals[0]).toMatchObject({ earned: 2000, chargesTotal: 300, net: 1700 })
    const c0 = (await call(teacher, 'post', '/managed-centers').send({ name: 'Zero rate', currency: 'USD', rateMinor: 0, payBasis: 'class' })).body.data
    const selected = [{ name: 'Center A', kind: 'percent', value: 6000, centerIds: [c1._id] }, { name: 'Center B', kind: 'percent', value: 6000, centerIds: [c2._id] }, { name: 'A fixed', kind: 'fixed', value: 100, currency: 'USD', centerIds: [c1._id, c0._id] }]
    const invalidCenter = await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules: [{ ...selected[0], centerIds: [new mongoose.Types.ObjectId().toString()] }] })
    expect(invalidCenter.status, `invalid center: ${JSON.stringify(invalidCenter.body)} ${invalidCenter.text} ${invalidCenter.request.url}`).toBe(400)
    const overlap = await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules: [selected[0], { ...selected[1], centerIds: [c1._id] }] })
    expect(overlap.status, `overlap: ${JSON.stringify(overlap.body)}`).toBe(400)
    expect((await admin('put', `/admin/workspaces/${w._id}/charges`).send({ rules: selected })).status).toBe(200)
    const settings = await admin('get', `/admin/workspaces/${w._id}/charges`)
    expect(settings.body.data.centers.some(c => c._id === c1._id)).toBe(true)
    expect(settings.body.data.rules[0].centerIds).toEqual([c1._id])
    for (const [c, amount] of [[c1, 1000], [c2, 2000]]) {
      const pupil = await db.models.Student.findOne({ managedCenterId: c._id }).select('_id')
      await db.models.Booking.create({ teacherId: jwt.decode(teacher.token).id, studentId: pupil._id, managedCenterId: c._id, classTitle: 'Current lesson', scheduledTime: now, completedAt: now, duration: 60, status: 'completed', standalonePay: { currency: 'USD', basis: 'class', rateMinor: amount, amountMinor: amount, credits: false } })
    }
    const zeroPupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c0._id, name: 'Zero pupil' })).body.data.id
    await db.models.Booking.create({ teacherId: jwt.decode(teacher.token).id, studentId: zeroPupil, managedCenterId: c0._id, classTitle: 'Zero rate lesson', scheduledTime: now, completedAt: now, duration: 60, status: 'completed', standalonePay: { currency: 'USD', basis: 'class', rateMinor: 0, amountMinor: 0, credits: false } })
    const current = (await call(teacher, 'get', '/earnings')).body.data
    expect(current.find(c => c._id === c1._id).totals[0]).toMatchObject({ earned: 2000, chargesTotal: 900 })
    expect(current.find(c => c._id === c2._id).totals[0]).toMatchObject({ earned: 4000, chargesTotal: 1500 })
    expect(current.find(c => c._id === c0._id).totals[0]).toMatchObject({ earned: 0, chargesTotal: 100 })
    expect((await request(app).get(`${root}/admin/earnings`).set('Authorization', `Bearer ${teacher.token}`)).status).toBe(403)
    const report = await admin('get', '/admin/earnings')
    expect(report.status).toBe(200)
    const teacherReport = report.body.data.teachers.find(t => t.id === w._id)
    expect(teacherReport.centers.find(c => c._id === c1._id).totals[0]).toMatchObject({ earned: 2000, chargesTotal: 900 })
    expect(teacherReport.centers.find(c => c._id === c2._id).totals[0]).toMatchObject({ earned: 4000, chargesTotal: 1500 })
    const usd = report.body.data.totals.find(t => t.currency === 'USD')
    const sums = report.body.data.teachers.flatMap(t => t.centers).flatMap(c => c.totals).filter(t => t.currency === 'USD')
    expect(usd.chargesTotal).toBe(sums.reduce((n, t) => n + t.chargesTotal, 0))
  })
  it('tracks a non-prepaid student balance once per attended completion and shows it to their family', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Counted classes', notificationEmail: 'office@example.test', currency: 'USD', rateMinor: 500, payBasis: 'class', prepaid: false })).body.data
    const created = await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Balance pupil', classCount: 4 })
    expect(created.status).toBe(200)
    const pupil = created.body.data.id, family = root + '/family/' + created.body.data.parentLink.split('/').at(-1)
    const unlock = await request(app).post(`${family}/unlock`).send({ studentName: 'Balance pupil' })
    const token = unlock.body.data.access
    const lesson = await call(teacher, 'post', '/work').send({ centerId: c._id, studentId: pupil, title: 'Counted lesson', duration: 30, scheduledTime: new Date(Date.now() + 100 * 86400000).toISOString() })
    expect((await call(teacher, 'patch', `/work/${lesson.body.data._id}`).send({ complete: true })).status).toBe(200)
    expect((await call(teacher, 'patch', `/work/${lesson.body.data._id}`).send({ complete: true })).status).toBe(200)
    const notices = sent.filter(mail => mail.subject === 'Class manually marked as taught' && mail.to === 'office@example.test');
    expect(notices).toHaveLength(1)
    expect(notices[0].text).toContain('Class: Counted lesson')
    expect(notices[0].html).toContain('Balance pupil')
    const page = await request(app).get(family).set('x-share-access', token)
    expect(page.body.data.student).toMatchObject({ classesRemaining: 3, classesUsed: 1 })
    expect(page.body.data.manualCompletions).toMatchObject([{ classTitle: 'Counted lesson', completedAt: expect.any(String), scheduledTime: expect.any(String) }])
    expect((await call(teacher, 'patch', `/managed-students/${pupil}`).send({ classCount: 8 })).status).toBe(200)
    expect((await request(app).get(family).set('x-share-access', token)).body.data.student.classesRemaining).toBe(8)
    const otherPupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Group balance', classCount: 3 })).body.data.id
    const group = await call(teacher, 'post', '/work').send({ centerId: c._id, studentIds: [pupil, otherPupil], group: true, title: 'Counted group', duration: 30, scheduledTime: new Date(Date.now() + 101 * 86400000).toISOString() })
    expect((await request(app).post(`${family}/schedule/${group.body.data._id}/absence`).set('x-share-access', token).send({ group: true })).status).toBe(200)
    expect(sent.at(-1)).toMatchObject({ to: ['solo1@test.com', 'office@example.test'], centerName: c.name, subject: 'Student absence notification', text: expect.stringContaining('Counted group') })
    expect((await call(teacher, 'patch', `/work/${group.body.data._id}`).send({ complete: true })).status).toBe(200)
    expect(sent.at(-1)).toMatchObject({ to: 'office@example.test', subject: 'Class manually marked as taught', text: expect.stringContaining('Counted group') })
    const pupils = (await call(teacher, 'get', `/managed-students?centerId=${c._id}`)).body.data
    expect(pupils.find(s => s._id === pupil).classCredits).toBe(8)
    expect(pupils.find(s => s._id === otherPupil).classCredits).toBe(2)
    expect((await call(other, 'patch', `/managed-students/${pupil}`).send({ classCount: 50 })).status).toBe(400)
    expect((await call(teacher, 'patch', `/managed-students/${pupil}`).send({ classCount: -1 })).status).toBe(400)
  })
  it('decrements a tracked balance once when a joined classroom completes', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Classroom balance', currency: 'USD', rateMinor: 500, payBasis: 'class', prepaid: false })).body.data
    const pupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Classroom pupil', classCount: 4 })).body.data.id
    const lesson = (await call(teacher, 'post', '/work').send({ centerId: c._id, studentId: pupil, title: 'Joined lesson', duration: 15, scheduledTime: new Date(Date.now() + 110 * 86400000).toISOString() })).body.data
    expect((await call(teacher, 'post', '/classroom/attendance').send({ bookingId: lesson._id, action: 'join' })).status).toBe(200)
    expect((await call(teacher, 'post', '/classroom/managed-presence').send({ bookingId: lesson._id, present: true })).status).toBe(200)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    expect((await db.models.Student.findById(pupil)).classCredits).toBe(4)
    await db.models.ClassroomSession.updateOne({ bookingId: lesson._id }, { $set: { classStartedAt: new Date(Date.now() - 900000), bothActiveTime: 900 } })
    expect((await call(teacher, 'post', '/classroom/auto-complete').send({ bookingId: lesson._id, clientBothActiveTime: 900 })).body.completed).toBe(true)
    expect((await call(teacher, 'post', '/classroom/auto-complete').send({ bookingId: lesson._id })).body.alreadyProcessed).toBe(true)
    expect((await db.models.Student.findById(pupil)).classCredits).toBe(3)
  })
  it('cancels invitations and makes replacement invitations single-use', async () => {
    const pending = await admin('post', '/admin/workspaces').send({ name: 'Pending', email: 'pending@test.com' })
    const old = sent.at(-1).html.match(/teacher-mode\/setup\/([A-Za-z0-9_-]{43})/)[1]
    const id = pending.body.data.id
    expect((await admin('post', `/admin/workspaces/${id}/revoke-invite`).send({})).status).toBe(200)
    expect((await request(app).post(`${root}/setup/${old}`).send({ password: 'Teacher@56789', acceptTerms: true, continent: 'Africa', gender: 'Prefer not to say' })).status).toBe(400)
    expect((await admin('post', `/admin/workspaces/${id}/resend`).send({})).status).toBe(200)
    const replacement = sent.at(-1).html.match(/teacher-mode\/setup\/([A-Za-z0-9_-]{43})/)[1]
    expect(replacement).not.toBe(old)
    expect((await request(app).post(`${root}/setup/${replacement}`).send({ password: 'Teacher@56789', acceptTerms: true, continent: 'Africa', gender: 'Prefer not to say' })).status).toBe(200)
  })
  it('supports authenticator and one-use backup codes and protects password changes', async () => {
    const user = await invite('security-mode@test.com')
    const setup = await call(user, 'post', '/2fa/setup').send({})
    expect(setup.status).toBe(200)
    const { default: speakeasy } = await import('speakeasy')
    const otp = () => speakeasy.totp({ secret: setup.body.secret, encoding: 'base32' })
    const enabled = await call(user, 'post', '/2fa/verify').send({ token: otp() })
    expect(enabled.status).toBe(200); expect(enabled.body.backupCodes).toHaveLength(10)
    const email = 'security-mode@test.com', password = 'Teacher@56789'
    const pending = await request(app).post(`${root}/login`).send({ email, password })
    expect(pending.status).toBe(202); expect(pending.body.requires2FA).toBe(true)
    const { trackFailedLogin, clearFailedAttempts } = await import('../middleware/rateLimiter.js')
    vi.mocked(trackFailedLogin).mockClear(); vi.mocked(clearFailedAttempts).mockClear()
    expect((await request(app).post(`${root}/login`).send({ email, password, twoFactorToken: '000000' === otp() ? '111111' : '000000' })).status).toBe(401)
    expect(trackFailedLogin).toHaveBeenCalled(); expect(clearFailedAttempts).not.toHaveBeenCalled()
    const login = await request(app).post(`${root}/login`).send({ email, password, twoFactorToken: otp() })
    expect(login.status).toBe(200); expect(clearFailedAttempts).toHaveBeenCalled()
    const backup = enabled.body.backupCodes[0]
    expect((await request(app).post(`${root}/login`).send({ email, password, backupCode: backup })).status).toBe(200)
    expect((await request(app).post(`${root}/login`).send({ email, password, backupCode: backup })).status).toBe(401)
    const current = { token: login.body.token }
    expect((await call(current, 'post', '/auth/teacher/change-password').send({ currentPassword: 'wrong', newPassword: 'Updated@56789' })).status).toBe(401)
    expect((await call(current, 'post', '/auth/teacher/change-password').send({ currentPassword: password, newPassword: 'Updated@56789' })).status).toBe(200)
    expect((await call(user, 'get', '/workspace')).status).toBe(401)
    expect((await request(app).post(`${root}/login`).send({ email, password: 'Updated@56789', twoFactorToken: otp() })).status).toBe(200)
  })
  it('accepts private ratings on completed individual and group classes', async () => {
    const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Rating center', currency: 'USD', rateMinor: 1000, payBasis: 'class', prepaid: false })).body.data
    const a = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Rating Alpha', classCount: 4 })).body.data
    const b = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Rating Beta', classCount: 4 })).body.data
    async function family(pupil, name) {
      const link = (await call(teacher, 'post', `/managed-students/${pupil.id}/parent-link`).send({})).body.data.url
      const url = root + '/family/' + link.split('/').at(-1)
      const unlocked = await request(app).post(url + '/unlock').send({ studentName: name })
      expect(unlocked.status).toBe(200)
      return { url, access: unlocked.body.data.access }
    }
    const fa = await family(a, 'Rating Alpha'), fb = await family(b, 'Rating Beta')
    const single = await call(teacher, 'post', '/work').send({ centerId: c._id, studentId: a.id, title: 'Rating individual', duration: 30, scheduledTime: new Date(Date.now() + 80 * 86400000).toISOString() })
    const group = await call(teacher, 'post', '/work').send({ centerId: c._id, studentIds: [a.id, b.id], group: true, title: 'Rating group', duration: 30, scheduledTime: new Date(Date.now() + 81 * 86400000).toISOString() })
    expect(single.status).toBe(200); expect(group.status).toBe(200)
    const post = (f, id) => request(app).post(`${f.url}/schedule/${id}/review`).set('x-share-access', f.access)
    const one = single.body.data._id, many = group.body.data._id
    expect((await post(fa, one).send({ group: false, rating: 5 })).status).toBe(404)
    const db = global.__TEST_DB__.useDb(jwt.decode(teacher.token).centerId, { useCache: true })
    await db.models.Booking.updateOne({ _id: one }, { $set: { status: 'completed' } })
    await db.models.GroupClass.updateOne({ _id: many }, { $set: { status: 'completed' } })
    expect((await request(app).post(`${fa.url}/schedule/${one}/review`).send({ group: false, rating: 4 })).status).toBe(403)
    expect((await post(fb, one).send({ group: false, rating: 4 })).status).toBe(404)
    expect((await post(fa, one).send({ group: false, rating: 6 })).status).toBe(400)
    expect((await post(fa, one).send({ group: false, rating: 4, comment: 'Helpful lesson' })).status).toBe(200)
    expect((await post(fa, many).send({ group: true, rating: 5 })).status).toBe(200)
    expect((await post(fb, many).send({ group: true, rating: 2 })).status).toBe(200)
    expect((await post(fa, one).send({ group: false, rating: 3, comment: 'Updated' })).status).toBe(200)
    const schedule = await request(app).get(fa.url + '/schedule?view=completed').set('x-share-access', fa.access)
    expect(schedule.body.data.classes.find(x => x.id === one).parentReview).toMatchObject({ rating: 3, comment: 'Updated' })
    const teacherId = jwt.decode(teacher.token).id
    const reviews = await call(teacher, 'get', `/reviews/teacher/${teacherId}?managedCenterId=${c._id}`)
    expect(reviews.status).toBe(200)
    expect(reviews.body.stats).toMatchObject({ total: 3, avgRating: 3.3 })
    expect(reviews.body.reviews.filter(x => x.bookingId?.classTitle === 'Rating group')).toHaveLength(2)
    expect((await call(teacher, 'get', `/reviews/my-trends?managedCenterId=${c._id}`)).status).toBe(200)
    expect((await call(other, 'get', `/reviews/teacher/${teacherId}`)).status).toBe(403)
  })
  it('does not disclose account existence when reset email delivery fails', async () => {
    const { sendEmail } = await import('../emails/core.js')
    vi.mocked(sendEmail).mockResolvedValueOnce({ success: false, error: 'Delivery unavailable' })
    const existing = await request(app).post(`${root}/forgot-password`).send({ email: 'solo2@test.com' })
    const missing = await request(app).post(`${root}/forgot-password`).send({ email: 'not-a-user@test.com' })
    expect(existing.status).toBe(200); expect(existing.body).toEqual(missing.body)
  })
  it('resets passwords once and rejects the previous device session', async () => {
    expect((await request(app).post(root + '/forgot-password').send({ email: 'solo2@test.com' })).status).toBe(200)
    const raw = sent.at(-1).html.match(/teacher-mode\/reset\/([A-Za-z0-9_-]{43})/)[1]
    expect((await request(app).post(`${root}/reset/${raw}`).send({ password: 'Replacement@56789' })).status).toBe(200)
    expect((await request(app).post(`${root}/reset/${raw}`).send({ password: 'Replacement@56789' })).status).toBe(400)
    expect((await call(other, 'get', '/workspace')).status).toBe(401)
    expect((await request(app).post(root + '/login').send({ email: 'solo2@test.com', password: 'Replacement@56789' })).status).toBe(200)
  })
it('reserves a whole series against paid credits', async () => {
  const c = (await call(teacher, 'post', '/managed-centers').send({ name: 'Series', currency: 'USD', rateMinor: 500, payBasis: 'class' })).body.data
  const pupil = (await call(teacher, 'post', '/managed-students').send({ centerId: c._id, name: 'Series pupil', classCount: 0 })).body.data
  const dates = [300, 307, 314].map(days => new Date(Date.now() + days * 86400000).toISOString())
  const book = scheduledDates => call(teacher, 'post', '/work').send({ centerId: c._id, studentId: pupil.id, title: 'Weekly lesson', classAmountMinor: 750, duration: 30, scheduledDates })
  expect((await book([dates[0]])).status).toBe(400)
  await call(teacher, 'patch', '/managed-students/' + pupil.id).send({ classCount: 2 })
  expect((await book(dates)).status).toBe(400)
  const series = await book(dates.slice(0, 2))
  expect(series.status).toBe(200)
  expect((await book([dates[2]])).status).toBe(400)
  expect((await call(teacher, 'patch', '/work/' + series.body.data._id).send({ complete: true })).status).toBe(200)
  const students = await call(teacher, 'get', '/managed-students?centerId=' + c._id)
  expect(students.body.data[0]).toMatchObject({ classesUsed: 1, classCredits: 1 })
  const history = await call(teacher, 'get', '/earnings/history?centerId=' + c._id)
  expect(history.body.data.entries[0]).toMatchObject({ amountMinor: 750, basis: 'class' })
})

  it('suspends teacher access and family links together', async () => {
    const link = await call(teacher, 'post', `/managed-students/${student}/parent-link`).send({})
    const route = root + '/family/' + link.body.data.url.split('/').at(-1)
    const w = (await admin('get', '/admin/workspaces')).body.data.find(w => w.email === 'solo1@test.com')
    expect((await admin('patch', `/admin/workspaces/${w._id}`).send({ status: 'suspended' })).status).toBe(200)
    expect((await call(teacher, 'get', '/workspace')).status).toBe(401)
    expect((await request(app).post(route + '/unlock').send({ studentName: 'Linh' })).status).toBe(410)
  })
})




