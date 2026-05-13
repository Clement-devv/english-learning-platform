// Modern template — split hero (text left / graphic right), colored teacher cards,
// prominent CTA band, multi-column footer.
import React, { useState, useEffect } from 'react';
import {
  resolveDesign, adjustHex, SectionLabel, useScrolled, useIsMobile,
  sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS,
} from '../utils.jsx';

export default function ModernTemplate({ center, lp }) {
  const D    = resolveDesign(lp.design);
  const urls = {
    student: lp.links?.studentLogin || '/student/login',
    teacher: lp.links?.teacherLogin || '/teacher/login',
    admin:   '/admin/login',
  };
  useDocTitle(lp.seo?.title || center.centerName);

  return (
    <div style={{ fontFamily: D.font, background: D.bg, color: D.text, minHeight: '100vh' }}>
      <ModernNav center={center} D={D} urls={urls} />
      <ModernHero center={center} lp={lp} D={D} />
      {lp.about?.enabled && lp.about?.body && <ModernAbout about={lp.about} D={D} />}
      {lp.teachers?.length > 0 && <ModernTeachers teachers={lp.teachers} D={D} />}
      <ModernCtaBand lp={lp} D={D} urls={urls} center={center} />
      {lp.contact?.enabled && <ModernContact contact={lp.contact} links={lp.links} D={D} />}
      <ModernFooter center={center} D={D} links={lp.links} />
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function ModernNav({ center, D, urls }) {
  const scrolled = useScrolled();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const navColor = D.navStyle === 'colored';
  const navDark  = D.navStyle === 'dark';

  let bg, txtColor, border;
  if (navColor)     { bg = D.primary; txtColor = '#fff';    border = 'rgba(255,255,255,0.15)'; }
  else if (navDark) { bg = '#0f172a'; txtColor = '#f1f5f9'; border = 'rgba(255,255,255,0.08)'; }
  else              { bg = scrolled ? '#ffffff' : 'rgba(255,255,255,0.93)'; txtColor = '#1e293b'; border = scrolled ? 'rgba(0,0,0,0.08)' : 'transparent'; }

  const menuBg = (navColor || navDark) ? '#0f172a' : '#fff';

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: bg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${border}`,
      boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.08)' : 'none',
      transition: 'all 0.3s ease', height: 68,
      display: 'flex', alignItems: 'center', padding: '0 5%',
      fontFamily: D.font,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {center.logo
          ? <img src={center.logo} alt={center.centerName} style={{ height: 36, objectFit: 'contain' }} />
          : <span style={{ fontSize: 19, fontWeight: 800, color: navColor ? '#fff' : D.primary, letterSpacing: '-0.02em' }}>{center.centerName}</span>
        }
      </div>

      {/* Desktop links */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href={urls.admin} style={{ fontSize: 12, fontWeight: 500, color: navColor ? 'rgba(255,255,255,0.45)' : '#94a3b8', textDecoration: 'none', padding: '6px 12px', borderRadius: 8 }}>
            Admin
          </a>
          <a href={urls.teacher} style={{ fontSize: 13, fontWeight: 600, color: navColor ? 'rgba(255,255,255,0.8)' : txtColor, textDecoration: 'none', padding: '7px 16px', borderRadius: 8, border: navColor ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)' }}>
            Teacher
          </a>
          <a href={urls.student} style={{
            fontSize: 13, fontWeight: 700, padding: '9px 22px', borderRadius: 10,
            background: `linear-gradient(135deg, ${D.primary}, ${adjustHex(D.primary, -25)})`,
            color: '#fff', textDecoration: 'none',
            boxShadow: `0 4px 16px ${D.primary}45`,
          }}>
            Student Login
          </a>
        </div>
      )}

      {/* Mobile hamburger */}
      {isMobile && (
        <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: navColor || navDark ? '#fff' : '#1e293b' }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      )}

      {/* Mobile slide-down menu */}
      {isMobile && menuOpen && (
        <div style={{ position: 'absolute', top: 68, left: 0, right: 0, background: menuBg, borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '12px 5% 20px', display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 99 }}>
          <a href={urls.student} onClick={() => setMenuOpen(false)} style={{
            fontSize: 15, fontWeight: 700, padding: '13px 16px', borderRadius: 10, textDecoration: 'none',
            background: `linear-gradient(135deg, ${D.primary}, ${adjustHex(D.primary, -25)})`,
            color: '#fff', textAlign: 'center', marginBottom: 4,
          }}>
            Student Login
          </a>
          <a href={urls.teacher} onClick={() => setMenuOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: navDark ? '#f1f5f9' : '#475569', textDecoration: 'none', padding: '10px 16px', borderRadius: 10 }}>
            Teacher Login
          </a>
          <a href={urls.admin} onClick={() => setMenuOpen(false)} style={{ fontSize: 12, fontWeight: 500, color: navDark ? 'rgba(255,255,255,0.4)' : '#94a3b8', textDecoration: 'none', padding: '8px 16px', borderRadius: 10 }}>
            Admin Login
          </a>
        </div>
      )}
    </nav>
  );
}

/* ── Hero (split layout) ──────────────────────────────────────────────────── */
function ModernHero({ center, lp, D }) {
  const isMobile = useIsMobile();
  const h1  = lp.hero?.headline    || center.centerName;
  const sub = lp.hero?.subheadline || center.description || 'Improving lives through English';
  const cta = lp.hero?.ctaText     || 'Start Learning';
  const ctaUrl  = lp.hero?.ctaUrl  || '/student/login';
  const sec     = lp.hero?.secondaryCtaText || '';
  const secUrl  = lp.hero?.secondaryCtaUrl  || '#';

  return (
    <section style={{
      minHeight: '100vh', paddingTop: 68,
      display: 'flex', alignItems: 'stretch',
      flexDirection: isMobile ? 'column' : 'row',
      overflow: 'hidden',
    }}>
      {/* Left — dark panel with text */}
      <div style={{
        flex: isMobile ? 'none' : 1,
        background: '#0f172a',
        display: 'flex', alignItems: 'center',
        padding: isMobile ? '64px 8%' : '80px 6% 80px 7%',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid pattern overlay */}
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle, ${D.primary}18 1px, transparent 1px)`, backgroundSize:'32px 32px', pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth: isMobile ? '100%' : 560 }}>
          <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:D.accent, background:`${D.accent}18`, padding:'5px 14px', borderRadius:20, marginBottom:24, border:`1px solid ${D.accent}35` }}>
            {center.centerName}
          </span>
          <h1 style={{ fontSize:'clamp(2.2rem,4.5vw,3.8rem)', fontWeight:800, lineHeight:1.1, color:'#fff', margin:'0 0 22px', letterSpacing:'-0.03em' }}>
            {h1}
          </h1>
          <p style={{ fontSize:'clamp(1rem,1.8vw,1.15rem)', color:'rgba(255,255,255,0.65)', lineHeight:1.78, margin:'0 0 40px', maxWidth:480 }}>
            {sub}
          </p>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
            <a href={ctaUrl} style={{
              padding:'13px 34px', borderRadius:11, fontSize:15, fontWeight:700,
              background:`linear-gradient(135deg,${D.accent},${adjustHex(D.accent,-20)})`,
              color:'#fff', textDecoration:'none',
              boxShadow:`0 8px 28px ${D.accent}55`,
            }}>
              {cta}
            </a>
            {sec && (
              <a href={secUrl} style={{ padding:'13px 34px', borderRadius:11, fontSize:15, fontWeight:700, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.9)', textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.2)' }}>
                {sec}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Right — primary-color panel with decorative shapes */}
      {!isMobile && (
        <div style={{
          width: '38%', minWidth: 300,
          background: `linear-gradient(145deg, ${D.primary}, ${adjustHex(D.primary, -50)})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          padding: '80px 40px',
        }}>
          {/* Decorative circles */}
          <div style={{ position:'absolute', top:-80, right:-80, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.07)' }} />
          <div style={{ position:'absolute', bottom:-60, left:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }} />
          <div style={{ position:'absolute', top:'40%', right:40, width:120, height:120, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
          {/* Floating info card */}
          <div style={{ position:'relative', background:'rgba(255,255,255,0.12)', backdropFilter:'blur(12px)', borderRadius:20, padding:'32px 28px', border:'1px solid rgba(255,255,255,0.2)', width:'100%', maxWidth:280, textAlign:'center' }}>
            {center.logo && <img src={center.logo} alt={center.centerName} style={{ height:52, objectFit:'contain', marginBottom:20, filter:'brightness(0) invert(1)' }} />}
            <p style={{ fontSize:20, fontWeight:800, color:'#fff', margin:'0 0 8px', letterSpacing:'-0.01em' }}>{center.centerName}</p>
            {center.country && <p style={{ fontSize:13, color:'rgba(255,255,255,0.7)', margin:'0 0 24px' }}>📍 {center.country}</p>}
            <a href={ctaUrl} style={{ display:'block', padding:'11px 0', background:'#fff', color:D.primary, fontWeight:700, fontSize:14, borderRadius:10, textDecoration:'none' }}>
              {cta} →
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */
function ModernAbout({ about, D }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '96px 5%', background: D.bg }}>
      <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns: (!isMobile && about.image) ? '1fr 1fr' : '1fr', gap:64, alignItems:'center' }}>
        {/* Image first on desktop */}
        {!isMobile && about.image && (
          <div style={{ position:'relative' }}>
            <img src={about.image} alt={about.title} style={{ width:'100%', borderRadius:24, objectFit:'cover', maxHeight:460, boxShadow:'0 32px 80px rgba(0,0,0,0.14)' }} />
            <div style={{ position:'absolute', bottom:-20, right:-20, width:80, height:80, borderRadius:16, background:`linear-gradient(135deg,${D.primary},${D.accent})`, boxShadow:`0 8px 24px ${D.primary}40` }} />
          </div>
        )}
        <div>
          <SectionLabel color={D.primary} font={D.font}>About Us</SectionLabel>
          <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 20px', lineHeight:1.22, letterSpacing:'-0.02em' }}>
            {about.title}
          </h2>
          <p style={{ fontSize:16, color:D.muted, lineHeight:1.85, whiteSpace:'pre-wrap', margin:'0 0 28px' }}>{about.body}</p>
          {/* Feature pills */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {['Expert Teachers','Flexible Schedule','Real Progress','Fun Learning'].map(f => (
              <span key={f} style={{ fontSize:12, fontWeight:600, padding:'6px 14px', borderRadius:20, background:`${D.primary}12`, color:D.primary, border:`1px solid ${D.primary}25` }}>{f}</span>
            ))}
          </div>
        </div>
        {/* Image after text on mobile */}
        {isMobile && about.image && (
          <img src={about.image} alt={about.title} style={{ width:'100%', borderRadius:20, objectFit:'cover', maxHeight:320 }} />
        )}
      </div>
    </section>
  );
}

/* ── Teachers ─────────────────────────────────────────────────────────────── */
function ModernTeachers({ teachers, D }) {
  const isMobile = useIsMobile();
  const sorted = sortedTeachers(teachers);
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '96px 5%', background:`${D.secondary}20` }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <SectionLabel color={D.primary} font={D.font}>Our Team</SectionLabel>
          <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 0', letterSpacing:'-0.02em' }}>Meet the Teachers</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(260px,1fr))', gap:24 }}>
          {sorted.map((t, i) => (
            <ModernTeacherCard key={i} teacher={t} D={D} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModernTeacherCard({ teacher, D, index }) {
  const colors = [D.primary, D.accent, adjustHex(D.primary, 40), adjustHex(D.accent, -20)];
  const headerColor = colors[index % colors.length];
  return (
    <div style={{ background:'#fff', borderRadius:20, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.07)', border:'1px solid rgba(0,0,0,0.06)' }}>
      {/* Colored header bar */}
      <div style={{ height:10, background:`linear-gradient(90deg, ${headerColor}, ${adjustHex(headerColor, -30)})` }} />
      <div style={{ padding:'24px 24px 28px', textAlign:'center' }}>
        {teacher.photo
          ? <img src={teacher.photo} alt={teacher.name} style={{ width:80, height:80, borderRadius:'50%', objectFit:'cover', border:`3px solid ${headerColor}35`, marginBottom:14 }} />
          : <div style={{ width:80, height:80, borderRadius:'50%', margin:'0 auto 14px', background:`linear-gradient(135deg,${headerColor}25,${headerColor}50)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color:headerColor }}>{teacher.name.charAt(0).toUpperCase()}</div>
        }
        <h3 style={{ fontSize:16, fontWeight:700, color:D.text, margin:'0 0 4px' }}>{teacher.name}</h3>
        {teacher.title && <p style={{ fontSize:11, fontWeight:700, color:headerColor, margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'0.08em' }}>{teacher.title}</p>}
        {teacher.bio   && <p style={{ fontSize:13, color:D.muted, lineHeight:1.65, margin:0 }}>{teacher.bio}</p>}
      </div>
    </div>
  );
}

/* ── CTA Band ─────────────────────────────────────────────────────────────── */
function ModernCtaBand({ lp, D, urls, center }) {
  const cta = lp.hero?.ctaText || 'Start Learning Today';
  return (
    <section style={{
      padding: '72px 5%',
      background: `linear-gradient(135deg, ${D.primary} 0%, ${adjustHex(D.primary, -50)} 100%)`,
      textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-60, right:-60, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.06)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-40, left:-40, width:180, height:180, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }} />
      <div style={{ position:'relative', maxWidth:640, margin:'0 auto' }}>
        <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:'#fff', margin:'0 0 16px', letterSpacing:'-0.02em' }}>
          Ready to start your English journey?
        </h2>
        <p style={{ fontSize:16, color:'rgba(255,255,255,0.78)', margin:'0 0 32px', lineHeight:1.7 }}>
          Join {center.centerName} and unlock your full potential.
        </p>
        <a href={urls.student} style={{
          display:'inline-block', padding:'14px 42px', borderRadius:12, fontSize:16, fontWeight:700,
          background:'#fff', color:D.primary, textDecoration:'none',
          boxShadow:'0 8px 28px rgba(0,0,0,0.2)',
        }}>
          {cta}
        </a>
      </div>
    </section>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */
function ModernContact({ contact, links, D }) {
  const isMobile = useIsMobile();
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section style={{ padding: isMobile ? '64px 6%' : '96px 5%', background: D.bg }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <SectionLabel color={D.primary} font={D.font}>Contact</SectionLabel>
          <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 0', letterSpacing:'-0.02em' }}>Get in Touch</h2>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:20, justifyContent:'center', marginBottom:32 }}>
          {contact.email   && <ContactChip icon="✉️" label={contact.email} href={`mailto:${contact.email}`} D={D} />}
          {contact.phone   && <ContactChip icon="📞" label={contact.phone} href={`tel:${contact.phone}`}    D={D} />}
          {contact.address && <ContactChip icon="📍" label={contact.address} D={D} />}
        </div>
        {socials.length > 0 && (
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            {socials.map(k => {
              const Icon = SOCIAL_ICONS[k];
              return (
                <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" style={{
                  display:'flex', alignItems:'center', gap:7, padding:'10px 20px', borderRadius:10,
                  fontSize:13, fontWeight:600, background:`${D.primary}10`,
                  color:D.primary, textDecoration:'none', border:`1px solid ${D.primary}25`,
                }}>
                  <Icon size={16} />{SOCIAL_LABELS[k]}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function ContactChip({ icon, label, href, D }) {
  const inner = (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderRadius:12, background:`${D.primary}08`, border:`1px solid ${D.primary}18`, fontSize:14, color:D.muted }}>
      <span style={{ fontSize:18 }}>{icon}</span>{label}
    </div>
  );
  return href ? <a href={href} style={{ textDecoration:'none' }}>{inner}</a> : inner;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
function ModernFooter({ center, D, links }) {
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <footer style={{ background:'#0f172a', color:'rgba(255,255,255,0.6)', padding:'56px 5% 32px', fontFamily:D.font }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:40, marginBottom:48 }}>
          {/* Brand col */}
          <div>
            {center.logo
              ? <img src={center.logo} alt={center.centerName} style={{ height:32, objectFit:'contain', marginBottom:12, filter:'brightness(0) invert(1)' }} />
              : <p style={{ fontSize:17, fontWeight:800, color:'#fff', margin:'0 0 10px' }}>{center.centerName}</p>
            }
            {center.description && <p style={{ fontSize:13, lineHeight:1.65, maxWidth:260, margin:'0 0 16px' }}>{center.description}</p>}
            <div style={{ display:'flex', gap:10 }}>
              {socials.map(k => {
                const Icon = SOCIAL_ICONS[k];
                return <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" style={{ color:'rgba(255,255,255,0.5)', transition:'color 0.15s' }}><Icon size={18} /></a>;
              })}
            </div>
          </div>
          {/* Links col */}
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 16px' }}>Portal</p>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {links?.studentLogin && <a href={links.studentLogin} style={{ color:'rgba(255,255,255,0.65)', textDecoration:'none', fontSize:14 }}>Student Login</a>}
              {links?.teacherLogin && <a href={links.teacherLogin} style={{ color:'rgba(255,255,255,0.65)', textDecoration:'none', fontSize:14 }}>Teacher Login</a>}
            </div>
          </div>
          {/* Contact col */}
          {center.phone && (
            <div>
              <p style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:'0.1em', textTransform:'uppercase', margin:'0 0 16px' }}>Contact</p>
              <p style={{ fontSize:14, margin:'0 0 8px' }}>📞 {center.phone}</p>
              {center.website && <a href={center.website} target="_blank" rel="noopener noreferrer" style={{ fontSize:14, color:'rgba(255,255,255,0.65)', textDecoration:'none' }}>🌐 Website</a>}
            </div>
          )}
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:24, display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:12, fontSize:12 }}>
          <span>© {new Date().getFullYear()} {center.centerName}. All rights reserved.</span>
          <span style={{ color:`${D.accent}cc` }}>English Learning Platform</span>
        </div>
      </div>
    </footer>
  );
}

function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}
