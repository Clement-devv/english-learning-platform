// src/pages/landing-page/utils.jsx
// Shared utilities for all landing page templates.
import React, { useState, useEffect } from 'react';

export const FONT_FAMILIES = {
  Inter:   "'Inter','system-ui',sans-serif",
  Nunito:  "'Nunito','system-ui',sans-serif",
  Poppins: "'Poppins','system-ui',sans-serif",
  Roboto:  "'Roboto','system-ui',sans-serif",
  Lato:    "'Lato','system-ui',sans-serif",
};

// Darken/lighten a hex color by an amount (-255 to 255)
export function adjustHex(hex = '#000000', amount) {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = Math.min(255, Math.max(0, parseInt(c.slice(0,2),16) + amount));
  const g = Math.min(255, Math.max(0, parseInt(c.slice(2,4),16) + amount));
  const b = Math.min(255, Math.max(0, parseInt(c.slice(4,6),16) + amount));
  return `#${[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')}`;
}

// Resolves design tokens from the lp.design object
export function resolveDesign(design = {}) {
  return {
    primary:   design.primaryColor   || '#4F46E5',
    secondary: design.secondaryColor || '#E0E7FF',
    accent:    design.accentColor    || '#f59e0b',
    bg:        design.bgColor        || '#ffffff',
    text:      design.textColor      || '#1e293b',
    muted:     design.mutedColor     || '#64748b',
    font:      FONT_FAMILIES[design.fontFamily] || FONT_FAMILIES.Inter,
    fontName:  design.fontFamily     || 'Inter',
    heroStyle: design.heroStyle      || 'gradient',
    heroImage: design.heroImage      || null,
    navStyle:  design.navStyle       || 'light',
  };
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return scrolled;
}

export function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [breakpoint]);
  return mobile;
}

// ── Shared micro-components ──────────────────────────────────────────────────

export function SectionLabel({ color, font, children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
      color, background: `${color}18`, padding: '5px 14px', borderRadius: 20,
      display: 'inline-block', fontFamily: font, border: `1px solid ${color}30`,
    }}>
      {children}
    </span>
  );
}

export function PageLoader() {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', zIndex: 9999 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid #e5e7eb', borderTopColor: '#6366f1', animation: 'spin 0.75s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function GoogleFont({ fontName }) {
  if (!fontName || fontName === 'Inter') return null;
  const href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g,'+')}:wght@400;500;600;700;800&display=swap`;
  return <link rel="stylesheet" href={href} />;
}

// Shared sorted-teachers helper
export function sortedTeachers(teachers = []) {
  return [...teachers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

// ── Social icons (inline SVG) ────────────────────────────────────────────────

export function FacebookIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
}
export function InstagramIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
}
export function YouTubeIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon fill="#fff" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>;
}
export function WhatsAppIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>;
}

export const SOCIAL_ICONS = {
  facebook:  FacebookIcon,
  instagram: InstagramIcon,
  youtube:   YouTubeIcon,
  whatsapp:  WhatsAppIcon,
};

export const SOCIAL_LABELS = {
  facebook:  'Facebook',
  instagram: 'Instagram',
  youtube:   'YouTube',
  whatsapp:  'WhatsApp',
};
