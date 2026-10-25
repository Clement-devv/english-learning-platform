// src/pages/teacher/tabs/WordSquadAi.jsx
// "Make questions with AI" for Word Squad: upload book pages (a PDF or photos),
// pick some, and the AI (the same model as the quiz maker) writes a DRAFT
// question set the teacher checks before publishing. Uploads delete
// themselves after 30 days, or any time with Delete. The server API is
// server/routes/gameAiRoutes.js; the work runs in the background there.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Sparkles, Trash2, Upload } from 'lucide-react';
import api from '../../../api';
import { LEVELS } from '../../../../server/utils/questionRules.js';

const AI = '/games/ai';
const PDF_MAX = 15 * 1024 * 1024;
const PHOTO_MAX = 10;
const msg = (err, fallback) => err?.response?.data?.message || fallback;
const day = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Photos go up as JPEGs of at most 1600 px and ~600 KB, so phones' 5 MB pictures stay small
async function shrinkPhoto(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  let blob = null;
  for (const quality of [0.82, 0.7, 0.58, 0.45]) {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (blob && blob.size <= 600 * 1024) break;
  }
  return blob;
}

async function uploadFiles(picked) {
  const files = [];
  for (const f of picked) {
    if (f.type === 'application/pdf') {
      if (f.size > PDF_MAX) throw new Error(`“${f.name}” is over 15 MB — split the PDF into smaller parts`);
      files.push({ name: f.name, mime: 'application/pdf', blob: f });
    } else if (f.type.startsWith('image/')) {
      const blob = await shrinkPhoto(f);
      if (!blob) throw new Error(`Could not read the photo “${f.name}”`);
      files.push({ name: f.name.replace(/\.\w+$/, '') + '.jpg', mime: 'image/jpeg', blob });
    } else throw new Error(`“${f.name}” isn't a PDF or a photo`);
  }
  const { data } = await api.post(`${AI}/uploads`, { files: files.map((f) => ({ name: f.name, mime: f.mime, size: f.blob.size })) });
  await Promise.all(data.data.map(async (slot, i) => {
    const { blob, mime } = files[i];
    if (slot.upload.local) {
      await api.put(slot.upload.url, blob, { headers: { 'Content-Type': mime } });
    } else {
      const res = await fetch(slot.upload.url, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
      if (!res.ok) throw new Error('The upload was interrupted — try again');
      await api.post(`${AI}/uploads/${slot.id}/done`);
    }
  }));
  return data.data.map((s) => s.id);
}

const STATUS = {
  queued: 'Waiting…',
  running: 'Reading the pages…',
  done: 'Ready',
  failed: 'Did not work',
};

export default function WordSquadAi({ onBack, onOpenDraft, onTestPlay, flash }) {
  const [credits, setCredits] = useState(null);
  const [uploads, setUploads] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [chosen, setChosen] = useState(() => new Set());
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: '', level: 'A1', wantedCount: 15, focus: 'both' });
  const pollRef = useRef(null);

  const loadUploads = useCallback(async () => {
    try { setUploads((await api.get(`${AI}/uploads`)).data.data); } catch (err) { setUploads([]); flash(msg(err, 'Could not load your pages'), true); }
  }, [flash]);
  const loadJobs = useCallback(async () => {
    try {
      const list = (await api.get(`${AI}/jobs`)).data.data;
      setJobs(list);
      return list;
    } catch { return null; }
  }, []);
  const loadCredits = useCallback(() => api.get(`${AI}/credits`).then(({ data }) => setCredits(data.data)).catch(() => setCredits({ balance: 0, enabled: false })), []);

  useEffect(() => { loadCredits(); loadUploads(); loadJobs(); }, [loadCredits, loadUploads, loadJobs]);

  // While a job is waiting or running, check on it every 5 s
  const working = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!working) return undefined;
    pollRef.current = setInterval(async () => {
      const list = await loadJobs();
      if (list && !list.some((j) => j.status === 'queued' || j.status === 'running')) loadCredits();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [working, loadJobs, loadCredits]);

  const onPick = async (fileList) => {
    const picked = [...(fileList || [])];
    if (!picked.length) return;
    if (picked.length > PHOTO_MAX) { flash(`Choose at most ${PHOTO_MAX} files at a time`, true); return; }
    setUploading(true);
    try {
      const ids = await uploadFiles(picked);
      flash(`Uploaded ${ids.length} file${ids.length > 1 ? 's' : ''}`);
      setChosen((c) => new Set([...c, ...ids.map(String)]));
      if (!form.title) setForm((f) => ({ ...f, title: picked[0].name.replace(/\.\w+$/, '').slice(0, 120) }));
      await loadUploads();
    } catch (err) {
      flash(err?.response ? msg(err, 'Upload failed') : (err.message || 'Upload failed'), true);
      loadUploads();
    } finally { setUploading(false); }
  };

  const toggle = (id) => setChosen((c) => {
    const n = new Set(c);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const removeUpload = async (u) => {
    if (!window.confirm(`Delete “${u.name}” now?`)) return;
    try {
      await api.delete(`${AI}/uploads/${u.id}`);
      setChosen((c) => { const n = new Set(c); n.delete(String(u.id)); return n; });
      flash('Deleted');
      loadUploads();
    } catch (err) { flash(msg(err, 'Could not delete'), true); }
  };

  const make = async () => {
    setBusy(true);
    try {
      const sourceIds = (uploads || []).filter((u) => chosen.has(String(u.id))).map((u) => u.id);
      const { data } = await api.post(`${AI}/jobs`, { ...form, sourceIds });
      flash(data.message || 'Making your questions');
      setJobs((j) => [data.data, ...j]);
    } catch (err) { flash(msg(err, 'Could not start'), true); }
    finally { setBusy(false); }
  };

  const chosenCount = (uploads || []).filter((u) => chosen.has(String(u.id))).length;
  const off = credits && !credits.enabled;

  return (
    <>
      <div className="wst-row">
        <button type="button" className="wst-btn wst-btn--sm" onClick={onBack}>← All sets</button>
        <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} /> Make questions with AI</h2>
        <span className="wst-spacer" />
        {credits && <span className="wst-badge wst-badge--pub" title="Your center's AI credits">AI credits: {credits.balance}</span>}
      </div>
      <p className="wst-muted" style={{ margin: 0 }}>
        Upload pages from the book you teach. The AI writes fill-the-gap questions from those pages only, as a <b>draft</b> — you check them, change anything, test play, then publish.
      </p>
      {off && <div className="wst-toast wst-toast--bad">AI isn't set up on this server yet. You can still write questions yourself or import a CSV.</div>}

      <div className="wst-layout">
        <div className="wst-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div className="wst-card">
            <div className="wst-row">
              <h3>1. Your uploaded pages</h3>
              <span className="wst-spacer" />
              <label className={`wst-btn wst-btn--sm${uploading ? ' wst-btn--busy' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload PDF or photos'}
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden disabled={uploading} onChange={(e) => { onPick(e.target.files); e.target.value = ''; }} />
              </label>
            </div>
            <p className="wst-muted">A PDF up to 15 MB (about 20 pages), or up to 10 photos. Pages delete themselves after 30 days — or delete them any time.</p>
            {uploads === null ? <p className="wst-muted">Loading…</p> : uploads.length === 0 ? <p className="wst-muted" style={{ margin: 0 }}>No pages uploaded yet.</p> : (
              <ul className="wst-files">
                {uploads.map((u) => (
                  <li key={u.id} className={`wst-file${chosen.has(String(u.id)) ? ' wst-file--on' : ''}`}>
                    <label className="wst-file-pick">
                      <input type="checkbox" checked={chosen.has(String(u.id))} onChange={() => toggle(String(u.id))} />
                      {u.mime === 'application/pdf' ? <FileText size={16} /> : <ImageIcon size={16} />}
                      <span className="wst-file-name">{u.name}</span>
                    </label>
                    <span className="wst-muted wst-file-exp">deletes {day(u.expiresAt)}</span>
                    <button type="button" className="wst-btn wst-btn--sm wst-btn--danger" aria-label={`Delete ${u.name}`} onClick={() => removeUpload(u)}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="wst-card">
            <h3 style={{ marginBottom: 10 }}>2. What to make</h3>
            <div className="wst-row">
              <label className="wst-field"><span className="wst-label">Title</span>
                <input className="wst-input" value={form.title} maxLength={120} placeholder="e.g. Unit 3 — Food" onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label style={{ width: 100 }}><span className="wst-label">Level</span>
                <select className="wst-input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
                  {LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
              <label style={{ width: 120 }}><span className="wst-label">Questions</span>
                <select className="wst-input" value={form.wantedCount} onChange={(e) => setForm({ ...form, wantedCount: Number(e.target.value) })}>
                  {[10, 15, 20, 25, 30].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label style={{ width: 180 }}><span className="wst-label">Focus</span>
                <select className="wst-input" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })}>
                  <option value="both">Words + grammar</option>
                  <option value="vocabulary">Vocabulary</option>
                  <option value="grammar">Grammar</option>
                </select>
              </label>
            </div>
            <div className="wst-row" style={{ marginTop: 12 }}>
              <span className="wst-muted">{chosenCount ? `${chosenCount} file${chosenCount > 1 ? 's' : ''} chosen` : 'Tick the pages to use'}</span>
              <span className="wst-spacer" />
              <button type="button" className="wst-btn wst-btn--primary" disabled={busy || off || !chosenCount || !form.title.trim()} onClick={make}>
                <Sparkles size={14} /> {busy ? 'Starting…' : 'Make questions'}
              </button>
            </div>
          </div>
        </div>

        <div className="wst-sticky">
          <div className="wst-card">
            <h3 style={{ marginBottom: 10 }}>3. Your AI drafts</h3>
            {jobs.length === 0 ? <p className="wst-muted" style={{ margin: 0 }}>Nothing made yet. It takes about a minute.</p> : (
              <ul className="wst-jobs">
                {jobs.map((j) => (
                  <li key={j.id} className="wst-job">
                    <div className="wst-row">
                      <b className="wst-file-name">{j.title}</b>
                      <span className="wst-spacer" />
                      <span className={`wst-badge ${j.status === 'done' ? 'wst-badge--pub' : 'wst-badge--draft'}`}>{STATUS[j.status] || j.status}</span>
                    </div>
                    <span className="wst-muted">
                      {j.level} · {j.pages} file{j.pages === 1 ? '' : 's'}
                      {j.status === 'done' && ` · ${j.made} questions`}
                      {j.creditsUsed ? ` · ${j.creditsUsed} credit${j.creditsUsed > 1 ? 's' : ''}` : ''}
                    </span>
                    {j.status === 'failed' && j.error && <p className="wst-errors" style={{ margin: '4px 0 0' }}>{j.error}</p>}
                    {j.status === 'done' && j.setId && (
                      <div className="wst-row" style={{ marginTop: 6 }}>
                        <button type="button" className="wst-btn wst-btn--sm wst-btn--primary" onClick={() => onOpenDraft(j.setId)}>Check &amp; edit</button>
                        <button type="button" className="wst-btn wst-btn--sm" onClick={() => onTestPlay(j.setId)}>▶ Test play</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
