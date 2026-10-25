// Word Squad questions from book pages: uploads (local storage here — no S3 in
// tests), delete any time and after 30 days, AI jobs checked against the
// center's credits and the 5-per-hour limit, and the background worker turning a
// job into a DRAFT set (with a fake AI client — no real AI calls).
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test', timezone: 'UTC' }
    req.db = global.__TEST_DB__
    next()
  },
}))
// The center's AI credits live in the master DB; keep them in memory here
const credits = vi.hoisted(() => ({ balance: 100, charged: [] }))
vi.mock('../utils/aiCredits.js', async (importOriginal) => {
  const real = await importOriginal()
  return {
    ...real,
    getAiBalance: async () => credits.balance,
    chargeAiCredits: async (slug, amount, note) => { const took = Math.min(amount, credits.balance); credits.balance -= took; credits.charged.push({ amount: took, note }); return took },
  }
})

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key-not-used'

const { default: aiRoutes } = await import('../routes/gameAiRoutes.js')
const { runNextJob, sweepExpiredSources } = await import('../utils/questionJobs.js')
const { readQuestions, buildPrompt, QUESTION_MODEL } = await import('../utils/questionAi.js')
const { LOCAL_DIR } = await import('../utils/questionSources.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { questionSourceSchema } = await import('../schemas/questionSourceSchema.js')
const { questionJobSchema } = await import('../schemas/questionJobSchema.js')
const { questionSetSchema } = await import('../schemas/questionSetSchema.js')

const app = express()
app.use(express.json())
app.use('/games/ai', aiRoutes)

const sign = (id, role) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: 'testcenter' }, getCenterSecret('testcenter'), { expiresIn: '5m' })
const as = (token) => ({
  get: (u) => request(app).get(u).set('Authorization', `Bearer ${token}`),
  post: (u, b = {}) => request(app).post(u).set('Authorization', `Bearer ${token}`).send(b),
  put: (u, buf, type) => request(app).put(u).set('Authorization', `Bearer ${token}`).set('Content-Type', type).send(buf),
  del: (u) => request(app).delete(u).set('Authorization', `Bearer ${token}`),
})

const PAGE = Buffer.from('%PDF-1.4 fake page for tests')
const goodAiReply = JSON.stringify([
  { prompt: 'She ___ to school by bus.', answer: 'goes', distractors: ['go', 'going'] },
  { prompt: 'I have two ___ at home.', answer: 'cats', distractors: ['cat', 'a cat'] },
  { prompt: 'They ___ football every day.', answer: 'play', distractors: ['plays', 'playing'] },
  { prompt: 'The sun is very ___ today.', answer: 'hot', distractors: ['cold', 'wet'] },
  { prompt: 'The sun is very ___ today.', answer: 'hot', distractors: ['cold', 'wet'] },          // duplicate
  { prompt: 'No blank in this one.', answer: 'x', distractors: ['y'] },                           // invalid
  { prompt: 'We ___ rice for dinner.', answer: 'eat', distractors: ['eat', 'eats'] },              // answer repeated
])
const fakeAi = (reply, { fail = false } = {}) => ({
  calls: 0,
  messages: {
    create: vi.fn(async function () {
      this.calls = (this.calls || 0) + 1
      if (fail) throw new Error('timeout')
      return { content: [{ type: 'text', text: reply }], usage: { input_tokens: 6000, output_tokens: 1500 } }
    }),
  },
})

let Source, Job, QSet, teacher, teacher2, tApi, t2Api, sApi

beforeAll(async () => {
  const db = global.__TEST_DB__
  Source = db.models.QuestionSource || db.model('QuestionSource', questionSourceSchema)
  Job = db.models.QuestionJob || db.model('QuestionJob', questionJobSchema)
  QSet = db.models.QuestionSet || db.model('QuestionSet', questionSetSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  teacher2 = await db.models.Teacher.create({ email: 't2-ai@test.com', firstName: 'Ai', lastName: 'Two', active: true, status: 'active', continent: 'Asia' })
  const student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  tApi = as(sign(teacher._id, 'teacher'))
  t2Api = as(sign(teacher2._id, 'teacher'))
  sApi = as(sign(student._id, 'student'))
})

beforeEach(async () => {
  await Promise.all([Source.deleteMany({}), Job.deleteMany({}), QSet.deleteMany({})])
  credits.balance = 100
  credits.charged = []
})

// Leave no test pages on disk
afterAll(async () => { await fs.promises.rm(path.join(LOCAL_DIR, 'testcenter'), { recursive: true, force: true }) })

async function upload(api = tApi, name = 'unit3.pdf', mime = 'application/pdf', buf = PAGE) {
  const start = await api.post('/games/ai/uploads', { files: [{ name, mime, size: buf.length }] })
  expect(start.status).toBe(201)
  const u = start.body.data[0]
  expect(u.upload.local).toBe(true)
  const put = await api.put(u.upload.url, buf, mime)
  expect(put.status).toBe(200)
  return u.id
}

describe('the AI prompt and its answer', () => {
  it('asks for gap questions from the pages only, for the level, as JSON', () => {
    const p = buildPrompt({ level: 'A2', focus: 'grammar', wantedCount: 12 })
    expect(p).toMatch(/exactly 12/)
    expect(p).toMatch(/CEFR level A2/)
    expect(p).toMatch(/ONLY words, sentences and topics that appear on these pages/)
    expect(p).toMatch(/Vietnamese children/)
    expect(QUESTION_MODEL).toBe('claude-sonnet-4-6') // the same model as the quiz generator
  })

  it('keeps only valid, different questions', () => {
    const qs = readQuestions('Here you go:\n```json\n' + goodAiReply + '\n```', 30)
    expect(qs.map((q) => q.answer)).toEqual(['goes', 'cats', 'play', 'hot'])
    expect(readQuestions('not json', 10)).toEqual([])
  })
})

describe('uploads', () => {
  it('accepts a PDF or photos, refuses other files and big ones, and lists them with their delete date', async () => {
    expect((await tApi.post('/games/ai/uploads', { files: [{ name: 'a.docx', mime: 'application/msword', size: 10 }] })).status).toBe(400)
    expect((await tApi.post('/games/ai/uploads', { files: [{ name: 'big.pdf', mime: 'application/pdf', size: 16 * 1024 * 1024 }] })).status).toBe(400)
    expect((await tApi.post('/games/ai/uploads', { files: [{ name: 'p.jpg', mime: 'image/jpeg', size: 2 * 1024 * 1024 }] })).status).toBe(400)
    const id = await upload()
    const list = (await tApi.get('/games/ai/uploads')).body.data
    expect(list.map((s) => String(s.id))).toEqual([String(id)])
    const days = (new Date(list[0].expiresAt) - Date.now()) / 86400000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
    expect((await t2Api.get('/games/ai/uploads')).body.data).toHaveLength(0) // not someone else's
    expect((await sApi.get('/games/ai/uploads')).status).toBe(403)
  })

  it('can be deleted any time — the file goes too', async () => {
    const id = await upload()
    const src = await Source.findById(id).lean()
    const file = path.join(LOCAL_DIR, src.key)
    expect(fs.existsSync(file)).toBe(true)
    expect((await t2Api.del(`/games/ai/uploads/${id}`)).status).toBe(404) // not theirs
    expect((await tApi.del(`/games/ai/uploads/${id}`)).status).toBe(200)
    expect(fs.existsSync(file)).toBe(false)
    expect(await Source.countDocuments({ _id: id })).toBe(0)
  })

  it('deletes itself after 30 days (the hourly cleanup)', async () => {
    const id = await upload()
    const src = await Source.findById(id).lean()
    await Source.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - 1000) })
    expect(await sweepExpiredSources(global.__TEST_DB__)).toBe(1)
    expect(fs.existsSync(path.join(LOCAL_DIR, src.key))).toBe(false)
    expect(await Source.countDocuments({ _id: id })).toBe(0)
  })
})

describe('AI jobs', () => {
  it('checks the credits first, then queues the job', async () => {
    const id = await upload()
    credits.balance = 2
    const poor = await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Unit 3' })
    expect(poor.status).toBe(402)
    expect(poor.body.message).toMatch(/Not enough AI credits/)
    credits.balance = 100
    const res = await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Unit 3', level: 'A2', wantedCount: 12, focus: 'grammar' })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('queued')
  })

  it("refuses other teachers' pages and more than 5 jobs an hour", async () => {
    const id = await upload()
    expect((await t2Api.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Mine?' })).status).toBe(403)
    for (let i = 0; i < 5; i++) expect((await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: `Job ${i}` })).status).toBe(201)
    expect((await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Too many' })).status).toBe(429)
  })

  it('the worker turns a job into a DRAFT set and charges what the AI used', async () => {
    const id = await upload()
    await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Unit 3 — Food', level: 'A2', wantedCount: 12 })
    const ai = fakeAi(goodAiReply)
    const job = await runNextJob(global.__TEST_DB__, { slug: 'testcenter' }, { ai })
    expect(job.status).toBe('done')
    expect(job.made).toBe(4)
    const set = await QSet.findById(job.setId).lean()
    expect(set.status).toBe('draft')            // never published by itself
    expect(set.source).toBe('ai_upload')
    expect(set.questions.map((q) => q.answer)).toEqual(['goes', 'cats', 'play', 'hot'])
    expect(String(set.createdBy.id)).toBe(String(teacher._id))
    // the pages went to the model as a document, with the prompt
    const content = ai.messages.create.mock.calls[0][0].messages[0].content
    expect(content[0]).toMatchObject({ type: 'document', source: { media_type: 'application/pdf' } })
    expect(content.at(-1).type).toBe('text')
    // 7,500 tokens → 2 credits
    expect(job.creditsUsed).toBe(2)
    expect(credits.balance).toBe(98)
    // the teacher sees it in their list
    const list = (await tApi.get('/games/ai/jobs')).body.data
    expect(list[0]).toMatchObject({ status: 'done', made: 4 })
  })

  it('retries once, then fails with a clear message (and keeps the pages)', async () => {
    const id = await upload()
    await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Unit 4' })
    const ai = fakeAi('', { fail: true })
    const job = await runNextJob(global.__TEST_DB__, { slug: 'testcenter' }, { ai })
    expect(ai.messages.create).toHaveBeenCalledTimes(2)
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/try again/)
    expect(await Source.countDocuments({ _id: id })).toBe(1)
    expect(await QSet.countDocuments({})).toBe(0)
  })

  it('fails if a page was deleted before the job ran', async () => {
    const id = await upload()
    await tApi.post('/games/ai/jobs', { sourceIds: [String(id)], title: 'Unit 5' })
    await tApi.del(`/games/ai/uploads/${id}`)
    const job = await runNextJob(global.__TEST_DB__, { slug: 'testcenter' }, { ai: fakeAi(goodAiReply) })
    expect(job.status).toBe('failed')
    expect(job.error).toMatch(/deleted/)
  })
})
