// Word Squad for teachers and admins: question sets (checked on save and before
// publishing), CSV reading, and assigning a published set — only to the
// teacher's own group classes and students. Teachers see their own; admins all.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: gameRoutes } = await import('../routes/gameRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { questionErrors, publishErrors, parseQuestionsCsv } = await import('../utils/questionRules.js')
const { questionSetSchema } = await import('../schemas/questionSetSchema.js')
const { gameAssignmentSchema } = await import('../schemas/gameAssignmentSchema.js')
const { groupClassSchema } = await import('../schemas/groupClassSchema.js')
const { assignmentSchema } = await import('../schemas/assignmentSchema.js')
const { teacherSchema } = await import('../schemas/teacherSchema.js')

const app = express()
app.use(express.json())
app.use('/games', gameRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (token) => ({
  get: (u) => request(app).get(u).set('Authorization', `Bearer ${token}`),
  post: (u, b = {}) => request(app).post(u).set('Authorization', `Bearer ${token}`).send(b),
  put: (u, b = {}) => request(app).put(u).set('Authorization', `Bearer ${token}`).send(b),
  patch: (u, b = {}) => request(app).patch(u).set('Authorization', `Bearer ${token}`).send(b),
  del: (u) => request(app).delete(u).set('Authorization', `Bearer ${token}`),
})

const q = (i) => ({ type: 'gap', prompt: `Sentence number ${i} has a ___ here.`, answer: `word${i}`, distractors: [`wrong${i}`, `nope${i}`] })
const eight = Array.from({ length: 8 }, (_, i) => q(i))

let Set, GA, GC, Link, teacher, teacher2, student, other, admin, tApi, t2Api, aApi, sApi

beforeAll(async () => {
  const db = global.__TEST_DB__
  Set = db.models.QuestionSet || db.model('QuestionSet', questionSetSchema)
  GA = db.models.GameAssignment || db.model('GameAssignment', gameAssignmentSchema)
  GC = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  Link = db.models.Assignment || db.model('Assignment', assignmentSchema)
  const Teacher = db.models.Teacher || db.model('Teacher', teacherSchema)
  teacher = await Teacher.findOne({ email: CREDENTIALS.teacher.email })
  teacher2 = await Teacher.create({ email: 't2-ws@test.com', firstName: 'Second', lastName: 'Teacher', active: true, status: 'active', continent: 'Asia' })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  other = await db.models.Student.create({ email: 'not-mine-ws@test.com', firstName: 'Not', lastName: 'Mine', active: true, status: 'active' })
  admin = await db.models.Admin.findOne({ email: CREDENTIALS.admin.email })
  await Link.deleteMany({ teacherId: teacher._id })
  await Link.create({ teacherId: teacher._id, studentId: student._id })
  tApi = as(sign(teacher._id, 'teacher'))
  t2Api = as(sign(teacher2._id, 'teacher'))
  aApi = as(sign(admin._id, 'admin'))
  sApi = as(sign(student._id, 'student'))
})

beforeEach(async () => {
  await Promise.all([Set.deleteMany({}), GA.deleteMany({}), GC.deleteMany({})])
})

describe('question checks (shared with the editor)', () => {
  it('needs exactly one blank, a right word not among the wrong ones, and different wrong words', () => {
    expect(questionErrors(q(1))).toEqual([])
    expect(questionErrors({ ...q(1), prompt: 'No blank here.' })[0]).toMatch(/exactly one blank/)
    expect(questionErrors({ ...q(1), prompt: 'Two ___ blanks ___.' })[0]).toMatch(/exactly one blank/)
    expect(questionErrors({ ...q(1), distractors: ['word1', 'x'] }).join()).toMatch(/also in the wrong words/)
    expect(questionErrors({ ...q(1), distractors: ['same', 'Same'] }).join()).toMatch(/same/)
    expect(questionErrors({ ...q(1), distractors: [] }).join()).toMatch(/at least one wrong word/)
    expect(questionErrors({ ...q(1), answer: 'x'.repeat(25) }).join()).toMatch(/too long/)
    expect(publishErrors({ title: 'T', questions: eight.slice(0, 7) })[0]).toMatch(/at least 8/)
    expect(publishErrors({ title: 'T', questions: eight })).toEqual([])
  })

  it('reads a CSV export, skipping the header and reporting bad lines', () => {
    const csv = 'type,prompt,answer,distractor1,distractor2,distractor3\n'
      + 'gap,I ___ a student.,am,is,are\n'
      + 'gap,"She has two cats, ___ dogs.",no,a,the\n'
      + 'gap,No blank here,x,y\n'
    const { questions, errors } = parseQuestionsCsv(csv)
    expect(questions).toHaveLength(2)
    expect(questions[1].prompt).toBe('She has two cats, ___ dogs.')
    expect(errors).toEqual([{ line: 4, message: expect.stringMatching(/blank/) }])
  })
})

describe('question sets', () => {
  it('creates a draft, refuses wrong questions, publishes only with 8 good ones', async () => {
    const bad = await tApi.post('/games/sets', { title: 'Unit 1', questions: [{ ...q(1), prompt: 'no blank' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.problems[0].index).toBe(0)

    const created = await tApi.post('/games/sets', { title: 'Unit 1', level: 'A2', questions: eight.slice(0, 5) })
    expect(created.status).toBe(201)
    const id = created.body.data._id
    expect(created.body.data.status).toBe('draft')
    expect((await tApi.post(`/games/sets/${id}/publish`)).status).toBe(400)
    expect((await tApi.put(`/games/sets/${id}`, { questions: eight })).status).toBe(200)
    const pub = await tApi.post(`/games/sets/${id}/publish`)
    expect(pub.status).toBe(200)
    expect(pub.body.data.status).toBe('published')
    // a published set can't drop below 8 questions
    expect((await tApi.put(`/games/sets/${id}`, { questions: eight.slice(0, 3) })).status).toBe(400)
  })

  it('teachers only see their own sets; admins see every set in the center', async () => {
    await tApi.post('/games/sets', { title: 'Mine', questions: [q(1)] })
    const theirs = (await t2Api.post('/games/sets', { title: 'Theirs', questions: [q(2)] })).body.data
    expect((await tApi.get('/games/sets')).body.data.map((s) => s.title)).toEqual(['Mine'])
    expect((await tApi.get(`/games/sets/${theirs._id}`)).status).toBe(404)
    expect((await tApi.put(`/games/sets/${theirs._id}`, { title: 'Hacked' })).status).toBe(404)
    expect((await aApi.get('/games/sets')).body.data.map((s) => s.title).sort()).toEqual(['Mine', 'Theirs'])
    expect((await sApi.get('/games/sets')).status).toBe(403)
  })

  it('duplicates as a draft, and will not delete a set students are playing', async () => {
    const set = (await tApi.post('/games/sets', { title: 'Unit 2', questions: eight })).body.data
    await tApi.post(`/games/sets/${set._id}/publish`)
    const copy = (await tApi.post(`/games/sets/${set._id}/duplicate`)).body.data
    expect(copy.title).toBe('Unit 2 (copy)')
    expect(copy.status).toBe('draft')
    expect(copy.questions).toHaveLength(8)
    const a = (await tApi.post('/games/assignments', { setId: set._id, studentIds: [String(student._id)] })).body.data
    expect((await tApi.del(`/games/sets/${set._id}`)).status).toBe(409)
    await tApi.patch(`/games/assignments/${a._id}`, { active: false })
    expect((await tApi.del(`/games/sets/${set._id}`)).status).toBe(200)
  })
})

describe('assigning', () => {
  async function publishedSet(api = tApi) {
    const set = (await api.post('/games/sets', { title: 'Play me', questions: eight })).body.data
    await api.post(`/games/sets/${set._id}/publish`)
    return set
  }

  it("offers only the teacher's own group classes and students", async () => {
    const mineGc = await GC.create({ teacherId: teacher._id, title: 'My club', scheduledTime: new Date(), enrollments: [{ studentId: student._id }] })
    await GC.create({ teacherId: teacher2._id, title: 'Their club', scheduledTime: new Date() })
    const t = (await tApi.get('/games/targets')).body.data
    expect(t.groupClasses.map((g) => g.title)).toEqual(['My club'])
    expect(t.groupClasses[0].students).toBe(1)
    expect(t.students.map((s) => s.id)).toEqual([String(student._id)])
    expect(String(mineGc._id)).toBe(String(t.groupClasses[0].id))
  })

  it('gives a published set to students, who then see and play it; stopping it hides it again', async () => {
    const draft = (await tApi.post('/games/sets', { title: 'Draft', questions: eight })).body.data
    expect((await tApi.post('/games/assignments', { setId: draft._id, studentIds: [String(student._id)] })).status).toBe(400)
    const set = await publishedSet()
    expect((await tApi.post('/games/assignments', { setId: set._id, studentIds: [String(other._id)] })).status).toBe(403) // not their student
    expect((await tApi.post('/games/assignments', { setId: set._id })).status).toBe(400)                                  // nobody chosen
    const res = await tApi.post('/games/assignments', { setId: set._id, studentIds: [String(student._id)], chapters: 2, maxPlaysPerDay: 5, dueAt: new Date(Date.now() + 7 * 86400000) })
    expect(res.status).toBe(201)
    const list = (await sApi.get('/games/word-squad/assignments')).body.data.assignments
    expect(list.map((a) => a.title)).toEqual(['Play me'])
    expect(list[0].chapters).toBe(2)
    expect((await tApi.get('/games/assignments')).body.data[0]).toMatchObject({ setTitle: 'Play me', students: 1, active: true })
    await tApi.patch(`/games/assignments/${res.body.data._id}`, { active: false })
    expect((await sApi.get('/games/word-squad/assignments')).body.data.assignments).toHaveLength(0)
  })

  it('admins can assign any set to any student', async () => {
    const set = await publishedSet(t2Api)
    const res = await aApi.post('/games/assignments', { setId: set._id, studentIds: [String(other._id)] })
    expect(res.status).toBe(201)
    expect((await t2Api.get('/games/assignments')).body.data).toHaveLength(0) // made by the admin, not the teacher
  })
})
