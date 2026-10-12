import { describe, it, expect } from 'vitest'
import { decodeJwtPayload } from './jwt'

// Encode like a real JWT: base64url, no padding
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const token = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`

describe('decodeJwtPayload', () => {
  it('reads a payload whose base64url contains "-" and "_" (plain atob threw on these)', () => {
    // these values encode to base64url with - and _ characters
    const payload = { id: '64b7f0c2a1b2c3d4e5f60718', role: 'admin', exp: 1999999999, n: '>>>???~~~' }
    const t = token(payload)
    expect(/[-_]/.test(t.split('.')[1])).toBe(true)
    expect(decodeJwtPayload(t)).toEqual(payload)
  })

  it('handles payloads that need padding', () => {
    for (const n of ['a', 'ab', 'abc', 'abcd']) {
      expect(decodeJwtPayload(token({ n }))).toEqual({ n })
    }
  })

  it('decodes UTF-8 (accented names)', () => {
    expect(decodeJwtPayload(token({ name: 'Zoë Ñúñez 李' }))).toEqual({ name: 'Zoë Ñúñez 李' })
  })

  it('returns null for garbage', () => {
    expect(decodeJwtPayload('')).toBeNull()
    expect(decodeJwtPayload('abc')).toBeNull()
    expect(decodeJwtPayload('a.%%%.c')).toBeNull()
    expect(decodeJwtPayload(null)).toBeNull()
  })
})
