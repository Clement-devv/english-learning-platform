// src/pages/sub-admin/login-themes/SunshineSubAdminTheme.jsx
// Sunshine sub-admin login — same design as the center admin's Sunshine login
// (components/auth/SunshineLoginShell.jsx) with sub-admin wording and auth endpoint.
// Default slot (id 'executive' — sub-admins follow the center's admin login theme).
import React from 'react';
import { ArrowRight, Users, LineChart, Video, ShieldCheck, Mail, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useSubAdminLoginLogic } from './useSubAdminLoginLogic';
import SunshineLoginShell, { LoginHeader, LoginError, LoginField, LoginPasswordField, LoginSubmit, LoginNote } from '../../../components/auth/SunshineLoginShell';

const OTHER_PORTALS = [
  { label: 'Main admin portal', path: '/admin/login' },
  { label: 'Teacher portal',    path: '/teacher/login' },
];

export default function SunshineSubAdminTheme() {
  const {
    username, setUsername, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    view, setView, forgotEmail, setForgotEmail, forgotLoading, forgotError,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, handleForgotPassword,
    navigate,
  } = useSubAdminLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';
  const mark = (centerName[0] || 'S').toUpperCase();

  if (requires2FA) {
    return (
      <SunshineLoginShell branding={branding} compact>
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </SunshineLoginShell>
    );
  }

  const hero = {
    eyebrow: 'Sub-admin portal',
    lines: ['Manage your'],
    highlight: 'assigned team.',
    sub: 'View and support the teachers and students assigned to you. Your scoped dashboard, fully under control.',
    chips: ['👥 My team', '📈 Progress', '🎥 Live sessions'],
    floats: [
      { Icon: Users,       cat: 'teal',  title: 'My Team',        sub: 'Live',   live: true },
      { Icon: LineChart,   cat: 'rose',  title: 'Track Progress', sub: 'Active' },
      { Icon: Video,       cat: 'amber', title: 'Live Sessions',  sub: 'Running' },
      { Icon: ShieldCheck, cat: 'green', title: 'Scoped access',  sub: 'Only your team' },
    ],
  };

  return (
    <SunshineLoginShell branding={branding} hero={hero}>
      {view === 'forgot' ? (
        <>
          <LoginHeader logo={branding.logo} mark={<Mail size={26} strokeWidth={2.2} />}
            tag="Sub-admin portal" title="Reset password" sub="Enter your sub-admin email" />
          <LoginError id="lx-forgot-error">{forgotError}</LoginError>
          <form onSubmit={handleForgotPassword} className="lx-form">
            <LoginField id="lx-forgot-email" label="Email address" type="email" inputMode="email" autoComplete="email"
              autoCapitalize="none" spellCheck={false} placeholder="you@example.com"
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required disabled={forgotLoading} autoFocus
              invalid={!!forgotError} describedBy="lx-forgot-error" />
            <LoginSubmit loading={forgotLoading} loadingLabel="Sending…">
              <Mail size={17} strokeWidth={2.4} aria-hidden="true" /> Send reset link
            </LoginSubmit>
            <button type="button" className="lx-link is-center" onClick={() => setView('login')}>← Back to login</button>
          </form>
        </>
      ) : view === 'forgot-sent' ? (
        <div className="lx-sent">
          <div className="lx-sent-icon"><CheckCircle2 size={28} strokeWidth={2.2} aria-hidden="true" /></div>
          <h1 className="lx-title">Check your email</h1>
          <p className="lx-sub" role="status">
            If <strong>{forgotEmail}</strong> is registered, a reset link has been sent. It expires in 1 hour.
          </p>
          <button type="button" className="lx-link" onClick={() => { setView('login'); setForgotEmail(''); }}>Back to login</button>
        </div>
      ) : (
        <>
          <LoginHeader logo={branding.logo} mark={mark}
            tag={centerName} title="Sub-Admin Portal" sub="Manage your assigned team" />
          <LoginError>{error}</LoginError>
          <form onSubmit={handleInitialLogin} className="lx-form">
            <LoginField id="lx-username" label="Email address" type="email" inputMode="email" autoComplete="username"
              autoCapitalize="none" spellCheck={false} placeholder="you@example.com"
              value={username} onChange={e => setUsername(e.target.value)} required disabled={loading}
              invalid={!!error} describedBy="lx-error" />
            <LoginPasswordField id="lx-password" label="Password"
              aside={<button type="button" className="lx-link" onClick={() => setView('forgot')}>Forgot password?</button>}
              show={showPassword} onToggle={() => setShowPassword(v => !v)}
              value={password} onChange={e => setPassword(e.target.value)} required disabled={loading}
              invalid={!!error} describedBy="lx-error" />
            <LoginSubmit loading={loading} loadingLabel="Signing in…">
              Access dashboard <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </LoginSubmit>
          </form>
          <div className="lx-notes">
            <LoginNote icon={Lock} tone="ok">You only see the teachers and students assigned to you</LoginNote>
            <LoginNote icon={AlertTriangle} tone="warn">Unauthorized access attempts are logged.</LoginNote>
          </div>
          <nav className="lx-portals" aria-label="Other portals">
            <span className="lx-portals-label">Other portals</span>
            <div className="lx-portals-row">
              {OTHER_PORTALS.map(({ label, path }) => (
                <button key={path} type="button" className="lx-portal" onClick={() => navigate(path)}>{label}</button>
              ))}
            </div>
          </nav>
          <p className="lx-foot">{centerName} Sub-Admin · {new Date().getFullYear()}</p>
        </>
      )}
    </SunshineLoginShell>
  );
}
