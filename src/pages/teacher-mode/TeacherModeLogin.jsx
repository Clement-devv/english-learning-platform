import { useStudioInstall } from './useStudioInstall';
import { continents, genders } from '../../utils/teacherDemographics';
import StudioLanguageSwitch from './StudioLanguageSwitch';
import { useStudioLanguage } from './useStudioLanguage';
import { studioText } from './studioLanguage';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Building2, Link2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import client from './client';
import { AccountTerms } from '../../components/TermsModal';
import { clearDataCache } from '../../lib/queryClient';
import './teacherMode.css';

export default function TeacherModeLogin({ mode = 'login' }) {
  useStudioInstall();
  useStudioLanguage('teacher');
  const { token } = useParams(), navigate = useNavigate(), auth = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false), [showConfirm, setShowConfirm] = useState(false);
  const [continent, setContinent] = useState(''), [gender, setGender] = useState('');
  const creatingPassword = mode === 'setup' || mode === 'reset';
  const [code, setCode] = useState(''), [twoFactor, setTwoFactor] = useState(false);
  const [useBackup, setUseBackup] = useState(false);
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const heading = { login: 'Your teaching, in one place.', setup: 'Make this workspace yours.', forgot: 'Reset your password', reset: 'Choose a new password' }[mode];
  const submit = async e => {
    e.preventDefault(); setMessage('');
    if (creatingPassword && password !== confirmPassword) { setMessage('Passwords do not match. Please enter the same password in both fields.'); return; }
    setBusy(true);
    try {
      const path = mode === 'setup' ? `/setup/${token}` : mode === 'reset' ? `/reset/${token}` : mode === 'forgot' ? '/forgot-password' : '/login';
      const { data } = await client.post(path, { email, password, ...(mode === 'setup' && { continent, gender, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }), acceptTerms: accepted, ...(twoFactor && code ? (useBackup ? { backupCode: code.trim() } : { twoFactorToken: code.trim() }) : {}) }, { headers: { Authorization: '' } });
      if (data.requires2FA) { setTwoFactor(true); return; }
      if (mode !== 'login') { setMessage(mode === 'forgot' ? data.data.message : 'Saved. You can now sign in.'); setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirm(false); if (mode === 'setup') navigate('/teacher-mode/login', { replace: true }); return; }
      const teacher = { ...(data.teacher || data.user), accountType: 'standalone' };
      clearDataCache();
      sessionStorage.setItem('teacherToken', data.token);
      sessionStorage.setItem('teacherInfo', JSON.stringify(teacher));
      sessionStorage.setItem('teacherSessionToken', data.sessionToken);
      auth.login('teacher', teacher, data.token); navigate('/teacher-mode/dashboard', { replace: true });
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to connect. Please try again.'); }
    finally { setBusy(false); }
  };
  return <main className="tm tm-auth"><section className="tm-auth-story"><div className="tm-auth-brand"><img src="/ego-studio/icon-192.png" width="40" height="40" alt="" style={{ borderRadius: 9 }} />E.G.O</div><span className="tm-eyebrow">THE INDEPENDENT TEACHER STUDIO</span><h1>Great teaching.<br /><em>A closer connection.</em></h1><p>{studioText("Your centers, your students, your teaching story.")}</p><div className="tm-story-item"><Building2 /> Manage the schools and clients you teach for.</div><div className="tm-story-item"><BookOpen /> Keep a clear record of every lesson.</div><div className="tm-story-item"><Link2 /> Bring parents into the learning journey with a link.</div></section><section className="tm-auth-form"><StudioLanguageSwitch /><span className="tm-eyebrow">YOUR PERSONAL WORKSPACE</span><h2>{heading}</h2><p className="tm-muted">{mode === 'login' ? 'For teachers invited directly by Clemify. No school code needed.' : 'Use the private link from your invitation or reset email.'}</p><form onSubmit={submit}>
      {['login', 'forgot'].includes(mode) && <label>{studioText("Email")}<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {mode !== 'forgot' && <div><label htmlFor="studio-password">{studioText("Password")}</label><div className="tm-password-field"><input id="studio-password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'login' ? 1 : 8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="studio-password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{creatingPassword && <small>Use at least 8 characters, including upper/lowercase letters, a number and a special character.</small>}</div>}
      {creatingPassword && <div><label htmlFor="studio-confirm-password">Confirm password</label><div className="tm-password-field"><input id="studio-confirm-password" type={showConfirm ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /><button type="button" aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showConfirm} aria-controls="studio-confirm-password" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>}
      {twoFactor && <><label>{useBackup ? 'Backup code' : 'Authenticator code'}<input inputMode={useBackup ? 'text' : 'numeric'} autoComplete="one-time-code" required value={code} onChange={e => setCode(e.target.value)} /></label><button type="button" onClick={() => { setUseBackup(!useBackup); setCode(''); setMessage(''); }}>{useBackup ? 'Use authenticator code' : 'Use a backup code'}</button></>}
      {mode === 'setup' && <><label>Continent<select required value={continent} onChange={e => setContinent(e.target.value)}><option value="">Select continent</option>{continents.map(v => <option key={v}>{v}</option>)}</select></label><label>Gender<select required value={gender} onChange={e => setGender(e.target.value)}><option value="">Select gender</option>{genders.map(v => <option key={v}>{v}</option>)}</select></label><details><summary>Read the platform terms</summary><AccountTerms /></details><label className="tm-check"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} /> I accept the platform terms.</label></>}
      {message && <p role="status" className="tm-notice">{message}</p>}
      <button className="tm-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? studioText('Open my workspace') : mode === 'forgot' ? 'Send reset link' : 'Save password'}</button>
    </form><Link to={mode === 'login' ? '/teacher-mode/forgot-password' : '/teacher-mode/login'}>{mode === 'login' ? studioText('Forgot password?') : 'Back to sign in'}</Link><p className="tm-muted">Teaching through a registered center? Use the sign-in link provided by your center.</p></section></main>;
}
