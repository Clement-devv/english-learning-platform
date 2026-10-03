// Revenue and payroll data sits behind the admin's analytics PIN, like /analytics.
import { vi, describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: paymentRouter } = await import('../routes/paymentRoutes.js')
const { default: txRouter }      = await import('../routes/paymentTransactionRoutes.js')
const { JWT_STANDARD_CLAIMS }    = await import('../config/config.js')
const { getCenterSecret }        = await import('../utils/jwtUtils.js')
const { signAnalyticsUnlock }    = await import('../middleware/analyticsPinMiddleware.js')

const app = express()
app.use(express.json())
app.use('/api/payments', paymentRouter)
app.use('/api/payment-transactions', txRouter)

const URLS = ['/api/payments', '/api/payment-transactions/all', '/api/payment-transactions/summary']
let admin, bearer

beforeAll(async () => {
  const Admin = global.__TEST_DB__.models.Admin
  admin = await Admin.findOne({ username: CREDENTIALS.admin.username })
  bearer = `Bearer ${jwt.sign(
    { ...JWT_STANDARD_CLAIMS, id: String(admin._id), role: 'admin', centerId: 'testcenter', sid: String(new mongoose.Types.ObjectId()) },
    getCenterSecret('testcenter'), { expiresIn: '5m' },
  )}`
})

describe('payment data and the analytics PIN', () => {
  it('is open when the admin has no PIN', async () => {
    for (const url of URLS) {
      const res = await request(app).get(url).set('Authorization', bearer)
      expect(res.status, url).toBe(200)
    }
  })

  it('is locked when a PIN is set, and unlocks with the PIN token', async () => {
    const Admin = global.__TEST_DB__.models.Admin
    await Admin.updateOne({ _id: admin._id }, { $set: { analyticsPinHash: await bcrypt.hash('1234', 4), analyticsPinSetAt: new Date() } })
    const withPin = await Admin.findById(admin._id).select('+analyticsPinHash analyticsPinSetAt')
    const unlock = signAnalyticsUnlock({ user: { id: String(admin._id) }, center: { slug: 'testcenter' } }, withPin)

    for (const url of URLS) {
      const locked = await request(app).get(url).set('Authorization', bearer)
      expect(locked.status, url).toBe(403)
      expect(locked.body.code, url).toBe('ANALYTICS_LOCKED')

      const open = await request(app).get(url).set('Authorization', bearer).set('x-analytics-unlock', unlock)
      expect(open.status, url).toBe(200)
    }
  })
})
