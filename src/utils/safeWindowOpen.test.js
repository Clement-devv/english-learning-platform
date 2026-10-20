import { describe, it, expect, vi, beforeAll } from 'vitest'
import { isSafeUrl, installSafeWindowOpen } from './safeWindowOpen.js'

describe('safe window.open', () => {
  it('allows meeting links, mail, phone and this site', () => {
    expect(isSafeUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(isSafeUrl('mailto:a@b.c')).toBe(true)
    expect(isSafeUrl('tel:+234')).toBe(true)
    expect(isSafeUrl('/student/dashboard')).toBe(true)
  })

  it('refuses script and data URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeUrl('  JavaScript:alert(1)')).toBe(false)
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false)
  })

  describe('installed', () => {
    const native = vi.fn(() => ({}))
    beforeAll(() => { window.open = native; installSafeWindowOpen() })
    it('opens safe links and blocks unsafe ones', () => {
      window.open('https://zoom.us/j/1', '_blank')
      expect(native).toHaveBeenCalledTimes(1)
      expect(window.open('javascript:alert(1)')).toBeNull()
      expect(native).toHaveBeenCalledTimes(1)
    })
  })
})
