// Values that end up in emails and links: one plain email address, real meeting links only.
import { describe, it, expect } from 'vitest'
import { toEmail } from '../utils/inputSanitizer.js'
import { isMeetingLink, cleanMeetingLink } from '../utils/meetingLinks.js'

describe('toEmail', () => {
  it('accepts and lower-cases a normal address', () => {
    expect(toEmail(' Kemi@Sandbox.Test ')).toBe('kemi@sandbox.test')
    expect(toEmail('ok.name+tag@sub.example.co.uk')).toBe('ok.name+tag@sub.example.co.uk')
  })
  it.each([
    ['two addresses', 'a@x.com,b@y.com'],
    ['a space', 'a b@x.com'],
    ['markup', '<script>@x.com'],
    ['quotes', '"x"@y.com'],
    ['no domain dot', 'a@x'],
    ['a control character', `a${String.fromCharCode(8)}@x.com`],
    ['not a string', { $ne: null }],
  ])('refuses %s', (_, v) => {
    expect(() => toEmail(v)).toThrow(/valid email/)
  })
})

describe('homework PDF uploads', async () => {
  const { pdfHasActiveContent } = await import('../routes/homeworkRoutes.js')
  const pdf = (body) => Buffer.from(`%PDF-1.4\n1 0 obj << /Type /Catalog ${body} >> endobj\n%%EOF`, 'latin1')
  it('a plain PDF is fine', () => expect(pdfHasActiveContent(pdf('/Pages 2 0 R'))).toBe(false))
  it.each([
    ['JavaScript', '/OpenAction << /S /JavaScript /JS (x) >>'],
    ['escaped name', '/S /J#61vaScript'],
    ['launch', '/S /Launch /F (cmd.exe)'],
    ['embedded file', '/EmbeddedFile'],
    ['XFA form', '/XFA 5 0 R'],
  ])('refuses a PDF with %s', (_, body) => expect(pdfHasActiveContent(pdf(body))).toBe(true))
})

describe('meeting links', () => {
  it('accepts real https Meet / Zoom links', () => {
    expect(isMeetingLink('googlemeet', 'https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(isMeetingLink('zoom', 'https://us02web.zoom.us/j/123')).toBe(true)
  })
  it.each([
    'javascript:alert(1)', 'data:text/html,x', 'http://meet.google.com/abc',
    'https://meet.google.com.evil.test/x', 'https://evil.test/meet.google.com',
  ])('refuses %s', (link) => {
    expect(isMeetingLink('googlemeet', link)).toBe(false)
    expect(() => cleanMeetingLink('googlemeet', link)).toThrow()
  })
  it('empty clears, undefined leaves alone', () => {
    expect(cleanMeetingLink('zoom', '')).toBe('')
    expect(cleanMeetingLink('zoom', undefined)).toBeUndefined()
  })
})
