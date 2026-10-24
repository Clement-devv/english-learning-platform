// A center website's language ('en' | 'vi') must survive saving and reach the public page.
import { describe, it, expect } from 'vitest'
import { cleanLandingPage, PUBLIC_LANDING_KEYS } from '../utils/landingPage.js'

describe('website language', () => {
  it('keeps en / vi and turns anything else into en', () => {
    expect(cleanLandingPage({ language: 'vi' }).language).toBe('vi')
    expect(cleanLandingPage({ language: 'en' }).language).toBe('en')
    expect(cleanLandingPage({ language: '<script>' }).language).toBe('en')
  })

  it('is sent to the public website', () => {
    expect(PUBLIC_LANDING_KEYS).toContain('language')
  })
})
