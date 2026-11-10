import { describe, it, expect } from 'vitest'
import { sharedSnapshot } from '../utils/sharedSnapshot.js'

const response = () => ({
  statusCode: 200, headers: {},
  set(k, v) { this.headers[k] = v; return this },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }, on() {},
})
describe('cached response audience isolation', () => {
  it.each([['admin', 'teacher'], ['teacher', 'admin']])('isolates %s → %s and keeps same-role cache hits', async (first, second) => {
    const snapshot = sharedSnapshot(`audience-${first}`)
    const req = role => ({ center: { slug: 'testcenter' }, user: { role }, query: {} })
    const a = response(), b = response(), c = response()
    await snapshot(req(first), a, () => a.json({ audience: first }))
    await snapshot(req(second), b, () => b.json({ audience: second }))
    await snapshot(req(second), c, () => { throw new Error('should hit same-role cache') })
    expect(b.body.audience).toBe(second)
    expect(b.headers['X-Snapshot']).toBe('miss')
    expect(c.body.audience).toBe(second)
    expect(c.headers['X-Snapshot']).toBe('hit')
  })
  it('does not share an in-flight admin response with a teacher', async () => {
    const snapshot = sharedSnapshot('inflight-audience')
    const a = response(), b = response()
    const req = role => ({ center: { slug: 'testcenter' }, user: { role }, query: {} })
    await snapshot(req('admin'), a, () => {})
    await snapshot(req('teacher'), b, () => b.json({ public: true }))
    a.json({ private: true })
    expect(b.body).toEqual({ public: true })
  })
})
