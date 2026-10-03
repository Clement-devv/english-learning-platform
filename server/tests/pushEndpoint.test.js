// The server POSTs to whatever push endpoint a browser registers, so only real
// browser push services may be stored or contacted (blocks blind SSRF).
import { describe, it, expect } from 'vitest'

const { isPushServiceEndpoint } = await import('../utils/webPushService.js')

describe('isPushServiceEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:APA91b',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://web.push.apple.com/QGuQyavXutnMUFkhRY',
    'https://wns2-bl2p.notify.windows.com/w/?token=abc',
  ])('accepts real browser push services: %s', (url) => {
    expect(isPushServiceEndpoint(url)).toBe(true)
  })

  it.each([
    'https://169.254.169.254/latest/meta-data/',           // cloud metadata
    'https://localhost/admin',
    'https://10.0.0.5:8443/internal',
    'https://attacker.example.com/collect',
    'https://fcm.googleapis.com.evil.com/x',                // look-alike host
    'https://evilfcm.googleapis.com.attacker.io/x',
    'https://fcm.googleapis.com:8443/x',                    // non-default port
    'https://user:pass@fcm.googleapis.com/x',               // credentials
    'http://fcm.googleapis.com/fcm/send/abc',               // not https
    'javascript:alert(1)',
    '',
  ])('rejects everything else: %s', (url) => {
    expect(isPushServiceEndpoint(url)).toBe(false)
  })
})
