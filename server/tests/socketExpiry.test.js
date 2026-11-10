import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import jwt from 'jsonwebtoken'
import { io as client } from '../../node_modules/socket.io-client/build/esm-debug/index.js'

vi.mock('../config/dbManager.js', () => ({ getDb: async () => global.__TEST_DB__, closeAllConnections: async () => {} }))
const { initializeSocket } = await import('../socketServer.js')
const { refreshSocketAccess } = await import('../utils/socketAccess.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
let server, io, url
beforeAll(async () => {
  server = http.createServer()
  io = await initializeSocket(server)
  await new Promise(resolve => server.listen(0, resolve))
  url = `http://localhost:${server.address().port}`
})
afterAll(async () => { io?.close(); await new Promise(resolve => server.close(resolve)) })
describe('socket lifetime and grants', () => {
  it('closes a passive connection when its JWT expires', async () => {
    const token = jwt.sign({ ...JWT_STANDARD_CLAIMS, id: 'synthetic', role: 'student', centerId: 'testcenter' }, getCenterSecret('testcenter'), { expiresIn: '2s' })
    const socket = client(url, { auth: { token }, transports: ['websocket'], reconnection: false })
    try {
      await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject) })
      const reason = await new Promise(resolve => socket.once('disconnect', resolve))
      expect(reason).toBe('transport close')
    } finally { socket.disconnect() }
  })
  it('rejects a cached grant after enrollment changes, including passive listeners', async () => {
    const db = global.__TEST_DB__
    const student = await db.models.Student.findOne({})
    const teacher = await db.models.Teacher.findOne({})
    const Booking = db.models.Booking || db.model('Booking', bookingSchema)
    const booking = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'Security', scheduledTime: new Date(), status: 'accepted' })
    const socket = { centerId: 'testcenter', authUser: { role: 'student', id: String(student._id) }, accessCache: new Map([[`ch:class-${booking._id}`, Promise.resolve(true)]]) }
    expect(await refreshSocketAccess(socket)).toBe(true)
    await Booking.updateOne({ _id: booking._id }, { $set: { studentId: teacher._id } })
    expect(await refreshSocketAccess(socket)).toBe(false)
  })
})
