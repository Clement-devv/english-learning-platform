// src/pages/teacher/tabs/WordSquadTab.jsx
// Word Squad for teachers (and admins, who see every set in the center):
// make question sets, check them, import a CSV, preview a question the way it
// appears above a gate in the game, publish, and give a set to group classes or
// students. The question checks are the server's own (server/utils/questionRules.js).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Copy, Download, Link2, Play, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';
import { teacherModeLink } from '../../../utils/teacherMode';
import { questionErrors, publishErrors, parseQuestionsCsv, LEVELS, LIMITS } from '../../../../server/utils/questionRules.js';
import { EXAMPLE_SET_TITLE, EXAMPLE_QUESTIONS, exampleCsv } from '../../../../server/utils/exampleQuestions.js';
import WordSquadAi from './WordSquadAi.jsx';
import './wordSquadTeacher.css';

const BASE = '/games';
const blankQuestion = () => ({ type: 'gap', prompt: '', answer: '', distractors: ['', '', ''] });
const toForm = (q) => ({ ...q, distractors: [...(q.distractors || []), '', '', ''].slice(0, 3) });
const fromForm = (q) => ({ type: q.type || 'gap', prompt: q.prompt, answer: q.answer, distractors: q.distractors.filter((d) => d.trim()) });
const msg = (err, fallback) => err?.response?.data?.message || fallback;

function downloadExampleCsv() {
  const url = URL.createObjectURL(new Blob([exampleCsv()], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'word-squad-example.csv' });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The pattern to follow, shown above the questions: one filled-in question,
// the rules the checks use, and the same thing as CSV rows
const GUIDE_EXAMPLE = { prompt: 'My sister ___ long hair.', answer: 'has', distractors: ['have', 'is', 'having'] };
const GUIDE_CSV = [
  'type,prompt,answer,distractor1,distractor2,distractor3',
  'gap,My sister ___ long hair.,has,have,is,having',
  'gap,School starts ___ seven thirty.,at,in,on',
  'gap,How ___ pens do you have?,many,much',
  'gap,"Yes, I ___ a dog.",have,has,having',
].join('\n');
const GUIDE_KEY = 'wsGuideClosed';

function QuestionGuide({ flash }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(GUIDE_KEY) !== '1'; } catch { return true; } });
  const toggle = (e) => {
    const now = e.currentTarget.open;
    setOpen(now);
    try { localStorage.setItem(GUIDE_KEY, now ? '0' : '1'); } catch { /* storage unavailable */ }
  };
  const copyCsv = async () => {
    try { await navigator.clipboard.writeText(GUIDE_CSV + '\n'); flash('Example rows copied — paste them into a spreadsheet or a .csv file'); }
    catch { flash('Could not copy — select the rows and copy them', true); }
  };
  return (
    <details className="wst-card wst-guide" open={open} onToggle={toggle}>
      <summary><BookOpen size={15} /> How to write a question — follow this example</summary>

      <div className="wst-guide-example" aria-label="Example question">
        <span className="wst-q-no">#1</span>
        <div className="wst-q-fields">
          <div className="wst-guide-cell wst-q-prompt"><span className="wst-label">Sentence</span>My sister <b className="wst-guide-blank">___</b> long hair.</div>
          <div className="wst-guide-cell wst-guide-cell--ok"><span className="wst-label">Right word</span>{GUIDE_EXAMPLE.answer}</div>
          {GUIDE_EXAMPLE.distractors.map((d, i) => (
            <div key={d} className="wst-guide-cell"><span className="wst-label">Wrong word {i + 1}{i ? ' (optional)' : ''}</span>{d}</div>
          ))}
        </div>
      </div>

      <div className="wst-guide-rules">
        <ul>
          <li>✅ <b>One blank</b> in the sentence, typed as <b>3 underscores</b>: <code>___</code></li>
          <li>✅ The <b>right word</b> fills the blank</li>
          <li>✅ <b>1 to 3 wrong words</b>, all different, and not the right word</li>
          <li>✅ At least <b>8 questions</b> to publish</li>
        </ul>
        <ul>
          <li>❌ <code>__</code> (only 2), <code>...</code>, <code>( )</code> or two blanks</li>
          <li>❌ The right word again in the wrong words</li>
          <li>❌ Sentences over 120 letters, words over 24</li>
        </ul>
      </div>

      <div>
        <div className="wst-row">
          <b>Importing a CSV?</b> <span className="wst-muted">Same pattern, one question per row. Put a sentence that has a comma in "double quotes".</span>
          <span className="wst-spacer" />
          <button type="button" className="wst-btn wst-btn--sm" onClick={copyCsv}><Copy size={14} /> Copy rows</button>
        </div>
        <pre className="wst-guide-csv">{GUIDE_CSV}</pre>
        <span className="wst-muted">In Excel: one column each (A–F), then <b>Save As → CSV UTF-8</b>. In Google Sheets: <b>File → Download → .csv</b>.</span>
      </div>
    </details>
  );
}

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

function Editor({ initialId, onDone, onTestPlay, flash }) {
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
      return saved._id;
    } catch (err) {
      const problems = err?.response?.data?.problems;
      if (problems) {
        // map the server's indexes (of the filled questions) back to editor rows
        const rows = questions.map((q, i) => (q.prompt || q.answer ? i : -1)).filter((i) => i >= 0);
        setServerProblems(Object.fromEntries(problems.map((p) => [rows[p.index], p.errors])));
      }
      flash(msg(err, 'Could not save'), true);
    } finally { setBusy(false); }
    return null;
  };
  // Save first, so the test plays what is on screen
  const testPlay = async () => { const saved = await save(false); if (saved) onTestPlay(saved); };

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
        <div className="wst-row" style={{ flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: 12 }}>
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
            <button type="button" className="wst-btn wst-btn--sm" title="A CSV with the 20 example questions, to see the format" onClick={downloadExampleCsv}><Download size={14} /> CSV example</button>
            <button type="button" className="wst-btn wst-btn--sm" onClick={add}><Plus size={14} /> Add question</button>
          </div>
          {csvReport && (
            <div className={`wst-toast ${csvReport.errors.length ? 'wst-toast--bad' : ''}`}>
              Added {csvReport.added} question{csvReport.added === 1 ? '' : 's'} from the CSV.
              {csvReport.errors.length > 0 && <> Skipped {csvReport.errors.length}: {csvReport.errors.slice(0, 3).map((e) => `line ${e.line} (${e.message})`).join('; ')}{csvReport.errors.length > 3 ? '…' : ''}</>}
            </div>
          )}
          <QuestionGuide flash={flash} />

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
            <button type="button" className="wst-btn" disabled={busy || !title.trim() || !filled.length} onClick={testPlay}><Play size={14} /> Save &amp; test play</button>
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
          <div className="wst-row" style={{ flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', gap: 12 }}>
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

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Links to send for one game: one address for students who log in, and a
 *  personal link (with a name check) for each no-login student. */
function GameLinks({ assignment, onClose, flash }) {
  const [managed, setManaged] = useState(null);
  const loginUrl = `${window.location.origin}/student/games/word-squad?assignment=${assignment.id}`;
  const linkUrl = (token) => teacherModeLink(`/g/${token}`);

  useEffect(() => {
    api.post(`${BASE}/assignments/${assignment.id}/links`)
      .then(({ data }) => setManaged(data.data))
      .catch((err) => { setManaged([]); flash(msg(err, 'Could not make the links'), true); });
  }, [assignment.id, flash]);

  const copy = async (text, what) => {
    const done = await copyText(text);
    flash(done ? `${what} copied — paste it in your message to students` : 'Could not copy — select the link and copy it', !done);
  };
  const withLinks = (managed || []).filter((m) => m.token);

  return (
    <div className="wst-card wst-links">
      <div className="wst-row">
        <h3 style={{ margin: 0 }}>Links for “{assignment.setTitle}”</h3>
        <span className="wst-spacer" />
        <button type="button" className="wst-btn wst-btn--sm" onClick={onClose}>Close</button>
      </div>
      {!assignment.active && <p className="wst-muted" style={{ margin: 0 }}>This game is stopped — the links work again when you restart it.</p>}

      <div className="wst-link">
        <b>Students who log in</b>
        <span className="wst-muted">One link for everyone in this game. They log in (if they aren't already) and the game opens. Others can't play it.</span>
        <div className="wst-row">
          <input className="wst-input wst-link-url" readOnly value={loginUrl} onFocus={(e) => e.target.select()} aria-label="Game link for students who log in" />
          <button type="button" className="wst-btn wst-btn--sm wst-btn--primary" onClick={() => copy(loginUrl, 'Link')}><Copy size={14} /> Copy</button>
        </div>
      </div>

      <div className="wst-link">
        <b>Students without a login</b>
        <span className="wst-muted">Each one has a personal link. To open it they type their name and your name.</span>
        {managed === null ? <span className="wst-muted">Making links…</span> : managed.length === 0 ? (
          <span className="wst-muted">No students without a login in this game.</span>
        ) : (
          <>
            {managed.map((m) => (
              <div key={m.studentId} className="wst-row">
                <span className="wst-link-name">{m.name}</span>
                {m.token ? (
                  <>
                    <input className="wst-input wst-link-url" readOnly value={linkUrl(m.token)} onFocus={(e) => e.target.select()} aria-label={`Game link for ${m.name}`} />
                    <button type="button" className="wst-btn wst-btn--sm" onClick={() => copy(linkUrl(m.token), `${m.name}'s link`)}><Copy size={14} /> Copy</button>
                  </>
                ) : <span className="wst-muted">No teacher linked to this student yet, so no link.</span>}
              </div>
            ))}
            {withLinks.length > 1 && (
              <div className="wst-row">
                <button type="button" className="wst-btn wst-btn--sm" onClick={() => copy(withLinks.map((m) => `${m.name}: ${linkUrl(m.token)}`).join('\n'), 'All links')}><Copy size={14} /> Copy all, one per line</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function WordSquadTab({ isDarkMode }) {
  const [view, setView] = useState({ name: 'list' });
  const [sets, setSets] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [toast, setToast] = useState(null);
  const [linksFor, setLinksFor] = useState(null);
  const navigate = useNavigate();
  const testPlay = useCallback((id) => navigate(`/teacher/games/word-squad/test/${id}`), [navigate]);

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
  // A copy of the 20-question example, so a teacher sees what a good set looks like
  const addExample = async () => {
    try {
      const { data } = await api.post(`${BASE}/sets`, { title: EXAMPLE_SET_TITLE, level: 'A1', questions: EXAMPLE_QUESTIONS });
      flash('Example set added — look through it, test play it, change anything');
      setView({ name: 'edit', id: data.data._id });
    } catch (err) { flash(msg(err, 'Could not add the example'), true); }
  };
  const toggleAssignment = async (a) => {
    try { await api.patch(`${BASE}/assignments/${a.id}`, { active: !a.active }); load(); } catch (err) { flash(msg(err, 'Could not change it'), true); }
  };
  const back = () => setView({ name: 'list' });

  return (
    <div className={`wst${isDarkMode ? ' wst--dark' : ''}`}>
      {toast && <div className={`wst-toast${toast.bad ? ' wst-toast--bad' : ''}`} role="status">{toast.text}</div>}
      {view.name === 'edit' && <Editor key={view.id || 'new'} initialId={view.id} onDone={back} onTestPlay={testPlay} flash={flash} />}
      {view.name === 'ai' && <WordSquadAi onBack={back} onOpenDraft={(id) => setView({ name: 'edit', id })} onTestPlay={testPlay} flash={flash} />}
      {view.name === 'assign' && <AssignForm set={view.set} onDone={back} flash={flash} />}
      {view.name === 'list' && (
        <>
          <div className="wst-row">
            <div>
              <h2>Word Squad 🎮</h2>
              <p className="wst-muted" style={{ margin: '4px 0 0' }}>Make question sets from your lessons and give them to your students to play.</p>
            </div>
            <span className="wst-spacer" />
            <button type="button" className="wst-btn" title="Add a ready-made set of 20 questions to see how it works" onClick={addExample}><BookOpen size={14} /> Example set</button>
            <button type="button" className="wst-btn" onClick={() => setView({ name: 'ai' })}><Sparkles size={14} /> Make questions with AI</button>
            <button type="button" className="wst-btn wst-btn--primary" onClick={() => setView({ name: 'edit' })}><Plus size={14} /> New question set</button>
          </div>

          {sets === null ? <p className="wst-muted">Loading…</p> : sets.length === 0 ? (
            <div className="wst-card wst-row">
              <p style={{ margin: 0, flex: '1 1 320px' }}>No question sets yet. New to Word Squad? Add the <b>example set</b> — 20 ready questions you can look through, test play and give to students. Or write your own with <b>New question set</b> (or import a CSV), or let the AI make some from your book pages.</p>
              <button type="button" className="wst-btn wst-btn--primary" onClick={addExample}><BookOpen size={14} /> Add example set (20 questions)</button>
            </div>
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
                    <button type="button" className="wst-btn wst-btn--sm" disabled={!s.questionCount} title="Play it yourself first — no stars" onClick={() => testPlay(s.id)}><Play size={14} /> Test</button>
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
                      <td>
                        <div className="wst-row" style={{ flexWrap: 'nowrap' }}>
                          <button type="button" className="wst-btn wst-btn--sm" onClick={() => setLinksFor(a)}><Link2 size={14} /> Links</button>
                          <button type="button" className="wst-btn wst-btn--sm" onClick={() => toggleAssignment(a)}>{a.active ? 'Stop' : 'Restart'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {linksFor && <GameLinks key={linksFor.id} assignment={linksFor} onClose={() => setLinksFor(null)} flash={flash} />}
        </>
      )}
    </div>
  );
}
