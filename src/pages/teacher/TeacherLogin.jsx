// src/pages/teacher/TeacherLogin.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../api';
import TwoFactorLogin from '../../components/TwoFactorLogin';

export default function TeacherLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/teacher/login', {
        email: email.trim(),
        password
      });

      if (response.data.success) {
        localStorage.setItem('teacherToken', response.data.token);
        localStorage.setItem('teacherSessionToken', response.data.sessionToken);
        localStorage.setItem('teacherInfo', JSON.stringify(response.data.teacher));
        navigate('/teacher/dashboard');
      } else if (response.data.requires2FA) {
        setRequires2FA(true);
        setTempUserId(response.data.tempUserId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (twoFactorToken, backupCode) => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/verify-2fa-login', {
        tempUserId, twoFactorToken, backupCode, role: 'teacher'
      });
      if (response.data.success) {
        localStorage.setItem('teacherToken', response.data.token);
        localStorage.setItem('teacherSessionToken', response.data.sessionToken);
        localStorage.setItem('teacherInfo', JSON.stringify(response.data.user));
        navigate('/teacher/dashboard');
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
      <div style={styles.root}>
        <TwoFactorLogin
          onVerify={handle2FAVerification}
          onCancel={handleCancel2FA}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div style={styles.root}>
        {/* ── LEFT PANEL ── */}
        <div style={styles.left}>
          {/* Decorative grid */}
          <div style={styles.gridOverlay} />
          <div style={styles.glowCircle} />

          <div style={styles.leftContent}>
            {/* Logo mark */}
            <div style={styles.logoMark}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 2L26 8V20L14 26L2 20V8L14 2Z" stroke="white" strokeWidth="1.5" fill="none"/>
                <path d="M14 8L20 11V17L14 20L8 17V11L14 8Z" fill="white" fillOpacity="0.9"/>
              </svg>
              <span style={styles.logoText}>EduLearn</span>
            </div>

            {/* Main headline */}
            <div style={styles.headline}>
              <h1 style={styles.h1}>Empower.<br/>Inspire.<br/>Teach.</h1>
              <p style={styles.sub}>
                Your classroom, your rules. Sign in to manage your students,
                track progress, and deliver world-class English lessons.
              </p>
            </div>

            {/* Stats row */}
            <div style={styles.statsRow}>
              {[
                { value: '2,400+', label: 'Active Students' },
                { value: '98%', label: 'Satisfaction Rate' },
                { value: '50+', label: 'Expert Teachers' },
              ].map((s) => (
                <div key={s.label} style={styles.stat}>
                  <span style={styles.statValue}>{s.value}</span>
                  <span style={styles.statLabel}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={styles.right}>
          <div style={styles.formWrap} className="login-form-wrap">

            {/* Top label */}
            <p style={styles.tag}>TEACHER PORTAL</p>

            <h2 style={styles.formTitle}>Welcome back</h2>
            <p style={styles.formSub}>Enter your credentials to continue</p>

            {/* Error */}
            {error && (
              <div style={styles.errorBox} className="login-error">
                <AlertCircle size={16} color="#ef4444" />
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} style={styles.form}>

              {/* Email */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Email address</label>
                <div
                  style={{
                    ...styles.inputWrap,
                    ...(focusedField === 'email' ? styles.inputWrapFocused : {}),
                  }}
                >
                  <Mail size={17} color={focusedField === 'email' ? '#1a1a2e' : '#9ca3af'} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={styles.fieldGroup}>
                <div style={styles.labelRow}>
                  <label style={styles.label}>Password</label>
                  <Link to="/teacher/forgot-password" style={styles.forgotLink}>
                    Forgot password?
                  </Link>
                </div>
                <div
                  style={{
                    ...styles.inputWrap,
                    ...(focusedField === 'password' ? styles.inputWrapFocused : {}),
                  }}
                >
                  <Lock size={17} color={focusedField === 'password' ? '#1a1a2e' : '#9ca3af'} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••••"
                    required
                    disabled={loading}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    disabled={loading}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={styles.submitBtn}
                className="login-submit-btn"
              >
                {loading ? (
                  <span style={styles.spinnerWrap}>
                    <span className="login-spinner" />
                    Signing in…
                  </span>
                ) : (
                  <span style={styles.btnInner}>
                    Sign In
                    <ArrowRight size={18} />
                  </span>
                )}
              </button>

            </form>

            {/* Footer note */}
            <p style={styles.footerNote}>
              Having trouble?{' '}
              <a href="mailto:support@edulearn.com" style={styles.footerLink}>
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  },

  // LEFT
  left: {
    flex: '0 0 45%',
    background: 'linear-gradient(145deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
  },
  glowCircle: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
    top: '-100px',
    right: '-150px',
    pointerEvents: 'none',
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    padding: '48px',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '48px',
  },
  logoMark: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logoText: {
    color: 'white',
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: '20px',
    fontWeight: '400',
    letterSpacing: '0.02em',
  },
  headline: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  h1: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: '56px',
    lineHeight: '1.05',
    color: 'white',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '15px',
    lineHeight: '1.7',
    margin: 0,
    fontWeight: '400',
  },
  statsRow: {
    display: 'flex',
    gap: '32px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statValue: {
    color: 'white',
    fontSize: '22px',
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontWeight: '400',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },

  // RIGHT
  right: {
    flex: 1,
    background: '#fafafa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 32px',
  },
  formWrap: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tag: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.15em',
    color: '#6366f1',
    textTransform: 'uppercase',
    margin: '0 0 16px 0',
  },
  formTitle: {
    fontFamily: "'DM Serif Display', Georgia, serif",
    fontSize: '36px',
    fontWeight: '400',
    color: '#0f0c29',
    margin: '0 0 6px 0',
    letterSpacing: '-0.01em',
  },
  formSub: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: '0 0 28px 0',
  },

  // ERROR
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: '13.5px',
    lineHeight: '1.4',
  },

  // FORM
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    letterSpacing: '0.01em',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLink: {
    fontSize: '12.5px',
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: '500',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 14px',
    height: '50px',
    background: 'white',
    border: '1.5px solid #e5e7eb',
    borderRadius: '12px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputWrapFocused: {
    borderColor: '#1a1a2e',
    boxShadow: '0 0 0 3px rgba(26,26,46,0.07)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '14.5px',
    color: '#111827',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
  },

  // SUBMIT
  submitBtn: {
    width: '100%',
    height: '52px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '6px',
    transition: 'opacity 0.2s, transform 0.15s',
  },
  btnInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinnerWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },

  // FOOTER
  footerNote: {
    textAlign: 'center',
    fontSize: '13px',
    color: '#9ca3af',
    marginTop: '24px',
  },
  footerLink: {
    color: '#6366f1',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

// ── CSS (animations + Google Fonts + responsive) ──────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap');

  * { box-sizing: border-box; }

  .login-form-wrap {
    animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .login-error {
    animation: shake 0.4s ease both;
  }

  .login-submit-btn:hover:not(:disabled) {
    opacity: 0.88;
    transform: translateY(-1px);
  }

  .login-submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .login-submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login-spinner {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(6px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(4px); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive: stack on small screens */
  @media (max-width: 768px) {
    body > div > div:first-child { display: none !important; }
    body > div > div:last-child  { padding: 32px 24px !important; }
  }
`;
