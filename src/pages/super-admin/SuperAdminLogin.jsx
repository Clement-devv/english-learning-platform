// src/pages/super-admin/SuperAdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Crown, ArrowRight, Mail } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

export default function SuperAdminLogin() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [focused,      setFocused]      = useState(null);
  const [mounted,      setMounted]      = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/super-admin/login', {
        email: email.trim(),
        password,
      });
      if (response.data.success) {
        localStorage.setItem('superAdminToken', response.data.token);
        localStorage.setItem('superAdminInfo', JSON.stringify(response.data.superAdmin));
        login('super-admin', response.data.superAdmin, response.data.token);
        navigate('/super-admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={s.root}>

        {/* Animated background grid */}
        <div style={s.grid} />

        {/* Glow orbs */}
        <div style={{ ...s.orb, ...s.orb1 }} className="sa-orb" />
        <div style={{ ...s.orb, ...s.orb2 }} className="sa-orb sa-orb2" />

        {/* Scanlines */}
        <div style={s.scanlines} />

        {/* Main card */}
        <div
          style={{
            ...s.card,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)',
          }}
          className="sa-card"
        >
          {/* Top accent bar — gold gradient for super admin distinction */}
          <div style={s.accentBar} />

          {/* Crown icon + title */}
          <div style={s.topSection}>
            <div style={s.crownWrap} className="sa-crown">
              <Crown size={32} color="#f59e0b" strokeWidth={1.5} />
            </div>
            <div>
              <p style={s.systemLabel}>MASTER CONTROL</p>
              <h1 style={s.title}>Super Admin</h1>
              <p style={s.subtitle}>Platform-wide access</p>
            </div>
          </div>

          <div style={s.divider} />

          {/* Error */}
          {error && (
            <div style={s.errorBox} className="sa-error">
              <AlertCircle size={15} color="#f87171" />
              <span style={s.errorText}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} style={s.form}>

            {/* Email */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Email Address</label>
              <div style={{ ...s.inputWrap, ...(focused === 'email' ? s.inputFocused : {}) }}>
                <Mail size={16} color={focused === 'email' ? '#f59e0b' : '#374151'} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="superadmin@example.com"
                  required
                  disabled={loading}
                  style={s.input}
                />
              </div>
            </div>

            {/* Password */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Password</label>
              <div style={{ ...s.inputWrap, ...(focused === 'pass' ? s.inputFocused : {}) }}>
                <Lock size={16} color={focused === 'pass' ? '#f59e0b' : '#374151'} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••••••"
                  required
                  disabled={loading}
                  style={s.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={s.eyeBtn}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={s.submitBtn}
              className="sa-submit"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <span className="sa-spinner" />
                  Authenticating…
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Access Platform
                  <ArrowRight size={17} />
                </span>
              )}
            </button>
          </form>

          {/* Security badge */}
          <div style={s.securityBadge}>
            <div style={s.dot} className="sa-dot" />
            <span style={s.secText}>Platform master access · All centers visible</span>
          </div>

          {/* Warning */}
          <div style={s.warning}>
            <AlertCircle size={12} color="#854d0e" />
            <span style={s.warnText}>
              This portal grants platform-wide control. All actions are logged.
            </span>
          </div>
        </div>

        <p style={s.version}>EduLearn SuperAdmin · {new Date().getFullYear()}</p>
      </div>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh',
    background: '#09080e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Sora', 'Segoe UI', sans-serif",
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(245,158,11,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,158,11,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '52px 52px',
    pointerEvents: 'none',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
    pointerEvents: 'none',
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    pointerEvents: 'none',
  },
  orb1: {
    width: '500px', height: '500px',
    background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
    top: '-150px', right: '-100px',
  },
  orb2: {
    width: '400px', height: '400px',
    background: 'radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 70%)',
    bottom: '-100px', left: '-100px',
  },
  card: {
    position: 'relative',
    zIndex: 10,
    background: 'linear-gradient(160deg, #110f1a 0%, #0d0b15 100%)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,158,11,0.06) inset',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    overflow: 'hidden',
  },
  accentBar: {
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #f59e0b, #fbbf24, transparent)',
  },
  topSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '28px 28px 20px',
  },
  crownWrap: {
    width: '60px', height: '60px',
    background: 'linear-gradient(135deg, #1c1400, #2a1f00)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: '16px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 20px rgba(245,158,11,0.2)',
  },
  systemLabel: {
    margin: '0 0 2px',
    fontSize: '10px', fontWeight: '700',
    letterSpacing: '0.2em', color: '#f59e0b',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 2px',
    fontSize: '26px', fontWeight: '700',
    color: '#f1f5f9', letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: 0,
    fontSize: '12.5px', color: '#374151', fontWeight: '400',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.12), transparent)',
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    padding: '11px 14px',
    margin: '20px 28px 0',
  },
  errorText: { color: '#f87171', fontSize: '13px', fontWeight: '500' },
  form: {
    display: 'flex', flexDirection: 'column', gap: '18px',
    padding: '24px 28px 0',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: {
    fontSize: '11.5px', fontWeight: '600',
    color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '0 14px', height: '50px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  },
  inputFocused: {
    border: '1px solid rgba(245,158,11,0.5)',
    boxShadow: '0 0 0 3px rgba(245,158,11,0.08)',
    background: 'rgba(245,158,11,0.03)',
  },
  input: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    fontSize: '14.5px', color: '#e2e8f0',
    fontFamily: 'inherit', fontWeight: '400',
  },
  eyeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#374151', padding: 0,
    display: 'flex', alignItems: 'center',
    transition: 'color 0.2s',
  },
  submitBtn: {
    width: '100%', height: '52px',
    background: 'linear-gradient(135deg, #b45309, #f59e0b)',
    color: '#0c0a00',
    border: 'none', borderRadius: '12px',
    fontSize: '15px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
    marginTop: '4px', letterSpacing: '0.01em',
    boxShadow: '0 6px 24px rgba(245,158,11,0.3)',
    transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
  },
  securityBadge: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '8px', margin: '20px 28px 0',
  },
  dot: {
    width: '7px', height: '7px',
    borderRadius: '50%', background: '#f59e0b', flexShrink: 0,
  },
  secText: { fontSize: '11.5px', color: '#374151', fontWeight: '500', letterSpacing: '0.01em' },
  warning: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    background: 'rgba(120,53,15,0.15)',
    border: '1px solid rgba(120,53,15,0.3)',
    borderRadius: '0 0 20px 20px',
    padding: '12px 20px', margin: '20px 0 0',
  },
  warnText: { fontSize: '11px', color: '#92400e', lineHeight: '1.5' },
  version: {
    position: 'relative', zIndex: 10,
    fontSize: '11px', color: '#1f2937',
    marginTop: '20px', letterSpacing: '0.05em',
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  input::placeholder { color: #1f2937; }

  .sa-card { animation: sa-rise 0.65s cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes sa-rise {
    from { opacity: 0; transform: translateY(28px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .sa-orb  { animation: sa-drift1 12s ease-in-out infinite alternate; }
  .sa-orb2 { animation: sa-drift2 10s ease-in-out infinite alternate; }
  @keyframes sa-drift1 { from { transform: translate(0,0); } to { transform: translate(30px, 20px); } }
  @keyframes sa-drift2 { from { transform: translate(0,0); } to { transform: translate(-20px, 30px); } }

  .sa-crown { animation: sa-crown-glow 3s ease-in-out infinite; }
  @keyframes sa-crown-glow {
    0%,100% { box-shadow: 0 4px 20px rgba(245,158,11,0.2); }
    50%      { box-shadow: 0 4px 32px rgba(245,158,11,0.45); }
  }

  .sa-dot { animation: sa-dot-pulse 2s ease-in-out infinite; }
  @keyframes sa-dot-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
    50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
  }

  .sa-submit:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(245,158,11,0.4) !important;
  }
  .sa-submit:active:not(:disabled) { transform: translateY(0); }
  .sa-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  .sa-spinner {
    display: inline-block;
    width: 18px; height: 18px;
    border: 2px solid rgba(12,10,0,0.3);
    border-top-color: #0c0a00;
    border-radius: 50%;
    animation: sa-spin 0.7s linear infinite;
  }
  @keyframes sa-spin { to { transform: rotate(360deg); } }

  .sa-error { animation: sa-shake 0.4s ease both; }
  @keyframes sa-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }

  @media (max-width: 480px) {
    .sa-card { border-radius: 16px !important; }
  }
`;
