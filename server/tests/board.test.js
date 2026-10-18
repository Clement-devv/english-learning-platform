// Board messages: the super admin's form is validated, and each dashboard only gets the
// messages aimed at its center, role and person — live, inside the date window.
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

const CENTER_A = new mongoose.Types.ObjectId()
const CENTER_B = new mongoose.Types.ObjectId()
const T1 = new mongoose.Types.ObjectId().toString()
const T2 = new mongoose.Types.ObjectId().toString()
const S1 = new mongoose.Types.ObjectId().toString()
const S2 = new mongoose.Types.ObjectId().toString()

// who is calling: set per test via the x-test-* headers
vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, _res, next) => { req.center = { _id: req.headers['x-test-center'], slug: 'c' }; next() },
}))
vi.mock('../middleware/authMiddleware.js', () => ({
  verifyToken: (req, _res, next) => { req.user = { role: req.headers['x-test-role'], id: req.headers['x-test-user'] }; next() },
}))
vi.mock('../middleware/superAdminMiddleware.js', () => ({
  verifySuperAdmin: (req, _res, next) => { req.superAdmin = { _id: 'sa', email: 'sa@x.com' }; next() },
}))
vi.mock('../middleware/rateLimiter.js', () => ({ strictLimiter: (_q, _s, n) => n() }))
vi.mock('../utils/auditLog.js', () => ({ writeAuditLog: () => {} }))

const { saBoardRoutes, centerBoardRoutes } = await import('../routes/boardRoutes.js')
const { default: BoardMessage } = await import('../models/master/BoardMessage.js')

const app = express()
app.use(express.json())
app.use('/sa', saBoardRoutes)
app.use('/board', centerBoardRoutes)

let mongod
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()) })
afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })
beforeEach(async () => { await BoardMessage.deleteMany({}) })

const base = { layout: 'text', title: 'Hello', body: 'News', durationSec: 8, showOnLogin: true, showOnClick: true }
const create = (patch) => request(app).post('/sa').send({ ...base, ...patch })
const fetchAs = (role, user, center = CENTER_A) =>
  request(app).get('/board').set('x-test-role', role).set('x-test-user', user || '').set('x-test-center', String(center))

describe('super admin form', () => {
  it('creates a message for everyone by default', async () => {
    const r = await create({ target: { roles: ['admin', 'teacher', 'student'] } })
    expect(r.status).toBe(201)
    expect(r.body.data.target.allCenters).toBe(true)
  })

  it('rejects bad input', async () => {
    expect((await create({ target: { roles: [] } })).status).toBe(400)                                    // nobody
    expect((await create({ durationSec: 1, target: { roles: ['admin'] } })).status).toBe(400)             // too short
    expect((await create({ showOnLogin: false, showOnClick: false, target: { roles: ['admin'] } })).status).toBe(400)
    expect((await create({ layout: 'image', imageUrl: '', target: { roles: ['admin'] } })).status).toBe(400)
    expect((await create({ ctaUrl: 'javascript:alert(1)', target: { roles: ['admin'] } })).status).toBe(400)
    expect((await create({ target: { roles: ['student'], allCenters: false, centerIds: [String(CENTER_A)], allStudents: false, studentIds: [] } })).status).toBe(400)
  })

  it('drops individual picks when several centers are chosen', async () => {
    const r = await create({ target: { roles: ['student'], allCenters: false, centerIds: [String(CENTER_A), String(CENTER_B)], allStudents: false, studentIds: [S1] } })
    expect(r.status).toBe(201)
    expect(r.body.data.target.allStudents).toBe(true)
    expect(r.body.data.target.studentIds).toEqual([])
  })
})

describe('dashboard fetch', () => {
  it('filters by role', async () => {
    await create({ title: 'teachers only', target: { roles: ['teacher'] } })
    expect((await fetchAs('teacher', T1)).body.data.map((m) => m.title)).toEqual(['teachers only'])
    expect((await fetchAs('student', S1)).body.data).toEqual([])
    expect((await fetchAs('admin', 'a1')).body.data).toEqual([])
  })

  it('filters by center', async () => {
    await create({ title: 'center A', target: { roles: ['student'], allCenters: false, centerIds: [String(CENTER_A)] } })
    expect((await fetchAs('student', S1, CENTER_A)).body.data).toHaveLength(1)
    expect((await fetchAs('student', S1, CENTER_B)).body.data).toHaveLength(0)
  })

  it('filters to the chosen students and teachers', async () => {
    await create({ title: 'picked', target: { roles: ['student', 'teacher'], allCenters: false, centerIds: [String(CENTER_A)], allStudents: false, studentIds: [S1], allTeachers: false, teacherIds: [T2] } })
    expect((await fetchAs('student', S1)).body.data).toHaveLength(1)
    expect((await fetchAs('student', S2)).body.data).toHaveLength(0)
    expect((await fetchAs('teacher', T2)).body.data).toHaveLength(1)
    expect((await fetchAs('teacher', T1)).body.data).toHaveLength(0)
  })

  it('hides paused, not-yet-started and ended messages', async () => {
    const day = 864e5
    await create({ title: 'paused', active: false, target: { roles: ['student'] } })
    await create({ title: 'future', startsAt: new Date(Date.now() + day).toISOString(), target: { roles: ['student'] } })
    await create({ title: 'ended', startsAt: new Date(Date.now() - 2 * day).toISOString(), endsAt: new Date(Date.now() - day).toISOString(), target: { roles: ['student'] } })
    await create({ title: 'live', target: { roles: ['student'] } })
    expect((await fetchAs('student', S1)).body.data.map((m) => m.title)).toEqual(['live'])
  })

  it('counts views and clicks', async () => {
    const { body } = await create({ target: { roles: ['student'] } })
    await request(app).post(`/board/${body.data._id}/seen`).set('x-test-role', 'student').set('x-test-center', String(CENTER_A))
    await request(app).post(`/board/${body.data._id}/click`).set('x-test-role', 'student').set('x-test-center', String(CENTER_A))
    await new Promise((r) => setTimeout(r, 50))
    const m = await BoardMessage.findById(body.data._id).lean()
    expect([m.views, m.clicks]).toEqual([1, 1])
  })
})
