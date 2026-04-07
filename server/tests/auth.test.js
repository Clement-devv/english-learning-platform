import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

// ─── Mock dependencies ────────────────────────────────────────────────────────
// vi.mock calls are hoisted above imports by Vitest, so the mocks are in
// place before authRoutes.js (and its imports) are resolved.

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

vi.mock('../middleware/rateLimiter.js', () => ({
  loginLimiter:          (req, res, next) => next(),
  passwordResetLimiter:  (req, res, next) => next(),
  trackFailedLogin:      vi.fn().mockResolvedValue(undefined),
  isAccountLocked:       vi.fn().mockResolvedValue({ isLocked: false }),
  clearFailedAttempts:   vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/emailService.js', () => ({
  sendForgotPasswordEmail:        vi.fn().mockResolvedValue({ success: true }),
  sendStudentForgotPasswordEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAdminForgotPasswordEmail:   vi.fn().mockResolvedValue({ success: true }),
}))

// ─── Build a minimal test app ─────────────────────────────────────────────────
// Import the router AFTER mocks are declared (Vitest hoists vi.mock above this)
const { default: authRouter } = await import('../routes/authRoutes.js')

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

// ─── Teacher login ────────────────────────────────────────────────────────────
describe('POST /api/auth/teacher/login', () => {
  it('returns 200 + token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: CREDENTIALS.teacher.email, password: CREDENTIALS.teacher.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
    expect(res.body.teacher.email).toBe(CREDENTIALS.teacher.email)
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: CREDENTIALS.teacher.email, password: 'WrongPass123!' })

    expect(res.status).toBe(401)
    expect(res.body.message).toMatch(/invalid/i)
  })

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: 'nobody@test.com', password: CREDENTIALS.teacher.password })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: CREDENTIALS.teacher.email })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/required/i)
  })

  it('token contains correct role and centerId', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: CREDENTIALS.teacher.email, password: CREDENTIALS.teacher.password })

    const decoded = jwt.decode(res.body.token)
    expect(decoded.role).toBe('teacher')
    expect(decoded.centerId).toBe('testcenter')
  })
})

// ─── Student login ────────────────────────────────────────────────────────────
describe('POST /api/auth/student/login', () => {
  it('returns 200 + token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ email: CREDENTIALS.student.email, password: CREDENTIALS.student.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
    expect(res.body.student.email).toBe(CREDENTIALS.student.email)
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ email: CREDENTIALS.student.email, password: 'WrongPass123!' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ email: 'ghost@test.com', password: CREDENTIALS.student.password })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ password: CREDENTIALS.student.password })

    expect(res.status).toBe(400)
  })
})

// ─── Admin login ──────────────────────────────────────────────────────────────
describe('POST /api/auth/admin/login', () => {
  it('returns 200 + token on valid username + password', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: CREDENTIALS.admin.username, password: CREDENTIALS.admin.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.token).toBeDefined()
    expect(res.body.admin.username).toBe(CREDENTIALS.admin.username)
  })

  it('can also login with email instead of username', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: CREDENTIALS.admin.email, password: CREDENTIALS.admin.password })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: CREDENTIALS.admin.username, password: 'BadPass999!' })

    expect(res.status).toBe(401)
  })

  it('returns 400 when fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ username: CREDENTIALS.admin.username })

    expect(res.status).toBe(400)
  })
})

// ─── Token verify ─────────────────────────────────────────────────────────────
describe('GET /api/auth/verify (teacher token)', () => {
  let validToken

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/teacher/login')
      .send({ email: CREDENTIALS.teacher.email, password: CREDENTIALS.teacher.password })
    validToken = res.body.token
  })

  it('returns 200 with teacher data for a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${validToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.teacher.email).toBe(CREDENTIALS.teacher.email)
  })

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/verify')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a tampered/invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer this.is.not.valid')

    expect(res.status).toBe(401)
  })
})

// ─── Student verify ───────────────────────────────────────────────────────────
describe('GET /api/auth/student/verify', () => {
  let studentToken

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/student/login')
      .send({ email: CREDENTIALS.student.email, password: CREDENTIALS.student.password })
    studentToken = res.body.token
  })

  it('returns 200 with student data for a valid token', async () => {
    const res = await request(app)
      .get('/api/auth/student/verify')
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/auth/student/verify')
    expect(res.status).toBe(401)
  })
})

// ─── Forgot password ──────────────────────────────────────────────────────────
describe('POST /api/auth/teacher/forgot-password', () => {
  it('always returns 200 (prevents email enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/forgot-password')
      .send({ email: 'notreal@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/teacher/forgot-password')
      .send({})

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/student/forgot-password', () => {
  it('always returns 200 (prevents email enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/student/forgot-password')
      .send({ email: 'notreal@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

describe('POST /api/auth/admin/forgot-password', () => {
  it('always returns 200 (prevents email enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/admin/forgot-password')
      .send({ email: 'notreal@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})
