import { enablePush, disablePush, getPushStatus, getDeviceChoice, restorePushIfAllowed } from '../../utils/pushNotifications';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { teacherModeKey } from '../../utils/teacherMode';
import client from './client';
import { CLASS_REMINDER_LEAD, reminderKey, upcomingReminderClasses, dueClassReminders } from '../../utils/studioClassReminder';
import { getRingtoneById, DEFAULT_RINGTONE_ID, CUSTOM_RINGTONE_ID, RINGTONES, makeCustomRingtone } from '../../components/ring/ringtones';
import { loadCustomTone, getCustomToneName } from '../../components/ring/ringStorage';

export default function StandaloneClassReminder() {
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const workspace = auth.role === 'teacher' && !auth.user?.inspection ? teacherModeKey() : null;
  const account = workspace && (auth.user?._id || auth.user?.id);
  const [alerts, setAlerts] = useState([]);
  const generation = useRef(0);
  const tone = useRef(null), route = useRef(location.pathname);
  route.current = location.pathname;
  const silence = () => { generation.current++; tone.current?.stop(); tone.current = null; };
  useEffect(() => {
    setAlerts([]); silence();
    if (!account) return;
    let alive = true, timer, soundTimer, loading = false, lastFetch = 0;
    const storageKey = 'studio-class-reminders:' + workspace + ':' + account;
    const memorySeen = new Set();
    const readSeen = () => { try { const value = JSON.parse(localStorage.getItem(storageKey) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; } catch { return {}; } };
    const claimed = lesson => {
      const key = reminderKey(lesson), seen = readSeen();
      if (seen[key] || memorySeen.has(key)) return false;
      memorySeen.add(key); seen[key] = Date.now();
      // Keep a bounded recent history, including after a browser refresh.
      const recent = Object.fromEntries(Object.entries(seen).filter(([, at]) => Date.now() - at < 7 * 86400000).slice(-200));
      try { localStorage.setItem(storageKey, JSON.stringify(recent)); } catch { /* in-memory fallback */ }
      return true;
    };
    const ring = async lessons => {
      const claim = () => alive ? lessons.filter(claimed) : [];
      const fresh = navigator.locks ? await navigator.locks.request(storageKey, claim) : claim();
      if (!alive || !fresh.length) return;
      setAlerts(previous => [...previous, ...fresh]);
      silence(); clearTimeout(soundTimer);
      const attempt = generation.current;
      const id = localStorage.getItem('ring_tone_id') || DEFAULT_RINGTONE_ID;
      let sound;
      if (id === CUSTOM_RINGTONE_ID) {
        try { const bytes = await loadCustomTone(); if (bytes) sound = () => makeCustomRingtone(bytes); } catch {}
      }
      if (!alive || attempt !== generation.current) return;
      tone.current = (sound || getRingtoneById(id).make)();
      soundTimer = setTimeout(silence, 30000);
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden && getDeviceChoice() !== 'on') {
        const title = 'Your class starts soon';
        const body = fresh.map(lesson => lesson.classTitle || lesson.title || 'Booked class').join(', ');
        const url = route.current === '/classroom' ? '/classroom' : '/teacher-mode/dashboard?tab=classes';
        const options = { body, tag: 'studio-class-' + reminderKey(fresh[0]), icon: '/ego-studio/icon-192.png', data: { url } };
        try {
          const registration = await navigator.serviceWorker?.getRegistration('/');
          if (!alive) return;
          if (registration) await registration.showNotification(title, options);
          else new Notification(title, options);
        } catch { /* the in-app reminder is still available */ }
      }
    };
    const load = async () => {
      if (!alive || loading) return;
      loading = true; clearTimeout(timer);
      try {
        // A fresh server read at the reminder boundary excludes cancelled/rescheduled classes.
        // This client does not apply the dashboard's selected-center filter.
        const { data } = await client.get('/app/work');
        if (!alive) return;
        lastFetch = Date.now();
        const work = data.data || [];
        setAlerts(previous => previous.filter(old => work.some(lesson => reminderKey(lesson) === reminderKey(old) && ['accepted','open','full'].includes(lesson.status))));
        await ring(dueClassReminders(work));
        if (!alive) return;
        const seen = readSeen();
        const next = upcomingReminderClasses(work).find(lesson => !seen[reminderKey(lesson)] && !memorySeen.has(reminderKey(lesson)));
        clearTimeout(timer);
        if (next) timer = setTimeout(load, Math.max(1000, Math.min(86400000, Date.parse(next.scheduledTime) - CLASS_REMINDER_LEAD - Date.now())));
      } catch {
        // Retry gently while online; never generate a ring from stale booking data.
        if (alive) timer = setTimeout(load, 60000);
      } finally { loading = false; }
    };
    const resume = () => { if (!document.hidden && Date.now() - lastFetch > 10000) void load(); };
    const changed = () => { void load(); };
    void restorePushIfAllowed();
    const pushed = event => {
      if (event.data?.type === 'studio-class-reminder' && event.data.data?.workspaceKey === workspace && event.data.data?.teacherId === String(account)) void load();
    };
    navigator.serviceWorker?.addEventListener('message', pushed);
    void load();
    window.addEventListener('focus', resume); document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', changed); window.addEventListener('studio-bookings-changed', changed);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', pushed);
      alive = false; clearTimeout(timer); clearTimeout(soundTimer); silence();
      window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', changed); window.removeEventListener('studio-bookings-changed', changed);
    };
  }, [account, workspace]);
  useEffect(() => {
    if (!alerts.length) return;
    const expires = Math.min(...alerts.map(lesson => Date.parse(lesson.scheduledTime) + 60000));
    const timer = setTimeout(() => setAlerts(previous => previous.filter(lesson => Date.parse(lesson.scheduledTime) + 60000 > Date.now())), Math.max(0, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [alerts]);
  if (!account || !alerts.length) return null;
  const dismiss = () => { silence(); setAlerts([]); };
  const openClasses = () => {
    dismiss();
    if (location.pathname === '/classroom') window.dispatchEvent(new Event('studio-open-dashboard'));
    else if (location.pathname.includes('/dashboard')) window.dispatchEvent(new Event('studio-open-classes'));
    else navigate('/teacher-mode/dashboard', { state: { activeTab: 'classes' } });
  };
  return <aside role="alert" aria-label="Upcoming class reminder" style={{ position: 'fixed', right: 16, bottom: 20, zIndex: 10000, width: 'min(360px, calc(100vw - 32px))', padding: 20, borderRadius: 20, background: '#f3f0e8', color: '#243e32', border: '2px solid #476d58', boxShadow: '0 12px 40px #0004' }}>
    <strong style={{ fontSize: 18 }}>Your class starts soon</strong>
    {alerts.map(lesson => <p key={reminderKey(lesson)} style={{ margin: '12px 0' }}><strong>{lesson.classTitle || lesson.title}</strong><br />{lesson.studentId?.firstName || 'Group class'} · {new Date(lesson.scheduledTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>)}
    <div style={{ display: 'flex', gap: 12 }}><button type="button" onClick={openClasses}>View classes</button><button type="button" onClick={dismiss}>Dismiss</button></div>
  </aside>;
}

export function ClassReminderSettings() {
  const [message, setMessage] = useState('Enable background reminders to receive a notification when this app is closed. Sound follows your device settings.');
  const [enabled, setEnabled] = useState(false), [busy, setBusy] = useState(false);
  const [ringtoneId, setRingtoneId] = useState(() => {
    const saved = localStorage.getItem('ring_tone_id');
    // Upgrade only the old app default; preserve tones the teacher selected.
    if (!saved || saved === 'chime') { localStorage.setItem('ring_tone_id', DEFAULT_RINGTONE_ID); return DEFAULT_RINGTONE_ID; }
    return saved;
  });
  const [customName, setCustomName] = useState(() => getCustomToneName());
  const previewRef = useRef(null);
  useEffect(() => { let alive = true; getPushStatus().then(value => { if (alive) setEnabled(value); }); return () => { alive = false; }; }, []);
  useEffect(() => () => previewRef.current?.stop(), []);
  const toggle = async () => {
    setBusy(true);
    try {
      if (enabled) { await disablePush(); setEnabled(false); setMessage('Background notifications are off on this device. Open-app ringing is still available.'); return; }
      const result = await enablePush();
      setEnabled(result.ok);
      setMessage(result.ok ? 'Background reminders enabled on this device. Stay signed in to receive them with the app closed.'
        : result.reason === 'unsupported' ? 'This browser does not support push. On iPhone, add the app to your Home Screen, open it there and try again.'
        : result.reason === 'denied' ? 'Notifications are blocked. Allow them in your browser or device settings, then try again.'
        : result.reason === 'no_vapid' ? 'Background notifications need to be configured on the server. Please contact support.'
        : 'Could not enable background reminders. Check your connection and try again.');
    } catch { setMessage('Could not change notification settings. Check your connection and try again.'); } finally { setBusy(false); }
  };
  const choose = id => {
    previewRef.current?.stop(); previewRef.current = null;
    localStorage.setItem('ring_tone_id', id); setRingtoneId(id);
    setMessage(`${id === CUSTOM_RINGTONE_ID ? customName || 'Custom ringtone' : getRingtoneById(id).label} selected for open-app class reminders.`);
  };
  const test = async () => {
    previewRef.current?.stop();
    let sound;
    if (ringtoneId === CUSTOM_RINGTONE_ID) {
      try { const bytes = await loadCustomTone(); if (bytes) sound = makeCustomRingtone(bytes); } catch {}
    } else sound = getRingtoneById(ringtoneId).make();
    if (!sound) { setMessage('No custom ringtone is saved on this device. Choose a built-in tone instead.'); return; }
    previewRef.current = sound;
    setTimeout(() => { sound.stop(); if (previewRef.current === sound) previewRef.current = null; }, 2500);
    setMessage('Ringtone tested. Background alerts use your device notification sound; silent mode or Focus may silence them.');
  };
  return <div>
    <label className="tm-field" style={{ display: 'grid', gap: 6, maxWidth: 420, marginBottom: 12 }}><span>Open app ringtone</span>
      <select aria-label="Class reminder ringtone" value={ringtoneId} onChange={event => choose(event.target.value)} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--tm-line, #ded6ca)', background: 'var(--tm-surface, #fff)', color: 'inherit', font: 'inherit' }}>
        {RINGTONES.map(tone => <option key={tone.id} value={tone.id}>{tone.emoji} {tone.label}</option>)}
        {customName && <option value={CUSTOM_RINGTONE_ID}>🎧 {customName} (custom, this device)</option>}
      </select>
    </label>
    <div className="tm-actions"><button type="button" onClick={test}>Preview ringtone</button><button type="button" disabled={busy} onClick={toggle}>{busy ? 'Please wait…' : enabled ? 'Turn off background notifications' : 'Enable background reminders'}</button></div>
    <p className="tm-muted" role="status">{message}</p>
  </div>;
}
