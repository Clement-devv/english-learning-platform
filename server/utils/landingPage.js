// server/utils/landingPage.js
// Cleans a center website (Center.landingPage) before it is saved:
//   • only known sections/fields are kept, strings are trimmed and length-capped
//   • lists are capped (e.g. 12 programs, 24 gallery photos)
//   • links may only be https/http, site paths (/…), #anchors, mailto: or tel:
//   • images may only be https/http URLs or our own /uploads/… files
// so nothing typed into the editor can turn into a javascript: link or a huge document.

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const bool = (v, dflt = true) => (typeof v === 'boolean' ? v : dflt);

export function safeUrl(v) {
  const s = str(v, 600);
  if (!s) return '';
  if (/^(https?:\/\/|mailto:|tel:|#)/i.test(s)) return s;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  return '';
}

export function safeImage(v) {
  const s = str(v, 600);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/uploads/')) return s;
  return '';
}

const list = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn).filter(Boolean) : []);
const section = (v, fields = {}) => {
  const o = v && typeof v === 'object' ? v : {};
  return { enabled: bool(o.enabled), title: str(o.title, 120), subtitle: str(o.subtitle, 300), ...fields };
};

const CLEANERS = {
  template: (v) => (['classic', 'modern', 'minimal'].includes(v) ? v : 'classic'),
  design: (d = {}) => ({
    primaryColor: str(d.primaryColor, 20), secondaryColor: str(d.secondaryColor, 20), accentColor: str(d.accentColor, 20),
    bgColor: str(d.bgColor, 20), textColor: str(d.textColor, 20), mutedColor: str(d.mutedColor, 20),
    fontFamily: str(d.fontFamily, 40), heroStyle: str(d.heroStyle, 20), navStyle: str(d.navStyle, 20),
    heroImage: safeImage(d.heroImage),
  }),
  hero: (h = {}) => ({
    headline: str(h.headline, 160), subheadline: str(h.subheadline, 400), badge: str(h.badge, 60),
    ctaText: str(h.ctaText, 40), ctaUrl: safeUrl(h.ctaUrl),
    secondaryCtaText: str(h.secondaryCtaText, 40), secondaryCtaUrl: safeUrl(h.secondaryCtaUrl),
    image: safeImage(h.image),
  }),
  about: (a = {}) => ({
    enabled: bool(a.enabled), title: str(a.title, 120), subtitle: str(a.subtitle, 120), body: str(a.body, 3000),
    image: safeImage(a.image), image2: safeImage(a.image2),
    badgeValue: str(a.badgeValue, 12), badgeLabel: str(a.badgeLabel, 40),
    points: list(a.points, 8, p => str(p, 120) || null),
  }),
  teachers: (t) => list(t, 24, (x, i) => (str(x?.name, 80) ? {
    name: str(x.name, 80), title: str(x.title, 80), bio: str(x.bio, 400), photo: safeImage(x.photo), order: i,
  } : null)),
  links: (l = {}) => Object.fromEntries(
    ['studentLogin', 'teacherLogin', 'parentLogin', 'facebook', 'instagram', 'youtube', 'whatsapp'].map(k => [k, safeUrl(l[k])]),
  ),
  contact: (c = {}) => ({
    enabled: bool(c.enabled, false), email: str(c.email, 120), phone: str(c.phone, 40),
    address: str(c.address, 300), hours: str(c.hours, 200),
  }),
  seo: (s = {}) => ({ title: str(s.title, 120), description: str(s.description, 300) }),
  topBar: (t = {}) => ({ enabled: bool(t?.enabled, false), text: str(t?.text, 160) }),
  stats: (s) => section(s, { items: list(s?.items, 6, x => (str(x?.value, 20) ? { value: str(x.value, 20), label: str(x.label, 60) } : null)) }),
  features: (s) => section(s, { items: list(s?.items, 12, x => (str(x?.title, 80) ? { icon: str(x.icon, 30), title: str(x.title, 80), text: str(x.text, 300) } : null)) }),
  programs: (s) => section(s, { items: list(s?.items, 12, x => (str(x?.title, 100) ? {
    image: safeImage(x.image), title: str(x.title, 100), level: str(x.level, 40), duration: str(x.duration, 40),
    price: str(x.price, 40), text: str(x.text, 400), ctaText: str(x.ctaText, 30), ctaUrl: safeUrl(x.ctaUrl),
  } : null)) }),
  testimonials: (s) => section(s, { items: list(s?.items, 12, x => (str(x?.quote, 600) ? {
    name: str(x.name, 80), role: str(x.role, 80), photo: safeImage(x.photo), quote: str(x.quote, 600),
    rating: Math.min(5, Math.max(0, parseInt(x.rating, 10) || 5)),
  } : null)) }),
  gallery: (s) => section(s, { items: list(s?.items, 24, x => (safeImage(x?.image) ? { image: safeImage(x.image), caption: str(x.caption, 120) } : null)) }),
  faq: (s) => section(s, { items: list(s?.items, 20, x => (str(x?.q, 200) ? { q: str(x.q, 200), a: str(x.a, 1500) } : null)) }),
  cta: (c = {}) => ({
    enabled: bool(c?.enabled), title: str(c?.title, 140), text: str(c?.text, 400),
    buttonText: str(c?.buttonText, 40), buttonUrl: safeUrl(c?.buttonUrl), image: safeImage(c?.image),
  }),
  footer: (f = {}) => ({ about: str(f?.about, 400) }),
};

/** Clean the parts of a landing page that were sent (partial updates keep other parts). */
export function cleanLandingPage(input) {
  const out = {};
  for (const [key, val] of Object.entries(input || {})) {
    if (CLEANERS[key]) out[key] = CLEANERS[key](val);
  }
  return out;
}

/** The public copy of a center website — every section the templates can show. */
export const PUBLIC_LANDING_KEYS = [
  'template', 'design', 'hero', 'about', 'teachers', 'links', 'contact', 'seo',
  'topBar', 'stats', 'features', 'programs', 'testimonials', 'gallery', 'faq', 'cta', 'footer', 'publishedAt',
];
