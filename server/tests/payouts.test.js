// Teacher payout routes. Teacher.earned is the UNPAID balance: settling a payment
// lowers it by exactly that amount; deductions count against a payout; only a
// pending payment can be paid, and only once.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: payRouter } = await import('../routes/paymentTransactionRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

const app = express()
app.use(express.json())
app.use('/api/payment-transactions', payRouter)

let db, Payment, Teacher, teacher, adminToken

const auth = (r) => r.set('Authorization', `Bearer ${adminToken}`)
const payOne = (id, body = {}) => auth(request(app).patch(`/api/payment-transactions/${id}/pay`)).send(body)
const payAll = (body = {}) => auth(request(app).patch(`/api/payment-transactions/teacher/${teacher._id}/pay-all`)).send(body)
const manual = (body) => auth(request(app).post('/api/payment-transactions/manual')).send({ teacherId: String(teacher._id), ...body })
const earned = async () => (await Teacher.findById(teacher._id)).earned

const tx = (overrides = {}) => Payment.create({
  teacherId: teacher._id, bookingId: new mongoose.Types.ObjectId(), amount: 10,
  type: 'class_completion', status: 'pending', completedAt: new Date(), ...overrides,
})

beforeAll(async () => {
  db = global.__TEST_DB__
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  await Payment.syncIndexes() // the unique sparse bookingId index must exist for the manual-transaction test
  Teacher = db.models.Teacher
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = jwt.sign(
    { ...JWT_STANDARD_CLAIMS, id: String(admin._id), role: 'admin', centerId: 'testcenter' },
    getCenterSecret('testcenter'), { expiresIn: '5m' },
  )
})

beforeEach(async () => {
  await Payment.deleteMany({ teacherId: teacher._id })
  await Teacher.updateOne({ _id: teacher._id }, { earned: 0 })
})

describe('PATCH /:id/pay', () => {
  it('pays a pending payment and lowers the unpaid balance by its amount', async () => {
    const a = await tx({ amount: 10 }); await tx({ amount: 15 })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 25 })
    const res = await payOne(a._id, { paymentMethod: 'cash' })
    expect(res.status).toBe(200)
    expect((await Payment.findById(a._id)).status).toBe('paid')
    expect(await earned()).toBe(15)
  })

  it('refuses a cancelled (reversed) payment', async () => {
    const a = await tx({ status: 'cancelled' })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 5 })
    const res = await payOne(a._id)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/cancelled/)
    expect((await Payment.findById(a._id)).status).toBe('cancelled')
    expect(await earned()).toBe(5)
  })

  it('double click → paid once, balance lowered once', async () => {
    const a = await tx({ amount: 10 })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 30 })
    const results = await Promise.all([payOne(a._id), payOne(a._id), payOne(a._id)])
    expect(results.filter(r => r.status === 200)).toHaveLength(1)
    expect(await earned()).toBe(20)
  })

  it('rejects an unknown payment method', async () => {
    const a = await tx()
    expect((await payOne(a._id, { paymentMethod: 'bitcoin' })).status).toBe(400)
    expect((await Payment.findById(a._id)).status).toBe('pending')
  })
})

describe('PATCH /teacher/:id/pay-all', () => {
  it('subtracts deductions from the payout total', async () => {
    await tx({ amount: 10 }); await tx({ amount: 20 })
    await tx({ bookingId: undefined, amount: 5, type: 'deduction' })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 25 })

    const res = await payAll()
    expect(res.status).toBe(200)
    expect(res.body.totalAmount).toBe(25)
    expect(res.body.transactionCount).toBe(3)
    expect(await earned()).toBe(0)
    expect(await Payment.countDocuments({ teacherId: teacher._id, status: 'pending' })).toBe(0)
  })

  it('leaves cancelled payments alone', async () => {
    await tx({ amount: 10 }); const c = await tx({ amount: 99, status: 'cancelled' })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 10 })
    expect((await payAll()).body.totalAmount).toBe(10)
    expect((await Payment.findById(c._id)).status).toBe('cancelled')
  })

  it('two clicks at once → paid once', async () => {
    await tx({ amount: 10 }); await tx({ amount: 20 })
    await Teacher.updateOne({ _id: teacher._id }, { earned: 30 })
    const results = await Promise.all([payAll(), payAll()])
    const totals = results.filter(r => r.status === 200).map(r => r.body.totalAmount)
    expect(totals.reduce((a, b) => a + b, 0)).toBe(30)
    expect(await earned()).toBe(0)
  })

  it('400 when nothing is pending', async () => {
    expect((await payAll()).status).toBe(400)
  })
})

describe('POST /manual', () => {
  it('adds a string amount as a number (not "100" + "50")', async () => {
    await Teacher.updateOne({ _id: teacher._id }, { earned: 100 })
    const res = await manual({ amount: '50', type: 'bonus' })
    expect(res.status).toBe(201)
    expect(await earned()).toBe(150)
  })

  it('a deduction lowers the balance, never below 0', async () => {
    await Teacher.updateOne({ _id: teacher._id }, { earned: 20 })
    await manual({ amount: 50, type: 'deduction' })
    expect(await earned()).toBe(0)
  })

  it('several manual transactions can exist (no bookingId collision)', async () => {
    expect((await manual({ amount: 5, type: 'bonus' })).status).toBe(201)
    expect((await manual({ amount: 7, type: 'manual_adjustment' })).status).toBe(201)
    expect(await earned()).toBe(12)
  })

  it('rejects bad input', async () => {
    expect((await manual({ amount: -5, type: 'bonus' })).status).toBe(400)
    expect((await manual({ amount: 'abc', type: 'bonus' })).status).toBe(400)
    expect((await manual({ amount: 5, type: 'class_completion' })).status).toBe(400)
    expect((await manual({ amount: 5, type: 'bonus', teacherId: 'nope' })).status).toBe(400)
    expect(await earned()).toBe(0)
  })
})
