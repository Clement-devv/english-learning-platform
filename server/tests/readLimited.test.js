import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import { readLimited } from '../utils/readLimited.js'

describe('bounded file reads', () => {
  it('accepts a file at the limit', async () => {
    expect(await readLimited(Readable.from([Buffer.from('ab'), Buffer.from('cd')]), 4)).toEqual(Buffer.from('abcd'))
  })
  it('stops consumption and closes the stream when chunks exceed the limit', async () => {
    let yielded = 0
    const stream = Readable.from((function* () {
      for (let n = 0; n < 100; n++) { yielded++; yield Buffer.alloc(10) }
    })())
    await expect(readLimited(stream, 15)).rejects.toThrow('allowed size')
    expect(stream.destroyed).toBe(true)
    expect(yielded).toBeLessThan(100)
  })
})
