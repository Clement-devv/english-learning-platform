// src/pages/admin/AdminLogin.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../../api';
import TwoFactorLogin from '../../components/TwoFactorLogin';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const [focused, setFocused] = useState(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { setMounted(true); }, []);

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/admin/login', {
        username: username.trim(),
        password,
      });
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminSessionToken', response.data.sessionToken);
        localStorage.setItem('adminInfo', JSON.stringify(response.data.admin));
        navigate('/admin');
      } else if (response.data.requires2FA) {
        setRequires2FA(true);
        setTempUserId(response.data.tempUserId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (twoFactorToken, backupCode) => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/verify-2fa-login', {
        tempUserId, twoFactorToken, backupCode, role: 'admin',
      });
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminSessionToken', response.data.sessionToken);
        localStorage.setItem('adminInfo', JSON.stringify(response.data.user));
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2FA = () => {
    setRequires2FA(false);
    setTempUserId(null);
    setError('');
  };

  if (requires2FA) {
    return (
      <div style={s.root}>
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={s.root}>

        {/* ── Animated background grid ── */}
        <div style={s.grid} />

        {/* ── Glow orbs ── */}
        <div style={{ ...s.orb, ...s.orb1 }} className="al-orb" />
        <div style={{ ...s.orb, ...s.orb2 }} className="al-orb al-orb2" />

        {/* ── Floating scanlines ── */}
        <div style={s.scanlines} />

        {/* ── Main card ── */}
        <div
          style={{
            ...s.card,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)',
          }}
          className="al-card"
        >
          {/* Top accent bar */}
          <div style={s.accentBar} />

          {/* Shield icon + title */}
          <div style={s.topSection}>
            <div style={s.shieldWrap} className="al-shield">
              <ShieldCheck size={32} color="#22d3ee" strokeWidth={1.5} />
            </div>

            <div>
              <p style={s.systemLabel}>CONTROL SYSTEM</p>
              <h1 style={s.title}>Admin Portal</h1>
              <p style={s.subtitle}>Authorized personnel only</p>
            </div>
          </div>

          {/* Divider */}
          <div style={s.divider} />

          {/* Error */}
          {error && (
            <div style={s.errorBox} className="al-error">
              <AlertCircle size={15} color="#f87171" />
              <span style={s.errorText}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleInitialLogin} style={s.form}>

            {/* Username */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Username or Email</label>
              <div style={{
                ...s.inputWrap,
                ...(focused === 'user' ? s.inputFocused : {}),
              }}>
                <User size={16} color={focused === 'user' ? '#22d3ee' : '#374151'} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocused('user')}
                  onBlur={() => setFocused(null)}
                  placeholder="admin@example.com"
                  required
                  disabled={loading}
                  style={s.input}
                />
              </div>
            </div>

            {/* Password */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Password</label>
              <div style={{
                ...s.inputWrap,
                ...(focused === 'pass' ? s.inputFocused : {}),
              }}>
                <Lock size={16} color={focused === 'pass' ? '#22d3ee' : '#374151'} />
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
              className="al-submit"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <span className="al-spinner" />
                  Authenticating…
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Access Dashboard
                  <ArrowRight size={17} />
                </span>
              )}
            </button>
          </form>

          {/* Security badge */}
          <div style={s.securityBadge}>
            <div style={s.dot} className="al-dot" />
            <span style={s.secText}>256-bit encrypted · Secured connection</span>
          </div>

          {/* Bottom warning */}
          <div style={s.warning}>
            <AlertCircle size={12} color="#854d0e" />
            <span style={s.warnText}>
              Unauthorized access attempts are logged and may result in account lockout.
            </span>
          </div>
        </div>

        {/* Version tag */}
        <p style={s.version}>EduLearn Admin v2.0 · {new Date().getFullYear()}</p>
      </div>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh',
    background: '#080b14',
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
      linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)
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
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(34,211,238,0.07) 0%, transparent 70%)',
    top: '-150px',
    right: '-100px',
  },
  orb2: {
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
    bottom: '-100px',
    left: '-100px',
  },

  // Card
  card: {
    position: 'relative',
    zIndex: 10,
    background: 'linear-gradient(160deg, #0f1520 0%, #0c1120 100%)',
    border: '1px solid rgba(34,211,238,0.12)',
    borderRadius: '20px',
    padding: '0',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.05) inset',
    transition: 'opacity 0.6s ease, transform 0.6s ease',
    overflow: 'hidden',
  },
  accentBar: {
    height: '2px',
    background: 'linear-gradient(90deg, transparent, #22d3ee, #818cf8, transparent)',
  },
  topSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '28px 28px 20px',
  },
  shieldWrap: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #0c1a2e, #112240)',
    border: '1px solid rgba(34,211,238,0.2)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 20px rgba(34,211,238,0.15)',
  },
  systemLabel: {
    margin: '0 0 2px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.2em',
    color: '#22d3ee',
    textTransform: 'uppercase',
  },
  title: {
    margin: '0 0 2px',
    fontSize: '26px',
    fontWeight: '700',
    color: '#f1f5f9',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: 0,
    fontSize: '12.5px',
    color: '#374151',
    fontWeight: '400',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.1), transparent)',
    margin: '0 0 0 0',
  },

  // Error
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    padding: '11px 14px',
    margin: '20px 28px 0',
  },
  errorText: {
    color: '#f87171',
    fontSize: '13px',
    fontWeight: '500',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '24px 28px 0',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '11.5px',
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 14px',
    height: '50px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  },
  inputFocused: {
  border: '1px solid rgba(34,211,238,0.5)',
  boxShadow: '0 0 0 3px rgba(34,211,238,0.08)',
  background: 'rgba(34,211,238,0.03)',
},
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: '14.5px',
    color: '#e2e8f0',
    fontFamily: 'inherit',
    fontWeight: '400',
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#374151',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.2s',
  },

  // Submit
  submitBtn: {
    width: '100%',
    height: '52px',
    background: 'linear-gradient(135deg, #0e7490, #22d3ee)',
    color: '#020617',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
    letterSpacing: '0.01em',
    boxShadow: '0 6px 24px rgba(34,211,238,0.25)',
    transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
  },

  // Security badge
  securityBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: '20px 28px 0',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#22d3ee',
    flexShrink: 0,
  },
  secText: {
    fontSize: '11.5px',
    color: '#374151',
    fontWeight: '500',
    letterSpacing: '0.01em',
  },

  // Warning
  warning: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: 'rgba(120,53,15,0.15)',
    border: '1px solid rgba(120,53,15,0.3)',
    borderRadius: '0 0 20px 20px',
    padding: '12px 20px',
    margin: '20px 0 0',
  },
  warnText: {
    fontSize: '11px',
    color: '#92400e',
    lineHeight: '1.5',
  },

  version: {
    position: 'relative',
    zIndex: 10,
    fontSize: '11px',
    color: '#1f2937',
    marginTop: '20px',
    letterSpacing: '0.05em',
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }

  input::placeholder { color: #1f2937; }

  /* Card entrance */
  .al-card {
    animation: al-rise 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes al-rise {
    from { opacity: 0; transform: translateY(28px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Orb drift */
  .al-orb  { animation: al-drift1 12s ease-in-out infinite alternate; }
  .al-orb2 { animation: al-drift2 10s ease-in-out infinite alternate; }
  @keyframes al-drift1 { from { transform: translate(0,0); } to { transform: translate(30px, 20px); } }
  @keyframes al-drift2 { from { transform: translate(0,0); } to { transform: translate(-20px, 30px); } }

  /* Shield pulse */
  .al-shield {
    animation: al-shield-glow 3s ease-in-out infinite;
  }
  @keyframes al-shield-glow {
    0%,100% { box-shadow: 0 4px 20px rgba(34,211,238,0.15); }
    50%      { box-shadow: 0 4px 32px rgba(34,211,238,0.35); }
  }

  /* Active dot pulse */
  .al-dot {
    animation: al-dot-pulse 2s ease-in-out infinite;
  }
  @keyframes al-dot-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.4); }
    50%      { box-shadow: 0 0 0 5px rgba(34,211,238,0); }
  }

  /* Submit */
  .al-submit:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(34,211,238,0.35) !important;
  }
  .al-submit:active:not(:disabled) { transform: translateY(0); }
  .al-submit:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Spinner */
  .al-spinner {
    display: inline-block;
    width: 18px; height: 18px;
    border: 2px solid rgba(2,6,23,0.3);
    border-top-color: #020617;
    border-radius: 50%;
    animation: al-spin 0.7s linear infinite;
  }
  @keyframes al-spin { to { transform: rotate(360deg); } }

  /* Error shake */
  .al-error { animation: al-shake 0.4s ease both; }
  @keyframes al-shake {
    0%,100% { transform: translateX(0); }
    20%     { transform: translateX(-6px); }
    40%     { transform: translateX(6px); }
    60%     { transform: translateX(-4px); }
    80%     { transform: translateX(4px); }
  }

  @media (max-width: 480px) {
    .al-card { border-radius: 16px !important; }
  }
`;
