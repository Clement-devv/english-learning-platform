// Classes whose time has passed must not stay open forever:
//   one-to-one requests never accepted → missed (nothing to refund);
//   group classes never started → missed + refunds;
//   started group classes → completed if a student joined (fee paid), else missed + refunds.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { expirePendingRequests } = await import('../utils/missedClassScheduler.js')
const { sweepGroupClasses } = await import('../utils/groupClassSweep.js')
const { default: groupClassRoutes } = await import('../routes/groupClassRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { paymentTransactionSchema } = await import('../schemas/paymentTransactionSchema.js')

const app = express()
app.use(express.json())
app.use('/group-classes', groupClassRoutes)
const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })

let db, Booking, GroupClass, Tx, Student, Teacher, student, teacher
const minsAgo = (m) => new Date(Date.now() - m * 60000)

beforeAll(async () => {
  db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  Tx = db.models.PaymentTransaction || db.model('PaymentTransaction', paymentTransactionSchema)
  Student = db.models.Student
  Teacher = db.models.Teacher
  student = await Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
})

beforeEach(async () => {
  await Booking.deleteMany({})
  await GroupClass.deleteMany({})
  await Tx.deleteMany({})
  await Student.updateOne({ _id: student._id }, { groupPoints: 0, classCredits: 5 })
  await Teacher.updateOne({ _id: teacher._id }, { earned: 0 })
})

const groupClass = (fields) => GroupClass.create({
  teacherId: teacher._id, title: 'Club', duration: 30, paymentType: 'points', pointsPerSeat: 2, teacherFee: 20,
  enrollments: [{ studentId: student._id, pointsCharged: 2 }], ...fields,
})
const points = async () => (await Student.findById(student._id).lean()).groupPoints

describe('one-to-one requests nobody accepted', () => {
  it('become missed once the class time is over; upcoming ones are untouched', async () => {
    const old = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'Old', scheduledTime: minsAgo(40), duration: 30, status: 'pending' })
    const soon = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'Soon', scheduledTime: minsAgo(10), duration: 30, status: 'pending' })
    expect(await expirePendingRequests(db)).toBe(1)
    const o = await Booking.findById(old._id).lean()
    expect(o.status).toBe('missed')
    expect(o.missedReason).toMatch(/didn't accept/)
    expect((await Booking.findById(soon._id).lean()).status).toBe('pending')
    expect((await Student.findById(student._id).lean()).classCredits).toBe(5) // nothing charged / refunded
  })
})

describe('group classes after their time', () => {
  it('never started → missed and everyone refunded', async () => {
    const gc = await groupClass({ scheduledTime: minsAgo(40), status: 'open' })
    await sweepGroupClasses(db)
    const after = await GroupClass.findById(gc._id).lean()
    expect(after.status).toBe('missed')
    expect(after.missedReason).toMatch(/never started/)
    expect(await points()).toBe(2)
  })

  it('started and a student joined → completed, attendance from joins, fee paid once', async () => {
    const gc = await groupClass({ scheduledTime: minsAgo(50), status: 'in-progress' })
    // the student opens the class → the join is recorded
    const res = await request(app).get(`/group-classes/${gc._id}/join`).set('Authorization', `Bearer ${sign(student._id, 'student')}`)
    expect(res.status).toBe(200)
    expect((await GroupClass.findById(gc._id).lean()).enrollments[0].joinedAt).toBeTruthy()
    await sweepGroupClasses(db)
    await sweepGroupClasses(db) // a second run changes nothing
    const after = await GroupClass.findById(gc._id).lean()
    expect(after.status).toBe('completed')
    expect(after.enrollments[0].attendance).toBe('attended')
    expect((await Teacher.findById(teacher._id).lean()).earned).toBe(20)
    expect(await Tx.countDocuments({ groupClassId: gc._id })).toBe(1)
    expect(await points()).toBe(0) // they attended — no refund
  })

  it('started but nobody joined → missed and refunded', async () => {
    const gc = await groupClass({ scheduledTime: minsAgo(50), status: 'in-progress' })
    await sweepGroupClasses(db)
    const after = await GroupClass.findById(gc._id).lean()
    expect(after.status).toBe('missed')
    expect(after.missedReason).toMatch(/No students joined/)
    expect(await points()).toBe(2)
    expect((await Teacher.findById(teacher._id).lean()).earned).toBe(0)
  })

  it('a class still running (or within the short overrun wait) is left alone', async () => {
    const running = await groupClass({ scheduledTime: minsAgo(35), status: 'in-progress' }) // ended 5 min ago, wait is 10
    const upcoming = await groupClass({ scheduledTime: minsAgo(-60), status: 'open' })
    await sweepGroupClasses(db)
    expect((await GroupClass.findById(running._id).lean()).status).toBe('in-progress')
    expect((await GroupClass.findById(upcoming._id).lean()).status).toBe('open')
  })
})

describe('finished group classes in class history', () => {
  it('completed → Completed, missed → Not completed (teacher + student); absent student → Not completed', async () => {
    const { default: historyRoutes } = await import('../routes/classHistoryRoutes.js')
    const h = express(); h.use(express.json()); h.use('/bookings', historyRoutes)
    const get = (url, id, role) => request(h).get(url).set('Authorization', `Bearer ${sign(id, role)}`)

    await groupClass({ title: 'Done club', scheduledTime: minsAgo(120), status: 'completed',
      enrollments: [{ studentId: student._id, pointsCharged: 2, attendance: 'attended' }] })
    await groupClass({ title: 'Never held', scheduledTime: minsAgo(200), status: 'missed', missedReason: 'The class was never started.' })
    await groupClass({ title: 'Skipped it', scheduledTime: minsAgo(300), status: 'completed',
      enrollments: [{ studentId: student._id, pointsCharged: 2, attendance: 'absent' }] })

    const tDone = await get(`/bookings/teacher/${teacher._id}/history?view=completed&page=1`, teacher._id, 'teacher')
    expect(tDone.body.classes.filter(c => c.isGroupClass).map(c => c.title).sort()).toEqual(['Done club', 'Skipped it'])
    const tNot = await get(`/bookings/teacher/${teacher._id}/history?view=not_completed&page=1`, teacher._id, 'teacher')
    expect(tNot.body.classes.filter(c => c.isGroupClass).map(c => c.title)).toEqual(['Never held'])

    const sDone = await get(`/bookings/student/${student._id}/history?view=completed&page=1`, student._id, 'student')
    expect(sDone.body.classes.filter(c => c.isGroupClass).map(c => c.title)).toEqual(['Done club'])
    const sNot = await get(`/bookings/student/${student._id}/history?view=not_completed&page=1`, student._id, 'student')
    const titles = sNot.body.classes.filter(c => c.isGroupClass).map(c => c.title).sort()
    expect(titles).toEqual(['Never held', 'Skipped it'])
    expect(sNot.body.classes.find(c => c.title === 'Skipped it').missedReason).toBe('You were marked absent.')
    expect(sNot.body.counts.notCompleted).toBeGreaterThanOrEqual(2)
  })
})
