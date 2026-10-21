// Teachers can move a homework / quiz due date; that reopens an expired family link
// (same token), resets the "due soon" reminder and emails the student / family.
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
const emailed = []
vi.mock('../utils/progressEmails.js', () => ({
  emailDueDateChanged: vi.fn(async (db, center, kind, item, opts) => { emailed.push({ kind, item, opts }) }),
  emailHomeworkGraded: vi.fn(async () => {}),
}))
vi.mock('../utils/familyLinkEmails.js', () => ({ emailShareLinkLater: vi.fn() }))

const { default: homeworkRouter } = await import('../routes/homeworkRoutes.js')
const { default: quizRouter } = await import('../routes/quizRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { homeworkSchema } = await import('../schemas/homeworkSchema.js')
const { quizSchema } = await import('../schemas/quizSchema.js')
const { reminderLogSchema } = await import('../schemas/reminderLogSchema.js')
const { issueShareLink } = await import('../utils/shareLink.js')

const app = express()
app.use(express.json())
app.use('/api/homework', homeworkRouter)
app.use('/api/quiz', quizRouter)

const day = (offset) => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + offset))
const ymd = (d) => d.toISOString().slice(0, 10)
const sign = (claims) => jwt.sign({ ...JWT_STANDARD_CLAIMS, centerId: 'testcenter', ...claims }, getCenterSecret('testcenter'), { expiresIn: '5m' })

let db, Homework, Quiz, ReminderLog, teacher, student, teacherToken, otherToken
beforeAll(async () => {
  db = global.__TEST_DB__
  Homework = db.models.Homework || db.model('Homework', homeworkSchema)
  Quiz = db.models.Quiz || db.model('Quiz', quizSchema)
  ReminderLog = db.models.ReminderLog || db.model('ReminderLog', reminderLogSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  const s = await db.models.Student.collection.insertOne({ firstName: 'Bayo', lastName: 'M', email: `b-${Date.now()}@managed.test`, isManaged: true, active: true })
  student = s.insertedId
  teacherToken = sign({ id: String(teacher._id), role: 'teacher' })
  otherToken = sign({ id: String(new mongoose.Types.ObjectId()), role: 'teacher' })
})
beforeEach(() => { emailed.length = 0 })

async function expiredHomework() {
  const hw = new Homework({ teacherId: teacher._id, studentId: student, title: 'Phonics', dueDate: day(-3) })
  issueShareLink(hw)
  await hw.save()
  await ReminderLog.create({ type: `homework_30min_${hw._id}`, refId: hw._id })
  return hw
}
const patch = (path, token, body) => request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body)

describe('PATCH /homework/:id/due-date', () => {
  it('moves the date, reopens the expired family link and resets the reminder', async () => {
    const hw = await expiredHomework()
    const res = await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: ymd(day(5)) })
    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/link works again/)
    expect(new Date(res.body.homework.dueDate).toISOString()).toBe(day(5).toISOString())
    expect(new Date(res.body.homework.shareLink.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(res.body.homework.shareToken).toBeTruthy()
    expect(await ReminderLog.countDocuments({ type: `homework_30min_${hw._id}` })).toBe(0)
    expect(emailed).toHaveLength(1)
    expect(emailed[0]).toMatchObject({ kind: 'homework', opts: { reopened: true } })
  })

  it('refuses a past date, a bad date, more than a year ahead, another teacher and graded homework', async () => {
    const hw = await expiredHomework()
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: ymd(day(-1)) })).status).toBe(400)
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: 'soon' })).status).toBe(400)
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: ymd(day(400)) })).status).toBe(400)
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, {})).status).toBe(400)
    expect((await patch(`/api/homework/${hw._id}/due-date`, otherToken, { dueDate: ymd(day(5)) })).status).toBe(403)
    await Homework.updateOne({ _id: hw._id }, { status: 'graded' })
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: ymd(day(5)) })).status).toBe(400)
    expect(emailed).toHaveLength(0)
  })

  it('today is allowed (open until the end of the day)', async () => {
    const hw = await expiredHomework()
    expect((await patch(`/api/homework/${hw._id}/due-date`, teacherToken, { dueDate: ymd(day(0)) })).status).toBe(200)
  })
})

describe('PATCH /quiz/:id/due-date', () => {
  it('moves the date; a quiz already taken is refused', async () => {
    const quiz = new Quiz({
      teacherId: teacher._id, studentId: student, title: 'Grammar', timeLimit: 10, dueDate: day(-2),
      questions: [{ question: 'Q?', options: [{ text: 'a' }, { text: 'b' }], correctIndex: 0 }],
    })
    issueShareLink(quiz)
    await quiz.save()
    const ok = await patch(`/api/quiz/${quiz._id}/due-date`, teacherToken, { dueDate: ymd(day(3)) })
    expect(ok.status).toBe(200)
    expect(emailed[0]).toMatchObject({ kind: 'quiz', opts: { reopened: true } })
    await Quiz.updateOne({ _id: quiz._id }, { status: 'attempted' })
    expect((await patch(`/api/quiz/${quiz._id}/due-date`, teacherToken, { dueDate: ymd(day(4)) })).status).toBe(400)
  })
})
