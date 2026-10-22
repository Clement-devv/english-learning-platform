// Super admin team: invite a partner (own login, same platform), they set a password from
// the emailed link; accounts can be switched off (signed out at once) or removed — never
// your own. Every change is told to the rest of the team.
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const sent = []
vi.mock('../utils/emailService.js', async (orig) => {
  const real = await orig()
  return { ...real, sendEmail: vi.fn(async (mail) => { sent.push(mail); return { success: true } }) }
})

const { default: teamRouter } = await import('../routes/superAdminTeamRoutes.js')
const { default: SuperAdmin } = await import('../models/master/SuperAdmin.js')
const { config, JWT_STANDARD_CLAIMS } = await import('../config/config.js')

const app = express()
app.use(express.json())
app.use('/api/super-admin/team', teamRouter)

let owner, ownerToken
const signFor = (a) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(a._id), role: 'superadmin', email: a.email }, config.jwtSecret, { expiresIn: '5m' })
const asOwner = (r) => r.set('Authorization', `Bearer ${ownerToken}`)
const linkToken = (mail) => /accept-invite\/([A-Za-z0-9_-]{43})/.exec(mail.html)[1]
const STRONG = 'Partner@Secret123'

beforeAll(async () => {
  const c = global.__TEST_DB__
  await mongoose.connect(`mongodb://${c.host}:${c.port}/master-team-test`)
  await SuperAdmin.deleteMany({})
  owner = await SuperAdmin.create({ firstName: 'Clem', lastName: 'Owner', email: 'owner@platform.test', password: await bcrypt.hash('x', 4), active: true })
  ownerToken = signFor(owner)
})
afterAll(async () => { await SuperAdmin.deleteMany({}); await mongoose.disconnect() })

describe('super admin team', () => {
  let partnerId, token

  it('invites a partner: inactive account + emailed link', async () => {
    const res = await asOwner(request(app).post('/api/super-admin/team/invite')).send({ firstName: 'Pat', lastName: 'Partner', email: 'Pat@Partner.test' })
    expect(res.status).toBe(201)
    const pat = res.body.data.find((a) => a.email === 'pat@partner.test')
    expect(pat).toMatchObject({ status: 'invited', invitedBy: 'owner@platform.test', isYou: false })
    partnerId = pat.id
    const invite = sent.find((m) => m.to === 'pat@partner.test')
    expect(invite.subject).toMatch(/invited/)
    token = linkToken(invite)
    expect((await SuperAdmin.findById(partnerId)).active).toBe(false)
    // Same email again while it's an active account → refused
    const dup = await asOwner(request(app).post('/api/super-admin/team/invite')).send({ firstName: 'Clem', lastName: 'O', email: 'owner@platform.test' })
    expect(dup.status).toBe(409)
  })

  it('resending replaces the link', async () => {
    const res = await asOwner(request(app).post(`/api/super-admin/team/${partnerId}/resend`))
    expect(res.status).toBe(200)
    const fresh = linkToken(sent.at(-1))
    expect((await request(app).get(`/api/super-admin/team/invite/${token}`)).status).toBe(404) // old link dead
    token = fresh
  })

  it('the partner sets a strong password once, then the account is active', async () => {
    const info = await request(app).get(`/api/super-admin/team/invite/${token}`)
    expect(info.status).toBe(200)
    expect(info.body.data).toMatchObject({ email: 'pat@partner.test', firstName: 'Pat' })
    expect((await request(app).post(`/api/super-admin/team/invite/${token}`).send({ password: 'short' })).status).toBe(400)

    const ok = await request(app).post(`/api/super-admin/team/invite/${token}`).send({ password: STRONG })
    expect(ok.status).toBe(200)
    const pat = await SuperAdmin.findById(partnerId).select('+invite')
    expect(pat.active).toBe(true)
    expect(pat.invite?.tokenHash).toBeUndefined()
    expect(await bcrypt.compare(STRONG, pat.password)).toBe(true)
    expect((await request(app).post(`/api/super-admin/team/invite/${token}`).send({ password: STRONG })).status).toBe(404) // used
    // The owner is told
    expect(sent.some((m) => m.to === 'owner@platform.test' && /joined/.test(m.subject))).toBe(true)
  })

  it('both see the same team list; nobody can switch themselves off', async () => {
    const pat = await SuperAdmin.findById(partnerId)
    const patToken = signFor(pat)
    const theirs = await request(app).get('/api/super-admin/team').set('Authorization', `Bearer ${patToken}`)
    expect(theirs.body.data.map((a) => a.email).sort()).toEqual(['owner@platform.test', 'pat@partner.test'])
    expect((await asOwner(request(app).patch(`/api/super-admin/team/${owner._id}`)).send({ active: false })).status).toBe(403)
    expect((await asOwner(request(app).delete(`/api/super-admin/team/${owner._id}`))).status).toBe(403)
  })

  it('switching the partner off locks them out at once', async () => {
    const pat = await SuperAdmin.findById(partnerId)
    const patToken = signFor(pat)
    const off = await asOwner(request(app).patch(`/api/super-admin/team/${partnerId}`)).send({ active: false })
    expect(off.status).toBe(200)
    expect(off.body.data.find((a) => a.email === 'pat@partner.test').status).toBe('off')
    expect((await request(app).get('/api/super-admin/team').set('Authorization', `Bearer ${patToken}`)).status).toBe(403)
  })

  it('removes the account', async () => {
    const res = await asOwner(request(app).delete(`/api/super-admin/team/${partnerId}`))
    expect(res.status).toBe(200)
    expect(await SuperAdmin.findById(partnerId)).toBeNull()
  })
})

describe('super admin passwords', () => {
  let sam
  // A token from before a password change (iat in whole seconds — make it clearly older)
  const oldTokenFor = (a) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(a._id), role: 'superadmin', email: a.email, iat: Math.floor(Date.now() / 1000) - 30 }, config.jwtSecret, { expiresIn: '5m' })
  const resetToken = (mail) => /reset-password\/([A-Za-z0-9_-]{43})/.exec(mail.html)[1]

  beforeAll(async () => {
    sam = await SuperAdmin.create({ firstName: 'Sam', lastName: 'Second', email: 'sam@partner.test', password: await bcrypt.hash(STRONG, 4), active: true, invitedBy: 'owner@platform.test' })
  })

  it('a teammate resets an invited admin: old password dead, signed out, link sets a new one', async () => {
    const samOld = oldTokenFor(sam)
    const res = await asOwner(request(app).post(`/api/super-admin/team/${sam._id}/reset-password`))
    expect(res.status).toBe(200)
    expect(res.body.data.find((a) => a.email === 'sam@partner.test').resetPending).toBe(true)
    const after = await SuperAdmin.findById(sam._id)
    expect(await bcrypt.compare(STRONG, after.password)).toBe(false)
    expect((await request(app).get('/api/super-admin/team').set('Authorization', `Bearer ${samOld}`)).status).toBe(401)

    const token = resetToken(sent.filter((m) => m.to === 'sam@partner.test' && /set a new/.test(m.subject)).at(-1))
    const info = await request(app).get(`/api/super-admin/team/reset/${token}`)
    expect(info.body.data).toMatchObject({ email: 'sam@partner.test', minLength: 12 })
    expect((await request(app).post(`/api/super-admin/team/reset/${token}`).send({ password: 'weak' })).status).toBe(400)
    expect((await request(app).post(`/api/super-admin/team/reset/${token}`).send({ password: 'Sam@New-Secret42' })).status).toBe(200)
    expect(await bcrypt.compare('Sam@New-Secret42', (await SuperAdmin.findById(sam._id)).password)).toBe(true)
    expect((await request(app).post(`/api/super-admin/team/reset/${token}`).send({ password: 'Sam@New-Secret43' })).status).toBe(404) // used
  })

  it('the main super admin can not be reset from Team', async () => {
    const res = await request(app).post(`/api/super-admin/team/${owner._id}/reset-password`).set('Authorization', `Bearer ${signFor(sam)}`)
    expect(res.status).toBe(403)
    const list = await request(app).get('/api/super-admin/team').set('Authorization', `Bearer ${signFor(sam)}`)
    expect(list.body.data.find((a) => a.email === 'owner@platform.test').isMain).toBe(true)
    expect(list.body.data.find((a) => a.email === 'sam@partner.test').isMain).toBe(false)
  })

  it('changing your own password needs the current one and signs you out', async () => {
    const samToken = signFor(sam)
    const samOld = oldTokenFor(sam)
    const wrong = await request(app).post('/api/super-admin/team/me/password').set('Authorization', `Bearer ${samToken}`).send({ currentPassword: 'nope', newPassword: 'Another@Secret77' })
    expect(wrong.status).toBe(400)
    const okRes = await request(app).post('/api/super-admin/team/me/password').set('Authorization', `Bearer ${samToken}`).send({ currentPassword: 'Sam@New-Secret42', newPassword: 'Another@Secret77' })
    expect(okRes.status).toBe(200)
    expect(await bcrypt.compare('Another@Secret77', (await SuperAdmin.findById(sam._id)).password)).toBe(true)
    expect((await request(app).get('/api/super-admin/team').set('Authorization', `Bearer ${samOld}`)).status).toBe(401)
  })

  it('the server script resets the main super admin with a printed link', async () => {
    const { execFileSync } = await import('child_process')
    const path = await import('path')
    const c = global.__TEST_DB__
    const out = execFileSync(process.execPath, [path.resolve(__dirname, '../scripts/resetSuperAdminPassword.js'), 'owner@platform.test'], {
      env: { ...process.env, MONGO_URI: `mongodb://${c.host}:${c.port}/master-team-test`, FRONTEND_URL: 'https://app.example.test' },
      encoding: 'utf8',
    })
    const token = /https:\/\/app\.example\.test\/super-admin\/reset-password\/([A-Za-z0-9_-]{43})/.exec(out)[1]
    expect((await request(app).post(`/api/super-admin/team/reset/${token}`).send({ password: 'Owner@Fresh-Secret1' })).status).toBe(200)
    expect(await bcrypt.compare('Owner@Fresh-Secret1', (await SuperAdmin.findById(owner._id)).password)).toBe(true)
  })
})
