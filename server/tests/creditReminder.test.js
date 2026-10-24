// "Classes remaining" email after a class uses a credit: managed families after every
// class, students with an account only once the balance is low — and never for a
// charge that was refunded before the email went out.
import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'

const mails = []
vi.mock('../emails/creditEmails.js', () => ({
  LOW_CLASSES: 2,
  sendClassesRemainingEmail: vi.fn(async (a) => { mails.push(a) }),
}))
vi.mock('../models/master/Center.js', () => ({ default: { findOne: () => ({ select: () => ({ lean: async () => null }) }) } }))

const { reminderTarget, sendCreditReminder } = await import('../utils/creditReminder.js')
const { chargeClassCredit, refundClassCredit } = await import('../utils/classPayment.js')

let db, Student
const addStudent = (fields) => Student.collection.insertOne({ firstName: 'Lan', lastName: 'Vu', active: true, ...fields }).then((r) => r.insertedId)

beforeAll(() => { db = global.__TEST_DB__; Student = db.models.Student })
beforeEach(async () => {
  mails.length = 0
  await Student.collection.deleteMany({ lastName: 'Vu' })
})

describe('who gets the "classes remaining" email', () => {
  it('managed family: every class, to the notification email', () => {
    expect(reminderTarget({ isManaged: true, notifyEmail: 'mum@example.com' }, 9)).toBe('mum@example.com')
    expect(reminderTarget({ isManaged: true, notifyEmail: '' }, 1)).toBeNull()
  })
  it('student account: only when 2 or fewer are left', () => {
    expect(reminderTarget({ isManaged: false, email: 'lan@example.com' }, 3)).toBeNull()
    expect(reminderTarget({ isManaged: false, email: 'lan@example.com' }, 2)).toBe('lan@example.com')
    expect(reminderTarget({ isManaged: false, email: 'lan@example.com' }, 0)).toBe('lan@example.com')
  })
  it('never to a placeholder address', () => {
    expect(reminderTarget({ isManaged: false, email: 'x@managed.invalid' }, 0)).toBeNull()
  })
})

describe('sending after a charge', () => {
  it('emails the managed family with the new balance and the class', async () => {
    const id = await addStudent({ isManaged: true, notifyEmail: 'mum@example.com', classCredits: 5 })
    const { charged } = await chargeClassCredit(db, id, { title: 'Phonics', when: new Date() })
    expect(charged).toBe(true)
    expect(await sendCreditReminder(db, id, 4, { title: 'Phonics' })).toBe('sent')
    expect(mails[0]).toMatchObject({ to: 'mum@example.com', left: 4, cls: { title: 'Phonics' } })
  })

  it('sends nothing when the class was refunded before the email went out', async () => {
    const id = await addStudent({ isManaged: true, notifyEmail: 'mum@example.com', classCredits: 3 })
    await chargeClassCredit(db, id)
    await refundClassCredit(db, id)
    expect(await sendCreditReminder(db, id, 2)).toBe('changed')
    expect(mails).toHaveLength(0)
  })

  it('student account above the low mark: no email', async () => {
    const id = await addStudent({ isManaged: false, email: 'lan@example.com', classCredits: 6 })
    await chargeClassCredit(db, id)
    expect(await sendCreditReminder(db, id, 5)).toBe('skipped')
    expect(mails).toHaveLength(0)
  })

  it('student account hitting zero: emailed', async () => {
    const id = await addStudent({ isManaged: false, email: 'lan@example.com', classCredits: 1 })
    await chargeClassCredit(db, id)
    expect(await sendCreditReminder(db, id, 0)).toBe('sent')
    expect(mails[0]).toMatchObject({ to: 'lan@example.com', left: 0 })
  })
})
