import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
const fixtures = vi.hoisted(() => ({
  centers: [{ _id: 'c1', name: 'Sunrise English', currency: 'USD', rateMinor: 800, payBasis: 'class', prepaid: false }, { _id: 'c2', name: 'River School', currency: 'EUR', rateMinor: 1200, payBasis: 'hour', prepaid: false }],
  students: [{ _id: 's1', firstName: 'Linh', managedCenterId: 'c1', active: true, classCredits: 0 }, { _id: 's2', firstName: 'Kai', managedCenterId: 'c2', active: true, classCredits: 0 }],
  links: [],
}));
vi.mock('../../api', () => ({ default: { get: vi.fn(async url => ({ data: { data: url === '/managed-centers' ? fixtures.centers : url === '/managed-students' ? fixtures.students : url === '/parent-links' ? fixtures.links : [], ...(url === '/parent-links' ? { pagination: { page: 1, total: fixtures.links.length, totalPages: 1 } } : {}) } })), post: vi.fn(), patch: vi.fn(), put: vi.fn() } }));
vi.mock('../../utils/teacherMode', () => ({ teacherModeKey: () => 'tw-synthetic' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 't1', firstName: 'Amara' }, logout: vi.fn(), login: vi.fn(), setUser: vi.fn() }) }));
vi.mock('./client', () => ({ modeBase: '/api/teacher-mode', default: { post: vi.fn() } }));
vi.mock('axios', () => ({ default: Object.assign(vi.fn(), { post: vi.fn(), get: vi.fn(async () => ({ data: { data: { studentName: 'Linh' } } })) }) }));
import axios from 'axios';
import TeacherModeDashboard from './TeacherModeDashboard';
import TeacherFamilyPage from './TeacherFamilyPage';
import TeacherModeLogin from './TeacherModeLogin';
import client from './client';
import api from '../../api';
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); fixtures.links = []; });
describe('standalone teacher workspace', () => {
  it('keeps every student and their center in a separate directory', async () => {
    render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    await screen.findByText('Hello, Amara.');
    fireEvent.change(screen.getByLabelText('Workspace view'), { target: { value: 'c1' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Teacher workspace' })).getByRole('button', { name: 'Students', exact: true }));
    const linh = (await screen.findByRole('heading', { name: 'Linh' }, { timeout: 10000 })).closest('article');
    const kai = screen.getByRole('heading', { name: 'Kai' }).closest('article');
    expect(within(linh).getByText('Sunrise English')).toBeInTheDocument();
    expect(within(kai).getByText('River School')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create parent link', exact: true })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Filter students by center')).toHaveValue('');
  }, 15000);
  it('creates a student directly inside the chosen center even when another workspace view is selected', async () => {
    api.post.mockResolvedValue({ data: { data: { id: 'new' } } });
    render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    await screen.findByText('Hello, Amara.');
    fireEvent.change(screen.getByLabelText('Workspace view'), { target: { value: 'c2' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Teacher workspace' })).getByRole('button', { name: 'My centers', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'Create student in Sunrise English' }));
    fireEvent.change(screen.getByLabelText('Student name'), { target: { value: 'Mai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add student', exact: true }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/managed-students', { name: 'Mai', notifyEmail: '', centerId: 'c1' }));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });
  it('shows the center list first and collapses the add-center editor', async () => {
    render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    await screen.findByText('Hello, Amara.');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Teacher workspace' })).getByRole('button', { name: 'My centers', exact: true }));
    expect(screen.queryByLabelText('Center or client name')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Add managed center', exact: true }));
    expect(screen.getByLabelText('Center or client name')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close center form', exact: true }));
    expect(screen.queryByLabelText('Center or client name')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sunrise English', exact: true })).toBeInTheDocument();
  });
  it('lists saved activity links independently of the student directory', async () => {
    fixtures.links = [{ id: 'homework:h1', kind: 'homework', title: 'Reading practice', student: { id: 's1', name: 'Linh', centerId: 'c1', centerName: 'Sunrise English' }, url: '/hw/saved?workspace=tw-synthetic', status: 'active', createdAt: new Date().toISOString() }];
    render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    await screen.findByText('Hello, Amara.');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Teacher workspace' })).getByRole('button', { name: 'Parent links', exact: true }));
    expect(await screen.findByRole('heading', { name: 'Reading practice' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open link', exact: true })).toHaveAttribute('href', '/hw/saved?workspace=tw-synthetic');
    expect(screen.getByDisplayValue('/hw/saved?workspace=tw-synthetic')).toBeInTheDocument();
    expect(screen.queryByLabelText('Student name')).not.toBeInTheDocument();
  });
  it.each([['Homework', 'Assign Homework'], ['Quizzes', 'Create Quiz']])('shows managed student names and IDs in %s assignment forms', async (tab, action) => {
    render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    await screen.findByText('Hello, Amara.');
    fireEvent.change(screen.getByLabelText('Workspace view'), { target: { value: 'c1' } });
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Teacher workspace' })).getByRole('button', { name: tab, exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: action, exact: true }, { timeout: 10000 }));
    const student = await screen.findByRole('option', { name: /Linh.*Managed/ });
    expect(student).toHaveAttribute('value', 's1');
  }, 15000);
});
describe('parent learning page', () => {
  it('lets a family choose and keep dark mode', () => {
    localStorage.removeItem('teacherFamilyDark'); localStorage.removeItem('teacherModeDark');
    const { container } = render(<MemoryRouter initialEntries={['/family/test-token']}><Routes><Route path="/family/:token" element={<TeacherFamilyPage />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(container.querySelector('main')).toHaveAttribute('data-dark', 'true');
    expect(localStorage.getItem('teacherFamilyDark')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(container.querySelector('main')).toHaveAttribute('data-dark', 'false');
  });
  it('switches the family page between English and Vietnamese', async () => {
    const { default: i18n } = await import('../../i18n/i18n');
    await i18n.changeLanguage('en');
    localStorage.removeItem('teacherFamilyLanguage');
    render(<MemoryRouter initialEntries={['/family/test-token']}><Routes><Route path="/family/:token" element={<TeacherFamilyPage />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang tiếng Việt' }));
    expect(await screen.findByText('Mở trang học tập')).toBeInTheDocument();
    expect(localStorage.getItem('teacherFamilyLanguage')).toBe('vi');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(await screen.findByText('Open learning page')).toBeInTheDocument();
  });
  it('keeps teacher and family language choices independent', async () => {
    localStorage.setItem('teacherStudioLanguage', 'vi');
    localStorage.setItem('teacherFamilyLanguage', 'en');
    const teacher = render(<MemoryRouter><TeacherModeDashboard /></MemoryRouter>);
    expect(await screen.findByText('Tổng quan')).toBeInTheDocument();
    teacher.unmount();
    const family = render(<MemoryRouter initialEntries={['/family/test-token']}><Routes><Route path="/family/:token" element={<TeacherFamilyPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Open learning page')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chuyển sang tiếng Việt' }));
    expect(await screen.findByText('Mở trang học tập')).toBeInTheDocument();
    expect(localStorage.getItem('teacherStudioLanguage')).toBe('vi');
    family.unmount();
    localStorage.removeItem('teacherStudioLanguage'); localStorage.removeItem('teacherFamilyLanguage');
  });
  it('unlocks, displays published learning and sends a family message', async () => {
    axios.post.mockResolvedValue({ data: { data: { access: 'family-access' } } });
    const work = [{ _id: 'w1', title: 'Reading', summary: 'Read page 4 together', attended: 'unanswered', class: { status: 'completed', duration: 60, scheduledTime: new Date().toISOString() } }];
    axios.mockImplementation(async config => {
      const data = config.method === 'post' ? {}
        : config.url.includes('/work?') ? { items: work, hasMore: false }
        : config.url.includes('/recordings?') ? { items: [], hasMore: false }
        : config.url.includes('/schedule?') ? { classes: [], totalPages: 1 }
        : { center: 'Sunrise', teacher: 'Amara', student: { firstName: 'Linh', classesRemaining: 3 }, work, activities: [{ id: 'h1', kind: 'hw', title: 'Reading practice', url: '/hw/opaque?workspace=tw-synthetic' }], messages: [] };
      return { data: { data } };
    });
    render(<MemoryRouter initialEntries={['/family/test-token']}><Routes><Route path="/family/:token" element={<TeacherFamilyPage />} /></Routes></MemoryRouter>);
    expect(screen.queryByText('Read page 4 together')).not.toBeInTheDocument();
    expect(await screen.findByText('Linh')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open learning page' }));
    expect(await screen.findByText('Read page 4 together')).toBeInTheDocument();
    expect(screen.getByText('Classes low. Please contact the admin.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reading practice/ })).toHaveAttribute('href', '/hw/opaque?workspace=tw-synthetic');
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Thank you for the update.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to teacher' }));
    await waitFor(() => expect(axios).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/api/teacher-mode/family/test-token/messages', data: { text: 'Thank you for the update.' } })));
  });
});

it('offers a backup code during standalone two-factor sign-in', async () => {
  client.post.mockResolvedValue({ data: { requires2FA: true } });
  render(<MemoryRouter><TeacherModeLogin /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'teacher@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Teacher@56789' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open my workspace' }));
  expect(await screen.findByLabelText('Authenticator code')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Use a backup code' }));
  fireEvent.change(screen.getByLabelText('Backup code'), { target: { value: 'ABC123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open my workspace' }));
  await waitFor(() => expect(client.post).toHaveBeenLastCalledWith('/login', expect.objectContaining({ backupCode: 'ABC123' }), expect.any(Object)));
});
