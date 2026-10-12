// The "password OK, 2FA still needed" token must only work on /auth/verify-2fa-login —
// never as a login token (it previously passed verifyToken with role: 'admin').
import { vi, describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

vi.mock('../middleware/rateLimiter.js', () => ({
  loginLimiter:         (req, res, next) => next(),
  passwordResetLimiter: (req, res, next) => next(),
  trackFailedLogin:     vi.fn().mockResolvedValue(undefined),
  isAccountLocked:      vi.fn().mockResolvedValue({ isLocked: false }),
  clearFailedAttempts:  vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/emailService.js', () => ({
  sendForgotPasswordEmail:        vi.fn().mockResolvedValue({ success: true }),
  sendStudentForgotPasswordEmail: vi.fn().mockResolvedValue({ success: true }),
  sendAdminForgotPasswordEmail:   vi.fn().mockResolvedValue({ success: true }),
  sendNewDeviceSignInEmail:       vi.fn().mockResolvedValue({ success: true }),
}))

const { default: authRouter } = await import('../routes/authRoutes.js')
const { verifyToken } = await import('../middleware/authMiddleware.js')
const { tenantMiddleware } = await import('../middleware/tenantMiddleware.js')
const { encrypt, hashBackupCode } = await import('../utils/fieldEncryption.js')
const { default: passwordHash } = await import('../utils/passwordHash.js')
const { adminSchema } = await import('../schemas/adminSchema.js')

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
// Stand-in for every center route guarded by verifyToken + a role check
app.get('/api/protected', tenantMiddleware, verifyToken, (req, res) => res.json({ role: req.user.role }))

const ADMIN = { username: 'twofaadmin', email: 'twofa@test.com', password: 'Test@1234!' }
const BACKUP = 'BACKUP-CODE-1'

beforeAll(async () => {
  const Admin = global.__TEST_DB__.models.Admin || global.__TEST_DB__.model('Admin', adminSchema)
  await Admin.create({
    username: ADMIN.username, email: ADMIN.email, firstName: 'Two', lastName: 'Factor',
    password: await passwordHash.hash(ADMIN.password, 10), active: true,
    twoFactorEnabled: true, twoFactorSecret: encrypt('JBSWY3DPEHPK3PXP'),
    twoFactorBackupCodes: [hashBackupCode(BACKUP)],
  })
})

const loginForPending = async () => {
  const res = await request(app).post('/api/auth/admin/login').send({ username: ADMIN.username, password: ADMIN.password })
  expect(res.status).toBe(202)
  expect(res.body.pendingToken).toBeDefined()
  return res.body.pendingToken
}

describe('2FA pending token', () => {
  it('is rejected by verifyToken (cannot act as an admin login token)', async () => {
    const pendingToken = await loginForPending()
    const res = await request(app).get('/api/protected').set('Authorization', `Bearer ${pendingToken}`)
    expect(res.status).toBe(401)
  })

  it('is rejected by /auth/admin/verify', async () => {
    const pendingToken = await loginForPending()
    const res = await request(app).get('/api/auth/admin/verify').set('Authorization', `Bearer ${pendingToken}`)
    expect(res.status).toBe(401)
  })

  it('still completes the login on /auth/verify-2fa-login', async () => {
    const pendingToken = await loginForPending()
    const res = await request(app).post('/api/auth/verify-2fa-login').send({ pendingToken, backupCode: BACKUP })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()

    // ...and the real login token it issues does pass verifyToken
    const ok = await request(app).get('/api/protected').set('Authorization', `Bearer ${res.body.token}`)
    expect(ok.status).toBe(200)
    expect(ok.body.role).toBe('admin')
  })
})
