import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'
import { Readable } from 'node:stream'
const mock = vi.hoisted(() => ({ send: vi.fn(), sign: vi.fn(async () => 'signed') }))
vi.mock('@aws-sdk/client-s3', () => {
  class Command { constructor(input) { this.input = input } }
  return {
    S3Client: class { send(command) { return mock.send(command) } },
    PutObjectCommand: Command, DeleteObjectCommand: Command, HeadObjectCommand: Command,
    GetObjectCommand: Command, CopyObjectCommand: Command,
  }
})
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: (...args) => mock.sign(...args) }))
vi.stubEnv('S3_BUCKET', 'synthetic-test-bucket')
afterAll(() => vi.unstubAllEnvs())
const { getObjectBuffer, getPresignedPutUrl, sealS3Upload } = await import('../utils/s3.js')
beforeEach(() => vi.clearAllMocks())
describe('S3 byte limits and immutable acceptance', () => {
  it('rejects ContentLength before consuming an oversized body', async () => {
    const body = Readable.from([Buffer.alloc(100)])
    mock.send.mockResolvedValue({ ContentLength: 100, Body: body })
    await expect(getObjectBuffer('synthetic', 10)).rejects.toThrow('allowed size')
    expect(body.destroyed).toBe(true)
  })
  it('bounds streamed bytes when ContentLength is absent', async () => {
    mock.send.mockResolvedValue({ Body: Readable.from([Buffer.alloc(6), Buffer.alloc(6)]) })
    await expect(getObjectBuffer('synthetic', 10)).rejects.toThrow('allowed size')
  })
  it('signs the announced byte count and type', async () => {
    await getPresignedPutUrl('staging', 'application/pdf', 600, 100)
    expect(mock.sign.mock.calls[0][1].input).toMatchObject({ ContentLength: 100, ContentType: 'application/pdf' })
    expect(mock.sign.mock.calls[0][2].signableHeaders.has('content-length')).toBe(true)
  })
  it('copies with the checked ETag into a never-signed key', async () => {
    mock.send.mockResolvedValue({})
    const key = await sealS3Upload('centers/test/staging.pdf', { ETag: 'etag' })
    expect(key).toMatch(/^centers\/test\/staging.pdf.ready-/)
    expect(mock.send.mock.calls[0][0].input).toMatchObject({ Key: key, CopySourceIfMatch: 'etag' })
  })
})
