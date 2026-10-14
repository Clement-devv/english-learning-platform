// src/utils/adminAccent.js
// The admin dashboard's single accent colour, taken from the center's brand colour.
// Centers that never picked a colour still carry a default — the server model's
// indigo (server/models/master/Center.js) or the client fallback purple
// (DEFAULT_BRANDING) — so those values count as "not chosen" and the dashboard
// falls back to the dashboard orange instead of an accidental purple.

import { DEFAULT_BRANDING } from './branding';

export const ADMIN_FALLBACK_ACCENT = '#cf4b08';   // vivid burnt orange — 4.5:1 with white text

const HEX6 = /^#[0-9a-f]{6}$/i;
const UNCHOSEN_DEFAULTS = new Set(['#4f46e5', DEFAULT_BRANDING.primaryColor.toLowerCase()]);

export function adminAccent(branding) {
  const c = (branding?.primaryColor || '').trim();
  if (!HEX6.test(c) || UNCHOSEN_DEFAULTS.has(c.toLowerCase())) return ADMIN_FALLBACK_ACCENT;
  return c;
}

// Text colour that stays readable on a solid accent fill (very light brand
// colours such as yellow get dark text instead of white).
export function adminOnAccent(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // contrast with white = 1.05 / (L + 0.05); prefer white down to 3:1 (bold UI text)
  return 1.05 / (L + 0.05) >= 3 ? '#ffffff' : '#1c1917';
}
