// #17 — the auth routes that check tokens themselves (verify, change-password,
//        accept-terms) must reject a logged-out / remotely signed-out token, and
//        a token for the wrong role.
// #18 — a revoked super-admin impersonation is refused everywhere verifyToken
//        runs, not only behind verifyAdmin.
import { vi, describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

// Minimal in-memory Redis so impersonation whitelisting can be exercised
const store = new Map()
vi.mock('../config/redis.js', () => ({
  default: {
    get: async (k) => (store.has(k) ? store.get(k) : null),
    set: async (k, v) => { store.set(k, v); return 'OK' },
    setex: async (k, _ttl, v) => { store.set(k, v); return 'OK' },
    del: async (...ks) => { ks.flat().forEach(k => store.delete(k)); return 1 },
  },
}))
vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))
vi.mock('../middleware/rateLimiter.js', () => ({
  loginLimiter: (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  trackFailedLogin: vi.fn().mockResolvedValue(undefined),
  isAccountLocked: vi.fn().mockResolvedValue({ isLocked: false }),
  clearFailedAttempts: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../utils/emailService.js', () => ({
  sendForgotPasswordEmail: vi.fn(), sendStudentForgotPasswordEmail: vi.fn(), sendAdminForgotPasswordEmail: vi.fn(),
}))

const { default: authRouter } = await import('../routes/authRoutes.js')
const { verifyToken, addToLocalBlacklist } = await import('../middleware/authMiddleware.js')
const { tenantMiddleware } = await import('../middleware/tenantMiddleware.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
// Stand-in for every route that checks the role itself after verifyToken
app.get('/api/protected', tenantMiddleware, verifyToken, (req, res) => res.json({ role: req.user.role }))

// nonce: two tokens with the same claims in the same second would otherwise be identical
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', nonce: Math.random(), ...claims },
  getCenterSecret('testcenter'), { expiresIn: '5m' })
const bearer = (r, t) => r.set('Authorization', `Bearer ${t}`)

let ids
beforeAll(async () => {
  const db = global.__TEST_DB__
  ids = {
    teacher: (await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email }))._id,
    student: (await db.models.Student.findOne({ email: CREDENTIALS.student.email }))._id,
    admin:   (await db.models.Admin.findOne({ email: CREDENTIALS.admin.email }))._id,
  }
})

const changePw = { currentPassword: 'Test@1234!', newPassword: 'Another@5678!' }

describe('#17 logged-out tokens are refused by the self-checking auth routes', () => {
  const cases = [
    ['teacher', 'get',  '/api/auth/verify'],
    ['teacher', 'post', '/api/auth/teacher/change-password', changePw],
    ['student', 'get',  '/api/auth/student/verify'],
    ['student', 'post', '/api/auth/student/change-password', changePw],
    ['student', 'post', '/api/auth/accept-terms'],
    ['admin',   'get',  '/api/auth/admin/verify'],
    ['admin',   'post', '/api/auth/admin/change-password', changePw],
  ]

  it.each(cases)('%s %s %s', async (role, method, path, body) => {
    const token = sign({ id: String(ids[role]), role })
    addToLocalBlacklist(token) // what logout / remote sign-out does
    const res = await bearer(request(app)[method](path), token).send(body || {})
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('SESSION_REVOKED')
  })

  it('a valid token still works', async () => {
    const res = await bearer(request(app).get('/api/auth/student/verify'), sign({ id: String(ids.student), role: 'student' }))
    expect(res.status).toBe(200)
  })

  it('a token for another role is refused', async () => {
    const res = await bearer(request(app).get('/api/auth/admin/verify'), sign({ id: String(ids.student), role: 'student' }))
    expect(res.status).toBe(403)
  })
})

describe('#18 impersonation revocation', () => {
  const impersonation = () => sign({ id: String(new mongoose.Types.ObjectId()), role: 'admin', isImpersonation: true })

  it('works while whitelisted, and is refused by verifyToken and /admin/verify once revoked', async () => {
    const token = impersonation()
    store.set('impers:testcenter', token.split('.')[2]) // what POST /super-admin/impersonate does
    expect((await bearer(request(app).get('/api/protected'), token)).status).toBe(200)
    expect((await bearer(request(app).get('/api/auth/admin/verify'), token)).status).toBe(200)

    store.delete('impers:testcenter') // DELETE /super-admin/impersonate/:slug
    expect((await bearer(request(app).get('/api/protected'), token)).status).toBe(401)
    expect((await bearer(request(app).get('/api/auth/admin/verify'), token)).status).toBe(401)
  })

  it('a newer impersonation replaces the older one', async () => {
    const older = impersonation()
    const newer = impersonation()
    store.set('impers:testcenter', newer.split('.')[2])
    expect((await bearer(request(app).get('/api/protected'), older)).status).toBe(401)
    expect((await bearer(request(app).get('/api/protected'), newer)).status).toBe(200)
  })
})
