import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MonitorTab from './MonitorTab';

const STATUS = {
  computedAt: new Date().toISOString(),
  overall: 'fail',
  checks: [
    { key: 'email', title: 'Emails', status: 'fail', summary: '4 sent · 6 failed in the last hour', details: ['Class reminder — 6 failed · emac: daily sending quota exceeded'] },
    { key: 'bookings', title: 'Bookings', status: 'warn', summary: '0 booking actions · 1 waiting > 24h', details: [] },
    { key: 'database', title: 'Databases', status: 'ok', summary: 'Main DB 4ms', details: [] },
  ],
  alerts: { open: [{ _id: 'a1', title: 'Emails', message: '6 failed', openedAt: new Date().toISOString(), delivery: { email: 'failed: quota', whatsapp: 'sent' } }], recent: [] },
  settings: { emailEnabled: true, whatsappEnabled: true, alertEmails: [], whatsappPhone: '', whatsappProvider: null },
};
const TROUBLE = { people: [{ key: 'teacher:1', center: 'family-english', centerName: 'Family English Academy', role: 'teacher', name: 'Sarah Mitchell', code: 'TCH-41020', severity: 'high', count: 3, text: "Didn't join 3 classes in the last 7 days" }] };
const EVENTS = { events: [{ _id: 'e1', at: new Date().toISOString(), center: 'emac', kind: 'email', action: 'Class reminder', ok: false, msg: 'quota exceeded' }], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };

const json = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, data, message: 'Done' }) });

describe('MonitorTab (App Health)', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn((url, opts = {}) => {
      calls.push([url, opts.method || 'GET']);
      if (url.endsWith('/status')) return json(STATUS);
      if (url.endsWith('/trouble')) return json(TROUBLE);
      if (url.includes('/events?')) return json(EVENTS);
      if (url.endsWith('/alerts/a1/ack')) return json({});
      if (url.endsWith('/test-alert')) return json({ delivery: { email: 'sent', whatsapp: 'off: no WhatsApp number set' } });
      return json({});
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  const renderTab = (onStatus = vi.fn()) =>
    render(<MonitorTab apiBase="http://api/v1" authHeaders={{ Authorization: 'Bearer x' }} centers={[{ _id: 'c', slug: 'emac', centerName: 'EMAC', status: 'active' }]} onStatus={onStatus} />);

  it('shows checks, open alerts with delivery, people and the event log', async () => {
    const onStatus = vi.fn();
    renderTab(onStatus);
    expect(await screen.findByText('4 sent · 6 failed in the last hour')).toBeTruthy();
    expect(screen.getByText('Open alerts (1)')).toBeTruthy();
    expect(screen.getByText(/failed: quota/)).toBeTruthy();
    expect(await screen.findByText('Sarah Mitchell')).toBeTruthy();
    expect(screen.getByText('TCH-41020')).toBeTruthy();
    expect(await screen.findByText('quota exceeded')).toBeTruthy();
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ overall: 'fail' }));
    // The event log asks for problems only by default
    expect(calls.some(([u]) => u.includes('/events?') && u.includes('ok=0'))).toBe(true);
    expect(screen.getByText(/No WhatsApp provider yet/)).toBeTruthy();
  });

  it('acknowledges an alert and sends a test alert', async () => {
    renderTab();
    fireEvent.click(await screen.findByRole('button', { name: /Acknowledge/ }));
    await waitFor(() => expect(calls.some(([u, m]) => u.endsWith('/alerts/a1/ack') && m === 'POST')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Send test alert/ }));
    expect(await screen.findByText(/Email: sent/)).toBeTruthy();
    expect(screen.getByText(/WhatsApp: off: no WhatsApp number set/)).toBeTruthy();
  });

  it('filters the event log by type', async () => {
    renderTab();
    await screen.findByText('quota exceeded');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'login' } });
    await waitFor(() => expect(calls.some(([u]) => u.includes('kind=login'))).toBe(true));
  });
});
