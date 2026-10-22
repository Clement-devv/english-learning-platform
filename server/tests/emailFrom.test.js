// The "From" header must always be `address` or `Name <address>` — Resend rejects
// anything else ("Invalid `from` field"), which silently stopped every email.
import { describe, it, expect, afterEach } from 'vitest'

const { buildFrom, senderAddress } = await import('../emails/core.js')
const saved = process.env.EMAIL_FROM
afterEach(() => { process.env.EMAIL_FROM = saved })

describe('email sender', () => {
  it('plain address in EMAIL_FROM', () => {
    process.env.EMAIL_FROM = 'noreply@clemify.com'
    expect(buildFrom('Sunshine English')).toBe('Sunshine English <noreply@clemify.com>')
  })

  it('EMAIL_FROM that already has a name is not wrapped twice', () => {
    process.env.EMAIL_FROM = 'Clemify <noreply@clemify.com>'
    expect(senderAddress()).toBe('noreply@clemify.com')
    expect(buildFrom('Sunshine English')).toBe('Sunshine English <noreply@clemify.com>')
  })

  it('quotes or cleans names that would break the header', () => {
    process.env.EMAIL_FROM = 'noreply@clemify.com'
    expect(buildFrom('Emac English, Ltd.')).toBe('"Emac English, Ltd." <noreply@clemify.com>')
    expect(buildFrom('Bad <name> "x"\nnext')).toBe('Bad name x next <noreply@clemify.com>')
    expect(buildFrom('')).toMatch(/<noreply@clemify\.com>$/)
  })

  it('no usable address → null (send fails with a clear message instead)', () => {
    process.env.EMAIL_FROM = 'not-an-email'
    expect(senderAddress()).toBe(null)
    expect(buildFrom('X')).toBe(null)
  })
})
