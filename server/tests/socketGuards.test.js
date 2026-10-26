// #16 — socket gaps:
//   • whiteboard strokes: a locked student can't draw, undo only removes your own stroke
//   • content tab: only the teacher drives page/zoom/pen, and only valid values pass
//   • ring-call can't skip the "calls muted" check by leaving out targetRole
//   • the caller's name shown to the target comes from the DB, not the client
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import http from 'http'
import jwt from 'jsonwebtoken'
import { io as ioClient } from '../../node_modules/socket.io-client/build/esm-debug/index.js'
import { CREDENTIALS } from './setup.js'

vi.mock('../config/dbManager.js', () => ({
  getDb: async () => global.__TEST_DB__,
  closeAllConnections: async () => {},
}))
vi.mock('../utils/webPushService.js', () => ({ pushToUser: vi.fn().mockResolvedValue(undefined) }))

const { initializeSocket }    = await import('../socketServer.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret }     = await import('../utils/jwtUtils.js')
const { bookingSchema }       = await import('../schemas/bookingSchema.js')

const SLUG = 'testcenter'
let server, io, url, booking, teacher, student
const sockets = []

const tokenFor = (role, id) => jwt.sign({ ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: SLUG },
  getCenterSecret(SLUG), { expiresIn: '5m' })
const connect = (role, id) => new Promise((resolve, reject) => {
  const s = ioClient(url, { auth: { token: tokenFor(role, id) }, transports: ['websocket'], forceNew: true })
  sockets.push(s)
  s.on('connect', () => resolve(s))
  s.on('connect_error', reject)
})
const wait = (ms = 200) => new Promise(r => setTimeout(r, ms))
const nextEvent = (socket, event, ms = 500) => new Promise(resolve => {
  const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
  const h = (data) => { clearTimeout(t); resolve(data ?? true) }
  socket.once(event, h)
})

beforeAll(async () => {
  const db = global.__TEST_DB__
  const Booking = db.models.Booking || db.model('Booking', bookingSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
  booking = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'WB', scheduledTime: new Date(), status: 'accepted' })

  server = http.createServer()
  io = await initializeSocket(server)
  await new Promise(r => server.listen(0, r))
  url = `http://localhost:${server.address().port}`
})

afterAll(async () => {
  sockets.forEach(s => s.disconnect())
  io?.close()
  await new Promise(r => server?.close(() => r()))
})

describe('whiteboard strokes', () => {
  // Each test gets its own class so boards don't carry over (empty boards are kept 30 min)
  let channel
  beforeEach(async () => {
    const Booking = global.__TEST_DB__.models.Booking
    const b = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'WB', scheduledTime: new Date(), status: 'accepted' })
    channel = `class-${b._id}`
  })

  const join = async (role, id) => {
    const s = await connect(role, id)
    const board = nextEvent(s, 'wb-strokes')
    s.emit('join-whiteboard', { channelName: channel, userName: role })
    s.board = await board
    return s
  }
  const boardSeenByNewJoiner = async () => {
    const s = await join('teacher', teacher._id)
    s.disconnect()
    return s.board.strokes.map(x => x.id)
  }
  const start = (s, id, extra = {}) =>
    s.emit('drawing', { channelName: channel, type: 'start', id, x: 0.1, y: 0.2, tool: 'pen', color: '#1e1e1e', size: 3, ...extra })
  const unlock = (t) => t.emit('toggle-lock', { channelName: channel, locked: false })

  it('a student cannot draw while locked, but can once unlocked', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    start(t, 'T1')
    await wait()
    const blocked = nextEvent(s, 'drawing-blocked')
    start(s, 'S1')
    expect(await blocked).toBeTruthy()
    expect(await boardSeenByNewJoiner()).toEqual(['T1'])

    unlock(t)
    await wait()
    start(s, 'S2')
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['T1', 'S2'])
  })

  it('strokes carry who drew them, and moves are appended to the right stroke', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    expect(t.board.you).toBe(String(teacher._id))
    const got = nextEvent(s, 'drawing')
    start(t, 'T1')
    expect(await got).toMatchObject({ type: 'start', id: 'T1', by: String(teacher._id), pts: [0.1, 0.2] })
    t.emit('drawing', { channelName: channel, type: 'move', id: 'T1', pts: [0.3, 0.4, 2, -1] })
    await wait()
    const late = await join('teacher', teacher._id)
    late.disconnect()
    expect(late.board.strokes[0].pts).toEqual([0.1, 0.2, 0.3, 0.4, 1, 0]) // clamped to the board
  })

  it('ignores bad strokes (unknown tool, bad colour, adding to someone else\'s stroke)', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    unlock(t)
    await wait()
    start(t, 'BAD1', { tool: 'laser' })
    start(t, 'BAD2', { color: 'red;background:url(x)' })
    start(t, 'T1')
    await wait()
    s.emit('drawing', { channelName: channel, type: 'move', id: 'T1', pts: [0.9, 0.9] })
    await wait()
    const late = await join('teacher', teacher._id)
    late.disconnect()
    expect(late.board.strokes.map(x => x.id)).toEqual(['T1'])
    expect(late.board.strokes[0].pts).toEqual([0.1, 0.2])
  })

  it('undo removes only your own stroke', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    unlock(t)
    await wait()
    start(t, 'T1')
    start(s, 'S1')
    await wait()

    s.emit('wb-undo', { channelName: channel, id: 'T1' }) // not the student's — ignored
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['T1', 'S1'])

    const relayed = nextEvent(s, 'wb-undo')
    t.emit('wb-undo', { channelName: channel, id: 'T1' })
    expect(await relayed).toEqual({ id: 'T1' })
    expect(await boardSeenByNewJoiner()).toEqual(['S1'])
  })

  it('a locked student cannot undo', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    unlock(t)
    await wait()
    start(s, 'S1')
    await wait()
    t.emit('toggle-lock', { channelName: channel, locked: true })
    await wait()
    s.emit('wb-undo', { channelName: channel, id: 'S1' })
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['S1'])
  })

  it('whoever cleared can undo the clear, keeping strokes drawn since', async () => {
    const t = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    unlock(t)
    await wait()
    start(t, 'T1')
    await wait()
    t.emit('clear-canvas', { channelName: channel })
    await wait()
    start(t, 'T2')
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['T2'])

    s.emit('wb-undo-clear', { channelName: channel }) // the student didn't clear — ignored
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['T2'])

    const restored = nextEvent(s, 'wb-strokes')
    t.emit('wb-undo-clear', { channelName: channel })
    expect((await restored)?.strokes.map(x => x.id)).toEqual(['T1', 'T2'])
  })

  it('the board survives everyone leaving (classroom tab switch)', async () => {
    const t = await join('teacher', teacher._id)
    start(t, 'KEPT')
    await wait()
    t.emit('leave-whiteboard', { channelName: channel })
    t.disconnect()
    await wait()
    expect(await boardSeenByNewJoiner()).toEqual(['KEPT'])
  })

  it('one user\'s second tab leaving does not stop the other tab\'s drawing', async () => {
    const t1 = await join('teacher', teacher._id)
    const t2 = await join('teacher', teacher._id)
    const s = await join('student', student._id)
    t2.emit('leave-whiteboard', { channelName: channel })
    await wait()
    const got = nextEvent(s, 'drawing')
    start(t1, 'T1')
    expect((await got)?.id).toBe('T1')
  })
})

describe('content tab (PDF) sync', () => {
  const channel = () => `class-${booking._id}`
  const joinBoth = async () => {
    const t = await connect('teacher', teacher._id)
    const s = await connect('student', student._id)
    t.emit('join-whiteboard', { channelName: channel(), userName: 't' })
    s.emit('join-whiteboard', { channelName: channel(), userName: 's' })
    await wait()
    return { t, s }
  }

  it('a student cannot change the page, zoom or marks for everyone', async () => {
    const { t, s } = await joinBoth()
    const page = nextEvent(t, 'pdf-page-sync')
    const zoom = nextEvent(t, 'pdf-zoom-sync')
    const clear = nextEvent(t, 'pdf-clear-sync')
    s.emit('pdf-page-sync', { channelName: channel(), page: 7 })
    s.emit('pdf-zoom-sync', { channelName: channel(), scale: 2 })
    s.emit('pdf-clear-sync', { channelName: channel(), page: 1 })
    expect(await page).toBeNull()
    expect(await zoom).toBeNull()
    expect(await clear).toBeNull()
  })

  it('the teacher\'s page and zoom reach the student, bad values do not', async () => {
    const { t, s } = await joinBoth()
    let got = nextEvent(s, 'pdf-zoom-sync')
    t.emit('pdf-zoom-sync', { channelName: channel(), scale: 'huge' })
    expect(await got).toBeNull()

    got = nextEvent(s, 'pdf-page-sync')
    t.emit('pdf-page-sync', { channelName: channel(), page: 4, extra: '<script>' })
    expect(await got).toEqual({ page: 4 })
  })

  it('pen strokes are relayed with only the expected fields', async () => {
    const { t, s } = await joinBoth()
    const start = nextEvent(s, 'pdf-stroke-start')
    t.emit('pdf-stroke-start', { channelName: channel(), page: 2, id: 'p1', x: 0.25, y: 1.5, strokeTool: 'pen', strokeColor: '#e74c3c', junk: 1 })
    expect(await start).toEqual({ page: 2, id: 'p1', x: 0.25, y: 1, strokeTool: 'pen', strokeColor: '#e74c3c' })

    const move = nextEvent(s, 'pdf-stroke-move')
    t.emit('pdf-stroke-move', { channelName: channel(), page: 2, id: 'p1', pts: [0.3, 0.3, 0.4, 0.4] })
    expect(await move).toEqual({ page: 2, id: 'p1', pts: [0.3, 0.3, 0.4, 0.4] })

    const bad = nextEvent(s, 'pdf-stroke-start')
    t.emit('pdf-stroke-start', { channelName: channel(), page: 2, id: 'p2', x: 0.1, y: 0.1, strokeTool: 'pen', strokeColor: 'red;x' })
    expect(await bad).toBeNull()
  })
})

describe('ring-call', () => {
  const setRing = (enabled) => global.__TEST_DB__.models.Teacher.updateOne({ _id: teacher._id }, { ringEnabled: enabled })

  async function ringTeacher(payload) {
    const target = await connect('teacher', teacher._id)
    target.emit('join-user-room')
    const caller = await connect('student', student._id)
    caller.emit('join-user-room')
    await wait()
    const incoming = nextEvent(target, 'incoming-ring')
    const declined = nextEvent(caller, 'ring-declined')
    caller.emit('ring-call', { targetUserId: String(teacher._id), ...payload })
    const result = { incoming: await incoming, declined: await declined }
    caller.emit('ring-cancel', { ringId: result.incoming?.ringId })
    return result
  }

  it('leaving out targetRole no longer skips the mute check (the ring is ignored)', async () => {
    await setRing(false)
    const { incoming } = await ringTeacher({ callerName: 'x' })
    expect(incoming).toBeNull()
  })

  it('a muted target is auto-declined', async () => {
    await setRing(false)
    const { incoming, declined } = await ringTeacher({ targetRole: 'teacher', callerName: 'x' })
    expect(incoming).toBeNull()
    expect(declined?.reason).toBe('muted')
  })

  it('the caller name comes from the database, not the client', async () => {
    await setRing(true)
    const { incoming } = await ringTeacher({ targetRole: 'teacher', callerName: 'School Admin (urgent)' })
    expect(incoming?.callerName).toBe(`${student.firstName} ${student.lastName}`)
  })

  it('ringing a user that does not exist is refused', async () => {
    const caller = await connect('student', student._id)
    const declined = nextEvent(caller, 'ring-declined')
    caller.emit('ring-call', { targetUserId: '64b7f0c2a1b2c3d4e5f60718', targetRole: 'teacher' })
    expect((await declined)?.reason).toBe('unavailable')
  })
})
