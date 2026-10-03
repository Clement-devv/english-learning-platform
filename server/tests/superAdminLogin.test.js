// Super-admin sign-in needs the password AND a code emailed to the account.
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const sent = []
vi.mock('../utils/emailService.js', async (orig) => {
  const real = await orig()
  return {
    ...Object.fromEntries(Object.keys(real).map(k => [k, typeof real[k] === 'function' ? vi.fn().mockResolvedValue({ success: true }) : real[k]])),
    sendEmail: vi.fn(async (mail) => { sent.push(mail); return { success: true } }),
  }
})

const { default: superAdminRouter } = await import('../routes/superAdminRoutes.js')
const { default: SuperAdmin }       = await import('../models/master/SuperAdmin.js')

const app = express()
app.set('trust proxy', 1)
app.use(express.json())
app.use('/api/super-admin', superAdminRouter)

const EMAIL = 'owner@platform.test', PASSWORD = 'Sup3r@Secret!'
// Loopback is exempt from rate limits; present a client IP like production does
const post = (path, body) => request(app).post(`/api/super-admin${path}`).set('X-Forwarded-For', '203.0.113.77').send(body)
const lastCode = () => /letter-spacing:6px[^>]*>(\d{6})</.exec(sent.at(-1).html)[1]

beforeAll(async () => {
  const c = global.__TEST_DB__
  await mongoose.connect(`mongodb://${c.host}:${c.port}/master-test`)
  await SuperAdmin.create({ firstName: 'Ow', lastName: 'Ner', email: EMAIL, password: await bcrypt.hash(PASSWORD, 4), active: true })
})
afterAll(async () => { await mongoose.disconnect() })

describe('super-admin sign-in', () => {
  it('a correct password alone does not give a session token', async () => {
    const res = await post('/login', { email: EMAIL, password: PASSWORD })
    expect(res.status).toBe(202)
    expect(res.body.requires2FA).toBe(true)
    expect(res.body.token).toBeUndefined()
    expect(sent.at(-1).to).toBe(EMAIL)
  })

  it('the pending token is useless on admin routes', async () => {
    const { body } = await post('/login', { email: EMAIL, password: PASSWORD })
    const res = await request(app).get('/api/super-admin/centers').set('Authorization', `Bearer ${body.pendingToken}`)
    expect(res.status).toBe(401)
  })

  it('wrong codes are limited, then the code is burned', async () => {
    await SuperAdmin.updateOne({ email: EMAIL }, { $unset: { loginCode: 1 } })
    const { body } = await post('/login', { email: EMAIL, password: PASSWORD })
    const real = lastCode()
    const wrong = real === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) expect((await post('/login/verify', { pendingToken: body.pendingToken, code: wrong })).status).toBe(400)
    const locked = await post('/login/verify', { pendingToken: body.pendingToken, code: wrong })
    expect(locked.status).toBe(429)
    // Even the right code no longer works — must start over with the password
    expect((await post('/login/verify', { pendingToken: body.pendingToken, code: real })).status).toBe(401)
  })

  it('password + emailed code signs in, and the code works only once', async () => {
    await SuperAdmin.updateOne({ email: EMAIL }, { $unset: { loginCode: 1 } })
    const { body } = await post('/login', { email: EMAIL, password: PASSWORD })
    const code = lastCode()

    const ok = await post('/login/verify', { pendingToken: body.pendingToken, code })
    expect(ok.status).toBe(200)
    expect(ok.body.token).toBeTruthy()
    expect(ok.body.superAdmin.email).toBe(EMAIL)

    const centers = await request(app).get('/api/super-admin/centers').set('Authorization', `Bearer ${ok.body.token}`)
    expect(centers.status).toBe(200)

    expect((await post('/login/verify', { pendingToken: body.pendingToken, code })).status).toBe(401)
  })
})
