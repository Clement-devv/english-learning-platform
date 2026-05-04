// Classic template — full-viewport gradient hero, centered layout, card grid teachers.
import React, { useState, useEffect } from 'react';
import {
  resolveDesign, adjustHex, SectionLabel, useScrolled, useIsMobile,
  sortedTeachers, SOCIAL_ICONS, SOCIAL_LABELS,
} from '../utils.jsx';

export default function ClassicTemplate({ center, lp }) {
  const D    = resolveDesign(lp.design);
  const urls = {
    student: lp.links?.studentLogin || '/student/login',
    teacher: lp.links?.teacherLogin || '/teacher/login',
  };
  useDocTitle(lp.seo?.title || center.centerName);

  return (
    <div style={{ fontFamily: D.font, background: D.bg, color: D.text, minHeight: '100vh' }}>
      <ClassicNav center={center} D={D} urls={urls} />
      <ClassicHero center={center} lp={lp} D={D} />
      {lp.about?.enabled && lp.about?.body && <ClassicAbout about={lp.about} D={D} />}
      {lp.teachers?.length > 0 && <ClassicTeachers teachers={lp.teachers} D={D} />}
      {lp.contact?.enabled && <ClassicContact contact={lp.contact} links={lp.links} D={D} />}
      <ClassicFooter center={center} D={D} links={lp.links} />
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────────── */
function ClassicNav({ center, D, urls }) {
  const scrolled  = useScrolled();
  const navColor  = D.navStyle === 'colored';
  const navDark   = D.navStyle === 'dark';

  let bg, txtColor, border;
  if (navColor)      { bg = D.primary; txtColor = '#fff';     border = 'rgba(255,255,255,0.15)'; }
  else if (navDark)  { bg = '#0f172a'; txtColor = '#f1f5f9';  border = 'rgba(255,255,255,0.08)'; }
  else               { bg = scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)'; txtColor = '#1e293b'; border = 'rgba(0,0,0,0.07)'; }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: bg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: `1px solid ${border}`,
      boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.09)' : 'none',
      transition: 'all 0.25s ease', height: 64,
      display: 'flex', alignItems: 'center', padding: '0 5%', gap: 16,
      fontFamily: D.font,
    }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        {center.logo
          ? <img src={center.logo} alt={center.centerName} style={{ height: 34, objectFit: 'contain' }} />
          : <span style={{ fontSize: 18, fontWeight: 800, color: navColor ? '#fff' : D.primary }}>{center.centerName}</span>
        }
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <a href={urls.teacher} style={{ fontSize: 13, fontWeight: 600, color: navColor ? 'rgba(255,255,255,0.8)' : txtColor, textDecoration: 'none', padding: '6px 14px' }}>
          Teacher Login
        </a>
        <a href={urls.student} style={{
          fontSize: 13, fontWeight: 700, padding: '8px 20px', borderRadius: 10,
          background: D.accent, color: '#fff', textDecoration: 'none',
          boxShadow: `0 4px 14px ${D.accent}50`,
        }}>
          Student Login
        </a>
      </div>
    </nav>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function ClassicHero({ center, lp, D }) {
  let heroBg;
  if (D.heroStyle === 'image' && D.heroImage)
    heroBg = `linear-gradient(rgba(0,0,0,0.52),rgba(0,0,0,0.52)), url(${D.heroImage}) center/cover no-repeat`;
  else if (D.heroStyle === 'gradient')
    heroBg = `linear-gradient(140deg, ${D.primary} 0%, ${adjustHex(D.primary, -40)} 100%)`;
  else
    heroBg = D.primary;

  const onLight  = D.heroStyle === 'image' && !D.heroImage;
  const heroText  = onLight ? D.text  : '#ffffff';
  const heroMuted = onLight ? D.muted : 'rgba(255,255,255,0.82)';

  const h1  = lp.hero?.headline        || center.centerName;
  const sub = lp.hero?.subheadline     || center.description || 'Improving lives through English';
  const cta = lp.hero?.ctaText         || 'Start Learning';
  const ctaUrl  = lp.hero?.ctaUrl      || '/student/login';
  const sec     = lp.hero?.secondaryCtaText || '';
  const secUrl  = lp.hero?.secondaryCtaUrl  || '#';

  return (
    <section style={{
      background: heroBg, minHeight: '94vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '100px 5% 80px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position:'absolute', top:-130, right:-130, width:500, height:500, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.09)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-90, left:-90, width:380, height:380, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.06)', pointerEvents:'none' }} />
      <div style={{ maxWidth: 760, position: 'relative' }}>
        <span style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color: D.accent, background:'rgba(255,255,255,0.13)', padding:'5px 14px', borderRadius:20, marginBottom:22, border:`1px solid ${D.accent}50` }}>
          {center.centerName}
        </span>
        <h1 style={{ fontSize:'clamp(2rem,5vw,3.6rem)', fontWeight:800, lineHeight:1.12, color:heroText, margin:'0 0 20px', letterSpacing:'-0.02em' }}>
          {h1}
        </h1>
        <p style={{ fontSize:'clamp(1rem,2vw,1.2rem)', color:heroMuted, lineHeight:1.75, margin:'0 auto 40px', maxWidth:600 }}>
          {sub}
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
          <a href={ctaUrl} style={{ padding:'14px 36px', borderRadius:12, fontSize:15, fontWeight:700, background:D.accent, color:'#fff', textDecoration:'none', boxShadow:`0 8px 28px ${D.accent}55`, fontFamily:D.font }}>
            {cta}
          </a>
          {sec && (
            <a href={secUrl} style={{ padding:'14px 36px', borderRadius:12, fontSize:15, fontWeight:700, background:'rgba(255,255,255,0.18)', color:heroText, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.35)', fontFamily:D.font }}>
              {sec}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── About ────────────────────────────────────────────────────────────────── */
function ClassicAbout({ about, D }) {
  const isMobile = useIsMobile();
  return (
    <section style={{ padding: '96px 5%', background: D.secondary + '25' }}>
      <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns: (!isMobile && about.image) ? '1fr 1fr' : '1fr', gap:64, alignItems:'center' }}>
        <div>
          <SectionLabel color={D.primary} font={D.font}>About</SectionLabel>
          <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 20px', lineHeight:1.22, letterSpacing:'-0.02em' }}>{about.title}</h2>
          <p style={{ fontSize:16, color:D.muted, lineHeight:1.85, whiteSpace:'pre-wrap', margin:0 }}>{about.body}</p>
        </div>
        {about.image && (
          <img src={about.image} alt={about.title} style={{ width:'100%', borderRadius:20, boxShadow:'0 24px 64px rgba(0,0,0,0.13)', objectFit:'cover', maxHeight:440 }} />
        )}
      </div>
    </section>
  );
}

/* ── Teachers ─────────────────────────────────────────────────────────────── */
function ClassicTeachers({ teachers, D }) {
  const sorted = sortedTeachers(teachers);
  return (
    <section style={{ padding:'96px 5%', background: D.bg }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <SectionLabel color={D.primary} font={D.font}>Our Team</SectionLabel>
          <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 0', letterSpacing:'-0.02em' }}>Meet the Teachers</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:28 }}>
          {sorted.map((t, i) => (
            <div key={i} style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.07)', borderRadius:18, padding:28, textAlign:'center', boxShadow:'0 4px 20px rgba(0,0,0,0.05)' }}>
              <Avatar teacher={t} size={90} primary={D.primary} accent={D.accent} />
              <h3 style={{ fontSize:17, fontWeight:700, color:D.text, margin:'0 0 4px' }}>{t.name}</h3>
              {t.title && <p style={{ fontSize:12, fontWeight:600, color:D.accent, margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'0.07em' }}>{t.title}</p>}
              {t.bio   && <p style={{ fontSize:13.5, color:D.muted, lineHeight:1.65, margin:0 }}>{t.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Contact ──────────────────────────────────────────────────────────────── */
function ClassicContact({ contact, links, D }) {
  const socials = Object.keys(SOCIAL_ICONS).filter(k => links?.[k]);
  return (
    <section style={{ padding:'96px 5%', background:`${D.primary}09` }}>
      <div style={{ maxWidth:700, margin:'0 auto', textAlign:'center', fontFamily:D.font }}>
        <SectionLabel color={D.primary} font={D.font}>Contact</SectionLabel>
        <h2 style={{ fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:800, color:D.text, margin:'14px 0 32px', letterSpacing:'-0.02em' }}>Get in Touch</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center', marginBottom:32 }}>
          {contact.email   && <a href={`mailto:${contact.email}`}    style={{ fontSize:15, color:D.muted, textDecoration:'none' }}>✉️ {contact.email}</a>}
          {contact.phone   && <a href={`tel:${contact.phone}`}       style={{ fontSize:15, color:D.muted, textDecoration:'none' }}>📞 {contact.phone}</a>}
          {contact.address && <span style={{ fontSize:15, color:D.muted }}>📍 {contact.address}</span>}
        </div>
        {socials.length > 0 && (
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            {socials.map(k => {
              const Icon = SOCIAL_ICONS[k];
              return (
                <a key={k} href={links[k]} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:10, fontSize:13, fontWeight:600, background:'#fff', color:D.text, textDecoration:'none', border:'1px solid rgba(0,0,0,0.08)', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
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

/* ── Footer ───────────────────────────────────────────────────────────────── */
function ClassicFooter({ center, D, links }) {
  return (
    <footer style={{ background:'#0f172a', color:'rgba(255,255,255,0.6)', padding:'52px 5% 32px', fontFamily:D.font }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:32, justifyContent:'space-between', marginBottom:36 }}>
          <div>
            {center.logo
              ? <img src={center.logo} alt={center.centerName} style={{ height:34, objectFit:'contain', marginBottom:10, filter:'brightness(0) invert(1)' }} />
              : <p style={{ fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>{center.centerName}</p>
            }
            {center.description && <p style={{ fontSize:13, lineHeight:1.65, maxWidth:300, margin:0 }}>{center.description}</p>}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-start' }}>
            {links?.studentLogin && <a href={links.studentLogin} style={footerLink}>Student Login</a>}
            {links?.teacherLogin && <a href={links.teacherLogin} style={footerLink}>Teacher Login</a>}
          </div>
        </div>
        <div style={{ borderTop:'1px solid rgba(255,255,255,0.08)', paddingTop:24, textAlign:'center', fontSize:12 }}>
          © {new Date().getFullYear()} {center.centerName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ── Shared pieces ────────────────────────────────────────────────────────── */
function Avatar({ teacher, size, primary, accent }) {
  if (teacher.photo) return <img src={teacher.photo} alt={teacher.name} style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', marginBottom:16, border:`3px solid ${primary}25` }} />;
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', margin:'0 auto 16px', background:`linear-gradient(135deg,${primary}25,${accent}25)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.36, fontWeight:800, color:primary }}>
      {teacher.name.charAt(0).toUpperCase()}
    </div>
  );
}

const footerLink = {
  fontSize:13, fontWeight:600, padding:'7px 14px', borderRadius:8,
  background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.75)',
  textDecoration:'none', border:'1px solid rgba(255,255,255,0.1)',
};

function useDocTitle(title) {
  useEffect(() => { if (title) document.title = title; }, [title]);
}
