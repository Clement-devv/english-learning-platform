// Without Redis, ending a super-admin impersonation must still revoke its token
// (before, isImpersonationActive always said "active" and the token lasted 10 minutes).
import { vi, describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../config/redis.js', () => ({ default: null, redisClient: null }))

const { isImpersonationActive, revokeImpersonationLocally } = await import('../middleware/authMiddleware.js')
const bearer = (iat) => `Bearer ${jwt.sign({ isImpersonation: true, centerId: 'nored', iat }, 'secret')}`

describe('impersonation revocation without Redis', () => {
  it('a token is active until the impersonation is ended, then refused', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = bearer(now - 5)
    expect(await isImpersonationActive(token, 'nored')).toBe(true)
    revokeImpersonationLocally('nored')
    expect(await isImpersonationActive(token, 'nored')).toBe(false)
  })

  it('a new impersonation started afterwards works', async () => {
    const later = bearer(Math.floor(Date.now() / 1000) + 2)
    expect(await isImpersonationActive(later, 'nored')).toBe(true)
  })

  it('other centers are unaffected', async () => {
    expect(await isImpersonationActive(bearer(Math.floor(Date.now() / 1000) - 5), 'other')).toBe(true)
  })
})
