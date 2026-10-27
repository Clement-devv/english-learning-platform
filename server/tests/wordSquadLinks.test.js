// Word Squad game links for managed (no-login) students: the teacher gets one
// personal link per managed student, the student opens it with a name check,
// then plays that one game (and earns stars) without a login. The link ends
// with the game, and can't be used for any other game.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'testcenter', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: gameRoutes } = await import('../routes/gameRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { questionSetSchema } = await import('../schemas/questionSetSchema.js')
const { gameAssignmentSchema } = await import('../schemas/gameAssignmentSchema.js')
const { gameSessionSchema } = await import('../schemas/gameSessionSchema.js')
const { gameLinkSchema } = await import('../schemas/gameLinkSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { studentSchema } = await import('../schemas/studentSchema.js')

const app = express()
app.use(express.json())
app.use('/games', gameRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'), { expiresIn: '5m' })

const QUESTIONS = [
  { prompt: 'I ___ a student.', answer: 'am', distractors: ['is', 'are'] },
  { prompt: 'She ___ two cats.', answer: 'has', distractors: ['have', 'having'] },
  { prompt: 'They ___ playing.', answer: 'are', distractors: ['is', 'am'] },
  { prompt: 'A fish lives in the ___.', answer: 'water', distractors: ['tree', 'sky'] },
]

let M, teacher, teacherToken, regular, kid, set, assignment

beforeAll(async () => {
  const db = global.__TEST_DB__
  M = {
    Set: db.models.QuestionSet || db.model('QuestionSet', questionSetSchema),
    Assignment: db.models.GameAssignment || db.model('GameAssignment', gameAssignmentSchema),
    Session: db.models.GameSession || db.model('GameSession', gameSessionSchema),
    Link: db.models.GameLink || db.model('GameLink', gameLinkSchema),
    GroupClass: db.models.GroupClass || db.model('GroupClass', groupClassSchema),
    Student: db.models.Student || db.model('Student', studentSchema),
  }
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  teacherToken = sign(teacher._id, 'teacher')
  regular = await M.Student.findOne({ email: CREDENTIALS.student.email })
  kid = await M.Student.create({ email: 'managed-ws@test.invalid', firstName: 'Linh', lastName: 'Tran', isManaged: true, active: true, status: 'active' })
})

beforeEach(async () => {
  await Promise.all([M.Set.deleteMany({}), M.Assignment.deleteMany({}), M.Session.deleteMany({}), M.Link.deleteMany({}), M.GroupClass.deleteMany({})])
  await M.Student.updateOne({ _id: kid._id }, { stars: 0 })
  set = await M.Set.create({ title: 'Unit 1', status: 'published', createdBy: { role: 'teacher', id: teacher._id }, questions: QUESTIONS })
  // The managed kid is in through a group class, the regular student directly
  const gc = await M.GroupClass.create({ title: 'Kids A', teacherId: teacher._id, scheduledTime: new Date(), enrollments: [{ studentId: kid._id }] })
  assignment = await M.Assignment.create({ setId: set._id, studentIds: [regular._id], groupClassIds: [gc._id], createdBy: { role: 'teacher', id: teacher._id } })
})

const makeLinks = (a = assignment) => request(app).post(`/games/assignments/${a._id}/links`).set('Authorization', `Bearer ${teacherToken}`)
const unlock = (token, studentName = 'Linh', teacherName = teacher.firstName) =>
  request(app).post(`/games/link/${token}/unlock`).send({ studentName, teacherName })
const asLink = (token, access) => ({
  get:  (u) => request(app).get(`/games/link/${token}${u}`).set('x-share-access', access || ''),
  post: (u, b = {}) => request(app).post(`/games/link/${token}${u}`).set('x-share-access', access || '').send(b),
})

describe('Word Squad game links', () => {
  it('gives the teacher one personal link per managed student, and the same one next time', async () => {
    const res = await makeLinks()
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1) // the regular student logs in instead
    expect(res.body.data[0]).toMatchObject({ studentId: String(kid._id), name: 'Linh Tran' })
    expect(res.body.data[0].token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const again = await makeLinks()
    expect(again.body.data[0].token).toBe(res.body.data[0].token)
    const stored = await M.Link.findOne({ studentId: kid._id }).select('+shareLink.tokenHash').lean()
    expect(stored.shareLink.tokenHash).not.toBe(res.body.data[0].token) // only a hash is stored
  })

  it("doesn't let a teacher make links for someone else's game", async () => {
    const otherTeacher = sign(regular._id, 'teacher') // not this game's teacher
    const res = await request(app).post(`/games/assignments/${assignment._id}/links`).set('Authorization', `Bearer ${otherTeacher}`)
    expect([401, 403, 404]).toContain(res.status)
  })

  it('opens only after the name check, then plays that game and pays stars', async () => {
    const token = (await makeLinks()).body.data[0].token
    expect((await asLink(token).get('')).status).toBe(403)
    expect((await unlock(token, 'Somebody', teacher.firstName)).status).toBe(400)

    const ok = await unlock(token)
    expect(ok.status).toBe(200)
    expect(ok.body.game.studentName).toBe('Linh')
    const kidApi = asLink(token, ok.body.accessToken)

    const list = await kidApi.get('/word-squad/assignments')
    expect(list.status).toBe(200)
    expect(list.body.data.assignments.map((a) => a.id)).toEqual([String(assignment._id)])

    const started = await kidApi.post('/word-squad/sessions', { assignmentId: String(assignment._id), chapter: 0 })
    expect(started.status).toBe(201)
    expect(started.body.data.gates[0].answer).toBeUndefined()
    const s = await M.Session.findById(started.body.data.sessionId).lean()
    expect(String(s.studentId)).toBe(String(kid._id))

    // Answer every gate right (pretending the seconds between gates passed)
    for (const g of started.body.data.gates.slice(0, -1)) {
      await M.Session.updateOne({ _id: s._id }, [{ $set: { createdAt: { $subtract: ['$createdAt', 10000] }, lastAnswerAt: { $cond: [{ $eq: ['$lastAnswerAt', null] }, null, { $subtract: ['$lastAnswerAt', 10000] }] } } }])
      const answer = QUESTIONS.find((q) => q.prompt === g.prompt).answer
      const r = await kidApi.post(`/word-squad/sessions/${s._id}/answer`, { gateId: g.gateId, choice: answer })
      expect(r.body.data.correct).toBe(true)
    }
    await M.Session.updateOne({ _id: s._id }, { $set: { createdAt: new Date(Date.now() - 120000) } })
    const done = await kidApi.post(`/word-squad/sessions/${s._id}/finish`, { won: true, bossBeaten: true, bossHits: 20 })
    expect(done.status).toBe(200)
    expect(done.body.data.starsAwarded).toBeGreaterThan(0)
    expect((await M.Student.findById(kid._id).lean()).stars).toBe(done.body.data.starsAwarded)
  })

  it("can't be used for another game, or to play someone else's session", async () => {
    const token = (await makeLinks()).body.data[0].token
    const kidApi = asLink(token, (await unlock(token)).body.accessToken)
    const other = await M.Assignment.create({ setId: set._id, studentIds: [kid._id], createdBy: { role: 'teacher', id: teacher._id } })
    expect((await kidApi.post('/word-squad/sessions', { assignmentId: String(other._id), chapter: 0 })).status).toBe(404)
    expect((await kidApi.get('/word-squad/assignments')).body.data.assignments).toHaveLength(1)

    const regularApi = (u, b) => request(app).post(u).set('Authorization', `Bearer ${sign(regular._id, 'student')}`).send(b)
    const theirs = await regularApi('/games/word-squad/sessions', { assignmentId: String(assignment._id), chapter: 0 })
    const g = theirs.body.data.gates[0]
    expect((await kidApi.post(`/word-squad/sessions/${theirs.body.data.sessionId}/answer`, { gateId: g.gateId, choice: g.choices[0] })).status).toBe(404)
  })

  it('ends when the game is stopped, and is unknown with a made-up token', async () => {
    const token = (await makeLinks()).body.data[0].token
    const access = (await unlock(token)).body.accessToken
    await M.Assignment.updateOne({ _id: assignment._id }, { active: false })
    expect((await asLink(token, access).get('')).status).toBe(410)
    expect((await unlock(token)).status).toBe(410)
    expect((await asLink('x'.repeat(43)).get('')).status).toBe(404)
  })

  it('ends when the student leaves the class', async () => {
    const token = (await makeLinks()).body.data[0].token
    const access = (await unlock(token)).body.accessToken
    await M.GroupClass.updateMany({}, { $set: { enrollments: [] } })
    expect((await asLink(token, access).get('/word-squad/assignments')).status).toBe(410)
  })
})
