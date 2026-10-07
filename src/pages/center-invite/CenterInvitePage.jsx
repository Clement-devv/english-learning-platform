// src/pages/center-invite/CenterInvitePage.jsx
// /center-invite/:token — the link a new center's admin gets by email after the
// super admin creates their center. They add their name, the center's location
// and time zone, and their password; then the center goes live.
// Server: routes/centerInviteRoutes.js (GET/POST /api/v1/center-invite/:token)
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, User, MapPin, Lock, Eye, EyeOff, Check, X, Loader2, CheckCircle2, AlertTriangle, Globe2 } from 'lucide-react';
import { TIMEZONE_OPTIONS, getUserTimezone } from '../../utils/timezone';

// Same base the app's api client uses (src/api.js)
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/v1';

// ISO 3166 codes → names in the visitor's language (Intl), for the country suggestions
const REGION_CODES = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');

const PASSWORD_RULES = [
  { test: (p) => p.length >= 8, label: 'At least 8 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'An uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'A lowercase letter' },
  { test: (p) => /\d/.test(p), label: 'A number' },
  { test: (p) => /[@$!%*?&]/.test(p), label: 'One of @ $ ! % * ? &' },
];

export default function CenterInvitePage() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(() => {
    const tz = getUserTimezone();
    return {
      firstName: '', lastName: '', country: '', address: '', phone: '',
      timezone: TIMEZONE_OPTIONS.some(o => o.value === tz) ? tz : 'UTC',
      password: '', confirm: '',
    };
  });
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const countries = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([navigator.language || 'en', 'en'], { type: 'region' });
      return REGION_CODES.map(c => names.of(c)).filter(Boolean).sort((a, b) => a.localeCompare(b));
    } catch { return []; }
  }, []);

  useEffect(() => {
    document.title = 'Set up your center';
    fetch(`${API}/center-invite/${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setInvite(d.data); else setLoadError(d.message || 'This invite link is not valid.'); })
      .catch(() => setLoadError('We could not load your invite. Check your connection and try again.'));
  }, [token]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const rules = PASSWORD_RULES.map(r => ({ ...r, ok: r.test(form.password) }));
  const passwordOk = rules.every(r => r.ok);
  const confirmOk = form.confirm.length > 0 && form.confirm === form.password;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!passwordOk) { setError('Your password does not meet all the rules yet.'); return; }
    if (!confirmOk) { setError('The two passwords do not match.'); return; }
    setSaving(true);
    try {
      const { confirm, ...body } = form; // eslint-disable-line no-unused-vars
      const r = await fetch(`${API}/center-invite/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Something went wrong');
      setDone(d.data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.card}>
        {!invite && !loadError && (
          <div style={S.center}><Loader2 size={28} className="ci-spin" color="#be185d" /><p style={S.muted}>Loading your invite…</p></div>
        )}

        {loadError && (
          <div style={S.center}>
            <AlertTriangle size={40} color="#f59e0b" />
            <h1 style={S.h1}>This link can't be used</h1>
            <p style={S.muted}>{loadError}</p>
            <a href="/admin/login" style={S.secondaryBtn}>Go to admin login</a>
          </div>
        )}

        {done && (
          <div style={S.center}>
            <CheckCircle2 size={52} color="#10b981" />
            <h1 style={S.h1}>{done.centerName} is ready 🎉</h1>
            <p style={S.muted}>Your admin account is set up. Sign in with <strong style={{ color: '#0f172a' }}>{done.adminEmail}</strong> and the password you just chose. We've also emailed you the login link.</p>
            <a href={done.loginUrl} style={S.primaryBtn}>Go to my admin dashboard</a>
          </div>
        )}

        {invite && !done && (
          <form onSubmit={submit} noValidate>
            <div style={S.header}>
              <div style={S.logo}><Building2 size={24} color="#fff" /></div>
              <div>
                <p style={S.eyebrow}>You're invited</p>
                <h1 style={{ ...S.h1, margin: 0 }}>Set up {invite.centerName}</h1>
                <p style={{ ...S.muted, margin: '6px 0 0' }}>
                  Your web address: <strong style={{ color: '#0f172a' }}>{invite.slug}.clemify.com</strong> · Admin login: <strong style={{ color: '#0f172a' }}>{invite.adminEmail}</strong>
                </p>
              </div>
            </div>

            <Section icon={User} title="About you">
              <div className="ci-two">
                <Field label="First name" id="ci-first"><input id="ci-first" required autoFocus autoComplete="given-name" maxLength={60} value={form.firstName} onChange={set('firstName')} style={S.input} /></Field>
                <Field label="Last name" id="ci-last"><input id="ci-last" required autoComplete="family-name" maxLength={60} value={form.lastName} onChange={set('lastName')} style={S.input} /></Field>
              </div>
              <Field label="Phone (optional)" id="ci-phone"><input id="ci-phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+234 801 234 5678" value={form.phone} onChange={set('phone')} style={S.input} /></Field>
            </Section>

            <Section icon={MapPin} title="Your center">
              <div className="ci-two">
                <Field label="Country" id="ci-country">
                  <input id="ci-country" required list="ci-countries" autoComplete="country-name" maxLength={80} placeholder="Start typing…" value={form.country} onChange={set('country')} style={S.input} />
                  <datalist id="ci-countries">{countries.map(c => <option key={c} value={c} />)}</datalist>
                </Field>
                <Field label="City / address (optional)" id="ci-address"><input id="ci-address" autoComplete="street-address" maxLength={200} placeholder="14 Allen Ave, Ikeja" value={form.address} onChange={set('address')} style={S.input} /></Field>
              </div>
              <Field label="Time zone" id="ci-tz" hint="Class times, reminders and reports use this time zone.">
                <div style={{ position: 'relative' }}>
                  <Globe2 size={16} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <select id="ci-tz" required value={form.timezone} onChange={set('timezone')} style={{ ...S.input, paddingLeft: 36 }}>
                    {!TIMEZONE_OPTIONS.some(o => o.value === 'UTC') && <option value="UTC">UTC (Coordinated Universal Time)</option>}
                    {TIMEZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </Field>
            </Section>

            <Section icon={Lock} title="Your password">
              <div className="ci-two">
                <Field label="Password" id="ci-pwd">
                  <div style={{ position: 'relative' }}>
                    <input id="ci-pwd" required type={showPwd ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} style={{ ...S.input, paddingRight: 42 }} />
                    <button type="button" onClick={() => setShowPwd(v => !v)} aria-label={showPwd ? 'Hide password' : 'Show password'} style={S.eye}>{showPwd ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </div>
                </Field>
                <Field label="Confirm password" id="ci-pwd2">
                  <input id="ci-pwd2" required type={showPwd ? 'text' : 'password'} autoComplete="new-password" value={form.confirm} onChange={set('confirm')}
                    style={{ ...S.input, ...(form.confirm && !confirmOk ? { borderColor: '#ef4444' } : {}) }} />
                  {form.confirm && !confirmOk && <span style={{ fontSize: 12, color: '#dc2626' }}>Passwords don't match</span>}
                </Field>
              </div>
              <ul style={S.rules} aria-label="Password rules">
                {rules.map(r => (
                  <li key={r.label} style={{ color: r.ok ? '#047857' : '#64748b', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: r.ok ? 600 : 500 }}>
                    {r.ok ? <Check size={14} /> : <X size={14} />} {r.label}
                  </li>
                ))}
              </ul>
            </Section>

            {error && <div role="alert" style={S.error}><AlertTriangle size={16} style={{ flexShrink: 0 }} /> {error}</div>}

            <button type="submit" disabled={saving} style={{ ...S.primaryBtn, width: '100%', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.75 : 1 }}>
              {saving ? <><Loader2 size={17} className="ci-spin" /> Setting up your center…</> : 'Finish setup'}
            </button>
            <p style={{ ...S.muted, fontSize: 12.5, textAlign: 'center', margin: '14px 0 0' }}>
              This link works once and expires on {new Date(invite.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.
            </p>
          </form>
        )}
      </div>
      <p style={{ ...S.muted, fontSize: 12, marginTop: 18 }}>Powered by Clemify</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <fieldset style={S.section}>
      <legend style={S.legend}><span style={S.legendIc}><Icon size={15} /></span>{title}</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </fieldset>
  );
}

function Field({ label, id, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <label htmlFor={id} style={S.label}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 12, color: '#64748b' }}>{hint}</span>}
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'radial-gradient(circle at 15% 0%, #fce7f3 0%, transparent 45%), radial-gradient(circle at 100% 100%, #fef3c7 0%, transparent 40%), #f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px', fontFamily: "'Inter', system-ui, sans-serif", color: '#0f172a', colorScheme: 'light' },
  card: { width: '100%', maxWidth: 640, background: '#fff', borderRadius: 24, boxShadow: '0 1px 2px rgba(15,23,42,.05), 0 24px 60px rgba(15,23,42,.10)', padding: '32px clamp(18px, 5vw, 40px)', boxSizing: 'border-box' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, padding: '24px 0' },
  header: { display: 'flex', gap: 16, alignItems: 'flex-start', paddingBottom: 22, marginBottom: 6, borderBottom: '1px solid #f1f5f9' },
  logo: { width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#be185d,#db2777)', display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: '0 10px 24px -8px #be185d' },
  eyebrow: { margin: '0 0 4px', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#be185d' },
  h1: { fontSize: 'clamp(1.35rem, 3.6vw, 1.7rem)', fontWeight: 800, margin: '4px 0', letterSpacing: '-0.02em', color: '#0f172a' },
  muted: { color: '#64748b', fontSize: 14, lineHeight: 1.6, margin: 0 },
  section: { border: 'none', padding: 0, margin: '24px 0 0' },
  legend: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: '#0f172a', padding: 0, marginBottom: 14 },
  legendIc: { width: 28, height: 28, borderRadius: 8, background: '#fdf2f8', color: '#be185d', display: 'grid', placeItems: 'center' },
  label: { fontSize: 13, fontWeight: 700, color: '#334155' },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 15, fontFamily: 'inherit', outline: 'none' },
  eye: { position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 6, display: 'grid' },
  rules: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 13 },
  error: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: '#b91c1c', fontSize: 14, margin: '22px 0 0' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 26px', borderRadius: 14, background: 'linear-gradient(135deg,#be185d,#db2777)', color: '#fff', fontWeight: 800, fontSize: 15.5, textDecoration: 'none', fontFamily: 'inherit', marginTop: 24, boxShadow: '0 14px 30px -12px #be185d' },
  secondaryBtn: { display: 'inline-flex', padding: '11px 20px', borderRadius: 12, border: '1.5px solid #e2e8f0', color: '#0f172a', fontWeight: 700, textDecoration: 'none', marginTop: 8 },
};

const CSS = `
.ci-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 560px) { .ci-two { grid-template-columns: 1fr; } }
#ci-first:focus, #ci-last:focus, #ci-phone:focus, #ci-country:focus, #ci-address:focus, #ci-tz:focus, #ci-pwd:focus, #ci-pwd2:focus { border-color: #be185d !important; box-shadow: 0 0 0 4px rgba(190,24,93,.12); }
@keyframes ciSpin { to { transform: rotate(360deg); } }
.ci-spin { animation: ciSpin .8s linear infinite; }
`;
