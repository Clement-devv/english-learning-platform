import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'

const storage = vi.hoisted(() => ({ metadata: null, sealed: 'sealed-never-signed', deleted: [], failCopy: false }))
vi.mock('../utils/s3.js', () => ({
  s3Enabled: () => true,
  getPresignedPutUrl: vi.fn(async () => 'https://synthetic.invalid/signed-put'),
  getObjectMetadata: vi.fn(async () => storage.metadata),
  sealS3Upload: vi.fn(async () => { if (storage.failCopy) throw new Error('ETag mismatch'); return storage.sealed }),
  deleteFromS3: vi.fn(async key => { storage.deleted.push(key) }),
}))
vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, _res, next) => { req.center = { slug: 'testcenter' }; req.db = global.__TEST_DB__; next() },
}))
vi.mock('../utils/aiCredits.js', () => ({ getAiBalance: async () => 100, estimateCredits: () => 1 }))
const { default: routes } = await import('../routes/gameAiRoutes.js')
const { questionSourceSchema } = await import('../schemas/questionSourceSchema.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getPresignedPutUrl } = await import('../utils/s3.js')
const app = express()
app.use(express.json())
app.use('/ai', routes)
let Source, token, teacher
beforeAll(async () => {
  Source = global.__TEST_DB__.model('QuestionSource', questionSourceSchema)
  teacher = await global.__TEST_DB__.models.Teacher.findOne({})
  token = jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(teacher._id), role: 'teacher', centerId: 'testcenter' }, getCenterSecret('testcenter'), { expiresIn: '5m' })
})
beforeEach(() => { storage.deleted = []; storage.failCopy = false })
const post = (url, body = {}) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body)
async function staged() {
  return Source.create({ createdBy: { role: 'teacher', id: teacher._id }, name: 'page.pdf', mime: 'application/pdf', size: 100, storage: 's3', status: 'pending', key: `test-${Math.random()}.pdf`, expiresAt: new Date(Date.now() + 3600000) })
}
describe('S3 AI upload acceptance', () => {
  it.each([
    ['oversized', { ETag: 'x', ContentLength: 101, ContentType: 'application/pdf' }],
    ['wrong type', { ETag: 'x', ContentLength: 100, ContentType: 'text/html' }],
    ['missing length', { ETag: 'x', ContentType: 'application/pdf' }],
    ['empty', { ETag: 'x', ContentLength: 0, ContentType: 'application/pdf' }],
  ])('rejects and deletes %s objects', async (_name, metadata) => {
    const src = await staged()
    storage.metadata = metadata
    expect((await post(`/ai/uploads/${src._id}/done`)).status).toBe(400)
    expect((await Source.findById(src._id)).status).toBe('pending')
    expect(storage.deleted).toContain(src.key)
  })
  it('seals the checked object at a different key and makes completion idempotent', async () => {
    const src = await staged()
    storage.metadata = { ETag: 'checked-etag', ContentLength: 90, ContentType: 'application/pdf' }
    expect((await post(`/ai/uploads/${src._id}/done`)).status).toBe(200)
    expect(await Source.findById(src._id).lean()).toMatchObject({ status: 'ready', key: storage.sealed, size: 90 })
    expect(storage.deleted).toContain(src.key)
    expect((await post(`/ai/uploads/${src._id}/done`)).status).toBe(200)
  })
  it('does not accept an object replaced during validation', async () => {
    const src = await staged()
    storage.metadata = { ETag: 'old', ContentLength: 100, ContentType: 'application/pdf' }
    storage.failCopy = true
    expect((await post(`/ai/uploads/${src._id}/done`)).status).toBe(500)
    expect((await Source.findById(src._id)).status).toBe('pending')
  })
  it('passes the announced byte count to the signed PUT', async () => {
    expect((await post('/ai/uploads', { files: [{ name: 'page.pdf', mime: 'application/pdf', size: 100 }] })).status).toBe(201)
    expect(getPresignedPutUrl).toHaveBeenLastCalledWith(expect.any(String), 'application/pdf', 600, 100)
  })
})
