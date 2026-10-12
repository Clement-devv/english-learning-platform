// Per-center background jobs must follow the center's status without a restart:
// a newly active center gets them, a suspended / deleted one has them stopped,
// and one center failing to start never blocks the others.
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest'

let activeCenters = []
let failingSlugs = new Set()
const started = []   // slugs, in start order
const cleared = new Set()

vi.mock('../models/master/Center.js', () => ({
  default: { find: () => ({ select: () => ({ lean: async () => activeCenters.map(slug => ({ slug })) }) }) },
}))
vi.mock('../config/dbManager.js', () => ({
  getDb: async (slug) => {
    if (failingSlugs.has(slug)) throw new Error(`cannot reach ${slug}`)
    return { name: slug, models: { Teacher: {} } }
  },
}))
vi.mock('../utils/teacherCode.js', () => ({ backfillTeacherCodes: () => Promise.resolve(), generateTeacherCode: async () => 'TCH-00000' }))

// Each fake scheduler hands back one real (long) timer so stop can be verified
const fakeStart = (name) => (db) => {
  if (name === 'reminders') started.push(db.name)
  const t = setInterval(() => {}, 1e9)
  t.__label = `${db.name}:${name}`
  return [t]
}
vi.mock('../utils/reminderScheduler.js', () => ({ startReminderScheduler: fakeStart('reminders') }))
vi.mock('../routes/recordingRoutes.js', () => ({ startRecordingCleanup: fakeStart('recordings') }))
vi.mock('../utils/progressReportScheduler.js', () => ({ startProgressReportScheduler: fakeStart('progress') }))
vi.mock('../utils/dailyClassReportScheduler.js', () => ({ startDailyClassReportScheduler: fakeStart('daily') }))
vi.mock('../utils/missedClassScheduler.js', () => ({ startMissedClassScheduler: fakeStart('missed') }))
vi.mock('../utils/parentCheck.js', () => ({ startParentCheckScheduler: fakeStart('parent') }))

const realClearInterval = globalThis.clearInterval
globalThis.clearInterval = (t) => { if (t?.__label) cleared.add(t.__label); realClearInterval(t) }

const { syncCenterJobs, stopCenterJobs, stopAllCenterJobs, runningCenterJobs } = await import('../utils/centerJobs.js')

beforeEach(() => {
  stopAllCenterJobs()
  activeCenters = []; failingSlugs = new Set(); started.length = 0; cleared.clear()
})
afterAll(() => { stopAllCenterJobs(); globalThis.clearInterval = realClearInterval })

describe('center background jobs', () => {
  it('starts jobs for every active center', async () => {
    activeCenters = ['alpha', 'beta']
    await syncCenterJobs()
    expect(runningCenterJobs().sort()).toEqual(['alpha', 'beta'])
  })

  it('a center activated later gets its jobs on the next sync (no restart)', async () => {
    activeCenters = ['alpha']
    await syncCenterJobs()
    activeCenters = ['alpha', 'newcenter'] // e.g. invite accepted
    await syncCenterJobs()
    expect(runningCenterJobs().sort()).toEqual(['alpha', 'newcenter'])
    expect(started.filter(s => s === 'alpha')).toHaveLength(1) // not started twice
  })

  it('a suspended / deleted center has all its jobs stopped', async () => {
    activeCenters = ['alpha', 'beta']
    await syncCenterJobs()
    activeCenters = ['alpha']
    await syncCenterJobs()
    expect(runningCenterJobs()).toEqual(['alpha'])
    for (const job of ['reminders', 'recordings', 'progress', 'daily', 'missed', 'parent']) {
      expect(cleared.has(`beta:${job}`)).toBe(true)
    }
    expect([...cleared].some(l => l.startsWith('alpha:'))).toBe(false)
  })

  it('a reactivated center gets fresh jobs', async () => {
    activeCenters = ['alpha']
    await syncCenterJobs()
    activeCenters = []
    await syncCenterJobs()
    activeCenters = ['alpha']
    await syncCenterJobs()
    expect(runningCenterJobs()).toEqual(['alpha'])
    expect(started.filter(s => s === 'alpha')).toHaveLength(2)
  })

  it('one unreachable center does not block the others, and is retried', async () => {
    activeCenters = ['broken', 'alpha', 'beta']
    failingSlugs = new Set(['broken'])
    await syncCenterJobs()
    expect(runningCenterJobs().sort()).toEqual(['alpha', 'beta'])

    failingSlugs = new Set()
    await syncCenterJobs()
    expect(runningCenterJobs().sort()).toEqual(['alpha', 'beta', 'broken'])
  })

  it('two overlapping syncs never start a center twice', async () => {
    activeCenters = ['alpha']
    await Promise.all([syncCenterJobs(), syncCenterJobs()])
    expect(started.filter(s => s === 'alpha')).toHaveLength(1)
  })

  it('stopCenterJobs (purge) stops one center only', async () => {
    activeCenters = ['alpha', 'beta']
    await syncCenterJobs()
    expect(stopCenterJobs('beta')).toBe(true)
    expect(runningCenterJobs()).toEqual(['alpha'])
    expect(stopCenterJobs('beta')).toBe(false)
  })
})
