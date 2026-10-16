// src/pages/admin/login-themes/SunshineAdminTheme.jsx
// Sunshine admin login — the default admin slot (id 'executive', shown as "Sunshine Login").
// Layout + styles live in components/auth/SunshineLoginShell.jsx (shared with the super
// admin login, which uses the same design with its own wording).
import React from 'react';
import { ArrowRight, BarChart3, Users, ShieldCheck, Settings2, Mail, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useAdminLoginLogic } from './useAdminLoginLogic';
import { useTranslation } from 'react-i18next';
import SunshineLoginShell, { LoginHeader, LoginError, LoginField, LoginPasswordField, LoginSubmit, LoginNote } from '../../../components/auth/SunshineLoginShell';

export default function SunshineAdminTheme() {
  const { t: tr } = useTranslation('admin');
  const {
    username, setUsername, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    view, setView, forgotEmail, setForgotEmail, forgotLoading, forgotError,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, handleForgotPassword,
  } = useAdminLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';
  const mark = (centerName[0] || 'A').toUpperCase();

  if (requires2FA) {
    return (
      <SunshineLoginShell branding={branding} compact>
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </SunshineLoginShell>
    );
  }

  const hero = {
    eyebrow: `${centerName} · ${tr('executiveTheme.adminPortal')}`,
    lines: [tr('executiveTheme.yourCommand')],
    highlight: tr('executiveTheme.center'),
    sub: `${tr('executiveTheme.fullVisibilityTotalControl')} ${tr('executiveTheme.manageYourEntireLearningCenter')}`,
    chips: [tr('executiveTheme.analytics2'), tr('executiveTheme.fullRoster'), tr('executiveTheme.settings')],
    floats: [
      { Icon: BarChart3,   cat: 'rose',  title: tr('executiveTheme.analytics'),    sub: tr('executiveTheme.live2'),   live: true },
      { Icon: Users,       cat: 'teal',  title: tr('executiveTheme.manageRoster'), sub: tr('executiveTheme.active') },
      { Icon: Settings2,   cat: 'amber', title: tr('executiveTheme.fullControl'),  sub: tr('executiveTheme.running') },
      { Icon: ShieldCheck, cat: 'green', title: tr('executiveTheme.adminPortal'),  sub: tr('executiveTheme.t256BitEncryptedSecuredConnection') },
    ],
  };

  return (
    <SunshineLoginShell branding={branding} hero={hero}>
      {view === 'forgot' ? (
        <>
          <LoginHeader logo={branding.logo} mark={<Mail size={26} strokeWidth={2.2} />}
            tag={tr('executiveTheme.adminPortal')} title={tr('executiveTheme.resetPassword')} sub={tr('executiveTheme.enterYourAdminEmailAddress')} />
          <LoginError id="lx-forgot-error">{forgotError}</LoginError>
          <form onSubmit={handleForgotPassword} className="lx-form">
            <LoginField id="lx-forgot-email" label={tr('executiveTheme.adminEmail')} type="email" inputMode="email" autoComplete="email"
              autoCapitalize="none" spellCheck={false} placeholder={tr('executiveTheme.adminExampleCom')}
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required disabled={forgotLoading} autoFocus
              invalid={!!forgotError} describedBy="lx-forgot-error" />
            <LoginSubmit loading={forgotLoading} loadingLabel={tr('executiveTheme.sending')}>
              <Mail size={17} strokeWidth={2.4} aria-hidden="true" /> {tr('executiveTheme.sendResetLink')}
            </LoginSubmit>
            <button type="button" className="lx-link is-center" onClick={() => setView('login')}>{tr('executiveTheme.backToLogin')}</button>
          </form>
        </>
      ) : view === 'forgot-sent' ? (
        <div className="lx-sent">
          <div className="lx-sent-icon"><CheckCircle2 size={28} strokeWidth={2.2} aria-hidden="true" /></div>
          <h1 className="lx-title">{tr('executiveTheme.checkYourEmail')}</h1>
          <p className="lx-sub" role="status">
            {tr('executiveTheme.if')} <strong>{forgotEmail}</strong> {tr('executiveTheme.isRegisteredAResetLink')}
          </p>
          <button type="button" className="lx-link" onClick={() => { setView('login'); setForgotEmail(''); }}>
            {tr('executiveTheme.backToLogin2')}
          </button>
        </div>
      ) : (
        <>
          <LoginHeader logo={branding.logo} mark={mark}
            tag={centerName} title={tr('executiveTheme.adminPortal')} sub={tr('executiveTheme.authorizedPersonnelOnly')} />
          <LoginError>{error}</LoginError>
          <form onSubmit={handleInitialLogin} className="lx-form">
            <LoginField id="lx-username" label={tr('executiveTheme.usernameOrEmail')} type="text" autoComplete="username"
              autoCapitalize="none" spellCheck={false} placeholder={tr('executiveTheme.adminExampleCom')}
              value={username} onChange={e => setUsername(e.target.value)} required disabled={loading}
              invalid={!!error} describedBy="lx-error" />
            <LoginPasswordField id="lx-password" label={tr('executiveTheme.password')}
              aside={<button type="button" className="lx-link" onClick={() => setView('forgot')}>{tr('executiveTheme.forgotPassword')}</button>}
              show={showPassword} onToggle={() => setShowPassword(v => !v)}
              value={password} onChange={e => setPassword(e.target.value)} required disabled={loading}
              invalid={!!error} describedBy="lx-error" />
            <LoginSubmit loading={loading} loadingLabel={tr('executiveTheme.authenticating')}>
              {tr('executiveTheme.accessDashboard')} <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </LoginSubmit>
          </form>
          <div className="lx-notes">
            <LoginNote icon={Lock} tone="ok">{tr('executiveTheme.t256BitEncryptedSecuredConnection')}</LoginNote>
            <LoginNote icon={AlertTriangle} tone="warn">{tr('executiveTheme.unauthorizedAccessAttemptsAreLogged')}</LoginNote>
          </div>
          <p className="lx-foot">{tr('executiveTheme.admin', { centerName, value: new Date().getFullYear() })}</p>
        </>
      )}
    </SunshineLoginShell>
  );
}
