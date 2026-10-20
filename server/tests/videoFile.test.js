// Local-disk video responses: Range parsing (seeking) and a file that disappears mid-request.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseRange, sendVideoFile } from '../utils/videoFile.js'

describe('parseRange', () => {
  it('reads start-end, open-ended and suffix ranges', () => {
    expect(parseRange('bytes=0-3', 10)).toEqual({ start: 0, end: 3 })
    expect(parseRange('bytes=4-', 10)).toEqual({ start: 4, end: 9 })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 })
    expect(parseRange('bytes=5-999', 10)).toEqual({ start: 5, end: 9 }) // clamped to the file
  })

  it('ignores a missing, malformed or multi-part header (whole file)', () => {
    expect(parseRange(undefined, 10)).toBeNull()
    expect(parseRange('bytes=-', 10)).toBeNull()
    expect(parseRange('items=0-3', 10)).toBeNull()
    expect(parseRange('bytes=0-1,4-5', 10)).toBeNull()
  })

  it('flags ranges the file cannot satisfy', () => {
    expect(parseRange('bytes=10-', 10)).toBe(false)
    expect(parseRange('bytes=6-2', 10)).toBe(false)
    expect(parseRange('bytes=-0', 10)).toBe(false)
    expect(parseRange('bytes=0-', 0)).toBe(false)
  })
})

describe('sendVideoFile', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'video-'))
  const file = path.join(dir, 'clip.webm')
  const app = express()
  app.get('/v', (req, res) => sendVideoFile(req, res, file))
  app.get('/missing', (req, res) => sendVideoFile(req, res, path.join(dir, 'gone.webm')))

  beforeAll(() => fs.writeFileSync(file, Buffer.from('0123456789')))
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('serves the whole file, a range, or 416', async () => {
    const all = await request(app).get('/v')
    expect(all.status).toBe(200)
    expect(all.headers['content-length']).toBe('10')

    const part = await request(app).get('/v').set('Range', 'bytes=-4')
    expect(part.status).toBe(206)
    expect(part.headers['content-range']).toBe('bytes 6-9/10')

    const bad = await request(app).get('/v').set('Range', 'bytes=50-')
    expect(bad.status).toBe(416)
    expect(bad.headers['content-range']).toBe('bytes */10')
  })

  it('answers 404 (not a crash) when the file is gone', async () => {
    expect((await request(app).get('/missing')).status).toBe(404)
  })
})
