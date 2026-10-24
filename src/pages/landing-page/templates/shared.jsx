// Pieces shared by the website templates (Classic, Modern): icons, the counting
// stats number, scroll reveal and small colour/document helpers.
import { useEffect, useRef, useState } from 'react';
/* eslint-disable react-refresh/only-export-components -- helper module, not a component file */

/** Black or white text, whichever reads better on `hex`. */
export function onColor(hex = '#000000') {
  const c = hex.replace('#', '').padEnd(6, '0');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
}

export const on = (sec) => !!sec && sec.enabled !== false;
export const items = (sec) => (on(sec) && Array.isArray(sec.items) ? sec.items.filter(Boolean) : []);

/** Counts a stat like "1,200+" or "98%" up from 0 once it scrolls into view.
 *  Values without a number ("Online") are shown as they are. Reduced motion: no count. */
export function CountUp({ value }) {
  const ref = useRef(null);
  const m = String(value).match(/^(\D*)([\d,.]+)(.*)$/);
  // Starts on the real value (what search engines, print and no-JS see); the count runs
  // only once the number is actually on screen.
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!m || !el) { setShown(value); return undefined; }
    // "1,200" (English) and "1.200" (Vietnamese) are thousands; "4.5" / "4,5" are decimals.
    // The count keeps whichever style was typed.
    const grouped = m[2].match(/^\d{1,3}([.,])\d{3}(?:\1\d{3})*$/);
    const group = grouped ? grouped[1] : '';
    const dec = grouped ? '' : (m[2].match(/[.,]/)?.[0] || '');
    const target = parseFloat(grouped ? m[2].split(group).join('') : m[2].replace(',', '.'));
    if (!Number.isFinite(target)) { setShown(value); return undefined; }
    const decimals = dec ? m[2].split(dec)[1].length : 0;
    const fmt = (n) => {
      const [int, frac] = n.toFixed(decimals).split('.');
      return `${m[1]}${group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, group) : int}${frac ? dec + frac : ''}${m[3]}`;
    };
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setShown(value); return undefined; }
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setShown(fmt(0));
      const start = performance.now(), dur = 1400;
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);          // ease-out: fast start, gentle landing
        setShown(p < 1 ? fmt(target * eased) : value);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="lp-count">{shown}</span>;
}

const PATHS = {
  arrow: <><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>,
  chevron: <polyline points="6 9 12 15 18 9" />,
  check: <polyline points="20 6 9 17 4 12" />,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  close: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
  cap: <><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c3 2 9 2 12 0v-5" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  board: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
  video: <><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  laptop: <><rect x="3" y="4" width="18" height="12" rx="2" /><line x1="2" y1="20" x2="22" y2="20" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  spark: <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />,
};
// Icon names offered in the editor: landing-page/classicContent.js (CLASSIC_FEATURE_ICONS)

export function Icon({ name, size = 18, className = '' }) {
  if (name === 'star-fill') {
    return <svg className={`lp-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>{PATHS.star}</svg>;
  }
  return (
    <svg className={`lp-ic ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name] || PATHS.star}
    </svg>
  );
}

/* ── Hooks ───────────────────────────────────────────────────────────────── */
// Elements with `${prefix}-reveal` fade up as they scroll into view. Without
// IntersectionObserver (or before it fires) everything stays visible.
export function useReveal(rootRef, prefix) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    root.classList.add(`${prefix}-anim`);
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll(`.${prefix}-reveal`).forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

// Scroll position of the page — or of the editor preview's scroll box
export function useScrolledIn() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = (e) => {
      const t = e.target === document ? document.scrollingElement : e.target;
      setScrolled((t?.scrollTop || window.scrollY) > 24);
    };
    window.addEventListener('scroll', fn, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', fn, { capture: true });
  }, []);
  return scrolled;
}

export function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}

/** Marks the page's language (<html lang>) so browsers and Google read the website as
 *  Vietnamese or English — and don't offer to translate it. Restored when it closes
 *  (the editor preview opens inside the super admin's page). */
export function useDocLang(lang) {
  useEffect(() => {
    const el = document.documentElement;
    const before = el.lang;
    el.lang = lang;
    return () => { el.lang = before; };
  }, [lang]);
}

/** Escape / arrow keys for a photo lightbox. */
export function useLightboxKeys(open, setOpen, count) {
  useEffect(() => {
    if (open === null) return undefined;
    const key = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen(i => (i + 1) % count);
      if (e.key === 'ArrowLeft') setOpen(i => (i - 1 + count) % count);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, setOpen, count]);
}

/** Splits a headline around its longest word (5+ letters), which the templates
 *  highlight: [before, word, after]. */
export function splitHeadline(text) {
  const words = text.split(' ');
  let best = -1;
  words.forEach((w, i) => { const clean = w.replace(/[^\p{L}]/gu, ''); if (clean.length >= 5 && (best < 0 || clean.length > words[best].replace(/[^\p{L}]/gu, '').length)) best = i; });
  if (best < 0) return [text, '', ''];
  return [words.slice(0, best).join(' '), words[best], words.slice(best + 1).join(' ')];
}
