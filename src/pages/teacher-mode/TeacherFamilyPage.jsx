import ManualCompletionNotice from './ManualCompletionNotice';
import StudioLanguageSwitch from './StudioLanguageSwitch';
import { useStudioLanguage } from './useStudioLanguage';
import { studioText } from './studioLanguage';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { BookOpen, MessageCircle, Moon, Sun } from 'lucide-react';
import { modeBase } from './client';
import './teacherMode.css';
import FamilyClassUpdates from './FamilyClassUpdates';
import FamilyRecordings from './FamilyRecordings';
import FamilySchedule from './FamilySchedule';
import FamilyActivities from './FamilyActivities';

export default function TeacherFamilyPage() {
  useStudioLanguage('family');
  const { token } = useParams(), base = `${modeBase}/family/${token}`;
  const key = `teacher-family:${token}`;
  const [dark, setDark] = useState(() => { const saved = localStorage.getItem('teacherFamilyDark'); return saved == null ? localStorage.getItem('teacherModeDark') === 'true' : saved === 'true'; });
  const [access, setAccess] = useState(() => sessionStorage.getItem(key) || '');
  const [name, setName] = useState(''), [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [notice, setNotice] = useState(''), [scheduleView, setScheduleView] = useState('upcoming');
  const request = useCallback((method, route, body) => axios({ method, url: `${base}${route}`, data: body, headers: { 'x-share-access': access } }), [base, access]);
  const load = useCallback(async () => {
    if (!access) return;
    try { const response = await request('get', '/'); setData(response.data.data); setError(''); }
    catch (e) { setError(e.response?.data?.message || 'Unable to load this learning page. Please retry.'); if (e.response?.status === 403) { setAccess(''); sessionStorage.removeItem(key); } }
  }, [access, request, key]);
  useEffect(() => { load(); const timer = setInterval(() => { if (!document.hidden) load(); }, 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    const meta = document.createElement('meta'); meta.name = 'robots'; meta.content = 'noindex,nofollow'; document.head.appendChild(meta);
    const ref = document.createElement('meta'); ref.name = 'referrer'; ref.content = 'no-referrer'; document.head.appendChild(ref);
    return () => { meta.remove(); ref.remove(); };
  }, []);
  const run = async fn => { setBusy(true); setNotice(''); try { await fn(); await load(); } catch (e) { setError(e.response?.data?.message || 'Unable to save. Please try again.'); } finally { setBusy(false); } };
  return <main className="tm tm-family" data-dark={dark}><header className="tm-family-header"><a href="/">Clemify</a><span className="tm-eyebrow">A WINDOW INTO THEIR LEARNING</span><StudioLanguageSwitch scope="family" /><button type="button" className="tm-family-theme" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => { const next = !dark; setDark(next); localStorage.setItem("teacherFamilyDark", String(next)); }}>{dark ? <Sun size={16} /> : <Moon size={16} />}{studioText(dark ? "Light mode" : "Dark mode")}</button></header>{error && <p role="alert" className="tm-notice tm-error">{error}</p>}{notice && <p role="status" className="tm-notice">{notice}</p>}
    {!access && <section className="tm-card tm-family-gate"><BookOpen size={36} /><h1>{studioText("A little closer to their learning.")}</h1><p>{studioText("This private page was shared by your child’s teacher. Confirm the student’s name to open their updates.")}</p><form onSubmit={e => { e.preventDefault(); run(async () => { const r = await axios.post(`${base}/unlock`, { studentName: name }); const value = r.data.data.access; sessionStorage.setItem(key, value); setAccess(value); }); }}><label>{studioText("Student’s name")}<input required value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></label><button disabled={busy} className="tm-primary">{studioText("Open learning page")}</button></form><p className="tm-muted">{studioText("No parent account or school code needed. Keep this link private.")}</p></section>}
    {access && !data && <p role="status">Opening your learning page…</p>}
    {data && access && <><ManualCompletionNotice lessons={data.manualCompletions} /><section className="tm-hero tm-family-welcome"><span className="tm-eyebrow">{data.center} · WITH {data.teacher}</span><h1>{studioText("Learning journey of")} {data.student.firstName}</h1><p>{studioText("Everything you need to follow your child’s learning, in one private place.")}</p>{data.student.classesRemaining != null && <div className="tm-parent-class-balance"><span>{studioText("Classes used")}</span><strong>{data.student.classesUsed || 0} / {data.student.classesRemaining + (data.student.classesUsed || 0)}</strong>{data.student.classesRemaining <= 3 && <span className="tm-class-low" role="status">{data.student.classesRemaining === 0 ? studioText("No classes left") : studioText("Classes low. Please contact the admin.")}</span>}</div>}<nav className="tm-family-navigation" aria-label="Parent page sections"><a href="#family-schedule" onClick={() => setScheduleView("upcoming")}>{studioText("Class schedule")}</a><a href="#family-schedule" onClick={() => setScheduleView("completed")}>{studioText("Completed classes")}</a><a href="#family-reviews">{studioText("Class reviews")}</a><a href="#family-recordings">{studioText("Recordings")}</a><a href="#family-activities">{studioText("Homework & quizzes")}</a><a href="#family-messages">{studioText("Message teacher")}</a></nav></section>
    <div id="family-schedule"><FamilySchedule request={request} base={base} access={access} view={scheduleView} onView={setScheduleView} /></div>
    <FamilyClassUpdates work={data.work || []} request={request} run={run} busy={busy} />
    <FamilyRecordings request={request} base={base} access={access} />
    <FamilyActivities activities={data.activities || []} />
    <section id="family-messages" className="tm-card"><h2><MessageCircle size={23} /> Talk with {data.teacher}</h2><p className="tm-muted">{studioText("Questions, progress and encouragement—all in one conversation.")}</p><div className="tm-thread">{data.messages.slice().reverse().map(m => <article className={`tm-bubble ${m.sender === 'family' ? 'mine' : ''}`} key={m._id}><small>{m.sender === 'teacher' ? data.teacher : 'Via this parent link'} · {new Date(m.createdAt).toLocaleString()}</small><p>{m.text}</p></article>)}</div><form onSubmit={e => { e.preventDefault(); run(async () => { await request('post', '/messages', { text: message }); setMessage(''); setNotice('Your message has been saved for the teacher.'); }); }}><label>{studioText("Your message")}<textarea required maxLength={3000} value={message} onChange={e => setMessage(e.target.value)} /></label><button disabled={busy} className="tm-primary">{studioText("Send to teacher")}</button></form></section></>}
  </main>;
}
