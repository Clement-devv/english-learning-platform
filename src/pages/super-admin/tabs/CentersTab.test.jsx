import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CentersTab from './CentersTab';
import PeopleTab from './PeopleTab';

const CENTERS = [
  { _id: 'p1', centerName: 'Bright Kids Lagos', slug: 'bright-kids', adminEmail: 'owner@bright.test', status: 'pending', plan: 'basic', createdAt: '2026-10-01' },
  { _id: 'a1', centerName: 'Family English Academy', slug: 'family-english', adminEmail: 'admin@fea.test', status: 'active', plan: 'pro',
    maxTeachers: 10, maxStudents: 100, usage: { teachers: 5, students: 96 }, health: { ok: true, missed24h: 3, unanswered: 1 },
    landingPage: { published: true }, createdAt: '2026-03-01' },
];
const PAGE = { success: true, centers: CENTERS, counts: { all: 2, pending: 1, active: 1, suspended: 0, rejected: 0 }, pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } };

const noop = () => {};
const props = (over = {}) => ({
  centers: [], loadData: vi.fn(), setShowModal: noop, apiBase: 'http://api/v1', authHeaders: { Authorization: 'Bearer x' },
  handleApprove: vi.fn(), handleReject: vi.fn(), handleSuspend: vi.fn(), handleEnterAsAdmin: vi.fn(), impersonating: null,
  setDeleteTarget: vi.fn(), setPlanModal: vi.fn(), setPlanSelected: noop, setPlanMsg: noop,
  setThemeCenter: vi.fn(), handleOpenLoginThemeModal: noop, handleOpenTeacherThemeModal: noop, handleOpenAdminLoginThemeModal: noop,
  handleOpenDashThemeModal: noop, handleOpenClassroomThemeModal: noop, setFeaturesCenter: vi.fn(),
  setLimitsModal: vi.fn(), setLimitsUnlimT: noop, setLimitsUnlimS: noop, setLimitsTeachers: noop, setLimitsStudents: noop, setLimitsMsg: noop,
  setPartnershipModal: noop, onEditWebsite: vi.fn(), ...over,
});

let urls;
beforeEach(() => {
  urls = [];
  globalThis.fetch = vi.fn((url) => {
    urls.push(url);
    if (url.includes('/people?')) {
      const students = url.includes('type=students');
      return Promise.resolve({ json: () => Promise.resolve({ success: true, data: {
        centerName: 'FEA', counts: { teachers: 5, students: 16 }, type: students ? 'students' : 'teachers',
        items: students ? [{ _id: 's1', name: 'Nam Phan', code: 'STU-57466', email: 'nam@x.test', country: 'VN', classes: 4 }]
                        : [{ _id: 't1', name: 'Grace Mensah', code: 'TCH-45568', email: 'g@x.test', continent: 'Africa', specializations: [], lessonsCompleted: 3 }],
        pagination: { page: 1, limit: 25, total: students ? 16 : 5, totalPages: 1 },
      } }) });
    }
    return Promise.resolve({ json: () => Promise.resolve(PAGE) });
  });
});
afterEach(() => vi.restoreAllMocks());

describe('CentersTab', () => {
  it('lists a page of centers with counts, usage and health; pending first with approve', async () => {
    const p = props();
    render(<CentersTab {...p} />);
    expect(await screen.findByText('Family English Academy')).toBeTruthy();
    expect(urls[0]).toContain('page=1');
    expect(urls[0]).toContain('withUsage=1');
    const tabs = screen.getByRole('tablist');
    expect(within(tabs).getByRole('tab', { name: /Pending\s*1/ })).toBeTruthy();
    expect(screen.getByText('96 / 100')).toBeTruthy();            // seat usage
    expect(screen.getByText(/3 missed \(24h\)/)).toBeTruthy();   // App Health signal
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(p.handleApprove).toHaveBeenCalledWith('p1');
  });

  it('filters by status and searches on the server', async () => {
    render(<CentersTab {...props()} />);
    await screen.findByText('Family English Academy');
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    await waitFor(() => expect(urls.some(u => u.includes('status=active'))).toBe(true));
    const box = screen.getByLabelText('Search centers');
    fireEvent.change(box, { target: { value: 'family' } });
    fireEvent.submit(box.closest('form'));
    await waitFor(() => expect(urls.some(u => u.includes('q=family'))).toBe(true));
  });

  it('opens the Manage panel with grouped actions and runs one', async () => {
    const p = props();
    render(<CentersTab {...p} />);
    await screen.findByText('Family English Academy');
    fireEvent.click(screen.getAllByRole('button', { name: /Manage/ })[1]);
    const panel = await screen.findByRole('dialog', { name: /Manage Family English Academy/ });
    for (const s of ['Plan and access', 'Look and feel', 'Website and branding', 'Account']) expect(within(panel).getByText(s)).toBeTruthy();
    expect(within(panel).getByText('Suspend center')).toBeTruthy();
    fireEvent.click(within(panel).getByText('Change plan'));
    expect(p.setPlanModal).toHaveBeenCalledWith(expect.objectContaining({ _id: 'a1' }));
    expect(screen.queryByRole('dialog', { name: /Manage/ })).toBeNull(); // closes so the modal is on top
  });
});

describe('PeopleTab', () => {
  it('loads a page of teachers, then students, with ID codes', async () => {
    render(<PeopleTab centers={[{ _id: 'a1', centerName: 'FEA', status: 'active' }]} peopleCenter="a1" setPeopleCenter={noop} apiBase="http://api/v1" authHeaders={{}} />);
    expect(await screen.findByText('Grace Mensah')).toBeTruthy();
    expect(screen.getByText('TCH-45568')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Students \(16\)/ }));
    expect(await screen.findByText('Nam Phan')).toBeTruthy();
    expect(urls.some(u => u.includes('type=students') && u.includes('page=1'))).toBe(true);
  });
});
