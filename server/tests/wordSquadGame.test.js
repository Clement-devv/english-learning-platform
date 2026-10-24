// Word Squad play API: the server holds the answers, checks each gate once, in
// order, at a believable pace, works out the stars itself (client stats only add
// a capped bonus), pays them once, saves progress, applies the daily limit, and
// keeps every center's games to itself.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

// Two centers: the header picks which one a request belongs to
vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    const slug = req.headers['x-test-center'] || 'testcenter'
    req.center = { slug, centerName: slug, timezone: 'UTC' }
    req.db = slug === 'testcenter' ? global.__TEST_DB__ : global.__TEST_DB__.useDb(`center_${slug}`, { useCache: true })
    next()
  },
}))

const { default: gameRoutes } = await import('../routes/gameRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { questionSetSchema } = await import('../schemas/questionSetSchema.js')
const { gameAssignmentSchema } = await import('../schemas/gameAssignmentSchema.js')
const { gameSessionSchema } = await import('../schemas/gameSessionSchema.js')
const { gameProgressSchema } = await import('../schemas/gameProgressSchema.js')
const { starLedgerSchema } = await import('../schemas/starLedgerSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { studentSchema } = await import('../schemas/studentSchema.js')
const { CHAPTER_GATES, STAR_RULES } = await import('../utils/wordSquadRules.js')

const app = express()
app.use(express.json())
app.use('/games', gameRoutes)

const sign = (id, role, center = 'testcenter') => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: center },
  getCenterSecret(center), { expiresIn: '5m' })
const as = (token, center = 'testcenter') => ({
  get:  (u) => request(app).get(u).set('Authorization', `Bearer ${token}`).set('x-test-center', center),
  post: (u, b = {}) => request(app).post(u).set('Authorization', `Bearer ${token}`).set('x-test-center', center).send(b),
})

const models = (db) => ({
  Set: db.models.QuestionSet || db.model('QuestionSet', questionSetSchema),
  Assignment: db.models.GameAssignment || db.model('GameAssignment', gameAssignmentSchema),
  Session: db.models.GameSession || db.model('GameSession', gameSessionSchema),
  Progress: db.models.GameProgress || db.model('GameProgress', gameProgressSchema),
  Ledger: db.models.StarLedger || db.model('StarLedger', starLedgerSchema),
  GroupClass: db.models.GroupClass || db.model('GroupClass', groupClassSchema),
  Student: db.models.Student || db.model('Student', studentSchema),
})

const QUESTIONS = [
  { prompt: 'I ___ a student.', answer: 'am', distractors: ['is', 'are'] },
  { prompt: 'She ___ two cats.', answer: 'has', distractors: ['have', 'having'] },
  { prompt: 'They ___ playing.', answer: 'are', distractors: ['is', 'am'] },
  { prompt: 'A fish lives in the ___.', answer: 'water', distractors: ['tree', 'sky'] },
  { prompt: 'Can you ___ a bike?', answer: 'ride', distractors: ['rides', 'riding'] },
  { prompt: 'The sun is very ___ today.', answer: 'hot', distractors: ['cold', 'wet'] },
  { prompt: 'I brush my ___ every day.', answer: 'teeth', distractors: ['shoes', 'books'] },
  { prompt: 'We go to the beach ___ summer.', answer: 'in', distractors: ['on', 'at'] },
]
const answerOf = (prompt) => QUESTIONS.find((q) => q.prompt === prompt).answer
const wrongOf = (gate) => gate.choices.find((c) => c !== answerOf(gate.prompt))

let M, student, other, teacher, set, assignment, studentApi, otherApi

beforeAll(async () => {
  const db = global.__TEST_DB__
  M = models(db)
  student = await M.Student.findOne({ email: CREDENTIALS.student.email })
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  other = await M.Student.create({ email: 'other-ws@test.com', firstName: 'Other', lastName: 'Kid', active: true, status: 'active' })
  studentApi = as(sign(student._id, 'student'))
  otherApi = as(sign(other._id, 'student'))
})

beforeEach(async () => {
  await Promise.all([M.Set.deleteMany({}), M.Assignment.deleteMany({}), M.Session.deleteMany({}), M.Progress.deleteMany({}), M.Ledger.deleteMany({}), M.GroupClass.deleteMany({})])
  await M.Student.updateOne({ _id: student._id }, { stars: 0, active: true })
  set = await M.Set.create({ title: 'Unit 1', status: 'published', createdBy: { role: 'teacher', id: teacher._id }, questions: QUESTIONS })
  assignment = await M.Assignment.create({ setId: set._id, studentIds: [student._id], createdBy: { role: 'teacher', id: teacher._id } })
})

/** Pretend time passed in the game, so the pace rule (gates are seconds apart) is met */
const age = (sessionId, secs = 10) => M.Session.updateOne({ _id: sessionId }, [
  { $set: { createdAt: { $subtract: ['$createdAt', secs * 1000] }, lastAnswerAt: { $cond: [{ $eq: ['$lastAnswerAt', null] }, null, { $subtract: ['$lastAnswerAt', secs * 1000] }] } } },
])
const start = (api = studentApi, chapter = 0, a = assignment) => api.post('/games/word-squad/sessions', { assignmentId: String(a._id), chapter })
const answer = (id, gateId, choice, api = studentApi) => api.post(`/games/word-squad/sessions/${id}/answer`, { gateId, choice })
async function playAll(s, { wrong = 0 } = {}) {
  for (const [i, g] of s.gates.entries()) {
    await age(s.sessionId)
    const res = await answer(s.sessionId, g.gateId, i < wrong ? wrongOf(g) : answerOf(g.prompt))
    expect(res.status).toBe(200)
  }
  await age(s.sessionId, 120) // a believable play time before the finish
}

describe('Word Squad play API', () => {
  it('lists only games given to the student — directly or through a group class — that are published and running', async () => {
    const gc = await M.GroupClass.create({ teacherId: teacher._id, title: 'Club', scheduledTime: new Date(), enrollments: [{ studentId: student._id }] })
    const viaClass = await M.Assignment.create({ setId: set._id, groupClassIds: [gc._id] })
    const draft = await M.Set.create({ title: 'Draft', status: 'draft', questions: QUESTIONS })
    await M.Assignment.create({ setId: draft._id, studentIds: [student._id] })                       // unpublished
    await M.Assignment.create({ setId: set._id, studentIds: [other._id] })                           // someone else's
    await M.Assignment.create({ setId: set._id, studentIds: [student._id], dueAt: new Date(Date.now() - 1000) }) // over
    const res = await studentApi.get('/games/word-squad/assignments')
    expect(res.status).toBe(200)
    expect(res.body.data.assignments.map((a) => String(a.id)).sort()).toEqual([String(assignment._id), String(viaClass._id)].sort())
    expect(res.body.data.stars).toBe(0)
  })

  it('starts a chapter without sending any answers', async () => {
    const res = await start()
    expect(res.status).toBe(201)
    const s = res.body.data
    expect(s.gates).toHaveLength(CHAPTER_GATES[0] + 1)
    expect(JSON.stringify(s)).not.toMatch(/"answer"/)
    for (const g of s.gates) expect(g.choices).toContain(answerOf(g.prompt))
    expect(s.gates[0].choices).toHaveLength(2)
    expect(s.revive.choices).toHaveLength(3)
  })

  it('locks a chapter until the one before is won, and refuses games not assigned to the student', async () => {
    expect((await start(studentApi, 1)).status).toBe(403)
    expect((await start(otherApi)).status).toBe(404)
  })

  it('checks each answer once, in order, at a believable pace, and only from the choices', async () => {
    const s = (await start()).body.data
    const g0 = s.gates[0], g1 = s.gates[1], g2 = s.gates[2]
    expect((await answer(s.sessionId, g0.gateId, answerOf(g0.prompt))).status).toBe(429)   // too fast after the start
    await age(s.sessionId)
    const right = await answer(s.sessionId, g0.gateId, answerOf(g0.prompt))
    expect(right.body.data).toEqual({ correct: true, correctAnswer: answerOf(g0.prompt) })
    await age(s.sessionId)
    expect((await answer(s.sessionId, g0.gateId, answerOf(g0.prompt))).status).toBe(409)   // once only
    expect((await answer(s.sessionId, g2.gateId, 'banana')).status).toBe(400)              // not a choice
    const wrong = await answer(s.sessionId, g2.gateId, wrongOf(g2))
    expect(wrong.body.data).toEqual({ correct: false, correctAnswer: answerOf(g2.prompt) })
    await age(s.sessionId)
    expect((await answer(s.sessionId, g1.gateId, answerOf(g1.prompt))).status).toBe(409)   // no going back
    // the bonus (revive) question can be answered once, any time
    const rv = s.revive
    expect((await answer(s.sessionId, 'revive', rv.choices[0])).status).toBe(200)
    expect((await answer(s.sessionId, 'revive', rv.choices[0])).status).toBe(409)
  })

  it("can't be played with someone else's game", async () => {
    const s = (await start()).body.data
    await age(s.sessionId)
    expect((await answer(s.sessionId, s.gates[0].gateId, s.gates[0].choices[0], otherApi)).status).toBe(404)
  })

  it('works out the stars on the server, caps what the game reports, pays once and saves progress', async () => {
    const s = (await start()).body.data
    await playAll(s, { wrong: 2 })
    const total = s.gates.length
    const claim = { won: true, bossBeaten: true, bugsPopped: 999999, bestCombo: 999, squadSize: 999, coins: 999, spells: 99, bossHits: 0 }
    const res = await studentApi.post(`/games/word-squad/sessions/${s.sessionId}/finish`, claim)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.right).toBe(total - 2)
    expect(d.total).toBe(total)
    expect(d.stars.base).toBe((total - 2) * STAR_RULES.perRight)
    expect(d.stars.bonus).toBe(STAR_RULES.bonusCap)             // huge claims, capped bonus
    expect(d.stars.boss).toBe(STAR_RULES.bossBonus)
    expect(d.starsAwarded).toBe(d.stars.total)
    expect(d.review).toHaveLength(2)
    expect(d.rating.count).toBe(3)
    expect(d.progress.unlocked).toBe(1)                         // chapter 2 is open now
    expect((await M.Student.findById(student._id).lean()).stars).toBe(d.starsAwarded)
    expect(await M.Ledger.countDocuments({ sessionId: s.sessionId })).toBe(1)
    // a second finish doesn't pay again
    expect((await studentApi.post(`/games/word-squad/sessions/${s.sessionId}/finish`, claim)).status).toBe(409)
    expect((await M.Student.findById(student._id).lean()).stars).toBe(d.starsAwarded)
    // and the next chapter can be started
    expect((await start(studentApi, 1)).status).toBe(201)
  })

  it("doesn't believe a win without reaching the boss, and gives no boss bonus with under half right", async () => {
    const s = (await start()).body.data
    await age(s.sessionId)
    await answer(s.sessionId, s.gates[0].gateId, wrongOf(s.gates[0]))
    await age(s.sessionId, 120)
    const d = (await studentApi.post(`/games/word-squad/sessions/${s.sessionId}/finish`, { won: true, bossBeaten: true })).body.data
    expect(d.rating.cleared).toBe(false)
    expect(d.stars.boss).toBe(0)
    expect(d.progress.unlocked).toBe(0)
  })

  it('stops paying stars after the daily limit, but the game can still be played', async () => {
    await M.Assignment.updateOne({ _id: assignment._id }, { maxPlaysPerDay: 1 })
    const first = (await start()).body.data
    expect(first.countsForStars).toBe(true)
    const second = (await start()).body.data
    expect(second.countsForStars).toBe(false)
    await playAll(second)
    const d = (await studentApi.post(`/games/word-squad/sessions/${second.sessionId}/finish`, { won: true, bossBeaten: true })).body.data
    expect(d.starsAwarded).toBe(0)
    expect(d.countsForStars).toBe(false)
  })

  it("keeps each center's games to itself", async () => {
    // Center B has its own student, set and assignment
    const dbB = global.__TEST_DB__.useDb('center_otherschool', { useCache: true })
    const B = models(dbB)
    const kidB = await B.Student.create({ email: 'kid-b@test.com', firstName: 'Kid', lastName: 'B', active: true, status: 'active' })
    const setB = await B.Set.create({ title: 'B set', status: 'published', questions: QUESTIONS })
    const assignB = await B.Assignment.create({ setId: setB._id, studentIds: [kidB._id, student._id] })
    // Center A's student, with A's token, against center B → refused
    expect((await as(sign(student._id, 'student'), 'otherschool').post('/games/word-squad/sessions', { assignmentId: String(assignB._id), chapter: 0 })).status).toBe(401)
    // …and a token claiming center B for A's student → no such student in B
    expect((await as(sign(student._id, 'student', 'otherschool'), 'otherschool').post('/games/word-squad/sessions', { assignmentId: String(assignB._id), chapter: 0 })).status).toBe(403)
    // A's student asking A for B's assignment id → not found in A
    expect((await start(studentApi, 0, assignB)).status).toBe(404)
    // B's own student plays fine in B
    const kidApi = as(sign(kidB._id, 'student', 'otherschool'), 'otherschool')
    expect((await kidApi.post('/games/word-squad/sessions', { assignmentId: String(assignB._id), chapter: 0 })).status).toBe(201)
    expect(await M.Session.countDocuments({ assignmentId: assignB._id })).toBe(0) // nothing leaked into A
  })
})
