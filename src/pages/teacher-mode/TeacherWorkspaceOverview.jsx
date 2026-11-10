import { studioText } from './studioLanguage';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Building2, CalendarDays, Check, Clock3, Link2, MessageCircle, Play, Plus, Video } from 'lucide-react';

const lessonDate = date => new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(date));
const lessonTime = date => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));

export default function TeacherWorkspaceOverview({ teacher, centers, students, work, messages, onNavigate }) {
  const upcoming = work.filter(w => ['accepted', 'open', 'full', 'in-progress'].includes(w.status))
    .slice().sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));
  const next = upcoming.find(w => new Date(w.scheduledTime) >= new Date()) || upcoming[0];
  const published = work.filter(w => w.update?.published);
  const familyNotes = messages.filter(m => m.sender === 'family').slice(0, 3);
  const stats = [
    { label: 'Managed centers', value: centers.filter(c => !c.archived).length, detail: 'Your schools & private clients', Icon: Building2 },
    { label: 'Students', value: students.length, detail: 'Learning in your workspace', Icon: BookOpen },
    { label: 'Classes taught', value: work.filter(w => w.status === 'completed').length, detail: 'A record of your teaching', Icon: Check },
    { label: 'Published updates', value: published.length, detail: 'Learning shared with families', Icon: Link2 },
  ];
  return <>
    <section className="tm-studio-hero" aria-labelledby="studio-title">
      <div className="tm-hero-copy">
        <span className="tm-greeting"><span className="tm-status-dot" />{studioText("Hello")}, {teacher.firstName || studioText("teacher")}.</span>
        <h2 id="studio-title">{studioText("Your teaching.")}<br /><em>{studioText("Closer connections.")}</em></h2>
        <p>{studioText("A space for every lesson, every student, and every little breakthrough. All yours.")}</p>
        <div className="tm-actions"><button className="tm-primary" onClick={() => onNavigate('classes')}><Plus size={16} />{studioText("Record a lesson")}</button><button className="tm-quiet-button" onClick={() => onNavigate('parent-links')}>{studioText("Share a parent link")}<ArrowUpRight size={16} /></button></div>
        <span className="tm-hero-footnote"><span className="tm-mini-line" /> {studioText("Independent teaching. Thoughtfully connected.")}</span>
      </div>
      <div className="tm-hero-scene">
        <div className="tm-scene-arch" aria-hidden="true" /><div className="tm-scene-orb" aria-hidden="true" /><div className="tm-scene-plinth" aria-hidden="true" />
        <article className="tm-glass-lesson">
          <div className="tm-row"><span className="tm-eyebrow">{next ? 'NEXT IN YOUR WORKSPACE' : 'YOUR TEACHING STUDIO'}</span><span className="tm-round-icon"><Video size={16} /></span></div>
          <span className="tm-lesson-marker">{next ? <><span className="tm-status-dot" />{centers.find(c => c._id === next.managedCenterId)?.name || 'Your lesson'}</> : <><span className="tm-status-dot" /> Ready when you are</>}</span>
          <h3>{next?.classTitle || 'Make every lesson count.'}</h3>
          <p>{next ? `${next.studentId?.firstName || (next.isGroupClass ? 'Group lesson' : 'Student')} · ${lessonDate(next.scheduledTime)}` : 'Teach. Record. Share the progress.'}</p>
          <div className="tm-lesson-bottom"><span><Clock3 size={14} />{next ? `${lessonTime(next.scheduledTime)} · ${next.duration} min` : 'Your own schedule'}</span><button aria-label={next ? 'View next lesson' : 'Plan your first lesson'} onClick={() => onNavigate('classes')}><ArrowUpRight size={19} /></button></div>
        </article>
        <div className="tm-scene-caption" aria-hidden="true"><span>YOUR CRAFT.</span><span>YOUR SPACE.</span></div>
      </div>
    </section>

    <div className="tm-grid tm-stats">{stats.map(({ label, value, detail, Icon }) => <article className="tm-card tm-stat" key={label}><div className="tm-row"><span>{label}</span><Icon size={17} /></div><strong>{String(value).padStart(2, '0')}</strong><p>{detail}</p></article>)}</div>

    <div className="tm-overview-columns">
      <section className="tm-card tm-lessons-panel"><div className="tm-panel-heading"><div><span className="tm-eyebrow">A LITTLE STRUCTURE, MORE SPACE TO TEACH</span><h2>Your next lessons</h2></div><button className="tm-text-button" onClick={() => onNavigate('schedule')}>Calendar<ArrowUpRight size={15} /></button></div>
        {upcoming.length ? <div className="tm-lesson-list">{upcoming.slice(0, 4).map(w => <button className="tm-lesson-row" key={w._id} onClick={() => onNavigate('classes')}><span className="tm-date-tile"><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(w.scheduledTime))}</span><strong>{new Date(w.scheduledTime).getDate()}</strong></span><span className="tm-lesson-title"><strong>{w.classTitle}</strong><span>{w.studentId?.firstName || 'Group lesson'} · {centers.find(c => c._id === w.managedCenterId)?.name || 'Managed center'}</span></span><span className="tm-lesson-time">{lessonTime(w.scheduledTime)}<small>{w.duration} min</small></span><ArrowUpRight size={16} /></button>)}</div> : <div className="tm-overview-empty"><CalendarDays size={27} /><h3>A little room for your next lesson.</h3><p>Plan a class or log one you’ve already taught.</p><button onClick={() => onNavigate(centers.length ? 'classes' : 'centers')}><Plus size={15} />{centers.length ? 'Add a lesson' : 'Create a managed center'}</button></div>}
      </section>
      <section className="tm-card tm-family-panel"><div className="tm-panel-heading"><div><span className="tm-eyebrow">BEYOND THE CLASSROOM</span><h2>A closer connection</h2></div><MessageCircle size={21} /></div>
        {familyNotes.length ? <div className="tm-family-notes">{familyNotes.map(m => <button key={m._id} className="tm-family-note" onClick={() => onNavigate('parents')}><span className="tm-note-avatar">{students.find(s => s._id === m.studentId)?.firstName?.slice(0, 1) || 'P'}</span><span><strong>{students.find(s => s._id === m.studentId)?.firstName || 'Family'}’s family{!m.readAt && <i aria-label="Unread message" />}</strong><span>{m.text}</span></span><ArrowDownLeft size={15} /></button>)}</div> : <div className="tm-parent-link-art" aria-hidden="true"><span className="tm-art-person">You</span><span className="tm-art-connection"><span /><Link2 size={21} /><span /></span><span className="tm-art-person">Family</span></div>}
        <p>Give parents a window into the progress. One private link for updates, recordings, and conversations.</p><button className="tm-text-button" onClick={() => onNavigate(familyNotes.length ? 'parents' : 'parent-links')}>{familyNotes.length ? 'Open parent responses' : 'Share a parent link'}<ArrowUpRight size={15} /></button>
      </section>
    </div>
    <section className="tm-studio-strip"><span className="tm-round-icon"><Play size={17} /></span><div><h3>Good work deserves to be seen.</h3><p>Keep the recording. Share the breakthrough. Let families follow along.</p></div><button onClick={() => onNavigate('recordings')}>Open recordings<ArrowUpRight size={16} /></button></section>
  </>;
}
