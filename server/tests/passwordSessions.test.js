// A password change/reset must end the account's other sessions (a stolen
// refresh token must not keep working), and API responses must never carry
// password hashes or session tokens.
import { vi, describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))
vi.mock('../utils/emailService.js', async (orig) => {
  const real = await orig()
  const stubbed = Object.fromEntries(Object.keys(real).map(k => [k, typeof real[k] === 'function' ? vi.fn().mockResolvedValue({ success: true }) : real[k]]))
  return stubbed
})

const { default: authRouter }    = await import('../routes/authRoutes.js')
const { default: studentRouter } = await import('../routes/studentRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret }     = await import('../utils/jwtUtils.js')
const { isTokenBlacklisted }  = await import('../middleware/authMiddleware.js')

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/students', studentRouter)

const PASSWORD = 'Old@Pass1234'
const sign = (role, id, sid) => jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter', sid: String(sid) },
  getCenterSecret('testcenter'), { expiresIn: '15m' },
)

/** Create an account with two signed-in devices; returns { doc, phone, laptop } (sessions with tokens). */
async function withTwoDevices(Model, role, extra) {
  const id = new mongoose.Types.ObjectId()
  const devices = ['phone', 'laptop'].map(name => {
    const _id = new mongoose.Types.ObjectId()
    return { _id, token: crypto.randomBytes(32).toString('hex'), jwtToken: sign(role, id, _id), isActive: true, deviceInfo: { browser: name } }
  })
  const doc = await Model.create({
    _id: id, password: await bcrypt.hash(PASSWORD, 4), active: true, status: 'active',
    firstName: 'P', lastName: 'S', sessions: devices, ...extra,
  })
  return { doc, phone: devices[0], laptop: devices[1] }
}

let Student, Teacher, Admin
beforeAll(() => {
  Student = global.__TEST_DB__.models.Student
  Teacher = global.__TEST_DB__.models.Teacher
  Admin   = global.__TEST_DB__.models.Admin
})

describe('password change ends other sessions', () => {
  it('student change-password keeps this device, signs out the other and revokes its token', async () => {
    const { doc, phone, laptop } = await withTwoDevices(Student, 'student', { email: 'pw-student@test.com' })

    const res = await request(app).post('/api/auth/student/change-password')
      .set('Authorization', `Bearer ${phone.jwtToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'New@Pass56789' })
    expect(res.status).toBe(200)

    const after = await Student.findById(doc._id)
    expect(after.sessions.id(phone._id).isActive).toBe(true)
    expect(after.sessions.id(laptop._id).isActive).toBe(false)
    expect(after.sessions.id(laptop._id).revokedReason).toBe('password-changed')
    expect(await isTokenBlacklisted(laptop.jwtToken)).toBe(true)
    expect(await isTokenBlacklisted(phone.jwtToken)).toBe(false)

    // The stolen laptop session can no longer be renewed
    const refresh = await request(app).post('/api/auth/refresh')
      .send({ sessionToken: laptop.token, expiredToken: laptop.jwtToken })
    expect(refresh.status).toBe(401)
  })

  it('teacher reset via email link signs out every device', async () => {
    const resetToken = crypto.randomBytes(32).toString('hex')
    const { doc } = await withTwoDevices(Teacher, 'teacher', {
      email: 'pw-teacher@test.com', continent: 'Africa',
      resetPasswordToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 3600_000), resetPasswordCenter: 'testcenter',
    })

    const res = await request(app).post(`/api/auth/teacher/reset-password/${resetToken}`).send({ newPassword: 'New@Pass56789' })
    expect(res.status).toBe(200)

    const after = await Teacher.findById(doc._id)
    expect(after.sessions.every(s => !s.isActive)).toBe(true)
  })

  it('staff issuing a temporary student password signs the student out', async () => {
    const { doc } = await withTwoDevices(Student, 'student', { email: 'pw-student2@test.com' })
    const admin = await Admin.findOne({})

    const res = await request(app).post(`/api/students/${doc._id}/reset-password`)
      .set('Authorization', `Bearer ${sign('admin', admin._id, new mongoose.Types.ObjectId())}`)
    expect(res.status).toBe(200)

    const after = await Student.findById(doc._id)
    expect(after.sessions.every(s => !s.isActive)).toBe(true)
  })
})

describe('student passwords: admins or the student only', () => {
  it('a teacher cannot reset a student password or edit the student', async () => {
    const { doc } = await withTwoDevices(Student, 'student', { email: 'pw-student4@test.com' })
    const teacher = await Teacher.findOne({})
    const auth = `Bearer ${sign('teacher', teacher._id, new mongoose.Types.ObjectId())}`

    const reset = await request(app).post(`/api/students/${doc._id}/reset-password`).set('Authorization', auth)
    expect(reset.status).toBe(403)
    expect(reset.body.tempPassword).toBeUndefined()

    const edit = await request(app).put(`/api/students/${doc._id}`).set('Authorization', auth)
      .send({ email: 'teacher-owned@test.com', password: 'Taken@123456' })
    expect(edit.status).toBe(403)

    const after = await Student.findById(doc._id)
    expect(after.email).toBe('pw-student4@test.com')
    expect(await bcrypt.compare(PASSWORD, after.password)).toBe(true)
  })

  it('a student can still reset their own password from the email link', async () => {
    const { doc } = await withTwoDevices(Student, 'student', { email: 'pw-student5@test.com' })

    const forgot = await request(app).post('/api/auth/student/forgot-password').send({ email: 'pw-student5@test.com' })
    expect(forgot.status).toBe(200)
    const withToken = await Student.findById(doc._id)
    expect(withToken.resetPasswordToken).toBeTruthy()   // a link was issued

    // Simulate the emailed link (only its hash is stored, so issue a known one)
    const raw = crypto.randomBytes(32).toString('hex')
    withToken.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex')
    await withToken.save()

    const reset = await request(app).post(`/api/auth/student/reset-password/${raw}`).send({ newPassword: 'Mine@Again2026' })
    expect(reset.status).toBe(200)
    const after = await Student.findById(doc._id)
    expect(await bcrypt.compare('Mine@Again2026', after.password)).toBe(true)
    expect(after.sessions.every(s => !s.isActive)).toBe(true)
  })
})

describe('account secrets never reach the browser', () => {
  it('PUT /students/:id response has no password hash or session tokens', async () => {
    const { doc } = await withTwoDevices(Student, 'student', { email: 'pw-student3@test.com', inviteToken: 'secret-invite' })
    const admin = await Admin.findOne({})

    const res = await request(app).put(`/api/students/${doc._id}`)
      .set('Authorization', `Bearer ${sign('admin', admin._id, new mongoose.Types.ObjectId())}`)
      .send({ firstName: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.student.firstName).toBe('Renamed')
    for (const f of ['password', 'sessions', 'inviteToken']) expect(res.body.student).not.toHaveProperty(f)
  })
})
