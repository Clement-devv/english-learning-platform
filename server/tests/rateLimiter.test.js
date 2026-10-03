// Rate limits must not be keyed on values the client controls: rotating the
// email in the body used to give every request a fresh bucket.
import { vi, describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../emails/core.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))

const { loginLimiter, passwordResetLimiter } = await import('../middleware/rateLimiter.js')
const { default: publicRouter } = await import('../routes/publicRoutes.js')
const { sendEmail } = await import('../emails/core.js')

// Loopback is exempt from limits, so tests present a real client IP via the proxy header
function makeApp(limiter, status = 401) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.post('/x', limiter, (req, res) => res.status(status).json({ ok: status < 400 }))
  return app
}
const hit = (app, ip, body) => request(app).post('/x').set('X-Forwarded-For', ip).send(body)

describe('loginLimiter', () => {
  it('blocks one IP spraying many accounts, even with a new email each time', async () => {
    const app = makeApp(loginLimiter)
    let last
    for (let i = 0; i < 101; i++) last = await hit(app, '203.0.113.10', { email: `victim${i}@x.com`, password: 'guess' })
    expect(last.status).toBe(429)
  })

  it('blocks repeated guesses at one account, even from many IPs', async () => {
    const app = makeApp(loginLimiter)
    let last
    for (let i = 0; i < 21; i++) last = await hit(app, `198.51.100.${i + 1}`, { email: 'Target@X.com ', password: 'guess' })
    expect(last.status).toBe(429)
  })

  it('does not count successful logins (a busy school IP is fine)', async () => {
    const app = makeApp(loginLimiter, 200)
    let last
    for (let i = 0; i < 120; i++) last = await hit(app, '203.0.113.20', { email: `student${i}@x.com`, password: 'ok' })
    expect(last.status).toBe(200)
  })
})

describe('passwordResetLimiter', () => {
  it('limits one IP across rotating emails', async () => {
    const app = makeApp(passwordResetLimiter, 200)
    let last
    for (let i = 0; i < 21; i++) last = await hit(app, '203.0.113.30', { email: `p${i}@x.com` })
    expect(last.status).toBe(429)
  })
})

describe('POST /public/contact', () => {
  const app = express()
  app.set('trust proxy', 1)
  app.use(express.json())
  app.use('/public', publicRouter)
  const send = (body) => request(app).post('/public/contact').set('X-Forwarded-For', '203.0.113.40').send(body)

  it('escapes HTML from the visitor and strips line breaks from the subject', async () => {
    const res = await send({ name: 'Eve\r\nBcc: x@y.com', email: 'eve@x.com', message: '<img src=x onerror=alert(1)><a href="https://evil">click</a>' })
    expect(res.status).toBe(200)
    const mail = sendEmail.mock.calls.at(-1)[0]
    expect(mail.html).not.toContain('<img')
    expect(mail.html).not.toContain('<a href="https://evil"')
    expect(mail.html).toContain('&lt;img')
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it('allows only a few messages per hour from one IP', async () => {
    let last
    for (let i = 0; i < 6; i++) last = await send({ name: 'A', email: `a${i}@x.com`, message: 'hi' })
    expect(last.status).toBe(429)
  })
})
