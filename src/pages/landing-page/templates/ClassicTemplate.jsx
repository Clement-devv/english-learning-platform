// Classic template — DevSkill-inspired: split hero, warm background, stats bar, modern cards.
import { useState, useEffect } from 'react';
import {
  resolveDesign, adjustHex, SectionLabel, useScrolled, useIsMobile,
  sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS, GoogleFont,
} from '../utils.jsx';

export default function ClassicTemplate({ center, lp }) {
  const D    = resolveDesign(lp.design);
  const urls = {
    student: lp.links?.studentLogin || '/student/login',
    teacher: lp.links?.teacherLogin || '/teacher/login',
    admin:   '/admin/login',
  };
  useDocTitle(lp.seo?.title || center.centerName);

  return (
    <div style={{ fontFamily: D.font, background: '#faf8f5', color: D.text, minHeight: '100vh', overflowX: 'hidden' }}>
      <GoogleFont fontName={D.fontName} />
      <style>{`
        * { box-sizing: border-box; }
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .cl-fade { animation: fadeUp 0.6s ease both; }
        .cl-fade-1 { animation-delay: 0.1s; }
        .cl-fade-2 { animation-delay: 0.22s; }
        .cl-fade-3 { animation-delay: 0.34s; }
        .cl-fade-4 { animation-delay: 0.46s; }
        .cl-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,0.18) !important; }
        .cl-btn { transition: transform 0.18s, box-shadow 0.18s; }
        .cl-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.10) !important; }
        .cl-card { transition: transform 0.2s, box-shadow 0.2s; }
        .float-a { animation: floatA 4s ease-in-out infinite; }
        .float-b { animation: floatB 5s ease-in-out infinite 0.8s; }
        .float-c { animation: floatA 6s ease-in-out infinite 1.6s; }
      `}</style>
      <ClassicNav  center={center} D={D} urls={urls} />
      <ClassicHero center={center} lp={lp} D={D} />
      <ClassicStats lp={lp} D={D} teachers={lp.teachers} />
      {lp.about?.enabled && lp.about?.body && <ClassicAbout about={lp.about} D={D} />}
      {lp.teachers?.length > 0 && <ClassicTeachers teachers={lp.teachers} D={D} />}
      {lp.contact?.enabled && <ClassicContact contact={lp.contact} links={lp.links} D={D} />}
      <ClassicFooter center={center} D={D} links={lp.links} />
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function ClassicNav({ center, D, urls }) {
  const scrolled    = useScrolled();
  const isMobile    = useIsMobile();
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  // Close login dropdown when clicking outside
  useEffect(() => {
    if (!loginOpen) return;
    const close = () => setLoginOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [loginOpen]);

  const navLinks = [
    { label: 'Home',     href: '#hero'     },
    { label: 'About',    href: '#about'    },
    { label: 'Teachers', href: '#teachers' },
    { label: 'Contact',  href: '#contact'  },
  ];

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.08)' : 'transparent'}`,
      boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.07)' : 'none',
      transition: 'all 0.25s ease', height: 68,
      display: 'flex', alignItems: 'center', padding: '0 5%', gap: 16,
      fontFamily: D.font,
    }}>
      {/* Logo */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {center.logo
          ? <img src={center.logo} alt={center.centerName} style={{ height: 36, objectFit: 'contain' }} />
          : <span style={{ fontSize: 20, fontWeight: 900, color: D.primary, letterSpacing: '-0.03em' }}>
              {center.centerName.split(' ')[0]}<span style={{ color: D.accent }}>.</span>
            </span>
        }
      </div>

      {/* Desktop nav links */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {navLinks.map(l => (
            <a key={l.label} href={l.href}
               style={{ fontSize: 13.5, fontWeight: 600, color: '#475569', textDecoration: 'none', padding: '6px 14px', borderRadius: 8, transition: 'color 0.15s' }}
               onMouseEnter={e => e.currentTarget.style.color = D.primary}
               onMouseLeave={e => e.currentTarget.style.color = '#475569'}>
              {l.label}
            </a>
          ))}
        </div>
      )}

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Login dropdown — desktop only */}
        {!isMobile && (
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLoginOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569', background: 'none', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: D.font, transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = D.primary}
              onMouseLeave={e => { if (!loginOpen) e.currentTarget.style.borderColor = '#e2e8f0'; }}>
              Login
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ transition: 'transform 0.2s', transform: loginOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {loginOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.12)', padding: '8px', minWidth: 200, zIndex: 300 }}>
                <a href={urls.student} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, textDecoration: 'none', color: '#0f172a', fontSize: 13.5, fontWeight: 700 }}
                   onMouseEnter={e => e.currentTarget.style.background = `${D.primary}0e`}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg,${D.primary},${D.accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                  <div>
                    <div>Student Login</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Access your classes</div>
                  </div>
                </a>
                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                <a href={urls.teacher} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10, textDecoration: 'none', color: '#475569', fontSize: 13.5, fontWeight: 600 }}
                   onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2.2} strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
                  </span>
                  <div>
                    <div>Teacher Login</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>Manage your classes</div>
                  </div>
                </a>
                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                <a href={urls.admin} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, textDecoration: 'none', color: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                   onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                   onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  Admin Login
                </a>
              </div>
            )}
          </div>
        )}

        {/* Primary CTA */}
        <a href={urls.student} className="cl-btn" style={{
          fontSize: 13, fontWeight: 700, padding: '9px 22px', borderRadius: 10,
          background: `linear-gradient(135deg,${D.primary},${adjustHex(D.primary,-25)})`,
          color: '#fff', textDecoration: 'none',
          boxShadow: `0 4px 14px ${D.primary}45`,
          display: 'inline-flex', alignItems: 'center', gap: 7,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          {isMobile ? 'Join' : 'Join as Student'}
        </a>

        {/* Mobile hamburger */}
        {isMobile && (
          <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#1e293b' }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Mobile slide-down menu */}
      {isMobile && menuOpen && (
        <div style={{ position: 'absolute', top: 68, left: 0, right: 0, background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.07)', padding: '12px 5% 20px', display: 'flex', flexDirection: 'column', gap: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          {navLinks.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
               style={{ fontSize: 14, fontWeight: 600, color: '#475569', textDecoration: 'none', padding: '10px 12px', borderRadius: 10 }}>
              {l.label}
            </a>
          ))}
          <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }} />
          <a href={urls.student} onClick={() => setMenuOpen(false)}
             style={{ fontSize: 14, fontWeight: 700, color: D.primary, textDecoration: 'none', padding: '10px 12px', borderRadius: 10 }}>
            Student Login
          </a>
          <a href={urls.teacher} onClick={() => setMenuOpen(false)}
             style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textDecoration: 'none', padding: '8px 12px', borderRadius: 10 }}>
            Teacher Login
          </a>
          <a href={urls.admin} onClick={() => setMenuOpen(false)}
             style={{ fontSize: 12, fontWeight: 500, color: '#cbd5e1', textDecoration: 'none', padding: '6px 12px', borderRadius: 10 }}>
            Admin Login
          </a>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function ClassicHero({ center, lp, D }) {
  const isMobile = useIsMobile();
  const h1  = lp.hero?.headline         || center.centerName;
  const sub = lp.hero?.subheadline      || center.description || 'Improving lives through English education.';
  const cta = lp.hero?.ctaText          || 'Start Free Trial';
  const ctaUrl  = lp.hero?.ctaUrl       || '/student/login';
  const sec     = lp.hero?.secondaryCtaText || 'How It Works';
  const secUrl  = lp.hero?.secondaryCtaUrl  || '#about';

  // Split headline: last word gets accent color
  const words   = h1.trim().split(' ');
  const lastWord = words.pop();
  const headStart = words.join(' ');

  return (
    <section id="hero" style={{
      minHeight: '100vh', paddingTop: 68,
      display: 'flex', alignItems: 'center',
      background: 'linear-gradient(135deg,#faf8f5 0%,#fef3e8 60%,#faf8f5 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{ position:'absolute', top:-120, right:-120, width:520, height:520, borderRadius:'50%', background:`${D.primary}08`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-80, left:'40%', width:300, height:300, borderRadius:'50%', background:`${D.accent}06`, pointerEvents:'none' }} />

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: isMobile ? '60px 5% 80px' : '0 5%', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 48 : 80, alignItems: 'center', width: '100%' }}>

        {/* Left: text */}
        <div>
          <div className="cl-fade cl-fade-1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${D.primary}14`, border: `1px solid ${D.primary}30`, borderRadius: 999, padding: '6px 16px', marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: D.primary, display: 'inline-block' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: D.primary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>eLearning Platform</span>
          </div>

          <h1 className="cl-fade cl-fade-2" style={{ fontSize: isMobile ? '2.2rem' : 'clamp(2rem,4vw,3.2rem)', fontWeight: 900, lineHeight: 1.13, color: '#0f172a', margin: '0 0 22px', letterSpacing: '-0.03em' }}>
            {headStart && <>{headStart}{' '}</>}
            <span style={{ color: D.primary }}>-{lastWord}</span>
          </h1>

          <p className="cl-fade cl-fade-3" style={{ fontSize: isMobile ? 15 : 16, color: '#64748b', lineHeight: 1.8, margin: '0 0 36px', maxWidth: 480 }}>
            {sub}
          </p>

          <div className="cl-fade cl-fade-4" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <a href={ctaUrl} className="cl-btn" style={{
              padding: '13px 30px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: `linear-gradient(135deg,${D.primary},${adjustHex(D.primary,-30)})`,
              color: '#fff', textDecoration: 'none',
              boxShadow: `0 8px 24px ${D.primary}45`, display: 'inline-flex', alignItems: 'center', gap: 8,
            }}>
              {cta} <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
            <a href={secUrl} className="cl-btn" style={{
              padding: '13px 26px', borderRadius: 12, fontSize: 14, fontWeight: 700,
              background: 'transparent', color: '#1e293b', textDecoration: 'none',
              border: '2px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${D.primary},${D.accent})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </span>
              {sec}
            </a>
          </div>
        </div>

        {/* Right: visual */}
        {!isMobile && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 480 }}>
            {/* Big blob */}
            <div style={{ width: 380, height: 380, borderRadius: '60% 40% 55% 45% / 50% 55% 45% 50%', background: `linear-gradient(135deg,${D.primary}22,${D.accent}18)`, position: 'absolute' }} />
            <div style={{ width: 340, height: 340, borderRadius: '50%', background: `linear-gradient(145deg,${D.primary}18,${D.primary}08)`, border: `2px dashed ${D.primary}25`, position: 'absolute' }} />

            {/* Center image or monogram */}
            {lp.about?.image
              ? <img src={lp.about.image} alt={center.centerName} style={{ width: 280, height: 340, objectFit: 'cover', borderRadius: 28, boxShadow: `0 32px 64px rgba(0,0,0,0.15)`, position: 'relative', zIndex: 1 }} />
              : (
                <div style={{ width: 200, height: 200, borderRadius: '50%', background: `linear-gradient(135deg,${D.primary},${adjustHex(D.primary,-30)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: `0 24px 56px ${D.primary}40` }}>
                  <span style={{ fontSize: 72, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em' }}>
                    {center.centerName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )
            }

            {/* Floating badge: rating */}
            <div className="float-a" style={{ position: 'absolute', top: 60, right: 20, background: '#fff', borderRadius: 16, padding: '12px 18px', boxShadow: '0 12px 32px rgba(0,0,0,0.10)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg,${D.accent},${adjustHex(D.accent,-20)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#fff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>4.9 / 5.0</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Student Rating</div>
              </div>
            </div>

            {/* Floating badge: certified */}
            <div className="float-b" style={{ position: 'absolute', bottom: 80, right: 10, background: '#fff', borderRadius: 16, padding: '12px 18px', boxShadow: '0 12px 32px rgba(0,0,0,0.10)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg,${D.primary},${adjustHex(D.primary,-30)})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>Certified</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>English Platform</div>
              </div>
            </div>

            {/* Floating badge: live classes */}
            <div className="float-c" style={{ position: 'absolute', top: 160, left: 0, background: '#fff', borderRadius: 16, padding: '10px 16px', boxShadow: '0 12px 32px rgba(0,0,0,0.10)', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 3px rgba(34,197,94,0.25)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Live Classes Available</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
function ClassicStats({ lp, D, teachers }) {
  const isMobile = useIsMobile();
  const teacherCount = teachers?.length || 0;
  const stats = [
    { value: '100%', label: 'Online Learning', icon: '🌐' },
    { value: `${teacherCount > 0 ? teacherCount + '+' : '10+'}`, label: 'Expert Teachers', icon: '👨‍🏫' },
    { value: '1-on-1', label: 'Personal Classes', icon: '🎯' },
  ];

  return (
    <section style={{ background: '#fff', padding: isMobile ? '56px 5%' : '72px 5%' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Mission text */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? 44 : 56 }}>
          <SectionLabel color={D.primary} font={D.font}>About Us</SectionLabel>
          <p style={{ fontSize: isMobile ? 17 : 22, fontWeight: 700, color: '#0f172a', margin: '20px auto 0', maxWidth: 640, lineHeight: 1.65 }}>
            We are passionate about{' '}
            <span style={{ color: D.primary }}>empowering learners</span>{' '}
            worldwide with high-quality, accessible &amp; engaging English education.
          </p>
        </div>

        {/* Stat numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: isMobile ? 20 : 32 }}>
          {stats.map((s, i) => (
            <div key={i} className="cl-card" style={{
              display: 'flex', alignItems: 'center', gap: 20, padding: '28px 32px',
              borderRadius: 20, border: `1.5px solid ${D.primary}18`,
              background: `linear-gradient(135deg,${D.primary}06,${D.accent}04)`,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: `linear-gradient(135deg,${D.primary}18,${D.primary}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: D.primary, lineHeight: 1, letterSpacing: '-0.03em' }}>{s.value}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */
function ClassicAbout({ about, D }) {
  const isMobile = useIsMobile();
  return (
    <section id="about" style={{ padding: isMobile ? '64px 5%' : '96px 5%', background: '#faf8f5' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: (!isMobile && about.image) ? '1fr 1fr' : '1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <SectionLabel color={D.primary} font={D.font}>Our Story</SectionLabel>
          <h2 style={{ fontSize: isMobile ? '1.7rem' : 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 800, color: '#0f172a', margin: '18px 0 22px', lineHeight: 1.22, letterSpacing: '-0.02em' }}>
            {about.title}
          </h2>
          <p style={{ fontSize: 15.5, color: '#64748b', lineHeight: 1.9, whiteSpace: 'pre-wrap', margin: '0 0 32px' }}>
            {about.body}
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[['✓ Expert teachers'], ['✓ Flexible schedule'], ['✓ Proven results']].map(([t]) => (
              <span key={t} style={{ fontSize: 13, fontWeight: 700, color: D.primary }}>{t}</span>
            ))}
          </div>
        </div>
        {about.image && (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: -16, borderRadius: 30, background: `linear-gradient(135deg,${D.primary}14,${D.accent}10)` }} />
            <img src={about.image} alt={about.title} style={{ width: '100%', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.12)', objectFit: 'cover', maxHeight: 440, position: 'relative' }} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Teachers ─────────────────────────────────────────────────────────────── */
function ClassicTeachers({ teachers, D }) {
  const isMobile = useIsMobile();
  const sorted = sortedTeachers(teachers);
  return (
    <section id="teachers" style={{ padding: isMobile ? '64px 5%' : '96px 5%', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel color={D.primary} font={D.font}>Our Team</SectionLabel>
          <h2 style={{ fontSize: isMobile ? '1.7rem' : 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 800, color: '#0f172a', margin: '18px 0 12px', letterSpacing: '-0.02em' }}>
            Meet the Teachers
          </h2>
          <p style={{ fontSize: 15, color: '#64748b', margin: 0 }}>Learn from our experienced English educators</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${isMobile ? '100%' : '260px'},1fr))`, gap: 24 }}>
          {sorted.map((t, i) => (
            <div key={i} className="cl-card" style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 22, padding: '28px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <TeacherAvatar teacher={t} primary={D.primary} accent={D.accent} />
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{t.name}</h3>
              {t.title && (
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: D.primary, background: `${D.primary}12`, padding: '3px 12px', borderRadius: 999, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {t.title}
                </span>
              )}
              {t.bio && <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{t.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */
function ClassicContact({ contact, links, D }) {
  const isMobile = useIsMobile();
  const socials  = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section id="contact" style={{ padding: isMobile ? '64px 5%' : '96px 5%', background: '#faf8f5' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <SectionLabel color={D.primary} font={D.font}>Contact</SectionLabel>
          <h2 style={{ fontSize: isMobile ? '1.7rem' : 'clamp(1.6rem,3vw,2.4rem)', fontWeight: 800, color: '#0f172a', margin: '18px 0 0', letterSpacing: '-0.02em' }}>
            Get in Touch
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 20, marginBottom: socials.length > 0 ? 40 : 0 }}>
          {contact.email && (
            <ContactCard icon={<EmailIcon />} label="Email Us" value={contact.email} href={`mailto:${contact.email}`} D={D} />
          )}
          {contact.phone && (
            <ContactCard icon={<PhoneIcon />} label="Call Us" value={contact.phone} href={`tel:${contact.phone}`} D={D} />
          )}
          {contact.address && (
            <ContactCard icon={<PinIcon />} label="Find Us" value={contact.address} D={D} />
          )}
        </div>

        {socials.length > 0 && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Follow Us</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {socials.map(k => {
                const Icon = SOCIAL_ICONS[k];
                return (
                  <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" className="cl-btn" style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                    borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: '#fff', color: '#1e293b', textDecoration: 'none',
                    border: '1.5px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  }}>
                    <Icon size={16} />{SOCIAL_LABELS[k]}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ContactCard({ icon, label, value, href, D }) {
  const inner = (
    <div className="cl-card" style={{ background: '#fff', border: '1.5px solid #f1f5f9', borderRadius: 20, padding: '28px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg,${D.primary}18,${D.primary}08)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: D.primary }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.5 }}>{value}</div>
    </div>
  );
  return href ? <a href={href} style={{ textDecoration: 'none' }}>{inner}</a> : inner;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function ClassicFooter({ center, D, links }) {
  return (
    <footer style={{ background: '#0f172a', color: 'rgba(255,255,255,0.55)', padding: '56px 5% 32px', fontFamily: D.font }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, justifyContent: 'space-between', marginBottom: 40 }}>
          <div style={{ maxWidth: 320 }}>
            {center.logo
              ? <img src={center.logo} alt={center.centerName} style={{ height: 36, objectFit: 'contain', marginBottom: 12, filter: 'brightness(0) invert(1)' }} />
              : <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.03em' }}>
                  {center.centerName.split(' ')[0]}<span style={{ color: D.primary }}>.</span>
                </p>
            }
            {center.description && <p style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0, maxWidth: 280 }}>{center.description}</p>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>Quick Links</p>
            {links?.studentLogin && <a href={links.studentLogin} style={fLink}>Student Login</a>}
            {links?.teacherLogin && <a href={links.teacherLogin} style={fLink}>Teacher Login</a>}
            <a href="#about"    style={fLink}>About</a>
            <a href="#contact"  style={fLink}>Contact</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12 }}>
          <span>© {new Date().getFullYear()} {center.centerName}. All rights reserved.</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>Powered by Clemify</span>
        </div>
      </div>
    </footer>
  );
}

/* ── Shared ───────────────────────────────────────────────────────────────── */
function TeacherAvatar({ teacher, primary, accent }) {
  const size = 90;
  if (teacher.photo)
    return <img src={teacher.photo} alt={teacher.name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', marginBottom: 18, border: `3px solid ${primary}30`, boxShadow: `0 8px 20px ${primary}22` }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', margin: '0 auto 18px', background: `linear-gradient(135deg,${primary},${accent})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: '#fff', boxShadow: `0 8px 20px ${primary}30` }}>
      {teacher.name.charAt(0).toUpperCase()}
    </div>
  );
}

function EmailIcon() {
  return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
}
function PhoneIcon() {
  return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.6 4.9 2 2 0 0 1 3.59 2.73h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l1.42-1.42a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function PinIcon() {
  return <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}

const fLink = { fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' };

function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}
