// src/pages/teacher/tabs/WordSquadTab.jsx
// Word Squad for teachers (and admins, who see every set in the center):
// make question sets, check them, import a CSV, preview a question the way it
// appears above a gate in the game, publish, and give a set to group classes or
// students. The question checks are the server's own (server/utils/questionRules.js).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2, Upload } from 'lucide-react';
import api from '../../../api';
import { questionErrors, publishErrors, parseQuestionsCsv, LEVELS, LIMITS } from '../../../../server/utils/questionRules.js';
import './wordSquadTeacher.css';

const BASE = '/games';
const blankQuestion = () => ({ type: 'gap', prompt: '', answer: '', distractors: ['', '', ''] });
const toForm = (q) => ({ ...q, distractors: [...(q.distractors || []), '', '', ''].slice(0, 3) });
const fromForm = (q) => ({ type: q.type || 'gap', prompt: q.prompt, answer: q.answer, distractors: q.distractors.filter((d) => d.trim()) });
const msg = (err, fallback) => err?.response?.data?.message || fallback;

function Preview({ q, index }) {
  const [a, b = ''] = String(q?.prompt || 'Write a sentence with ___ in it.').split(/_{3,}/);
  const words = q ? [q.answer, ...q.distractors].filter((w) => w && w.trim()).slice(0, 3) : [];
  return (
    <div className="wst-preview" aria-label="Preview of the question in the game">
      <div className="wst-bubble">
        <span className="wst-bubble-tag">GATE {index + 1}</span>
        {a}<span className="wst-blank">{q?.answer || '_____'}</span>{b}
      </div>
      <div className="wst-gates">
        {(words.length ? words : ['word', 'word']).map((w, i) => <span key={i} className="wst-gate">{w}</span>)}
      </div>
    </div>
  );
}

function Editor({ initialId, onDone, flash }) {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('A1');
  const [status, setStatus] = useState('draft');
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [serverProblems, setServerProblems] = useState({});
  const [csvReport, setCsvReport] = useState(null);
  const [id, setId] = useState(initialId);

  useEffect(() => {
    if (!initialId) return;
    api.get(`${BASE}/sets/${initialId}`).then(({ data }) => {
      setTitle(data.data.title);
      setLevel(data.data.level);
      setStatus(data.data.status);
      setQuestions(data.data.questions.length ? data.data.questions.map(toForm) : [blankQuestion()]);
    }).catch((err) => flash(msg(err, 'Could not open the set'), true));
  }, [initialId, flash]);

  const rowErrors = useMemo(() => questions.map((q) => (q.prompt || q.answer || q.distractors.some(Boolean) ? questionErrors(fromForm(q)) : [])), [questions]);
  const filled = questions.filter((q) => q.prompt || q.answer);
  const readyErrors = publishErrors({ title, questions: filled.map(fromForm) });

  const update = (i, patch) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i, d) => setQuestions((qs) => {
    const j = i + d;
    if (j < 0 || j >= qs.length) return qs;
    const n = [...qs];
    [n[i], n[j]] = [n[j], n[i]];
    setSelected(j);
    return n;
  });
  const remove = (i) => setQuestions((qs) => (qs.length > 1 ? qs.filter((_, k) => k !== i) : [blankQuestion()]));
  const add = () => { setQuestions((qs) => [...qs, blankQuestion()]); setSelected(questions.length); };

  const onCsv = async (file) => {
    if (!file) return;
    const text = await file.text();
    const { questions: got, errors } = parseQuestionsCsv(text);
    setQuestions((qs) => [...qs.filter((q) => q.prompt || q.answer), ...got.map(toForm)].slice(0, LIMITS.maxQuestions));
    setCsvReport({ added: got.length, errors });
  };

  const save = async (andPublish = false) => {
    setBusy(true);
    setServerProblems({});
    const body = { title, level, questions: filled.map(fromForm) };
    try {
      let saved;
      if (id) saved = (await api.put(`${BASE}/sets/${id}`, body)).data.data;
      else { saved = (await api.post(`${BASE}/sets`, body)).data.data; setId(saved._id); }
      if (andPublish) {
        await api.post(`${BASE}/sets/${saved._id}/publish`);
        setStatus('published');
        flash('Published — you can give it to your students now');
        onDone();
      } else flash('Saved');
    } catch (err) {
      const problems = err?.response?.data?.problems;
      if (problems) {
        // map the server's indexes (of the filled questions) back to editor rows
        const rows = questions.map((q, i) => (q.prompt || q.answer ? i : -1)).filter((i) => i >= 0);
        setServerProblems(Object.fromEntries(problems.map((p) => [rows[p.index], p.errors])));
      }
      flash(msg(err, 'Could not save'), true);
    } finally { setBusy(false); }
  };

  const unpublish = async () => {
    try { await api.post(`${BASE}/sets/${id}/unpublish`); setStatus('draft'); flash('Back to draft'); }
    catch (err) { flash(msg(err, 'Could not change it'), true); }
  };

  return (
    <>
      <div className="wst-row">
        <button type="button" className="wst-btn wst-btn--sm" onClick={onDone}>← All sets</button>
        <h2>{id ? 'Edit question set' : 'New question set'}</h2>
        <span className={`wst-badge ${status === 'published' ? 'wst-badge--pub' : 'wst-badge--draft'}`}>{status}</span>
      </div>
      <div className="wst-layout">
        <div className="wst-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div className="wst-card wst-row">
            <label className="wst-field"><span className="wst-label">Title</span>
              <input className="wst-input" value={title} maxLength={120} placeholder="e.g. Unit 3 — Food" onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label style={{ width: 110 }}><span className="wst-label">Level</span>
              <select className="wst-input" value={level} onChange={(e) => setLevel(e.target.value)}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
          </div>

          <div className="wst-row">
            <h3>Questions ({filled.length})</h3>
            <span className="wst-spacer" />
            <label className="wst-btn wst-btn--sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} /> Import CSV
              <input type="file" accept=".csv,text/csv,.txt" hidden onChange={(e) => { onCsv(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <button type="button" className="wst-btn wst-btn--sm" onClick={add}><Plus size={14} /> Add question</button>
          </div>
          {csvReport && (
            <div className={`wst-toast ${csvReport.errors.length ? 'wst-toast--bad' : ''}`}>
              Added {csvReport.added} question{csvReport.added === 1 ? '' : 's'} from the CSV.
              {csvReport.errors.length > 0 && <> Skipped {csvReport.errors.length}: {csvReport.errors.slice(0, 3).map((e) => `line ${e.line} (${e.message})`).join('; ')}{csvReport.errors.length > 3 ? '…' : ''}</>}
            </div>
          )}
          <p className="wst-muted" style={{ margin: 0 }}>Write a sentence with one blank (___), the right word, and 1–3 wrong words. CSV columns: type, prompt, answer, distractor1, distractor2, distractor3.</p>

          {questions.map((q, i) => {
            const errs = serverProblems[i] || rowErrors[i];
            return (
              <div key={i} className={`wst-q${selected === i ? ' wst-q--on' : ''}`} onClick={() => setSelected(i)} onFocus={() => setSelected(i)}>
                <span className="wst-q-no">#{i + 1}</span>
                <div className="wst-q-fields">
                  <input className={`wst-input wst-q-prompt${errs.length ? ' wst-input--bad' : ''}`} aria-label={`Question ${i + 1} sentence`} placeholder="Sentence with ___ for the missing word" maxLength={LIMITS.prompt} value={q.prompt} onChange={(e) => update(i, { prompt: e.target.value })} />
                  <input className="wst-input" aria-label={`Question ${i + 1} right word`} placeholder="Right word" maxLength={LIMITS.word} value={q.answer} onChange={(e) => update(i, { answer: e.target.value })} />
                  {q.distractors.map((d, k) => (
                    <input key={k} className="wst-input" aria-label={`Question ${i + 1} wrong word ${k + 1}`} placeholder={`Wrong word ${k + 1}${k ? ' (optional)' : ''}`} maxLength={LIMITS.word} value={d}
                      onChange={(e) => update(i, { distractors: q.distractors.map((x, j) => (j === k ? e.target.value : x)) })} />
                  ))}
                  {errs.length > 0 && <ul className="wst-errors">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
                  <div className="wst-q-tools">
                    <button type="button" className="wst-btn wst-btn--sm" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                    <button type="button" className="wst-btn wst-btn--sm" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === questions.length - 1}><ArrowDown size={14} /></button>
                    <button type="button" className="wst-btn wst-btn--sm wst-btn--danger" aria-label="Delete question" onClick={() => remove(i)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="wst-sticky">
          <div className="wst-card">
            <h3 style={{ marginBottom: 10 }}>Preview</h3>
            <Preview q={questions[selected] ? fromForm(questions[selected]) : null} index={selected} />
            <p className="wst-muted" style={{ marginBottom: 0 }}>In the game the right word is shuffled among the gates.</p>
          </div>
          <div className="wst-card wst-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            {status !== 'published' && readyErrors.length > 0 && <ul className="wst-errors" style={{ margin: 0 }}>{readyErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
            <button type="button" className="wst-btn" disabled={busy || !title.trim()} onClick={() => save(false)}>{status === 'published' ? 'Save changes' : 'Save draft'}</button>
            {status !== 'published'
              ? <button type="button" className="wst-btn wst-btn--primary" disabled={busy || readyErrors.length > 0} onClick={() => save(true)}>Publish</button>
              : <button type="button" className="wst-btn" disabled={busy} onClick={unpublish}>Back to draft</button>}
          </div>
        </div>
      </div>
    </>
  );
}

function AssignForm({ set, onDone, flash }) {
  const [targets, setTargets] = useState(null);
  const [gc, setGc] = useState([]);
  const [st, setSt] = useState([]);
  const [search, setSearch] = useState('');
  const [chapters, setChapters] = useState(3);
  const [dueAt, setDueAt] = useState('');
  const [plays, setPlays] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`${BASE}/targets`).then(({ data }) => setTargets(data.data)).catch((err) => flash(msg(err, 'Could not load your classes'), true));
  }, [flash]);
  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const shownStudents = (targets?.students || []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`${BASE}/assignments`, {
        setId: set.id, groupClassIds: gc, studentIds: st, chapters, maxPlaysPerDay: plays,
        dueAt: dueAt ? new Date(`${dueAt}T23:59:00`).toISOString() : null,
      });
      flash(`“${set.title}” is now in your students' Word Squad`);
      onDone();
    } catch (err) { flash(msg(err, 'Could not give the game'), true); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="wst-row">
        <button type="button" className="wst-btn wst-btn--sm" onClick={onDone}>← All sets</button>
        <h2>Give “{set.title}” to students</h2>
      </div>
      {!targets ? <p className="wst-muted">Loading your classes…</p> : (
        <div className="wst-layout">
          <div className="wst-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div className="wst-card">
              <h3 style={{ marginBottom: 8 }}>Group classes</h3>
              {targets.groupClasses.length === 0 ? <p className="wst-muted">No recent group classes.</p> : (
                <div className="wst-list">
                  {targets.groupClasses.map((g) => (
                    <label key={g.id} className="wst-check">
                      <input type="checkbox" checked={gc.includes(g.id)} onChange={() => toggle(gc, setGc, g.id)} />
                      <span>{g.title} <span className="wst-muted">· {new Date(g.scheduledTime).toLocaleDateString()} · {g.students} student{g.students === 1 ? '' : 's'}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="wst-card">
              <div className="wst-row" style={{ marginBottom: 8 }}>
                <h3>Students</h3>
                <span className="wst-spacer" />
                <input className="wst-input" style={{ maxWidth: 200 }} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {targets.students.length === 0 ? <p className="wst-muted">No students yet.</p> : (
                <div className="wst-list">
                  {shownStudents.map((s) => (
                    <label key={s.id} className="wst-check">
                      <input type="checkbox" checked={st.includes(s.id)} onChange={() => toggle(st, setSt, s.id)} />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="wst-sticky">
            <div className="wst-card wst-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <label><span className="wst-label">Chapters</span>
                <select className="wst-input" value={chapters} onChange={(e) => setChapters(Number(e.target.value))}>
                  <option value={1}>1 — Bug Town</option><option value={2}>2 — up to Candy Jungle</option><option value={3}>3 — all chapters</option>
                </select>
              </label>
              <label><span className="wst-label">Due date (optional)</span>
                <input className="wst-input" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
              </label>
              <label><span className="wst-label">Plays per day that earn stars</span>
                <input className="wst-input" type="number" min={1} max={20} value={plays} onChange={(e) => setPlays(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
              </label>
              <p className="wst-muted" style={{ margin: 0 }}>{gc.length} group class{gc.length === 1 ? '' : 'es'} · {st.length} student{st.length === 1 ? '' : 's'} chosen</p>
              <button type="button" className="wst-btn wst-btn--primary" disabled={busy || (!gc.length && !st.length)} onClick={submit}>Give to students</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function WordSquadTab({ isDarkMode }) {
  const [view, setView] = useState({ name: 'list' });
  const [sets, setSets] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState(null);

  const flash = useCallback((text, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api.get(`${BASE}/sets`), api.get(`${BASE}/assignments`)]);
      setSets(s.data.data);
      setAssignments(a.data.data);
    } catch (err) { setSets([]); flash(msg(err, 'Could not load Word Squad'), true); }
  }, [flash]);
  useEffect(() => { if (view.name === 'list') load(); }, [view, load]);

  const duplicate = async (s) => { try { await api.post(`${BASE}/sets/${s.id}/duplicate`); flash('Copied'); load(); } catch (err) { flash(msg(err, 'Could not copy'), true); } };
  const remove = async (s) => {
    if (!window.confirm(`Delete “${s.title}”? This can't be undone.`)) return;
    try { await api.delete(`${BASE}/sets/${s.id}`); flash('Deleted'); load(); } catch (err) { flash(msg(err, 'Could not delete'), true); }
  };
  const toggleAssignment = async (a) => {
    try { await api.patch(`${BASE}/assignments/${a.id}`, { active: !a.active }); load(); } catch (err) { flash(msg(err, 'Could not change it'), true); }
  };
  const back = () => setView({ name: 'list' });

  return (
    <div className={`wst${isDarkMode ? ' wst--dark' : ''}`}>
      {toast && <div className={`wst-toast${toast.bad ? ' wst-toast--bad' : ''}`} role="status">{toast.text}</div>}
      {view.name === 'edit' && <Editor initialId={view.id} onDone={back} flash={flash} />}
      {view.name === 'assign' && <AssignForm set={view.set} onDone={back} flash={flash} />}
      {view.name === 'list' && (
        <>
          <div className="wst-row">
            <div>
              <h2>Word Squad 🎮</h2>
              <p className="wst-muted" style={{ margin: '4px 0 0' }}>Make question sets from your lessons and give them to your students to play.</p>
            </div>
            <span className="wst-spacer" />
            <button type="button" className="wst-btn wst-btn--primary" onClick={() => setView({ name: 'edit' })}><Plus size={14} /> New question set</button>
          </div>

          {sets === null ? <p className="wst-muted">Loading…</p> : sets.length === 0 ? (
            <div className="wst-card"><p style={{ margin: 0 }}>No question sets yet. Start one with <b>New question set</b> — or import a CSV.</p></div>
          ) : (
            <div className="wst-grid">
              {sets.map((s) => (
                <div key={s.id} className="wst-card wst-set">
                  <div className="wst-row">
                    <span className="wst-set-title">{s.title}</span>
                    <span className="wst-spacer" />
                    <span className={`wst-badge ${s.status === 'published' ? 'wst-badge--pub' : 'wst-badge--draft'}`}>{s.status}</span>
                  </div>
                  <span className="wst-muted">{s.level} · {s.questionCount} questions{s.activeAssignments ? ` · given ${s.activeAssignments}×` : ''}</span>
                  <div className="wst-row">
                    <button type="button" className="wst-btn wst-btn--sm" onClick={() => setView({ name: 'edit', id: s.id })}>Edit</button>
                    <button type="button" className="wst-btn wst-btn--sm wst-btn--primary" disabled={s.status !== 'published'} title={s.status !== 'published' ? 'Publish the set first' : ''} onClick={() => setView({ name: 'assign', set: s })}>Give to students</button>
                    <button type="button" className="wst-btn wst-btn--sm" aria-label="Copy" onClick={() => duplicate(s)}><Copy size={14} /></button>
                    <button type="button" className="wst-btn wst-btn--sm wst-btn--danger" aria-label="Delete" onClick={() => remove(s)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="wst-card">
            <h3 style={{ marginBottom: 8 }}>Given to students</h3>
            {assignments.length === 0 ? <p className="wst-muted" style={{ margin: 0 }}>Nothing given yet.</p> : (
              <table className="wst-table">
                <thead><tr><th>Set</th><th>Who</th><th>Due</th><th>Played by</th><th /></tr></thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id} style={{ opacity: a.active ? 1 : 0.55 }}>
                      <td>{a.setTitle}{a.setStatus !== 'published' && <span className="wst-badge wst-badge--draft" style={{ marginLeft: 6 }}>not playable</span>}</td>
                      <td>{[a.groupClasses && `${a.groupClasses} class${a.groupClasses > 1 ? 'es' : ''}`, a.students && `${a.students} student${a.students > 1 ? 's' : ''}`].filter(Boolean).join(' + ')}</td>
                      <td>{a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—'}</td>
                      <td>{a.players}</td>
                      <td><button type="button" className="wst-btn wst-btn--sm" onClick={() => toggleAssignment(a)}>{a.active ? 'Stop' : 'Restart'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
