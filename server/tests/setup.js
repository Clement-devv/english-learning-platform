import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Set required env vars BEFORE any server modules are imported.
// config.js calls process.exit(1) if these are missing.
process.env.JWT_SECRET   = 'test-jwt-secret-for-vitest-only-abc123xyz!'
process.env.MONGO_URI    = 'mongodb://localhost/test'
process.env.MASTER_DB_URI = 'mongodb://localhost/test-master'
process.env.DB_BASE_URI  = 'mongodb://localhost/'
process.env.EMAIL_USER   = 'test@example.com'
process.env.EMAIL_PASSWORD = 'testpassword'
process.env.NODE_ENV     = 'test'

// Exported so test files can reference the same credentials
export const CREDENTIALS = {
  teacher: { email: 'teacher@test.com', password: 'Test@1234!' },
  student: { email: 'student@test.com', password: 'Test@1234!' },
  admin:   { username: 'testadmin',     email: 'admin@test.com', password: 'Test@1234!' },
}

let mongod
let centerConn

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  centerConn = await mongoose.createConnection(mongod.getUri()).asPromise()

  // Expose to test files via global so the tenantMiddleware mock can inject it
  global.__TEST_DB__ = centerConn

  const { teacherSchema } = await import('../schemas/teacherSchema.js')
  const { studentSchema } = await import('../schemas/studentSchema.js')
  const { adminSchema }   = await import('../schemas/adminSchema.js')

  const Teacher = centerConn.model('Teacher', teacherSchema)
  const Student = centerConn.model('Student', studentSchema)
  const Admin   = centerConn.model('Admin', adminSchema)

  const hash = await bcrypt.hash('Test@1234!', 10)

  await Teacher.create({
    email: CREDENTIALS.teacher.email,
    firstName: 'Test',
    lastName: 'Teacher',
    password: hash,
    active: true,
    status: 'active',
    continent: 'Africa',
  })

  await Student.create({
    email: CREDENTIALS.student.email,
    firstName: 'Test',
    surname: 'Student',
    password: hash,
    active: true,
    status: 'active',
  })

  await Admin.create({
    username: CREDENTIALS.admin.username,
    email: CREDENTIALS.admin.email,
    firstName: 'Test',
    lastName: 'Admin',
    password: hash,
    active: true,
  })
})

afterAll(async () => {
  await centerConn.close()
  await mongod.stop()
})
