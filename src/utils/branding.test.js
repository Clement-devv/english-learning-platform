import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  hexToRgb,
  DEFAULT_BRANDING,
  applyBranding,
  fetchBranding,
  setCachedBranding,
  getCachedBranding,
  getCachedCenter,
} from './branding';

// ── hexToRgb ────────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('converts a 6-digit hex to "r, g, b" string', () => {
    expect(hexToRgb('#6D28D9')).toBe('109, 40, 217');
    expect(hexToRgb('#ffffff')).toBe('255, 255, 255');
    expect(hexToRgb('#000000')).toBe('0, 0, 0');
  });

  it('accepts hex without leading #', () => {
    expect(hexToRgb('ff0000')).toBe('255, 0, 0');
  });

  it('falls back to default purple when given invalid input', () => {
    expect(hexToRgb('not-a-color')).toBe('109, 40, 217');
    expect(hexToRgb('')).toBe('109, 40, 217');
  });
});

// ── DEFAULT_BRANDING ─────────────────────────────────────────────────────────

describe('DEFAULT_BRANDING', () => {
  it('has required keys with sensible defaults', () => {
    expect(DEFAULT_BRANDING.primaryColor).toBe('#6D28D9');
    expect(DEFAULT_BRANDING.fontFamily).toBe('Inter');
    expect(DEFAULT_BRANDING.centerName).toBe('English Learning Platform');
    expect(DEFAULT_BRANDING.loginBgOverlay).toBe(0.45);
  });
});

// ── applyBranding ────────────────────────────────────────────────────────────

describe('applyBranding', () => {
  let setPropertySpy;

  beforeEach(() => {
    setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty');
  });

  afterEach(() => {
    setPropertySpy.mockRestore();
  });

  it('sets CSS custom properties for primary colour', () => {
    applyBranding({ ...DEFAULT_BRANDING, primaryColor: '#ff0000' }, null);
    expect(setPropertySpy).toHaveBeenCalledWith('--brand-primary', '#ff0000');
    expect(setPropertySpy).toHaveBeenCalledWith('--brand-primary-rgb', '255, 0, 0');
  });

  it('sets font family CSS variable', () => {
    applyBranding({ ...DEFAULT_BRANDING, fontFamily: 'Inter' }, null);
    expect(setPropertySpy).toHaveBeenCalledWith('--brand-font', "'Inter', sans-serif");
  });

  it('sets border radius CSS variable', () => {
    applyBranding({ ...DEFAULT_BRANDING, borderRadius: '12px' }, null);
    expect(setPropertySpy).toHaveBeenCalledWith('--brand-radius', '12px');
  });

  it('sets login overlay opacity', () => {
    applyBranding({ ...DEFAULT_BRANDING, loginBgOverlay: 0.6 }, null);
    expect(setPropertySpy).toHaveBeenCalledWith('--brand-login-overlay', 0.6);
  });

  it('updates document.title when center name is provided', () => {
    applyBranding(DEFAULT_BRANDING, { centerName: 'My School' });
    expect(document.title).toBe('My School');
  });

  it('does not update document.title when no center is passed', () => {
    document.title = 'Original';
    applyBranding(DEFAULT_BRANDING, null);
    expect(document.title).toBe('Original');
  });

  it('appends a Google Fonts link for non-system fonts', () => {
    const before = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    applyBranding({ ...DEFAULT_BRANDING, fontFamily: 'Roboto Mono' }, null);
    const after = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    expect(after).toBe(before + 1);
    const link = [...document.head.querySelectorAll('link[rel="stylesheet"]')].at(-1);
    expect(link.href).toContain('Roboto+Mono');
  });

  it('does not append a link for built-in system fonts', () => {
    const before = document.head.querySelectorAll('link[rel="stylesheet"]').length;
    applyBranding({ ...DEFAULT_BRANDING, fontFamily: 'Arial' }, null);
    expect(document.head.querySelectorAll('link[rel="stylesheet"]').length).toBe(before);
  });
});

// ── fetchBranding ────────────────────────────────────────────────────────────

describe('fetchBranding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('returns DEFAULT_BRANDING when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const result = await fetchBranding();
    expect(result.branding).toEqual(DEFAULT_BRANDING);
    expect(result.center).toBeNull();
  });

  it('returns DEFAULT_BRANDING when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await fetchBranding();
    expect(result.branding).toEqual(DEFAULT_BRANDING);
  });

  it('merges server branding over defaults', async () => {
    const serverBranding = { primaryColor: '#123456' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, branding: serverBranding, center: { centerName: 'Test' } }),
    }));
    const result = await fetchBranding();
    expect(result.branding.primaryColor).toBe('#123456');
    // Defaults still in place for unspecified keys
    expect(result.branding.fontFamily).toBe(DEFAULT_BRANDING.fontFamily);
    expect(result.center).toEqual({ centerName: 'Test' });
  });

  it('sends x-center-slug header when impersonationCenterSlug is set', async () => {
    sessionStorage.setItem('impersonationCenterSlug', 'my-center');
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    await fetchBranding();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['x-center-slug']).toBe('my-center');
  });
});

// ── branding cache ───────────────────────────────────────────────────────────

describe('branding cache', () => {
  it('stores and retrieves branding via cache helpers', () => {
    const branding = { ...DEFAULT_BRANDING, primaryColor: '#abcdef' };
    const center   = { centerName: 'Cached Center' };
    setCachedBranding(branding, center);
    expect(getCachedBranding()).toEqual(branding);
    expect(getCachedCenter()).toEqual(center);
  });
});
