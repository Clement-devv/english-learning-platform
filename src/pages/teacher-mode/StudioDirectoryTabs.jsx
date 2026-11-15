import { studioText } from './studioLanguage';
import { useState } from 'react';
import { Archive, ArrowUpRight, Building2, CalendarDays, Mail, Pencil, Plus, ShieldCheck, Users, Wallet } from 'lucide-react';
import api from '../../api';
import StudentContactEditor from './StudentContactEditor';
import StudentClassBalance from './StudentClassBalance';
import { currencyFactor, studioMoney } from './studioFormatting';
import { CenterHint, PanelHeading, StudioEmpty, StudioIntro, StudioSearch } from './StudioUI';

const blankCenter = { name: '', notificationEmail: '', currency: 'USD', payBasis: 'class', salaryDay: 31, rate: '', prepaid: false, meetingUrl: '' };

export function ManagedStudentForm({ centers, centerId = '', fixedCenter = false, busy, run, onDone }) {
  const [selected, setSelected] = useState(centerId), [form, setForm] = useState({ name: '', notifyEmail: '', classCount: '' });
  const center = centers.find(c => c._id === selected);
  return <form className="tm-managed-student-form" aria-label={fixedCenter ? `New student at ${center?.name || 'managed center'}` : 'New managed student'} onSubmit={e => { e.preventDefault(); run(async () => {
    if (!center || center.archived) throw new Error('Choose an active center for this student.');
    const { classCount, ...details } = form;
    await api.post('/managed-students', { ...details, centerId: selected, ...(classCount === '' ? {} : { classCount: Number(classCount) }) });
    setForm({ name: '', notifyEmail: '', classCount: '' }); onDone?.();
  }); }}>
    {fixedCenter ? <CenterHint center={center} /> : <label>Student’s managed center<select required value={selected} onChange={e => setSelected(e.target.value)}><option value="">{studioText("Choose a center")}</option>{centers.filter(c => !c.archived).map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>}
    <label>{studioText("Student name")}<input required placeholder="Student’s first and last name" maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>{studioText("Parent email (optional)")}<input type="email" placeholder="family@example.com" value={form.notifyEmail} onChange={e => setForm({ ...form, notifyEmail: e.target.value })} /></label>
    <label>{studioText("Number of classes (optional)")}<input type="number" min="0" step="1" max="1000000000" value={form.classCount} onChange={e => setForm({ ...form, classCount: e.target.value })} /><small>Add paid classes here or update the balance before booking.</small></label>
    <div className="tm-form-footer"><button className="tm-primary" disabled={busy || !center || center.archived}>{busy ? 'Adding…' : 'Add student'}<Plus size={14} /></button>{onDone && <button type="button" onClick={onDone}>{studioText("Cancel")}</button>}</div>
    <p className="tm-form-note"><ShieldCheck size={13} />The student belongs to this center and does not need a login.</p>
  </form>;
}

function CenterRecord({ center: c, students, index, centers, busy, run, onEdit, onViewStudents }) {
  const [creating, setCreating] = useState(false);
  const roster = students.filter(s => s.managedCenterId === c._id);
  return <article className={`tm-card tm-center-record ${c.archived ? 'is-archived' : ''}`}>
    <div className="tm-row"><span className={`tm-center-monogram tone-${index % 3}`}><Building2 size={23} strokeWidth={1.3} /></span><span className={`tm-status-label ${c.archived ? '' : 'is-active'}`}><span />{c.archived ? 'Archived' : 'Active center'}</span></div>
    <h3>{c.name}</h3><div className="tm-center-rate"><strong>{studioMoney(c.rateMinor, c.currency)}</strong><span> / {c.payBasis === 'hour' ? 'hour' : 'class'}</span></div>
    <div className="tm-center-facts"><span><Users size={14} />{roster.length} {roster.length === 1 ? 'student' : 'students'}</span><span><Wallet size={14} />Paid classes required</span><span><CalendarDays size={14} />Salary day {c.salaryDay || 31}</span></div>
    <section className="tm-center-roster" aria-label={`Students at ${c.name}`}><div className="tm-row"><span className="tm-eyebrow">STUDENTS IN THIS CENTER</span>{roster.length > 0 && <button className="tm-text-button" onClick={() => onViewStudents(c._id)}>View all<ArrowUpRight size={12} /></button>}</div>{roster.length ? <div className="tm-roster-chips">{roster.slice(0, 6).map(s => <span key={s._id}>{s.firstName}{!s.active && <small> · archived</small>}</span>)}{roster.length > 6 && <span>+{roster.length - 6} more</span>}</div> : <p>No students yet. Create the first student below.</p>}</section>
    {!c.archived && <button className="tm-center-create-student" aria-label={`${creating ? 'Close student form for' : 'Create student in'} ${c.name}`} aria-expanded={creating} onClick={() => setCreating(!creating)}><Plus size={15} />{creating ? 'Close student form' : 'Create student'}</button>}
    {creating && !c.archived && <ManagedStudentForm centers={centers} centerId={c._id} fixedCenter busy={busy} run={run} onDone={() => setCreating(false)} />}
    <div className="tm-record-footer"><button onClick={() => onEdit(c)}><Pencil size={13} />Edit settings</button><button className="tm-icon-action" aria-label={`${c.archived ? 'Restore' : 'Archive'} ${c.name}`} disabled={busy} onClick={() => run(() => api.put(`/managed-centers/${c._id}`, { ...c, archived: !c.archived }))}>{c.archived ? 'Restore' : <Archive size={15} />}</button></div>
  </article>;
}

export function CentersSection({ centers, students, busy, run, onViewStudents }) {
  const [form, setForm] = useState(blankCenter), [search, setSearch] = useState(''), [editing, setEditing] = useState(false);
  const filtered = centers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <StudioIntro eyebrow="YOUR TEACHING, IN EVERY PLACE" title="A home for each center." aside={<button className="tm-primary" aria-expanded={editing} aria-controls="studio-center-editor" onClick={() => { setForm(blankCenter); setEditing(!editing); }}><Plus size={15} />{editing ? 'Close center form' : 'Add managed center'}</button>}>See the students in each school or private client. Create new students directly inside the center they belong to.</StudioIntro>
    <div className={`tm-center-page-layout ${editing ? 'with-editor' : ''}`}>
      {editing && <form id="studio-center-editor" className="tm-card tm-editor-panel" onSubmit={e => { e.preventDefault(); run(async () => { const payload = { ...form, rateMinor: Math.round(Number(form.rate) * currencyFactor(form.currency)) }; await (form._id ? api.put(`/managed-centers/${form._id}`, payload) : api.post('/managed-centers', payload)); setForm(blankCenter); setEditing(false); }); }}>
        <PanelHeading icon={form._id ? Pencil : Plus} eyebrow="CENTER DETAILS" title={form._id ? 'Edit managed center' : 'Add a managed center'} />
        <label>Center email (optional)<input type="email" maxLength={254} value={form.notificationEmail || ''} onChange={e => setForm({ ...form, notificationEmail: e.target.value })} /><small>Receives this teacher’s daily report for this center and family absence notifications.</small></label>
        <label>Center or client name<input required placeholder="e.g. Sunrise English" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <div className="tm-field-pair"><label>{studioText("Currency")}<select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>{['USD', 'EUR', 'GBP', 'VND', 'JPY', 'CAD', 'AUD', 'PHP'].map(c => <option key={c}>{c}</option>)}</select></label><label>{studioText("Your rate")}<input required type="number" min="0" step="any" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} /></label></div>
        <label>{studioText("Pay basis")}<select value={form.payBasis} onChange={e => setForm({ ...form, payBasis: e.target.value })}><option value="class">{studioText("Per class")}</option><option value="hour">{studioText("Per hour")}</option></select></label>
        <label>{studioText("Salary payment day")}<select value={form.salaryDay || 31} onChange={e => setForm({ ...form, salaryDay: Number(e.target.value) })}>{Array.from({ length: 31 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day === 31 ? "31st (or last day of shorter months)" : `Day ${day}`}</option>)}</select><small>Pay periods run from the day after the previous payment date through this day. Days 29–31 use the last day in shorter months.</small></label>
        <label>Meeting link (optional)<input type="url" value={form.meetingUrl} onChange={e => setForm({ ...form, meetingUrl: e.target.value })} placeholder="https://meet.google.com/…" /></label>
        <div className="tm-form-footer"><button className="tm-primary" disabled={busy}>{busy ? 'Saving…' : 'Save center'}<ArrowUpRight size={15} /></button><button type="button" onClick={() => setEditing(false)}>{studioText("Cancel")}</button></div>
      </form>}
      <section className="tm-records-panel"><div className="tm-list-toolbar"><h3>Your centers <span>{centers.length}</span></h3><StudioSearch value={search} onChange={setSearch} label="Search centers" placeholder="Find a center…" /></div>
        {!filtered.length ? <StudioEmpty title={centers.length ? 'No matching centers.' : 'Your teaching starts here.'} action={!centers.length ? 'Add your first center' : undefined} onAction={() => { setForm(blankCenter); setEditing(true); }}>{centers.length ? 'Try a different center name.' : 'Add a school you teach for, or create “Private students” for your own clients.'}</StudioEmpty> : <div className="tm-center-list">{filtered.map((c, i) => <CenterRecord key={c._id} center={c} students={students} centers={centers} index={i} busy={busy} run={run} onViewStudents={onViewStudents} onEdit={value => { setForm({ ...value, rate: String(value.rateMinor / currencyFactor(value.currency)) }); setEditing(true); }} />)}</div>}
      </section>
    </div>
  </>;
}

export function StudentsSection({ centers, students, busy, run, refresh, centerFilter, onCenterFilter }) {
  const [search, setSearch] = useState(''), [creating, setCreating] = useState(false);
  const matches = students.filter(s => (!centerFilter || s.managedCenterId === centerFilter) && `${s.firstName} ${s.notifyEmail || ''} ${centers.find(c => c._id === s.managedCenterId)?.name || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <>
    <StudioIntro eyebrow="ALL YOUR STUDENTS, CLEARLY CONNECTED" title="Every student. Their own center." aside={<button className="tm-primary" aria-expanded={creating} onClick={() => setCreating(!creating)}><Plus size={15} />{creating ? 'Close student form' : 'Create student'}</button>}>Your complete student directory across all managed centers. Each student stays attached to their center; sharing links live in Parent links.</StudioIntro>
    {creating && <section className="tm-card tm-directory-create"><PanelHeading icon={Plus} eyebrow="GROW YOUR CLASSROOM" title="Add a managed student" /><ManagedStudentForm key={centerFilter} centers={centers} centerId={centerFilter} busy={busy} run={run} onDone={() => setCreating(false)} /></section>}
    <div className="tm-list-toolbar tm-directory-toolbar"><h3>Your students <span>{matches.length} / {students.length}</span></h3><div className="tm-directory-filters"><label><span className="tm-sr-only">Filter students by center</span><select value={centerFilter} onChange={e => onCenterFilter(e.target.value)}><option value="">{studioText("All centers")}</option>{centers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label><StudioSearch value={search} onChange={setSearch} label="Search students" placeholder="Student, email, or center…" /></div></div>
    {!matches.length ? <StudioEmpty icon={Users} title={students.length ? 'No matching students.' : 'Meet your next little breakthrough.'}>{students.length ? 'Try another search or choose All centers.' : 'Create a student inside a managed center, or use Create student above.'}</StudioEmpty> : <div className="tm-student-grid tm-student-directory">{matches.map((s, i) => <article className={`tm-card tm-student-record ${s.active ? '' : 'is-archived'}`} key={s._id}>
      <div className="tm-row"><span className={`tm-student-avatar tone-${i % 3}`}>{s.firstName.slice(0, 1)}</span><span className={`tm-status-label ${s.active ? 'is-active' : ''}`}><span />{s.active ? 'Active' : 'Archived'}</span></div><h3>{s.firstName}</h3><div className="tm-student-center-label"><Building2 size={15} /><span>{centers.find(c => c._id === s.managedCenterId)?.name || 'Managed center'}</span></div><p className="tm-contact-line"><Mail size={13} />{s.notifyEmail || 'No family email yet'}</p>
      <StudentContactEditor student={s} onSaved={refresh} />
      <StudentClassBalance student={s} onSaved={refresh} />
      <div className="tm-record-footer"><button disabled={busy} onClick={() => run(() => api.patch(`/managed-students/${s._id}`, { active: !s.active }))}><Archive size={13} />{s.active ? 'Archive student' : 'Restore student'}</button></div>
    </article>)}</div>}
  </>;
}
