// #16 — socket gaps:
//   • a student can't overwrite the shared whiteboard snapshot while it's locked
//   • ring-call can't skip the "calls muted" check by leaving out targetRole
//   • the caller's name shown to the target comes from the DB, not the client
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
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

describe('whiteboard snapshot', () => {
  const channelName = () => `class-${booking._id}`
  const snapshotSeenByNewJoiner = async () => {
    const s = await connect('teacher', teacher._id)
    const got = nextEvent(s, 'canvas-state')
    s.emit('join-whiteboard', { channelName: channelName(), userName: 'late' })
    const data = await got
    s.disconnect()
    return data?.dataUrl ?? null
  }

  it('a student cannot overwrite it while locked, but can once unlocked', async () => {
    const t = await connect('teacher', teacher._id)
    const s = await connect('student', student._id)
    t.emit('join-whiteboard', { channelName: channelName(), userName: 't' })
    s.emit('join-whiteboard', { channelName: channelName(), userName: 's' })
    await wait()

    t.emit('save-canvas-state', { channelName: channelName(), dataUrl: 'data:image/png;base64,TEACHER' })
    await wait()
    s.emit('save-canvas-state', { channelName: channelName(), dataUrl: 'data:image/png;base64,STUDENT' }) // locked by default
    await wait()
    expect(await snapshotSeenByNewJoiner()).toBe('data:image/png;base64,TEACHER')

    t.emit('toggle-lock', { channelName: channelName(), locked: false })
    await wait()
    s.emit('save-canvas-state', { channelName: channelName(), dataUrl: 'data:image/png;base64,STUDENT2' })
    await wait()
    expect(await snapshotSeenByNewJoiner()).toBe('data:image/png;base64,STUDENT2')
  })

  it('ignores a snapshot that is not an image data URL', async () => {
    const t = await connect('teacher', teacher._id)
    t.emit('join-whiteboard', { channelName: channelName(), userName: 't' })
    await wait()
    t.emit('save-canvas-state', { channelName: channelName(), dataUrl: 'data:image/png;base64,GOOD' })
    await wait()
    t.emit('save-canvas-state', { channelName: channelName(), dataUrl: 'javascript:alert(1)' })
    await wait()
    expect(await snapshotSeenByNewJoiner()).toBe('data:image/png;base64,GOOD')
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
