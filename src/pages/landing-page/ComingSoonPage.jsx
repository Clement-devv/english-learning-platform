// src/pages/landing-page/ComingSoonPage.jsx
// Shown at a center's address (school.clemify.com) while its website isn't published:
// the school's name and logo, plus the login buttons students, parents and teachers need.
import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, BookOpen } from 'lucide-react';
import { siteText } from './siteText.js';

const CSS = `
.cs { --ink:#1c1917; --ink-2:#57534e; --paper:#fbf7f0; --card:#ffffff; --rule:#e6d9c4;
  --ease:cubic-bezier(0.23,1,0.32,1);
  min-height:100svh; display:grid; place-items:center; padding:32px 16px;
  background:radial-gradient(ellipse at top, color-mix(in srgb, var(--p) 10%, var(--paper)), var(--paper) 60%);
  color:var(--ink); font-family:'Inter',system-ui,sans-serif; }
@media (prefers-color-scheme: dark) {
  .cs { --ink:#f5f5f4; --ink-2:#a8a29e; --paper:#171412; --card:#211d1a; --rule:#3a332d; }
}
.cs-card { width:100%; max-width:440px; text-align:center; background:var(--card); border:1px solid var(--rule);
  border-radius:24px; padding:40px 28px 28px; box-shadow:0 24px 60px -30px rgba(28,25,23,.35);
  animation:cs-in .6s var(--ease) both; }
@keyframes cs-in { from { opacity:0; transform:translateY(12px); } }
.cs-logo { width:72px; height:72px; margin:0 auto 18px; border-radius:20px; display:grid; place-items:center;
  background:var(--p); color:#fff; font:700 30px/1 'Playfair Display',Georgia,serif; overflow:hidden; }
.cs-logo img { width:100%; height:100%; object-fit:cover; }
.cs h1 { font:700 clamp(26px,6vw,32px)/1.15 'Playfair Display',Georgia,serif; margin:0 0 10px; }
.cs-eyebrow { display:inline-block; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
  color:var(--p); margin-bottom:10px; }
.cs p { color:var(--ink-2); font-size:15px; line-height:1.6; margin:0 0 26px; }
.cs-btns { display:grid; gap:10px; }
.cs-btn { display:flex; align-items:center; justify-content:center; gap:10px; min-height:48px; border-radius:14px;
  font-weight:600; font-size:15px; text-decoration:none; border:1px solid var(--rule); color:var(--ink);
  background:transparent; transition:transform .16s var(--ease), background .16s, border-color .16s;
  touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
.cs-btn.main { background:var(--p); border-color:var(--p); color:#fff; }
.cs-btn:active { transform:scale(.97); }
@media (hover:hover) and (pointer:fine) {
  .cs-btn:hover { border-color:var(--p); }
  .cs-btn.main:hover { filter:brightness(1.08); }
}
.cs-staff { display:inline-block; margin-top:22px; font-size:13px; color:var(--ink-2); }
.cs-staff a { color:var(--ink-2); text-underline-offset:3px; }
@media (prefers-reduced-motion: reduce) { .cs-card { animation:none; } }
`;

export default function ComingSoonPage({ center }) {
  const T = siteText(center?.language);
  const name = center?.centerName || T.ourSchool;
  const p = center?.primaryColor || '#BE185D';
  return (
    <main className="cs" style={{ '--p': p }} lang={T.lang}>
      <style>{CSS}</style>
      <div className="cs-card">
        <div className="cs-logo">
          {center?.logo ? <img src={center.logo} alt="" /> : name.trim()[0]?.toUpperCase()}
        </div>
        <span className="cs-eyebrow">{T.soon}</span>
        <h1>{name}</h1>
        <p>{T.soonText}</p>
        <div className="cs-btns">
          <Link className="cs-btn main" to="/student/login"><GraduationCap size={18} /> {T.studentLogin}</Link>
          <Link className="cs-btn" to="/parent/login"><Users size={18} /> {T.parentLogin}</Link>
          <Link className="cs-btn" to="/teacher/login"><BookOpen size={18} /> {T.teacherLogin}</Link>
        </div>
        <span className="cs-staff">{T.staff} <Link to="/admin/login">{T.adminShort}</Link></span>
      </div>
    </main>
  );
}
