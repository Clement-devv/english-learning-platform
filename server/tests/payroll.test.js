// Monthly payroll: pay periods, general charges on class earnings, loans / part
// payments taken off the salary, settling exactly once, debt carried forward.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: payrollRouter } = await import('../routes/payrollRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')
const payroll = await import('../utils/payroll.js')
const { periodEndFor, periodStartFor, payDateFor, calculate } = payroll

const app = express()
app.use(express.json())
app.use('/api/payroll', payrollRouter)

let db, Payment, Teacher, teacher, adminToken, teacherToken
const asAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`)
const get = (url) => asAdmin(request(app).get(`/api/payroll${url}`))
const post = (url, body) => asAdmin(request(app).post(`/api/payroll${url}`)).send(body)
const put = (url, body) => asAdmin(request(app).put(`/api/payroll${url}`)).send(body)
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...claims }, getCenterSecret('testcenter'), { expiresIn: '5m' })

const classTx = (amount = 100, completedAt = new Date(), extra = {}) => Payment.create({
  teacherId: teacher._id, bookingId: new mongoose.Types.ObjectId(), amount,
  type: 'class_completion', status: 'pending', completedAt, ...extra,
})
const myRow = (body) => body.data.rows.find((r) => String(r.teacherId) === String(teacher._id))

beforeAll(async () => {
  db = global.__TEST_DB__
  Payment = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  await Payment.syncIndexes()
  await payroll.getPayslip(db).syncIndexes()
  Teacher = db.models.Teacher
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  await Teacher.updateOne({ _id: teacher._id }, { active: true, status: 'active' })
  const admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  adminToken = sign({ id: String(admin._id), role: 'admin' })
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
})

beforeEach(async () => {
  await Promise.all([
    Payment.deleteMany({}),
    payroll.getPayslip(db).deleteMany({}),
    payroll.getTeacherPayout(db).deleteMany({}),
    payroll.getPayrollPeriod(db).deleteMany({}),
    payroll.getPayrollSettings(db).deleteMany({}),
  ])
  await Teacher.updateOne({ _id: teacher._id }, { earned: 300 })
  const res = await put('/admin/settings', {
    payDay: 31, cycle: 'calendar_month', retentionMonths: 6,
    charges: [{ name: 'Center fee', kind: 'percent', value: 10, active: true }],
  })
  expect(res.status).toBe(200)
})

describe('pay periods', () => {
  const cal = (payDay) => ({ cycle: 'calendar_month', payDay })
  const pd = (payDay) => ({ cycle: 'ends_on_payday', payDay })

  it('calendar month, paid on a day of the next month', () => {
    expect(periodEndFor('2026-10-18', cal(5))).toBe('2026-10-31')
    expect(periodStartFor('2026-10-31', cal(5))).toBe('2026-10-01')
    expect(payDateFor('2026-10-31', cal(5))).toBe('2026-11-05')
    expect(payDateFor('2026-02-28', cal(31))).toBe('2026-02-28') // last day
  })

  it('period ending on the pay day (26th → 25th)', () => {
    expect(periodEndFor('2026-10-18', pd(25))).toBe('2026-10-25')
    expect(periodEndFor('2026-10-26', pd(25))).toBe('2026-11-25')
    expect(periodStartFor('2026-11-25', pd(25))).toBe('2026-10-26')
    expect(payDateFor('2026-11-25', pd(25))).toBe('2026-11-25')
  })

  it('charges come off the full class earnings, whatever was handed over early', () => {
    const c = calculate({
      txs: [{ type: 'class_completion', amount: 100, status: 'pending' }, { type: 'class_completion', amount: 200, status: 'pending' }],
      advances: [{ amount: 100 }],
      chargeRules: [{ name: 'fee', kind: 'percent', value: 10 }],
    })
    expect(c).toMatchObject({ classEarnings: 300, chargesTotal: 30, advancesTotal: 100, net: 170, amountPaid: 170 })
  })
})

describe('salary run', () => {
  it('works out salary = classes − 10% − part payment, and pays it once', async () => {
    await classTx(100); await classTx(100); await classTx(100)
    const adv = await post('/admin/payouts', { teacherId: String(teacher._id), kind: 'part_payment', amount: 50, paymentMethod: 'cash' })
    expect(adv.status).toBe(201)

    const view = await get('/admin/periods')
    expect(view.status).toBe(200)
    expect(myRow(view.body)).toMatchObject({ status: 'unpaid', classCount: 3, classEarnings: 300, chargesTotal: 30, advancesTotal: 50, amountPaid: 220 })

    const key = view.body.data.period.key
    const pay = await post(`/admin/periods/${key}/settle`, { teacherId: String(teacher._id), early: true })
    expect(pay.status).toBe(200)
    expect(pay.body.data).toMatchObject({ status: 'paid', amountPaid: 220, chargesTotal: 30, carryForward: 0 })

    expect(await Payment.countDocuments({ status: 'paid', payslipId: pay.body.data._id })).toBe(3)
    expect((await Teacher.findById(teacher._id)).earned).toBe(0)

    const again = await post(`/admin/periods/${key}/settle`, { teacherId: String(teacher._id), early: true })
    expect(again.status).toBe(400) // nothing left / already paid

    const charges = await get('/admin/charges')
    expect(charges.body.data.allTime).toBe(30)
    expect(charges.body.data.byRule).toEqual([{ name: 'Center fee', amount: 30 }])

    const history = await get(`/admin/payouts?teacherId=${teacher._id}`)
    expect(history.body.data.items.map((p) => p.kind).sort()).toEqual(['part_payment', 'salary'])

    // A part payment counted in a salary can't be voided any more
    const voided = await post(`/admin/payouts/${adv.body.data._id}/void`, {})
    expect(voided.status).toBe(400)
  })

  it('refuses to pay the running period before its pay day unless paid early', async () => {
    await classTx(100)
    const view = await get('/admin/periods')
    const { key, payYmd } = view.body.data.period
    const res = await post(`/admin/periods/${key}/settle`, { teacherId: String(teacher._id) })
    const today = new Date().toISOString().slice(0, 10)
    expect(res.status).toBe(today >= payYmd ? 200 : 400)
  })

  it('carries a loan bigger than the salary into the next period', async () => {
    await classTx(300)
    await post('/admin/payouts', { teacherId: String(teacher._id), kind: 'loan', amount: 500 })
    const view = await get('/admin/periods')
    const key = view.body.data.period.key
    const pay = await post(`/admin/periods/${key}/settle`, { teacherId: String(teacher._id), early: true })
    // 300 − 30 (10%) − 500 = −230
    expect(pay.body.data).toMatchObject({ net: -230, amountPaid: 0, carryForward: 230 })

    // A class in the next period: 200 − 20 − 230 debt = −50
    const nextView = await get('/admin/periods')
    const next = nextView.body.data.period
    expect(next.key > key).toBe(true)
    await classTx(200, new Date(new Date(next.startAt).getTime() + 3600_000))
    const row = myRow((await get(`/admin/periods/${next.key}`)).body)
    expect(row).toMatchObject({ classEarnings: 200, chargesTotal: 20, broughtForward: 230, net: -50 })
  })

  it('voids a mistaken part payment so it is not deducted', async () => {
    await classTx(100)
    const adv = await post('/admin/payouts', { teacherId: String(teacher._id), kind: 'part_payment', amount: 40 })
    const v = await post(`/admin/payouts/${adv.body.data._id}/void`, { reason: 'typo' })
    expect(v.status).toBe(200)
    expect(myRow((await get('/admin/periods')).body)).toMatchObject({ advancesTotal: 0, amountPaid: 90 })
  })
})

describe('teacher statement', () => {
  it('shows the teacher their running salary and payments', async () => {
    await classTx(100)
    await post('/admin/payouts', { teacherId: String(teacher._id), kind: 'part_payment', amount: 20 })
    const res = await request(app).get('/api/payroll/me').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const open = res.body.data.current.find((c) => c.period.open)
    expect(open).toMatchObject({ classEarnings: 100, chargesTotal: 10, advancesTotal: 20, net: 70 })
    expect(res.body.data.payouts).toHaveLength(1)
    expect(res.body.data.settings.charges).toEqual([{ name: 'Center fee', kind: 'percent', value: 10 }])
  })

  it('is admin-only for the admin routes', async () => {
    const res = await request(app).get('/api/payroll/admin/periods').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(403)
  })
})

describe('settings validation', () => {
  it('rejects charges over 100% and bad pay days', async () => {
    expect((await put('/admin/settings', { payDay: 30, cycle: 'calendar_month', charges: [] })).status).toBe(400)
    expect((await put('/admin/settings', { payDay: 5, cycle: 'calendar_month', charges: [
      { name: 'a', kind: 'percent', value: 60 }, { name: 'b', kind: 'percent', value: 50 },
    ] })).status).toBe(400)
    expect((await put('/admin/settings', { payDay: 5, cycle: 'calendar_month', retentionMonths: 2, charges: [] })).status).toBe(400)
  })
})
