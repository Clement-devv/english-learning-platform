// public/sw.js — push notifications: shown when the app isn't on screen (not while you're
// looking at it), tagged, and clicking one opens the right page in the open app tab.
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import vm from 'vm'

const source = fs.readFileSync('public/sw.js', 'utf8') // vitest runs from the project root

function loadWorker({ windows = [] } = {}) {
  const listeners = {}
  const shown = []
  const opened = []
  const self = {
    location: { origin: 'https://school.example.com' },
    addEventListener: (type, fn) => { listeners[type] = fn },
    registration: { showNotification: async (title, options) => { shown.push({ title, options }) } },
    skipWaiting: () => {},
  }
  const clients = {
    matchAll: async () => windows,
    openWindow: async (url) => { opened.push(url) },
    claim: async () => {},
  }
  vm.runInNewContext(source, { self, clients, caches: {}, fetch: () => {}, URL, Response: {}, console })
  const fire = async (type, event) => {
    let done
    event.waitUntil = (p) => { done = p }
    listeners[type](event)
    await done
  }
  return { fire, shown, opened }
}
const pushEvent = (payload) => ({ data: { json: () => payload } })
const tab = (url, { focused = false, visible = false } = {}) => {
  const messages = []
  return { url, focused, visibilityState: visible ? 'visible' : 'hidden', messages, postMessage: (m) => messages.push(m), focus: async () => {} }
}

describe('push', () => {
  const payload = { title: '💬 Message from Admin', body: 'Hi', tag: 'dm-1', renotify: true, data: { url: '/teacher/dashboard?tab=messages' } }

  it('shows the notification when the app is closed', async () => {
    const w = loadWorker()
    await w.fire('push', pushEvent(payload))
    expect(w.shown).toHaveLength(1)
    expect(w.shown[0]).toMatchObject({ title: payload.title, options: { body: 'Hi', tag: 'dm-1', renotify: true } })
  })

  it('shows it when the app is open in a background tab', async () => {
    const w = loadWorker({ windows: [tab('https://school.example.com/teacher/dashboard')] })
    await w.fire('push', pushEvent(payload))
    expect(w.shown).toHaveLength(1)
  })

  it('does not pop up over the app while you are looking at it', async () => {
    const w = loadWorker({ windows: [tab('https://school.example.com/teacher/dashboard', { focused: true, visible: true })] })
    await w.fire('push', pushEvent(payload))
    expect(w.shown).toHaveLength(0)
  })
})

describe('notification click', () => {
  let w
  const click = (url) => w.fire('notificationclick', { notification: { data: { url }, close: () => {} } })

  it('reuses the open app tab and tells it which page to show', async () => {
    const t = tab('https://school.example.com/teacher/dashboard')
    w = loadWorker({ windows: [t] })
    await click('/teacher/dashboard?tab=messages')
    expect(t.messages).toEqual([{ type: 'notification-click', url: '/teacher/dashboard?tab=messages' }])
    expect(w.opened).toHaveLength(0)
  })

  it('opens the page when no app tab is open', async () => {
    w = loadWorker()
    await click('/student/dashboard?tab=homework')
    expect(w.opened).toEqual(['/student/dashboard?tab=homework'])
  })

  it('never follows a link to another site', async () => {
    w = loadWorker()
    await click('https://evil.example/phish')
    expect(w.opened).toEqual(['/'])
  })
})

