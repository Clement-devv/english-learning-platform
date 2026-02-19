// src/pages/student/StudentLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import api from '../../api';
import TwoFactorLogin from '../../components/TwoFactorLogin';

export default function StudentLogin() {
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
      const response = await api.post('/api/auth/student/login', {
        email: email.trim(),
        password,
      });
      if (response.data.success) {
        localStorage.setItem('studentToken', response.data.token);
        localStorage.setItem('studentSessionToken', response.data.sessionToken);
        localStorage.setItem('studentInfo', JSON.stringify(response.data.student));
        navigate('/student/dashboard');
      } else if (response.data.requires2FA) {
        setRequires2FA(true);
        setTempUserId(response.data.tempUserId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Oops! Wrong email or password. Try again! 🙈');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (twoFactorToken, backupCode) => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/api/auth/verify-2fa-login', {
        tempUserId, twoFactorToken, backupCode, role: 'student'
      });
      if (response.data.success) {
        localStorage.setItem('studentToken', response.data.token);
        localStorage.setItem('studentSessionToken', response.data.sessionToken);
        localStorage.setItem('studentInfo', JSON.stringify(response.data.user));
        navigate('/student/dashboard');
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

        {/* ── Floating background shapes ── */}
        <div className="sl-blob sl-blob-1" />
        <div className="sl-blob sl-blob-2" />
        <div className="sl-blob sl-blob-3" />

        {/* ── Floating emoji decorations ── */}
        <span className="sl-float sl-f1">📚</span>
        <span className="sl-float sl-f2">⭐</span>
        <span className="sl-float sl-f3">🎨</span>
        <span className="sl-float sl-f4">✏️</span>
        <span className="sl-float sl-f5">🌟</span>
        <span className="sl-float sl-f6">🎯</span>

        {/* ── Card ── */}
        <div style={styles.card} className="sl-card">

          {/* mascot */}
          <div style={styles.mascotWrap} className="sl-mascot">
            <div style={styles.mascotFace}>
              <span style={styles.mascotEmoji}>🦉</span>
            </div>
            <div style={styles.speechBubble}>
              <p style={styles.speechText}>Hi there! Ready to learn? 🎉</p>
            </div>
          </div>

          {/* Title */}
          <h1 style={styles.title}>Student Login</h1>
          <p style={styles.subtitle}>Sign in to start your English adventure!</p>

          {/* Error */}
          {error && (
            <div style={styles.errorBox} className="sl-error">
              <AlertCircle size={16} color="#dc2626" />
              <span style={styles.errorText}>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleInitialLogin} style={styles.form}>

            {/* Email */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                <Mail size={14} />
                Your Email
              </label>
              <div
                style={{
                  ...styles.inputWrap,
                  ...(focusedField === 'email' ? styles.inputWrapFocused : {}),
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="your.email@example.com"
                  required
                  disabled={loading}
                  style={styles.input}
                />
              </div>
            </div>

            {/* Password */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>
                <Lock size={14} />
                Your Password
              </label>
              <div
                style={{
                  ...styles.inputWrap,
                  ...(focusedField === 'password' ? styles.inputWrapFocused : {}),
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginTop: '-8px' }}>
              <button
                type="button"
                onClick={() => navigate('/student/forgot-password')}
                style={styles.forgotBtn}
              >
                Forgot password? 🤔
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={styles.submitBtn}
              className="sl-submit"
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <span className="sl-spinner" />
                  Signing in…
                </span>
              ) : (
                <span>
                  Let's Go! 🚀
                </span>
              )}
            </button>

          </form>

          {/* Footer */}
          <p style={styles.footerNote}>
            Your account is managed by your school 🏫
          </p>

          {/* Fun progress dots */}
          <div style={styles.dots}>
            {['#ff6b6b','#ffd93d','#6bcb77','#4d96ff'].map((c, i) => (
              <span key={i} style={{ ...styles.dot, background: c }} className="sl-dot" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #fef9c3 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
  },

  card: {
    position: 'relative',
    zIndex: 10,
    background: 'white',
    borderRadius: '32px',
    padding: '40px 36px 32px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
    border: '3px solid #e0f2fe',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },

  // Mascot
  mascotWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  mascotFace: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #fef9c3, #fde68a)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid #fcd34d',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(252,211,77,0.4)',
  },
  mascotEmoji: {
    fontSize: '32px',
    lineHeight: 1,
  },
  speechBubble: {
    background: '#eff6ff',
    border: '2px solid #bfdbfe',
    borderRadius: '16px 16px 16px 4px',
    padding: '10px 14px',
    position: 'relative',
  },
  speechText: {
    margin: 0,
    fontSize: '14px',
    color: '#1e40af',
    fontWeight: '700',
  },

  // Text
  title: {
    fontSize: '30px',
    fontWeight: '800',
    color: '#1e293b',
    margin: '8px 0 2px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14.5px',
    color: '#64748b',
    margin: '0 0 18px',
    fontWeight: '500',
  },

  // Error
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fef2f2',
    border: '2px solid #fecaca',
    borderRadius: '14px',
    padding: '12px 14px',
    marginBottom: '8px',
  },
  errorText: {
    color: '#dc2626',
    fontSize: '13.5px',
    fontWeight: '600',
  },

  // Form
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    marginTop: '4px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#475569',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    height: '52px',
    background: '#f8fafc',
    border: '2.5px solid #e2e8f0',
    borderRadius: '16px',
    transition: 'all 0.2s',
  },
  inputWrapFocused: {
    borderColor: '#3b82f6',
    background: '#eff6ff',
    boxShadow: '0 0 0 4px rgba(59,130,246,0.12)',
  },
  input: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '15px',
    color: '#1e293b',
    fontFamily: 'inherit',
    fontWeight: '500',
  },
  eyeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#3b82f6',
    fontWeight: '700',
    fontFamily: 'inherit',
    padding: '0',
  },

  // Submit
  submitBtn: {
    width: '100%',
    height: '56px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '18px',
    fontSize: '17px',
    fontWeight: '800',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
    boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    letterSpacing: '0.01em',
  },

  // Footer
  footerNote: {
    textAlign: 'center',
    fontSize: '12.5px',
    color: '#94a3b8',
    margin: '12px 0 6px',
    fontWeight: '600',
  },

  // Dots
  dots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap');

  * { box-sizing: border-box; }

  /* ── Card entrance ── */
  .sl-card {
    animation: sl-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes sl-rise {
    from { opacity: 0; transform: translateY(32px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* ── Mascot bounce ── */
  .sl-mascot {
    animation: sl-bounce-in 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
  }
  @keyframes sl-bounce-in {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── Submit button ── */
  .sl-submit:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 10px 28px rgba(99,102,241,0.45) !important;
  }
  .sl-submit:active:not(:disabled) {
    transform: translateY(0) scale(0.99);
  }
  .sl-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* ── Spinner ── */
  .sl-spinner {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,0.4);
    border-top-color: white;
    border-radius: 50%;
    animation: sl-spin 0.7s linear infinite;
  }
  @keyframes sl-spin {
    to { transform: rotate(360deg); }
  }

  /* ── Error shake ── */
  .sl-error {
    animation: sl-shake 0.45s ease both;
  }
  @keyframes sl-shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-7px); }
    40%      { transform: translateX(7px); }
    60%      { transform: translateX(-4px); }
    80%      { transform: translateX(4px); }
  }

  /* ── Background blobs ── */
  .sl-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.5;
    pointer-events: none;
  }
  .sl-blob-1 {
    width: 380px; height: 380px;
    background: #bfdbfe;
    top: -100px; left: -100px;
    animation: sl-drift 8s ease-in-out infinite alternate;
  }
  .sl-blob-2 {
    width: 300px; height: 300px;
    background: #bbf7d0;
    bottom: -80px; right: -80px;
    animation: sl-drift 10s ease-in-out infinite alternate-reverse;
  }
  .sl-blob-3 {
    width: 200px; height: 200px;
    background: #fde68a;
    top: 40%; left: 60%;
    animation: sl-drift 7s ease-in-out infinite alternate;
  }
  @keyframes sl-drift {
    from { transform: translate(0, 0) scale(1); }
    to   { transform: translate(20px, 20px) scale(1.05); }
  }

  /* ── Floating emojis ── */
  .sl-float {
    position: absolute;
    font-size: 28px;
    pointer-events: none;
    user-select: none;
    opacity: 0.7;
    animation: sl-float-anim linear infinite;
  }
  .sl-f1 { left: 8%;  top: 15%; animation-duration: 6s;  animation-delay: 0s; }
  .sl-f2 { left: 85%; top: 20%; animation-duration: 7s;  animation-delay: 1s; }
  .sl-f3 { left: 12%; top: 70%; animation-duration: 5s;  animation-delay: 2s; }
  .sl-f4 { left: 80%; top: 65%; animation-duration: 8s;  animation-delay: 0.5s; }
  .sl-f5 { left: 50%; top: 8%;  animation-duration: 6.5s; animation-delay: 1.5s; }
  .sl-f6 { left: 5%;  top: 45%; animation-duration: 7.5s; animation-delay: 3s; }

  @keyframes sl-float-anim {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25%       { transform: translateY(-14px) rotate(5deg); }
    75%       { transform: translateY(10px) rotate(-5deg); }
  }

  /* ── Dots bounce ── */
  .sl-dot {
    animation: sl-dot-bounce 1.4s ease-in-out infinite;
  }
  .sl-dot:nth-child(1) { animation-delay: 0s; }
  .sl-dot:nth-child(2) { animation-delay: 0.15s; }
  .sl-dot:nth-child(3) { animation-delay: 0.3s; }
  .sl-dot:nth-child(4) { animation-delay: 0.45s; }
  @keyframes sl-dot-bounce {
    0%, 80%, 100% { transform: scale(1); }
    40%           { transform: scale(1.5); }
  }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .sl-card { padding: 32px 24px 28px !important; border-radius: 24px !important; }
    .sl-float { display: none; }
  }
`;
