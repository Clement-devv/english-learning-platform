// src/pages/teacher/login-themes/EnchantedGroveTheme.jsx
// "Enchanted Grove" — A magical forest classroom at dusk.
// Teacher at a bark chalkboard, woodland creatures as students,
// glowing owl, hanging lanterns, fireflies, mist & moonbeams.
// CSS prefix: tfl-
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useTeacherLoginLogic } from './useTeacherLoginLogic';

export default function EnchantedGroveTheme() {
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, navigate,
  } = useTeacherLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';

  if (requires2FA) {
    return (
      <div className="tfl-root">
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="tfl-root" style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : {}}>

        {/* ── LEFT — enchanted forest illustration ── */}
        <div className="tfl-left">

          {/* Moonbeams / light shafts */}
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`tfl-beam tfl-beam-${i + 1}`} />
          ))}

          {/* Fireflies */}
          {[...Array(22)].map((_, i) => (
            <span key={i} className={`tfl-firefly tfl-ff-${(i % 5) + 1}`}
              style={{
                left: `${(i * 43 + 5) % 90}%`,
                top:  `${(i * 37 + 10) % 82}%`,
                animationDelay: `${(i * 0.4) % 5}s`,
                animationDuration: `${2.2 + (i % 4) * 0.5}s`,
              }}
            />
          ))}

          {/* Falling leaves */}
          {[...Array(10)].map((_, i) => (
            <div key={i} className={`tfl-leaf tfl-leaf-${(i % 4) + 1}`}
              style={{
                left: `${(i * 23 + 5) % 90}%`,
                animationDelay: `${(i * 0.7) % 6}s`,
                animationDuration: `${6 + (i % 4)}s`,
              }}
            />
          ))}

          {/* Ground mist */}
          <div className="tfl-mist tfl-mist-1" />
          <div className="tfl-mist tfl-mist-2" />

          {/* Ground */}
          <div className="tfl-ground" />
          <div className="tfl-grass" />

          {/* Background trees */}
          <div className="tfl-bg-trees">
            <div className="tfl-btree tfl-btree-1" />
            <div className="tfl-btree tfl-btree-2" />
            <div className="tfl-btree tfl-btree-3" />
            <div className="tfl-btree tfl-btree-4" />
          </div>

          {/* ── Main scene ── */}
          <div className="tfl-scene">

            {/* Ancient Teaching Tree */}
            <div className="tfl-ancient-tree">
              {/* Roots */}
              <div className="tfl-root-l" />
              <div className="tfl-root-r" />
              <div className="tfl-root-c" />
              {/* Trunk */}
              <div className="tfl-trunk">
                <div className="tfl-rune tfl-rune-1">✦</div>
                <div className="tfl-rune tfl-rune-2">⟡</div>
              </div>
              {/* Bark chalkboard */}
              <div className="tfl-board">
                <div className="tfl-board-frame" />
                <div className="tfl-board-line tfl-bl-1" />
                <div className="tfl-board-line tfl-bl-2" />
                <div className="tfl-board-dot" />
              </div>
              {/* Branch for owl */}
              <div className="tfl-branch" />
              {/* Owl */}
              <div className="tfl-owl">
                <div className="tfl-owl-body" />
                <div className="tfl-owl-head">
                  <div className="tfl-owl-eyes">
                    <div className="tfl-owl-eye" />
                    <div className="tfl-owl-eye" />
                  </div>
                  <div className="tfl-owl-beak" />
                </div>
                <div className="tfl-owl-wings" />
              </div>
              {/* Hanging lanterns */}
              <div className="tfl-lantern-wrap tfl-lw-1">
                <div className="tfl-lstring" />
                <div className="tfl-lantern"><div className="tfl-lglow" /></div>
              </div>
              <div className="tfl-lantern-wrap tfl-lw-2">
                <div className="tfl-lstring" />
                <div className="tfl-lantern tfl-lantern-gold"><div className="tfl-lglow" /></div>
              </div>
              {/* Canopy layers */}
              <div className="tfl-canopy tfl-can-1" />
              <div className="tfl-canopy tfl-can-2" />
              <div className="tfl-canopy tfl-can-3" />
              <div className="tfl-canopy tfl-can-4" />
            </div>

            {/* Teacher character */}
            <div className="tfl-teacher">
              <div className="tfl-tch-head">
                <div className="tfl-tch-eyes">
                  <div className="tfl-tch-eye" />
                  <div className="tfl-tch-eye" />
                </div>
                <div className="tfl-tch-smile" />
                <div className="tfl-cap-brim" />
                <div className="tfl-cap-top" />
                <div className="tfl-cap-tassel" />
              </div>
              <div className="tfl-tch-body">
                <div className="tfl-tch-arm tfl-tch-arm-r">
                  <div className="tfl-pointer" />
                </div>
                <div className="tfl-tch-arm tfl-tch-arm-l" />
              </div>
              <div className="tfl-tch-legs">
                <div className="tfl-tch-leg" />
                <div className="tfl-tch-leg" />
              </div>
            </div>

            {/* Rabbit (woodland student) */}
            <div className="tfl-rabbit">
              <div className="tfl-rab-head">
                <div className="tfl-rab-ear" />
                <div className="tfl-rab-ear" />
                <div className="tfl-rab-eye" />
              </div>
              <div className="tfl-rab-body" />
            </div>

            {/* Fox (woodland student) */}
            <div className="tfl-fox">
              <div className="tfl-fox-head">
                <div className="tfl-fox-ear" />
                <div className="tfl-fox-ear tfl-fox-ear-r" />
                <div className="tfl-fox-eye" />
                <div className="tfl-fox-snout" />
              </div>
              <div className="tfl-fox-body" />
              <div className="tfl-fox-tail" />
            </div>

            {/* Glowing mushrooms */}
            <div className="tfl-shroom tfl-sh-a">
              <div className="tfl-sh-cap" /><div className="tfl-sh-stem" />
              <div className="tfl-sh-halo" />
            </div>
            <div className="tfl-shroom tfl-sh-b">
              <div className="tfl-sh-cap tfl-sh-cap-b" /><div className="tfl-sh-stem" />
              <div className="tfl-sh-halo" />
            </div>
            <div className="tfl-shroom tfl-sh-c">
              <div className="tfl-sh-cap tfl-sh-cap-c" /><div className="tfl-sh-stem" />
            </div>

            {/* Sparkle spores */}
            <span className="tfl-spore tfl-spore-1">✦</span>
            <span className="tfl-spore tfl-spore-2">✧</span>
            <span className="tfl-spore tfl-spore-3">✦</span>
            <span className="tfl-spore tfl-spore-4">⊹</span>
            <span className="tfl-spore tfl-spore-5">✦</span>
          </div>

          {/* Hero text */}
          <div className="tfl-hero-text">
            <h2 className="tfl-hero-h2">Shape Minds,<br />Grow Futures.</h2>
            <p className="tfl-hero-p">Your forest classroom awaits, Professor!</p>
            <div className="tfl-badge-row">
              <span className="tfl-badge">🦉 Wisdom shared</span>
              <span className="tfl-badge">🌱 Students grow</span>
              <span className="tfl-badge">✨ Magic happens</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div className="tfl-right">
          <div className="tfl-card">
            <div className="tfl-brand">
              {branding.logo
                ? <img src={branding.logo} alt={centerName} className="tfl-logo-img" />
                : <div className="tfl-logo-default"><span>🦉</span></div>
              }
            </div>

            <h1 className="tfl-title">{centerName}</h1>
            <p className="tfl-subtitle">Enter the Grove, Professor</p>

            {error && (
              <div className="tfl-error">
                <AlertCircle size={16} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="tfl-form">
              <div className="tfl-field">
                <label className="tfl-label"><Mail size={13} /> Email</label>
                <div className={`tfl-input-wrap${focusedField === 'email' ? ' tfl-focused' : ''}`}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="your.email@example.com" required disabled={loading} className="tfl-input" />
                </div>
              </div>

              <div className="tfl-field">
                <label className="tfl-label"><Lock size={13} /> Password</label>
                <div className={`tfl-input-wrap${focusedField === 'password' ? ' tfl-focused' : ''}`}>
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" required disabled={loading} className="tfl-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="tfl-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                <button type="button" onClick={() => navigate('/teacher/forgot-password')} className="tfl-forgot">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="tfl-submit">
                {loading
                  ? <span className="tfl-loading-row"><span className="tfl-spinner" />Signing in…</span>
                  : <span>Enter the Grove 🌿</span>
                }
              </button>
            </form>

            <p className="tfl-footer">Your account is managed by your school 🏫</p>
            <div className="tfl-dots">
              {['#16a34a', '#4ade80', '#fbbf24', '#a3e635', '#86efac'].map((c, i) => (
                <span key={i} className="tfl-dot" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .tfl-root { min-height: 100vh; display: flex; font-family: 'Nunito','Segoe UI',sans-serif; background: #010d04; overflow: hidden; }

  /* ── LEFT PANEL ── */
  .tfl-left {
    flex: 1; min-height: 100vh;
    background: linear-gradient(180deg, #010d04 0%, #031a09 20%, #052e16 45%, #0f4023 70%, #14532d 85%, #15803d 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px 32px; position: relative; overflow: hidden;
  }

  /* ── MOONBEAMS ── */
  .tfl-beam {
    position: absolute; top: 0; width: 55px; height: 100%;
    background: linear-gradient(to bottom, rgba(220,255,200,0.5), transparent 70%);
    transform-origin: top center; border-radius: 0 0 50% 50%;
    pointer-events: none;
  }
  .tfl-beam-1 { left:  4%; transform: rotate(-9deg);  opacity: .03; animation: tfl-beam 9s ease-in-out infinite; }
  .tfl-beam-2 { left: 18%; transform: rotate(-4deg);  opacity: .025; animation: tfl-beam 11s ease-in-out 1.5s infinite; width: 38px; }
  .tfl-beam-3 { left: 42%; transform: rotate(2deg);   opacity: .035; animation: tfl-beam 8s  ease-in-out 3s   infinite; }
  .tfl-beam-4 { right:18%; transform: rotate(7deg);   opacity: .028; animation: tfl-beam 10s ease-in-out 1s   infinite; width: 48px; }
  .tfl-beam-5 { right: 4%; transform: rotate(11deg);  opacity: .022; animation: tfl-beam 13s ease-in-out 2.5s infinite; width: 32px; }
  @keyframes tfl-beam { 0%,100%{opacity:.025} 50%{opacity:.06} }

  /* ── FIREFLIES ── */
  .tfl-firefly { position: absolute; border-radius: 50%; pointer-events: none; }
  .tfl-ff-1 { width:5px;height:5px; background:#fde68a; box-shadow:0 0 6px 3px #fbbf24,0 0 14px 5px rgba(251,191,36,.4); animation:tfl-ff1 ease-in-out infinite; }
  .tfl-ff-2 { width:4px;height:4px; background:#bbf7d0; box-shadow:0 0 7px 3px #4ade80,0 0 16px 6px rgba(74,222,128,.3); animation:tfl-ff2 ease-in-out infinite; }
  .tfl-ff-3 { width:3px;height:3px; background:#fef9c3; box-shadow:0 0 5px 2px #fde68a; animation:tfl-ff1 ease-in-out infinite reverse; }
  .tfl-ff-4 { width:4px;height:4px; background:#a3e635; box-shadow:0 0 7px 3px rgba(163,230,53,.5); animation:tfl-ff2 ease-in-out infinite reverse; }
  .tfl-ff-5 { width:6px;height:6px; background:#fbbf24; box-shadow:0 0 10px 4px rgba(251,191,36,.45); animation:tfl-ff3 ease-in-out infinite; }
  @keyframes tfl-ff1 { 0%,100%{opacity:0;transform:translate(0,0)} 30%{opacity:1} 50%{opacity:.85;transform:translate(10px,-15px)} 70%{opacity:1} }
  @keyframes tfl-ff2 { 0%,100%{opacity:0;transform:translate(0,0)} 25%{opacity:1} 55%{opacity:.9;transform:translate(-9px,-13px)} 75%{opacity:.7} }
  @keyframes tfl-ff3 { 0%,100%{opacity:0;transform:translate(0,0) scale(.8)} 50%{opacity:1;transform:translate(7px,-19px) scale(1.25)} }

  /* ── FALLING LEAVES ── */
  .tfl-leaf { position: absolute; top: -20px; pointer-events: none; border-radius: 50% 0 50% 0; animation: tfl-leaf-fall linear infinite; }
  .tfl-leaf-1 { width:10px;height:8px; background:#4ade80; box-shadow:0 0 4px rgba(74,222,128,.3); }
  .tfl-leaf-2 { width:8px; height:6px; background:#86efac; }
  .tfl-leaf-3 { width:9px; height:7px; background:#fbbf24; border-radius:0 50% 0 50%; }
  .tfl-leaf-4 { width:9px; height:7px; background:#a3e635; }
  @keyframes tfl-leaf-fall { 0%{transform:translateY(-20px) rotate(0);opacity:0} 10%{opacity:.9} 90%{opacity:.7} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }

  /* ── MIST ── */
  .tfl-mist { position:absolute; bottom:0; left:-20%; width:140%; pointer-events:none; border-radius:50%; animation:tfl-mist-drift ease-in-out infinite; }
  .tfl-mist-1 { height:70px; background:radial-gradient(ellipse at center,rgba(187,247,208,.07) 0%,transparent 70%); animation-duration:13s; }
  .tfl-mist-2 { height:45px; background:radial-gradient(ellipse at center,rgba(74,222,128,.04) 0%,transparent 70%); bottom:12px; animation-duration:9s; animation-delay:3s; }
  @keyframes tfl-mist-drift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4%)} }

  /* ── GROUND ── */
  .tfl-ground { position:absolute; bottom:0; left:0; right:0; height:58px; background:linear-gradient(to top,#0a2a10,#14532d); }
  .tfl-grass  { position:absolute; bottom:53px; left:0; right:0; height:10px; background:repeating-linear-gradient(90deg,#4ade80 0 5px,transparent 5px 10px); opacity:.3; }

  /* ── BACKGROUND TREES ── */
  .tfl-bg-trees { position:absolute; bottom:52px; left:0; right:0; height:220px; pointer-events:none; }
  .tfl-btree { position:absolute; bottom:0; }
  .tfl-btree::before { content:''; position:absolute; bottom:0; left:50%; transform:translateX(-50%); background:#3d2007; border-radius:3px; }
  .tfl-btree::after  { content:''; position:absolute; left:50%; transform:translateX(-50%); border-left:solid transparent; border-right:solid transparent; border-bottom:solid; }
  .tfl-btree-1 { left:2%;  opacity:.28; } .tfl-btree-1::before{width:8px;height:42px} .tfl-btree-1::after{bottom:38px;border-left-width:24px;border-right-width:24px;border-bottom-width:72px;border-bottom-color:#0d3318}
  .tfl-btree-2 { left:11%; opacity:.38; } .tfl-btree-2::before{width:6px;height:32px} .tfl-btree-2::after{bottom:28px;border-left-width:18px;border-right-width:18px;border-bottom-width:58px;border-bottom-color:#0f3d1e}
  .tfl-btree-3 { right:7%; opacity:.32; } .tfl-btree-3::before{width:7px;height:38px} .tfl-btree-3::after{bottom:33px;border-left-width:21px;border-right-width:21px;border-bottom-width:66px;border-bottom-color:#0d3318}
  .tfl-btree-4 { right:17%;opacity:.22; } .tfl-btree-4::before{width:5px;height:26px} .tfl-btree-4::after{bottom:23px;border-left-width:14px;border-right-width:14px;border-bottom-width:50px;border-bottom-color:#0b2e15}

  /* ── SCENE ── */
  .tfl-scene { position:relative; width:340px; height:315px; margin-bottom:18px; }

  /* ── ANCIENT TEACHING TREE ── */
  .tfl-ancient-tree { position:absolute; bottom:0; left:52%; transform:translateX(-50%); }

  /* Roots */
  .tfl-root-l { position:absolute; bottom:-4px; left:-20px; width:22px; height:14px; background:#4a2106; border-radius:50% 0 50% 50%; transform:rotate(-18deg); }
  .tfl-root-r { position:absolute; bottom:-4px; right:-16px; width:18px; height:12px; background:#4a2106; border-radius:0 50% 50% 50%; transform:rotate(18deg); }
  .tfl-root-c { position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); width:32px; height:10px; background:#3d1a04; border-radius:50%; }

  /* Trunk */
  .tfl-trunk {
    width:30px; height:135px;
    background:linear-gradient(to right,#4a2106,#6b3a14,#3d1a04);
    border-radius:5px; position:relative; margin:0 auto;
  }
  .tfl-trunk::before { content:''; position:absolute; top:14px; left:7px; width:8px; height:42px; background:rgba(255,255,255,.06); border-radius:4px; }
  .tfl-trunk::after  { content:''; position:absolute; top:64px; left:4px; width:5px; height:26px; background:rgba(255,255,255,.04); border-radius:3px; }

  /* Glowing runes */
  .tfl-rune { position:absolute; color:#4ade80; font-size:10px; text-shadow:0 0 8px #4ade80; animation:tfl-rune-pulse 3.5s ease-in-out infinite; pointer-events:none; }
  .tfl-rune-1 { top:28px; left:8px; }
  .tfl-rune-2 { top:66px; left:10px; font-size:9px; animation-delay:1.8s; }
  @keyframes tfl-rune-pulse { 0%,100%{opacity:.2;text-shadow:0 0 4px #4ade80} 50%{opacity:1;text-shadow:0 0 14px #4ade80,0 0 28px rgba(74,222,128,.5)} }

  /* Bark chalkboard */
  .tfl-board {
    position:absolute; top:18px; right:-62px; width:56px; height:44px;
    background:#0c2a10; border:2px solid #2a6334; border-radius:5px;
    box-shadow:0 0 12px rgba(74,222,128,.15);
  }
  .tfl-board-frame { position:absolute; inset:3px; background:#08200d; border-radius:3px; }
  .tfl-board-line  { position:absolute; height:2px; background:rgba(187,247,208,.35); border-radius:1px; }
  .tfl-bl-1 { top:10px; left:5px; right:5px; }
  .tfl-bl-2 { top:20px; left:5px; right:14px; }
  .tfl-board-dot { position:absolute; top:27px; left:7px; width:4px; height:4px; background:rgba(74,222,128,.55); border-radius:50%; }

  /* Branch */
  .tfl-branch {
    position:absolute; top:22px; left:50%; width:58px; height:8px;
    background:linear-gradient(to right,#6b3a14,#4a2106);
    border-radius:4px; transform-origin:left center; transform:rotate(-14deg);
  }
  .tfl-branch::after { content:''; position:absolute; right:-3px; top:-13px; width:6px; height:21px; background:#4a2106; border-radius:3px; transform:rotate(26deg); }

  /* Owl */
  .tfl-owl { position:absolute; top:-10px; left:62px; display:flex; flex-direction:column; align-items:center; animation:tfl-owl-bob 4.5s ease-in-out infinite; }
  @keyframes tfl-owl-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  .tfl-owl-body { width:19px; height:21px; background:linear-gradient(160deg,#78350f,#92400e); border-radius:40% 40% 50% 50%; }
  .tfl-owl-head  { width:19px; height:17px; background:linear-gradient(160deg,#92400e,#b45309); border-radius:50%; position:relative; display:flex; justify-content:center; align-items:center; margin-bottom:-2px; }
  .tfl-owl-eyes  { display:flex; gap:4px; margin-top:3px; }
  .tfl-owl-eye   { width:5px; height:5px; background:#fef9c3; border-radius:50%; border:1.5px solid #3d1c02; position:relative; }
  .tfl-owl-eye::after { content:''; position:absolute; top:1px; left:1px; width:2px; height:2px; background:#0f172a; border-radius:50%; }
  .tfl-owl-beak  { position:absolute; bottom:2px; left:50%; transform:translateX(-50%); width:6px; height:4px; background:#fbbf24; border-radius:0 0 50% 50%; }
  .tfl-owl-wings { position:absolute; width:23px; height:13px; background:linear-gradient(160deg,#92400e,#78350f); border-radius:50%; top:4px; left:-2px; z-index:-1; }

  /* Lanterns */
  .tfl-lantern-wrap { position:absolute; display:flex; flex-direction:column; align-items:center; }
  .tfl-lw-1 { top:-58px; left:28%; }
  .tfl-lw-2 { top:-53px; left:64%; }
  .tfl-lstring  { width:1.5px; height:26px; background:rgba(255,255,255,.32); }
  .tfl-lantern  { width:14px; height:18px; background:linear-gradient(135deg,#fef08a,#fbbf24); border-radius:3px; box-shadow:0 0 16px 6px rgba(251,191,36,.5); animation:tfl-swing 3.5s ease-in-out infinite; transform-origin:top center; }
  .tfl-lantern-gold { background:linear-gradient(135deg,#fde68a,#f97316); box-shadow:0 0 16px 6px rgba(249,115,22,.45); animation-delay:1.8s; }
  .tfl-lglow { position:absolute; inset:3px; background:rgba(255,255,255,.55); border-radius:1px; animation:tfl-lglow 2s ease-in-out infinite; }
  @keyframes tfl-swing { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(6deg)} }
  @keyframes tfl-lglow  { 0%,100%{opacity:.9} 45%{opacity:.45} 70%{opacity:.75} }

  /* Canopy */
  .tfl-canopy { position:absolute; left:50%; transform:translateX(-50%); border-radius:50%; }
  .tfl-can-1 { width:138px; height:95px;  background:#0d3d1e; bottom:125px; box-shadow:0 14px 30px rgba(0,0,0,.45); }
  .tfl-can-2 { width:116px; height:90px;  background:#0f4a24; bottom:145px; }
  .tfl-can-3 { width:94px;  height:84px;  background:#14532d; bottom:165px; }
  .tfl-can-4 { width:74px;  height:68px;  background:#16a34a; bottom:184px; box-shadow:0 -6px 20px rgba(22,163,74,.35); animation:tfl-canopy-breathe 4.5s ease-in-out infinite; }
  @keyframes tfl-canopy-breathe { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.04)} }

  /* ── TEACHER ── */
  .tfl-teacher { position:absolute; bottom:0; left:10%; display:flex; flex-direction:column; align-items:center; animation:tfl-teacher-bob 3.2s ease-in-out infinite; }
  @keyframes tfl-teacher-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }

  .tfl-tch-head {
    width:27px; height:27px;
    background:linear-gradient(135deg,#fde68a,#fbbf24);
    border-radius:50%; position:relative; display:flex; align-items:center; justify-content:center; margin-bottom:-2px;
  }
  .tfl-tch-eyes { display:flex; gap:6px; margin-top:5px; }
  .tfl-tch-eye  { width:4px; height:5px; background:#1e293b; border-radius:50%; }
  .tfl-tch-smile { position:absolute; bottom:5px; left:50%; transform:translateX(-50%); width:11px; height:5px; border-bottom:2px solid #92400e; border-radius:0 0 50% 50%; }

  /* Graduation cap */
  .tfl-cap-brim   { position:absolute; top:-4px; left:-6px; right:-6px; height:4px; background:#1e1b4b; border-radius:2px; }
  .tfl-cap-top    { position:absolute; top:-13px; left:50%; transform:translateX(-50%); width:19px; height:10px; background:#312e81; border-radius:2px 2px 0 0; }
  .tfl-cap-tassel { position:absolute; top:-13px; right:-3px; width:2px; height:17px; background:linear-gradient(to bottom,#fbbf24,#f97316); border-radius:1px; transform-origin:top center; animation:tfl-tassel 2.2s ease-in-out infinite; }
  @keyframes tfl-tassel { 0%,100%{transform:rotate(-12deg)} 50%{transform:rotate(12deg)} }

  .tfl-tch-body {
    width:31px; height:40px;
    background:linear-gradient(160deg,#166534,#14532d);
    border-radius:6px 6px 3px 3px; position:relative;
  }
  .tfl-tch-body::after { content:''; position:absolute; top:9px; left:50%; transform:translateX(-50%); width:10px; height:2px; background:rgba(255,255,255,.35); border-radius:1px; box-shadow:0 6px 0 rgba(255,255,255,.25); }

  .tfl-tch-arm { position:absolute; height:7px; background:#15803d; border-radius:3px; }
  .tfl-tch-arm-r { width:26px; top:12px; right:-22px; transform:rotate(-28deg); transform-origin:left center; }
  .tfl-tch-arm-l { width:22px; top:18px; left:-18px; transform:rotate(16deg); transform-origin:right center; }

  .tfl-pointer { position:absolute; right:-20px; top:-1px; width:22px; height:2px; background:linear-gradient(to right,#fbbf24,#f97316); border-radius:1px; }
  .tfl-pointer::after { content:''; position:absolute; right:0; top:-2px; width:3px; height:6px; background:#f97316; border-radius:1px; }

  .tfl-tch-legs { display:flex; gap:5px; }
  .tfl-tch-leg  { width:8px; height:18px; background:#1d4ed8; border-radius:2px; }

  /* ── RABBIT ── */
  .tfl-rabbit { position:absolute; bottom:0; right:20%; display:flex; flex-direction:column; align-items:center; animation:tfl-sit-bob 3.8s ease-in-out infinite; }
  @keyframes tfl-sit-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }

  .tfl-rab-head { width:13px; height:12px; background:#e2e8f0; border-radius:50%; position:relative; display:flex; justify-content:center; margin-bottom:-2px; }
  .tfl-rab-ear  { position:absolute; top:-10px; width:4px; height:10px; background:#fca5a5; border-radius:2px; }
  .tfl-rab-ear:first-child { left:1px; transform:rotate(-10deg); }
  .tfl-rab-ear:last-child  { right:1px; transform:rotate(10deg); }
  .tfl-rab-eye  { width:3px; height:3px; background:#1e293b; border-radius:50%; margin-top:5px; }
  .tfl-rab-body { width:15px; height:17px; background:#e2e8f0; border-radius:50% 50% 40% 40%; }

  /* ── FOX ── */
  .tfl-fox { position:absolute; bottom:0; right:9%; display:flex; flex-direction:column; align-items:center; animation:tfl-sit-bob 4.2s ease-in-out .6s infinite; }
  .tfl-fox-head { width:15px; height:14px; background:#f97316; border-radius:50%; position:relative; display:flex; justify-content:center; margin-bottom:-2px; }
  .tfl-fox-ear  { position:absolute; top:-7px; left:0; width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:8px solid #f97316; }
  .tfl-fox-ear-r { left:auto; right:0; }
  .tfl-fox-eye  { width:3px; height:3px; background:#1e293b; border-radius:50%; margin-top:4px; }
  .tfl-fox-snout { position:absolute; bottom:1px; left:50%; transform:translateX(-50%); width:5px; height:3px; background:#fde68a; border-radius:50%; }
  .tfl-fox-body  { width:16px; height:18px; background:#f97316; border-radius:50% 50% 40% 40%; position:relative; }
  .tfl-fox-tail  { width:13px; height:8px; background:linear-gradient(135deg,#f97316,#fde68a); border-radius:50% 0 0 50%; position:absolute; right:-11px; bottom:4px; transform:rotate(-18deg); }

  /* ── MUSHROOMS ── */
  .tfl-shroom { position:absolute; bottom:0; display:flex; flex-direction:column; align-items:center; }
  .tfl-sh-a { left:4%;  }
  .tfl-sh-b { left:9%;  transform:scale(.68); animation:tfl-sh-glow 2.5s ease-in-out .5s infinite; }
  .tfl-sh-c { right:27%;transform:scale(.6); }

  .tfl-sh-cap { width:25px; height:17px; background:radial-gradient(circle at 38% 28%,#fca5a5,#ef4444,#b91c1c); border-radius:50% 50% 0 0; position:relative; }
  .tfl-sh-cap::after { content:''; position:absolute; top:3px; left:3px; width:7px; height:5px; background:rgba(255,255,255,.42); border-radius:50%; }
  .tfl-sh-cap-b { background:radial-gradient(circle at 38% 28%,#a5b4fc,#6366f1,#3730a3); }
  .tfl-sh-cap-c { background:radial-gradient(circle at 38% 28%,#fde68a,#fbbf24,#d97706); }
  .tfl-sh-stem { width:9px; height:14px; background:#fef9c3; border-radius:0 0 3px 3px; }
  .tfl-sh-halo { position:absolute; bottom:10px; width:32px; height:13px; background:rgba(74,222,128,.14); border-radius:50%; animation:tfl-sh-glow 2.2s ease-in-out infinite; }
  @keyframes tfl-sh-glow { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:1;transform:scale(1.25)} }

  /* ── SPARKLE SPORES ── */
  .tfl-spore { position:absolute; pointer-events:none; animation:tfl-spore ease-in-out infinite; }
  .tfl-spore-1 { color:#4ade80; font-size:14px; top:14%; left:7%;  animation-duration:2.3s; }
  .tfl-spore-2 { color:#fbbf24; font-size:18px; top:54%; left:80%; animation-duration:2.9s; animation-delay:.9s; }
  .tfl-spore-3 { color:#4ade80; font-size:12px; top:24%; left:84%; animation-duration:2.1s; animation-delay:1.7s; }
  .tfl-spore-4 { color:#a3e635; font-size:20px; top:72%; left:14%; animation-duration:3.1s; animation-delay:1.1s; }
  .tfl-spore-5 { color:#fde68a; font-size:10px; top:42%; left:56%; animation-duration:2.6s; animation-delay:2.1s; }
  @keyframes tfl-spore { 0%,100%{opacity:.12;transform:scale(.65) rotate(0)} 50%{opacity:1;transform:scale(1.45) rotate(22deg)} }

  /* ── HERO TEXT ── */
  .tfl-hero-text { text-align:center; color:white; position:relative; z-index:2; }
  .tfl-hero-h2 { font-size:clamp(30px,4.5vw,46px); font-weight:900; line-height:1.15; margin:0 0 12px; letter-spacing:-1px; background:linear-gradient(135deg,#fff 0%,#bbf7d0 45%,#fde68a 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .tfl-hero-p { font-size:14px; color:rgba(255,255,255,.72); margin:0 0 22px; font-weight:600; }
  .tfl-badge-row { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
  .tfl-badge { background:rgba(255,255,255,.09); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,.16); color:white; font-size:12px; font-weight:700; padding:6px 14px; border-radius:100px; }

  /* ── RIGHT PANEL ── */
  .tfl-right { width:440px; min-height:100vh; background:#f0fdf4; display:flex; align-items:center; justify-content:center; padding:40px 32px; position:relative; flex-shrink:0; }
  .tfl-right::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg,rgba(22,163,74,.07) 0%,rgba(74,222,128,.04) 100%); pointer-events:none; }

  .tfl-card { width:100%; max-width:360px; display:flex; flex-direction:column; gap:6px; animation:tfl-rise .55s cubic-bezier(.16,1,.3,1) both; }
  @keyframes tfl-rise { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

  .tfl-brand { display:flex; justify-content:center; margin-bottom:6px; animation:tfl-pop .7s cubic-bezier(.34,1.56,.64,1) .2s both; }
  @keyframes tfl-pop { from{opacity:0;transform:scale(.35)} to{opacity:1;transform:scale(1)} }
  .tfl-logo-img { height:56px; max-width:160px; object-fit:contain; }
  .tfl-logo-default { width:72px; height:72px; border-radius:20px; background:linear-gradient(135deg,#166534,#14532d); display:flex; align-items:center; justify-content:center; font-size:36px; box-shadow:0 8px 24px rgba(22,163,74,.4); }

  .tfl-title    { font-size:26px; font-weight:900; color:#14532d; margin:4px 0 2px; text-align:center; letter-spacing:-.5px; }
  .tfl-subtitle { font-size:14px; color:#475569; text-align:center; margin:0 0 18px; font-weight:600; }

  .tfl-error { display:flex; align-items:center; gap:10px; background:#fef2f2; border:2px solid #fecaca; border-radius:14px; padding:11px 14px; color:#dc2626; font-size:13.5px; font-weight:700; margin-bottom:8px; animation:tfl-shake .45s ease both; }
  @keyframes tfl-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }

  .tfl-form  { display:flex; flex-direction:column; gap:16px; margin-top:4px; }
  .tfl-field { display:flex; flex-direction:column; gap:7px; }
  .tfl-label { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.06em; }
  .tfl-input-wrap { display:flex; align-items:center; height:52px; padding:0 16px; background:white; border:2.5px solid #bbf7d0; border-radius:16px; transition:border-color .2s,box-shadow .2s; }
  .tfl-input-wrap.tfl-focused { border-color:#16a34a; background:#f0fdf4; box-shadow:0 0 0 4px rgba(22,163,74,.12); }
  .tfl-input { flex:1; border:none; outline:none; background:transparent; font-size:15px; color:#14532d; font-family:inherit; font-weight:600; }
  .tfl-eye-btn { background:none; border:none; cursor:pointer; color:#94a3b8; padding:0; display:flex; align-items:center; }
  .tfl-eye-btn:hover { color:#16a34a; }
  .tfl-forgot { background:none; border:none; cursor:pointer; font-size:13px; color:#16a34a; font-weight:700; font-family:inherit; padding:0; }

  .tfl-submit {
    width:100%; height:56px;
    background:linear-gradient(135deg,#052e16 0%,#14532d 35%,#16a34a 65%,#4ade80 100%);
    background-size:200% 200%; color:white; border:none; border-radius:18px;
    font-size:17px; font-weight:800; cursor:pointer; font-family:inherit; margin-top:4px;
    box-shadow:0 6px 22px rgba(22,163,74,.42); transition:transform .15s,box-shadow .15s;
    animation:tfl-shimmer 5s ease-in-out infinite;
  }
  @keyframes tfl-shimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  .tfl-submit:hover:not(:disabled) { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(22,163,74,.52); }
  .tfl-submit:active:not(:disabled) { transform:translateY(0) scale(.98); }
  .tfl-submit:disabled { opacity:.7; cursor:not-allowed; }

  .tfl-loading-row { display:flex; align-items:center; gap:10px; justify-content:center; }
  .tfl-spinner { display:inline-block; width:20px; height:20px; border:3px solid rgba(255,255,255,.35); border-top-color:white; border-radius:50%; animation:tfl-spin .7s linear infinite; }
  @keyframes tfl-spin { to{transform:rotate(360deg)} }

  .tfl-footer { text-align:center; font-size:12px; color:#94a3b8; margin:14px 0 6px; font-weight:600; }
  .tfl-dots { display:flex; justify-content:center; gap:8px; margin-top:4px; }
  .tfl-dot  { width:10px; height:10px; border-radius:50%; display:inline-block; animation:tfl-db 1.4s ease-in-out infinite; }
  .tfl-dot:nth-child(1){animation-delay:0s} .tfl-dot:nth-child(2){animation-delay:.15s} .tfl-dot:nth-child(3){animation-delay:.3s} .tfl-dot:nth-child(4){animation-delay:.45s} .tfl-dot:nth-child(5){animation-delay:.6s}
  @keyframes tfl-db { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.65)} }

  @media (max-width:900px) { .tfl-root{flex-direction:column} .tfl-left{min-height:auto;padding:40px 24px 32px} .tfl-right{width:100%;min-height:auto;padding:32px 24px 48px} }
  @media (max-width:480px) { .tfl-scene{display:none} .tfl-hero-h2{font-size:28px} }
`;
