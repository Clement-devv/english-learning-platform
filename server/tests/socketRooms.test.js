// End-to-end tests for Socket.IO room membership (socketServer.js +
// utils/socketAccess.js). A socket may only join — and only emit into — the
// class and chat rooms it belongs to; sub-admins only get admin content for
// teachers in their scope.
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'http'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { io as ioClient } from '../../node_modules/socket.io-client/build/esm-debug/index.js'

vi.mock('../config/dbManager.js', () => ({
  getDb: async () => global.__TEST_DB__,
  closeAllConnections: async () => {},
}))

const { initializeSocket }    = await import('../socketServer.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret }     = await import('../utils/jwtUtils.js')
const { adminContentRooms }   = await import('../utils/socketRooms.js')
const { bookingSchema }       = await import('../schemas/bookingSchema.js')
const { groupChatSchema }     = await import('../schemas/groupChatSchema.js')
const { groupClassSchema }    = await import('../schemas/groupClassSchema.js')

const SLUG = 'testcenter'
const oid = () => new mongoose.Types.ObjectId()
const ids = { teacher: oid(), student: oid(), otherStudent: oid(), otherTeacher: oid(), admin: oid(), subAdmin: oid() }

let server, io, url, booking, otherBooking, chat, groupClass
const sockets = []

const tokenFor = (role, id, extra = {}) => jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(id), role, centerId: SLUG, ...extra },
  getCenterSecret(SLUG), { expiresIn: '5m' },
)

function connect(role, id, extra) {
  return new Promise((resolve, reject) => {
    const s = ioClient(url, { auth: { token: tokenFor(role, id, extra) }, transports: ['websocket'], forceNew: true })
    sockets.push(s)
    s.on('connect', () => resolve(s))
    s.on('connect_error', reject)
  })
}

const wait = (ms = 250) => new Promise(r => setTimeout(r, ms))

/** Resolves with the event payload, or null if it doesn't arrive within `ms`. */
const nextEvent = (socket, event, ms = 400) => new Promise(resolve => {
  const t = setTimeout(() => { socket.off(event, h); resolve(null) }, ms)
  const h = (data) => { clearTimeout(t); resolve(data ?? true) }
  socket.once(event, h)
})

beforeAll(async () => {
  const db = global.__TEST_DB__
  const Booking    = db.models.Booking    || db.model('Booking',    bookingSchema)
  const GroupChat  = db.models.GroupChat  || db.model('GroupChat',  groupChatSchema)
  const GroupClass = db.models.GroupClass || db.model('GroupClass', groupClassSchema)
  booking      = await Booking.create({ teacherId: ids.teacher, studentId: ids.student, classTitle: 'A', scheduledTime: new Date(), status: 'accepted' })
  otherBooking = await Booking.create({ teacherId: ids.teacher, studentId: ids.otherStudent, classTitle: 'B', scheduledTime: new Date(), status: 'accepted' })
  chat         = await GroupChat.create({ assignmentId: oid(), teacherId: ids.teacher, studentId: ids.student, chatName: 'A' })
  groupClass   = await GroupClass.create({ teacherId: ids.teacher, title: 'G', scheduledTime: new Date(), maxSeats: 5,
    enrollments: [{ studentId: ids.student, creditCharged: 1 }] })

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

describe('class rooms', () => {
  it('a student cannot join another student\'s class whiteboard', async () => {
    const intruder = await connect('student', ids.otherStudent)
    const errored = nextEvent(intruder, 'error')
    intruder.emit('join-whiteboard', { channelName: `class-${booking._id}`, userName: 'x' })
    expect(await errored).toBeTruthy()

    const teacher = await connect('teacher', ids.teacher)
    teacher.emit('join-whiteboard', { channelName: `class-${booking._id}`, userName: 't' })
    await wait()
    const leaked = nextEvent(intruder, 'drawing')
    teacher.emit('drawing', { channelName: `class-${booking._id}`, x: 1 })
    expect(await leaked).toBeNull()
  })

  it('members of the class still see each other\'s drawing', async () => {
    const teacher = await connect('teacher', ids.teacher)
    const student = await connect('student', ids.student)
    teacher.emit('join-whiteboard', { channelName: `class-${booking._id}`, userName: 't' })
    student.emit('join-whiteboard', { channelName: `class-${booking._id}`, userName: 's' })
    await wait()
    const got = nextEvent(student, 'drawing')
    teacher.emit('drawing', { channelName: `class-${booking._id}`, x: 2 })
    expect(await got).toMatchObject({ x: 2 })
  })

  it('an outsider cannot emit into a class room without joining it', async () => {
    const student = await connect('student', ids.student)
    student.emit('join-whiteboard', { channelName: `class-${booking._id}`, userName: 's' })
    await wait()
    const outsider = await connect('student', ids.otherStudent)
    const got = nextEvent(student, 'drawing')
    outsider.emit('drawing', { channelName: `class-${booking._id}`, x: 3 })
    expect(await got).toBeNull()
  })

  it('another teacher cannot kick students from a group class', async () => {
    const student = await connect('student', ids.student)
    student.emit('join-group-room', { groupClassId: String(groupClass._id) })
    await wait()
    const rogue = await connect('teacher', ids.otherTeacher)
    rogue.emit('join-group-room', { groupClassId: String(groupClass._id) })
    const kicked = nextEvent(student, 'group-kicked')
    rogue.emit('group-kick', { groupClassId: String(groupClass._id), targetUserId: String(ids.student) })
    expect(await kicked).toBeNull()

    const owner = await connect('teacher', ids.teacher)
    owner.emit('join-group-room', { groupClassId: String(groupClass._id) })
    await wait()
    const kicked2 = nextEvent(student, 'group-kicked')
    owner.emit('group-kick', { groupClassId: String(groupClass._id), targetUserId: String(ids.student) })
    expect(await kicked2).toMatchObject({ targetUserId: String(ids.student) })
  })
})

describe('chat rooms', () => {
  it('a non-member cannot listen to or type into a chat', async () => {
    const member = await connect('student', ids.student)
    member.emit('join-chat-room', { chatId: String(chat._id) })
    const outsider = await connect('student', ids.otherStudent)
    outsider.emit('join-chat-room', { chatId: String(chat._id) })
    await wait()

    const outsiderSees = nextEvent(outsider, 'user-typing')
    const memberSeesTeacher = nextEvent(member, 'user-typing')
    const teacher = await connect('teacher', ids.teacher)
    teacher.emit('join-chat-room', { chatId: String(chat._id) })
    await wait()
    teacher.emit('typing-start', { chatId: String(chat._id), senderName: 'T' })
    expect(await outsiderSees).toBeNull()
    expect(await memberSeesTeacher).toMatchObject({ name: 'T' })

    const memberSees = nextEvent(member, 'user-typing')
    outsider.emit('typing-start', { chatId: String(chat._id), senderName: 'X' })
    expect(await memberSees).toBeNull()
  })
})

describe('admin content rooms', () => {
  it('sub-admins only receive content for teachers in their scope', async () => {
    const admin       = await connect('admin', ids.admin)
    const inScope     = await connect('sub-admin', ids.subAdmin, { teacherScope: [String(ids.teacher)] })
    const outOfScope  = await connect('sub-admin', oid(), { teacherScope: [String(ids.otherTeacher)] })
    for (const s of [admin, inScope, outOfScope]) s.emit('join-admin-room')
    await wait()

    const [a, i, o] = [admin, inScope, outOfScope].map(s => nextEvent(s, 'new-group-message'))
    io.to(adminContentRooms(SLUG, ids.teacher)).emit('new-group-message', { chatId: 'x' })
    expect(await a).toBeTruthy()
    expect(await i).toBeTruthy()
    expect(await o).toBeNull()
  })
})
