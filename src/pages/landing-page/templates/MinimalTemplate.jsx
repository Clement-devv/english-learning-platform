// Minimal template — white hero, generous whitespace, teachers as list rows.
import React, { useState, useEffect } from 'react';
import {
  resolveDesign, SectionLabel, useScrolled, useIsMobile,
  sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS,
} from '../utils.jsx';

export default function MinimalTemplate({ center, lp }) {
  const D    = resolveDesign(lp.design);
  const urls = {
    student: lp.links?.studentLogin || '/student/login',
    teacher: lp.links?.teacherLogin || '/teacher/login',
    parent:  lp.links?.parentLogin  || '/parent/login',
    admin:   '/admin/login',
  };
  useDocTitle(lp.seo?.title || center.centerName);

  return (
    <div style={{ fontFamily: D.font, background: '#fafafa', color: D.text, minHeight: '100vh' }}>
      <MinimalNav center={center} D={D} urls={urls} />
      <MinimalHero center={center} lp={lp} D={D} />
      {lp.about?.enabled && lp.about?.body && <MinimalAbout about={lp.about} D={D} />}
      {lp.teachers?.length > 0 && <MinimalTeachers teachers={lp.teachers} D={D} />}
      {lp.contact?.enabled && <MinimalContact contact={lp.contact} links={lp.links} D={D} />}
      <MinimalFooter center={center} D={D} links={lp.links} />
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function MinimalNav({ center, D, urls }) {
  const scrolled = useScrolled();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled || menuOpen ? '#fff' : 'transparent',
      borderBottom: `1px solid ${(scrolled || menuOpen) ? 'rgba(0,0,0,0.06)' : 'transparent'}`,
      boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.05)' : 'none',
      transition: 'all 0.3s ease',
      height: 64, display: 'flex', alignItems: 'center', padding: '0 6%',
      fontFamily: D.font,
    }}>
      <div style={{ flex: 1 }}>
        {center.logo
          ? <img src={center.logo} alt={center.centerName} style={{ height: 30, objectFit: 'contain' }} />
          : <span style={{ fontSize: 17, fontWeight: 700, color: D.text, letterSpacing: '-0.01em' }}>{center.centerName}</span>
        }
      </div>

      {/* Desktop links */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href={urls.admin} style={{ fontSize: 12, color: '#cbd5e1', textDecoration: 'none', fontWeight: 400 }}>
            Admin
          </a>
          <a href={urls.parent} style={{ fontSize: 13, color: D.muted, textDecoration: 'none', fontWeight: 500 }}>
            Parents
          </a>
          <a href={urls.teacher} style={{ fontSize: 13, color: D.muted, textDecoration: 'none', fontWeight: 500 }}>
            Teachers
          </a>
          <a href={urls.student} style={{
            fontSize: 13, fontWeight: 700, padding: '8px 20px', borderRadius: 9,
            background: D.primary, color: '#fff', textDecoration: 'none',
          }}>
            Login
          </a>
        </div>
      )}

      {/* Mobile: Login button + hamburger */}
      {isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href={urls.student} style={{
            fontSize: 13, fontWeight: 700, padding: '7px 16px', borderRadius: 9,
            background: D.primary, color: '#fff', textDecoration: 'none',
          }}>
            Login
          </a>
          <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: D.text }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      )}

      {/* Mobile slide-down menu */}
      {isMobile && menuOpen && (
        <div style={{ position: 'absolute', top: 64, left: 0, right: 0, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '12px 6% 20px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.07)', zIndex: 99 }}>
          <a href={urls.student} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 700, color: D.primary, textDecoration: 'none', padding: '10px 12px', borderRadius: 8 }}>
            Student Login
          </a>
          <a href={urls.teacher} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 500, color: D.muted, textDecoration: 'none', padding: '10px 12px', borderRadius: 8 }}>
            Teacher Login
          </a>
          <a href={urls.parent} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 500, color: D.muted, textDecoration: 'none', padding: '10px 12px', borderRadius: 8 }}>
            Parent Login
          </a>
          <a href={urls.admin} onClick={() => setMenuOpen(false)} style={{ fontSize: 12, fontWeight: 400, color: '#cbd5e1', textDecoration: 'none', padding: '8px 12px', borderRadius: 8 }}>
            Admin Login
          </a>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function MinimalHero({ center, lp, D }) {
  const isMobile = useIsMobile();
  const h1     = lp.hero?.headline    || center.centerName;
  const sub    = lp.hero?.subheadline || center.description || 'Improving lives through English';
  const cta    = lp.hero?.ctaText     || 'Get Started';
  const ctaUrl = lp.hero?.ctaUrl      || '/student/login';
  const sec    = lp.hero?.secondaryCtaText || '';
  const secUrl = lp.hero?.secondaryCtaUrl  || '#';

  // Split headline at last space to accent the last word
  const parts = h1.trim().split(' ');
  const lastWord   = parts.pop();
  const restOfLine = parts.join(' ');

  return (
    <section style={{
      minHeight: '92vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? '100px 8% 80px' : '120px 10% 100px',
      background: '#fafafa',
      textAlign: 'center',
      position: 'relative',
    }}>
      {/* Thin accent top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${D.primary}, ${D.accent})` }} />

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Tiny center name label */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: D.primary, margin: '0 0 32px' }}>
          {center.centerName}
        </p>

        <h1 style={{ fontSize: 'clamp(2.4rem,5.5vw,4.2rem)', fontWeight: 800, lineHeight: 1.08, color: D.text, margin: '0 0 24px', letterSpacing: '-0.03em' }}>
          {restOfLine && <>{restOfLine} </>}
          <span style={{ color: D.primary, position: 'relative' }}>
            {lastWord}
            {/* Underline accent */}
            <svg style={{ position: 'absolute', bottom: '-4px', left: 0, width: '100%', overflow: 'visible' }} height="6" viewBox="0 0 100 6" preserveAspectRatio="none">
              <path d="M0 5 Q50 0 100 5" stroke={D.accent} strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </span>
        </h1>

        <p style={{ fontSize: 'clamp(1rem,2vw,1.15rem)', color: D.muted, lineHeight: 1.82, margin: '0 auto 40px', maxWidth: 520 }}>
          {sub}
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={ctaUrl} style={{
            padding: '13px 32px', borderRadius: 10, fontSize: 14, fontWeight: 700,
            background: D.primary, color: '#fff', textDecoration: 'none',
          }}>
            {cta}
          </a>
          {sec && (
            <a href={secUrl} style={{ padding: '13px 32px', borderRadius: 10, fontSize: 14, fontWeight: 600, background: 'transparent', color: D.muted, textDecoration: 'none', border: `1px solid ${D.muted}35` }}>
              {sec}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */
function MinimalAbout({ about, D }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '100px 10%', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <SectionLabel color={D.primary} font={D.font}>About</SectionLabel>
        <h2 style={{ fontSize: 'clamp(1.5rem,2.8vw,2.2rem)', fontWeight: 700, color: D.text, margin: '16px 0 24px', letterSpacing: '-0.02em' }}>
          {about.title}
        </h2>
        <p style={{ fontSize: 16, color: D.muted, lineHeight: 1.9, whiteSpace: 'pre-wrap', margin: 0 }}>
          {about.body}
        </p>
        {about.image && (
          <img src={about.image} alt={about.title} style={{ marginTop: 48, width: '100%', maxHeight: 400, objectFit: 'cover', borderRadius: 16, boxShadow: '0 16px 48px rgba(0,0,0,0.1)' }} />
        )}
      </div>
    </section>
  );
}

/* ── Teachers ─────────────────────────────────────────────────────────────── */
function MinimalTeachers({ teachers, D }) {
  const isMobile = useIsMobile();
  const sorted = sortedTeachers(teachers);
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '100px 10%', background: '#fafafa', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 48 }}>
          <SectionLabel color={D.primary} font={D.font}>Team</SectionLabel>
          <h2 style={{ fontSize: 'clamp(1.5rem,2.8vw,2.2rem)', fontWeight: 700, color: D.text, margin: '16px 0 0', letterSpacing: '-0.02em' }}>
            Our Teachers
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sorted.map((t, i) => (
            <div key={i}>
              <MinimalTeacherRow teacher={t} D={D} />
              {i < sorted.length - 1 && <div style={{ height: 1, background: 'rgba(0,0,0,0.05)', margin: '0' }} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MinimalTeacherRow({ teacher, D }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 20,
        padding: '28px 0',
        background: hovered ? `${D.primary}05` : 'transparent',
        transition: 'background 0.2s',
        borderRadius: 8,
      }}
    >
      {/* Avatar */}
      {teacher.photo
        ? <img src={teacher.photo} alt={teacher.name} style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${D.primary}20` }} />
        : <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, background: `${D.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: D.primary }}>
            {teacher.name.charAt(0).toUpperCase()}
          </div>
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>{teacher.name}</h3>
          {teacher.title && (
            <span style={{ fontSize: 11, fontWeight: 600, color: D.primary, background: `${D.primary}12`, padding: '2px 10px', borderRadius: 10 }}>
              {teacher.title}
            </span>
          )}
        </div>
        {teacher.bio && <p style={{ fontSize: 14, color: D.muted, margin: 0, lineHeight: 1.65 }}>{teacher.bio}</p>}
      </div>
    </div>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */
function MinimalContact({ contact, links, D }) {
  const isMobile = useIsMobile();
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '100px 10%', background: '#fff', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <SectionLabel color={D.primary} font={D.font}>Contact</SectionLabel>
        <h2 style={{ fontSize: 'clamp(1.5rem,2.8vw,2.2rem)', fontWeight: 700, color: D.text, margin: '16px 0 32px', letterSpacing: '-0.02em' }}>
          Say Hello
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', marginBottom: 32 }}>
          {contact.email   && <a href={`mailto:${contact.email}`} style={{ fontSize: 15, color: D.muted, textDecoration: 'none' }}>✉️ {contact.email}</a>}
          {contact.phone   && <a href={`tel:${contact.phone}`}    style={{ fontSize: 15, color: D.muted, textDecoration: 'none' }}>📞 {contact.phone}</a>}
          {contact.address && <span style={{ fontSize: 15, color: D.muted }}>📍 {contact.address}</span>}
        </div>
        {socials.length > 0 && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            {socials.map(k => {
              const Icon = SOCIAL_ICONS[k];
              return (
                <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" style={{ color: D.muted, transition: 'color 0.15s' }}
                   title={SOCIAL_LABELS[k]}>
                  <Icon size={22} />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function MinimalFooter({ center, D, links }) {
  return (
    <footer style={{ borderTop: `3px solid ${D.primary}`, background: D.text, padding: '32px 6%', fontFamily: D.font }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          {center.logo
            ? <img src={center.logo} alt={center.centerName} style={{ height: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            : <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{center.centerName}</span>
          }
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {links?.studentLogin && <a href={links.studentLogin} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Students</a>}
          {links?.teacherLogin && <a href={links.teacherLogin} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Teachers</a>}
          {links?.parentLogin  && <a href={links.parentLogin}  style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>Parents</a>}
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>© {new Date().getFullYear()} {center.centerName}</span>
        </div>
      </div>
    </footer>
  );
}

function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}
