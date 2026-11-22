import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({}));
vi.mock('axios', () => ({ default: { create: () => ({ interceptors: {
  request: { use: fn => { hooks.request = fn; } },
  response: { use: (_ok, fn) => { hooks.response = fn; } },
} }) } }));
vi.mock('./utils/branding', () => ({ getCachedCenter: () => null }));
vi.mock('./utils/deviceKey', () => ({ deviceLoginHeaders: vi.fn(), signRenewal: vi.fn() }));
vi.mock('./utils/deviceWipe', () => ({ wipeDeviceAndSignOut: vi.fn() }));
import './api';

const token = claims => `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims }))}.signature`;
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe('center and standalone API isolation', () => {
  it('keeps regular center requests on their existing API', async () => {
    const jwt = token({ role: 'teacher', centerId: 'existing-school' });
    sessionStorage.setItem('teacherToken', jwt);
    const config = await hooks.request({ url: '/teachers/me', headers: {}, baseURL: '/api/v1' });
    expect(config.baseURL).toBe('/api/v1');
    expect(config.headers.Authorization).toBe(`Bearer ${jwt}`);
  });
  it('routes standalone tools through their workspace API', async () => {
    const jwt = token({ role: 'teacher', centerId: 'tw-111111111111111111111111', realm: 'teacher-mode' });
    sessionStorage.setItem('teacherToken', jwt);
    const config = await hooks.request({ url: '/teachers/me', headers: {}, baseURL: '/api/v1' });
    expect(config.baseURL).toMatch(/\/teacher-mode\/app$/);
    expect(config.headers.Authorization).toBe(`Bearer ${jwt}`);
  });
  it('keeps Super Admin sign-in on the platform API when a standalone teacher is signed in', async () => {
    const jwt = token({ role: 'teacher', centerId: 'tw-111111111111111111111111', realm: 'teacher-mode' });
    sessionStorage.setItem('teacherToken', jwt);
    const config = await hooks.request({ url: '/super-admin/login', headers: {}, baseURL: '/api/v1' });
    expect(config.baseURL).toBe('/api/v1');
    expect(config.headers.Authorization).toBeUndefined();
    const error = { config: { url: '/super-admin/login/verify' }, response: { status: 401 } };
    await expect(hooks.response(error)).rejects.toBe(error);
    expect(sessionStorage.getItem('teacherToken')).toBe(jwt);
  });
  it.each([
    [{ role: 'teacher', centerId: 'existing-school' }, '/teacher/login'],
    [{ role: 'teacher', centerId: 'tw-111111111111111111111111', realm: 'teacher-mode' }, '/teacher-mode/login'],
  ])('returns an ended session to its own login page', async (claims, expectedPath) => {
    sessionStorage.setItem('teacherToken', token(claims));
    const location = { href: '' };
    vi.stubGlobal('window', { location });
    const error = { config: { url: '/teachers/me' }, response: { status: 401 } };
    await expect(hooks.response(error)).rejects.toBe(error);
    expect(location.href).toBe(expectedPath);
    expect(sessionStorage.getItem('teacherToken')).toBeNull();
  });
});
