// Installed-app icons: each center gets square PNGs in the sizes phones require, made
// from its logo (or its initial on its brand colour) — never the Clemify icon.
import { vi, describe, it, expect, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

vi.mock('../models/master/Center.js', () => ({ default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }))
const { pwaIcon, manifestIcons, iconVersion } = await import('../utils/pwaIcons.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOGO = path.join(__dirname, '../uploads/branding', `test-logo-${Date.now()}.png`)
afterAll(() => { try { fs.unlinkSync(LOGO) } catch { /* gone */ } })

const meta = (buf) => sharp(buf).metadata()
const pixel = async (buf, x, y) => {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i], data[i + 1], data[i + 2]]
}

describe('pwa icons', () => {
  it('makes a square PNG of the exact size from a wide logo, without cropping it', async () => {
    // A wide red logo (300x100)
    fs.mkdirSync(path.dirname(LOGO), { recursive: true })
    fs.writeFileSync(LOGO, await sharp({ create: { width: 300, height: 100, channels: 3, background: '#ff0000' } }).png().toBuffer())
    const center = { slug: 'logo-center', centerName: 'Emac', branding: { logo: `/uploads/branding/${path.basename(LOGO)}` } }
    for (const size of [180, 192, 512]) {
      const m = await meta(await pwaIcon(center, size))
      expect([m.format, m.width, m.height]).toEqual(['png', size, size])
    }
    const icon = await pwaIcon(center, 512)
    expect(await pixel(icon, 256, 256)).toEqual([255, 0, 0])   // the logo in the middle
    expect(await pixel(icon, 10, 10)).toEqual([255, 255, 255]) // white padding around it
  })

  it('uses the center initial on its brand colour when there is no logo', async () => {
    const center = { slug: 'plain', centerName: 'Emac', branding: { primaryColor: '#0000ff' } }
    const icon = await pwaIcon(center, 192)
    const m = await meta(icon)
    expect([m.format, m.width, m.height]).toEqual(['png', 192, 192])
    expect(await pixel(icon, 4, 4)).toEqual([0, 0, 255]) // brand colour background
  })

  it('lists the sizes Chrome needs, with a version that changes with the branding', () => {
    const a = { slug: 'x', centerName: 'A', branding: { logo: '/uploads/branding/a.png' } }
    const icons = manifestIcons(a)
    expect(icons.map((i) => [i.sizes, i.type, i.purpose])).toEqual([
      ['192x192', 'image/png', 'any'], ['512x512', 'image/png', 'any'], ['512x512', 'image/png', 'maskable'],
    ])
    expect(icons[0].src).toMatch(/^\/pwa-icon\/192\.png\?v=[0-9a-f]{10}$/)
    expect(iconVersion(a)).not.toBe(iconVersion({ ...a, branding: { logo: '/uploads/branding/b.png' } }))
  })
})
