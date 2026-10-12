// getDb(slug) must open ONE connection per center, even when the first requests
// for that center arrive at the same moment (each used to open its own, and the
// extras leaked). A failed connect must not be cached.
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'

const { getDb, closeConnection, closeAllConnections } = await import('../config/dbManager.js')

let savedBase
beforeAll(() => {
  savedBase = process.env.DB_BASE_URI
  const c = global.__TEST_DB__
  process.env.DB_BASE_URI = `mongodb://${c.host}:${c.port}`
})
afterAll(async () => {
  await closeAllConnections()
  process.env.DB_BASE_URI = savedBase
})

describe('getDb', () => {
  it('simultaneous first requests share one connection', async () => {
    const spy = vi.spyOn(mongoose, 'createConnection')
    const conns = await Promise.all(Array.from({ length: 8 }, () => getDb('race-center')))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(new Set(conns).size).toBe(1)
    expect(conns[0].readyState).toBe(1) // open by the time getDb resolves
    spy.mockRestore()
  })

  it('later calls reuse the open connection', async () => {
    const a = await getDb('reuse-center')
    const b = await getDb('reuse-center')
    expect(a).toBe(b)
  })

  it('closeConnection closes it and the next getDb opens a fresh one', async () => {
    const a = await getDb('reopen-center')
    await closeConnection('reopen-center')
    expect(a.readyState).toBe(0)
    const b = await getDb('reopen-center')
    expect(b).not.toBe(a)
    expect(b.readyState).toBe(1)
  })

  it('a failed connect is not cached — the next call tries again', async () => {
    process.env.DB_BASE_URI = 'mongodb://127.0.0.1:1' // nothing listens here
    await expect(getDb('down-center')).rejects.toThrow()
    const c = global.__TEST_DB__
    process.env.DB_BASE_URI = `mongodb://${c.host}:${c.port}`
    const conn = await getDb('down-center')
    expect(conn.readyState).toBe(1)
  }, 20000)

  it('rejects an invalid slug', async () => {
    await expect(getDb('../admin')).rejects.toThrow(/Invalid center slug/)
  })
})
