// #20 — one email = one center admin, guaranteed by a unique index (the friendly
// check in utils/centerEmail.js can lose a race). Rejected registrations don't
// hold the email.
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import mongoose from 'mongoose'

vi.mock('../utils/emailService.js', () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))

const { default: Center } = await import('../models/master/Center.js')
const { isEmailTakenError } = await import('../utils/centerEmail.js')
const { default: registrationRouter } = await import('../routes/centerRegistrationRoutes.js')

const app = express()
app.use(express.json())
app.use('/api/register-center', registrationRouter)

// The Center model lives on the default (master) connection — point it at the test MongoDB
beforeAll(async () => {
  const c = global.__TEST_DB__
  await mongoose.connect(`mongodb://${c.host}:${c.port}/master_email_test`)
  await Center.init()
})
afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
beforeEach(() => Center.deleteMany({}))

const center = (slug, adminEmail, status) => Center.create({ centerName: slug, slug, adminEmail, dbName: slug, status })

describe('one admin email per center', () => {
  it('the database refuses a second live center with the same email', async () => {
    await center('one', 'owner@school.com', 'active')
    const err = await center('two', 'owner@school.com', 'pending').catch(e => e)
    expect(isEmailTakenError(err)).toBe(true)
  })

  it('a rejected registration does not hold the email', async () => {
    await center('old', 'owner@school.com', 'rejected')
    await expect(center('new', 'owner@school.com', 'pending')).resolves.toBeTruthy()
    await expect(center('older', 'owner@school.com', 'rejected')).resolves.toBeTruthy()
  })

  it('emails are compared case-insensitively (stored lowercase)', async () => {
    await center('one', 'Owner@School.com', 'active')
    const err = await center('two', 'owner@school.com', 'active').catch(e => e)
    expect(isEmailTakenError(err)).toBe(true)
  })

  it('a slug clash is not mistaken for an email clash', async () => {
    await center('same', 'a@school.com', 'active')
    const err = await center('same', 'b@school.com', 'active').catch(e => e)
    expect(err.code).toBe(11000)
    expect(isEmailTakenError(err)).toBe(false)
  })

  it('two registrations with the same email at the same moment → one 201, one 409', async () => {
    const body = (slug) => ({ centerName: `School ${slug}`, slug, adminEmail: 'race@school.com', password: 'Str0ng!Passw0rd', phone: '+2348000000000', country: 'Nigeria' })
    const results = await Promise.all([
      request(app).post('/api/register-center').send(body('race-a')),
      request(app).post('/api/register-center').send(body('race-b')),
    ])
    expect(results.map(r => r.status).sort()).toEqual([201, 409])
    expect(await Center.countDocuments({ adminEmail: 'race@school.com' })).toBe(1)
  })
})
