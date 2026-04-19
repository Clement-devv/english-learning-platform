import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './AuthGuard';

vi.mock('../api', () => ({
  default: {
    defaults: { headers: { common: {} } },
    get: vi.fn(),
  },
}));

import api from '../api';

function renderGuard(role, { initialPath = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<AuthGuard role={role}><div>Protected</div></AuthGuard>} />
        <Route path="/teacher/login"    element={<div>Teacher Login</div>} />
        <Route path="/student/login"    element={<div>Student Login</div>} />
        <Route path="/admin/login"      element={<div>Admin Login</div>} />
        <Route path="/sub-admin/login"  element={<div>SubAdmin Login</div>} />
        <Route path="/super-admin/login" element={<div>SuperAdmin Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthGuard — teacher', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); api.defaults.headers.common = {}; });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('redirects to teacher login when no token', async () => {
    renderGuard('teacher');
    await waitFor(() => expect(screen.getByText('Teacher Login')).toBeInTheDocument());
  });

  it('renders children when teacher token is valid', async () => {
    sessionStorage.setItem('teacherToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('teacher');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });

  it('redirects when teacher token verify fails', async () => {
    sessionStorage.setItem('teacherToken', 'bad');
    api.get.mockRejectedValue(new Error('401'));
    renderGuard('teacher');
    await waitFor(() => expect(screen.getByText('Teacher Login')).toBeInTheDocument());
  });

  it('clears tokens on failed verification', async () => {
    sessionStorage.setItem('teacherToken', 'bad');
    sessionStorage.setItem('teacherInfo', '{}');
    localStorage.setItem('teacherToken', 'bad');
    api.get.mockRejectedValue(new Error('401'));
    renderGuard('teacher');
    await waitFor(() => expect(screen.getByText('Teacher Login')).toBeInTheDocument());
    expect(sessionStorage.getItem('teacherToken')).toBeNull();
    expect(localStorage.getItem('teacherToken')).toBeNull();
  });
});

describe('AuthGuard — student', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('redirects to student login when no token', async () => {
    renderGuard('student');
    await waitFor(() => expect(screen.getByText('Student Login')).toBeInTheDocument());
  });

  it('renders children when student token is valid', async () => {
    sessionStorage.setItem('studentToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('student');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });
});

describe('AuthGuard — admin', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('redirects to admin login when no token', async () => {
    renderGuard('admin');
    await waitFor(() => expect(screen.getByText('Admin Login')).toBeInTheDocument());
  });

  it('renders children when admin token is valid', async () => {
    sessionStorage.setItem('adminToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('admin');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });
});

describe('AuthGuard — sub-admin (client-side JWT)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  // Build a minimal JWT with exp in the future
  function makeJwt(exp) {
    const payload = btoa(JSON.stringify({ exp }));
    return `header.${payload}.sig`;
  }

  it('redirects when no token', async () => {
    renderGuard('sub-admin');
    await waitFor(() => expect(screen.getByText('SubAdmin Login')).toBeInTheDocument());
  });

  it('renders children when token is not expired', async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem('subAdminToken', token);
    renderGuard('sub-admin');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
    // No API call — verified client-side
    expect(api.get).not.toHaveBeenCalled();
  });

  it('redirects when token is expired', async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) - 10);
    sessionStorage.setItem('subAdminToken', token);
    renderGuard('sub-admin');
    await waitFor(() => expect(screen.getByText('SubAdmin Login')).toBeInTheDocument());
    expect(api.get).not.toHaveBeenCalled();
  });

  it('redirects when token is malformed', async () => {
    sessionStorage.setItem('subAdminToken', 'not.a.jwt');
    renderGuard('sub-admin');
    await waitFor(() => expect(screen.getByText('SubAdmin Login')).toBeInTheDocument());
  });
});

describe('AuthGuard — super-admin (localStorage only)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('reads token from localStorage, not sessionStorage', async () => {
    // Only set in localStorage — should still work
    localStorage.setItem('superAdminToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('super-admin');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });

  it('redirects when no token in localStorage', async () => {
    renderGuard('super-admin');
    await waitFor(() => expect(screen.getByText('SuperAdmin Login')).toBeInTheDocument());
  });
});

describe('AuthGuard — classroom (multi-role)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks(); });
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); });

  function makeJwt(exp) {
    const payload = btoa(JSON.stringify({ exp }));
    return `header.${payload}.sig`;
  }

  it('grants access when teacher token is valid', async () => {
    sessionStorage.setItem('teacherToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('classroom');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });

  it('grants access when student token is valid', async () => {
    sessionStorage.setItem('studentToken', 'valid');
    api.get.mockResolvedValue({});
    renderGuard('classroom');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });

  it('grants access when sub-admin token is valid (client-side)', async () => {
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    sessionStorage.setItem('subAdminToken', token);
    renderGuard('classroom');
    await waitFor(() => expect(screen.getByText('Protected')).toBeInTheDocument());
  });

  it('redirects to teacher login by default when no tokens', async () => {
    renderGuard('classroom');
    await waitFor(() => expect(screen.getByText('Teacher Login')).toBeInTheDocument());
  });

  it('redirects to student login when role hint is student', async () => {
    sessionStorage.setItem('role', 'student');
    renderGuard('classroom');
    await waitFor(() => expect(screen.getByText('Student Login')).toBeInTheDocument());
  });
});
