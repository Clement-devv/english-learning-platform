// Content tab (PDF) state: page, zoom and pen marks the student mirrors.
//   • pen marks are kept per page — marking page 2 no longer wipes page 1's
//   • bad page / zoom / annotation values are refused instead of saved
//   • only the class teacher can change it
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { CREDENTIALS } from './setup.js'

vi.mock('../middleware/tenantMiddleware.js', () => ({
  tenantMiddleware: (req, res, next) => {
    req.center = { slug: 'testcenter', centerName: 'Test Center' }
    req.db = global.__TEST_DB__
    next()
  },
}))

const { default: classroomRouter } = await import('../routes/classroomRoutes.js')
const { JWT_STANDARD_CLAIMS } = await import('../config/config.js')
const { getCenterSecret } = await import('../utils/jwtUtils.js')
const { bookingSchema } = await import('../schemas/bookingSchema.js')
const { classroomSessionSchema } = await import('../schemas/classroomSessionSchema.js')

const app = express()
app.use(express.json({ limit: '1mb' }))
app.use('/api/classroom', classroomRouter)

let Booking, Session, teacher, student, booking

const tokenFor = (role, user) => jwt.sign(
  { ...JWT_STANDARD_CLAIMS, id: String(user._id), role, centerId: 'testcenter' },
  getCenterSecret('testcenter'),
  { expiresIn: '5m' },
)
const url = () => `/api/classroom/session/${booking._id}/content-state`
const patch = (body, role = 'teacher', user = teacher) =>
  request(app).patch(url()).set('Authorization', `Bearer ${tokenFor(role, user)}`).send(body)
const get = (query = {}, role = 'student', user = student) =>
  request(app).get(url()).query(query).set('Authorization', `Bearer ${tokenFor(role, user)}`)

const marks = (n) => JSON.stringify([{ tool: 'pen', color: '#e74c3c', points: [{ x: n / 10, y: 0.5 }] }])

beforeAll(async () => {
  const db = global.__TEST_DB__
  Booking = db.models.Booking || db.model('Booking', bookingSchema)
  Session = db.models.ClassroomSession || db.model('ClassroomSession', classroomSessionSchema)
  teacher = await db.models.Teacher.findOne({ email: CREDENTIALS.teacher.email })
  student = await db.models.Student.findOne({ email: CREDENTIALS.student.email })
})

beforeEach(async () => {
  booking = await Booking.create({ teacherId: teacher._id, studentId: student._id, classTitle: 'PDF', scheduledTime: new Date(), status: 'accepted' })
  await Session.create({ bookingId: booking._id, requiredTime: 3600 })
})

describe('content-state', () => {
  it('keeps pen marks for every page', async () => {
    expect((await patch({ annotation: marks(1), annotationPage: 1 })).status).toBe(200)
    expect((await patch({ annotation: marks(2), annotationPage: 2 })).status).toBe(200)
    await patch({ page: 2 })

    const p2 = await get()                 // default: the teacher's page
    expect(p2.body.contentPage).toBe(2)
    expect(p2.body.contentAnnotation).toMatchObject({ page: 2, data: marks(2) })

    const p1 = await get({ page: 1 })      // going back to page 1 still has its marks
    expect(p1.body.contentAnnotation).toMatchObject({ page: 1, data: marks(1) })

    const all = await get({ all: 1 }, 'teacher', teacher)
    expect(Object.keys(all.body.contentAnnotations).sort()).toEqual(['1', '2'])
    expect((await get({ all: 1 })).body.contentAnnotations).toBeUndefined() // teacher only
  })

  it('a cleared page comes back empty with a new timestamp', async () => {
    await patch({ annotation: marks(1), annotationPage: 1 })
    const before = (await get({ page: 1 })).body.contentAnnotation.ts
    await new Promise(r => setTimeout(r, 5))
    await patch({ annotation: '[]', annotationPage: 1 })
    const after = (await get({ page: 1 })).body.contentAnnotation
    expect(after.data).toBe('[]')
    expect(after.ts).toBeGreaterThan(before)
  })

  it('refuses bad values instead of saving them', async () => {
    expect((await patch({ page: 'abc' })).status).toBe(400)
    expect((await patch({ page: 0 })).status).toBe(400)
    expect((await patch({ scale: 50 })).status).toBe(400)
    expect((await patch({ annotation: 'not json', annotationPage: 1 })).status).toBe(400)
    expect((await patch({ annotation: marks(1) })).status).toBe(400) // no page
    expect((await patch({ annotation: `[${'1,'.repeat(200_000)}1]`, annotationPage: 1 })).status).toBe(400)
    const state = (await get()).body
    expect(state.contentPage).toBe(1)
    expect(state.contentScale).toBe(1.3)
  })

  it('only the class teacher can change it', async () => {
    expect((await patch({ page: 3 }, 'student', student)).status).toBe(403)
    expect((await get()).body.contentPage).toBe(1)
  })
})
