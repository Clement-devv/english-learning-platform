import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Download, FileText, HardDrive, Trash2, Upload } from 'lucide-react';
import api from '../../api';
import { PanelHeading, StudioEmpty, StudioIntro, StudioSearch } from './StudioUI';
export default function TeacherResources({ centerId, archived }) {
  const [items, setItems] = useState([]), [title, setTitle] = useState(''), [file, setFile] = useState(null), [rights, setRights] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [search, setSearch] = useState('');
  const load = useCallback(async () => { try { setItems((await api.get('/resources', { params: { managedCenterId: centerId || undefined } })).data.data); setError(''); } catch (e) { setError(e.response?.data?.message || 'Unable to load resources.'); } finally { setLoading(false); } }, [centerId]);
  useEffect(() => { load(); }, [load]);
  const download = async item => {
    try {
      const r = await api.get(`/resources/${item._id}/download`, { responseType: 'blob' });
      const a = document.createElement('a');
      if (r.headers['content-type']?.includes('application/json')) { a.href = JSON.parse(await r.data.text()).data.url; a.target = '_blank'; a.rel = 'noreferrer'; }
      else { a.href = URL.createObjectURL(r.data); a.download = `${item.title}.pdf`; }
      a.click(); if (a.href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } catch { setError('Unable to download. Please retry.'); }
  };
  const filtered = items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()));
  return <><StudioIntro eyebrow="GOOD MATERIALS. GREAT TEACHING." title="Keep your inspiration close." aside={<span className="tm-count-pill"><FileText size={15} />{items.length} resources</span>}>A private shelf for your PDFs, worksheets, and teaching materials, organized by managed center.</StudioIntro>{error && <p role="alert" className="tm-notice tm-error">{error}<button onClick={load}>Retry</button></p>}
    <div className="tm-management-grid"><form className="tm-card tm-editor-panel" onSubmit={async e => {
      e.preventDefault(); if (!centerId || !file) { setError('Choose a center and a PDF first.'); return; } if (file.size > 10 * 1024 * 1024) { setError('Please choose a PDF smaller than 10 MB.'); return; } setBusy(true); setError('');
      const form = e.currentTarget;
      try { const body = new FormData(); body.append('title', title); body.append('rightsConfirmed', String(rights)); body.append('pdf', file); await api.post('/resources', body, { params: { managedCenterId: centerId } }); setTitle(''); setFile(null); setRights(false); form.reset(); await load(); }
      catch (err) { setError(err.response?.data?.message || 'Upload failed. Please retry.'); } finally { setBusy(false); }
    }}><PanelHeading icon={Upload} eyebrow="ADD TO YOUR SHELF" title="Upload a resource" />{(!centerId || archived) && <div className="tm-center-hint needs-center">Choose an active managed center above to upload a resource.</div>}<label>Resource title<input required maxLength={160} placeholder="e.g. Reading practice · Unit 4" value={title} onChange={e => setTitle(e.target.value)} /></label><label className="tm-resource-upload"><Upload size={25} strokeWidth={1.4} />PDF file<span>{file ? file.name : 'Choose a worksheet or teaching resource'}</span><input required type="file" accept="application/pdf,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></label><label className="tm-policy-check"><input type="checkbox" required checked={rights} onChange={e => setRights(e.target.checked)} /><span>I have the right to use this resource.<small>Keep shared materials respectful of their creators.</small></span></label><div className="tm-form-footer"><button className="tm-primary" disabled={busy || !centerId || archived}>{busy ? 'Uploading…' : 'Upload resource'}<ArrowUpRight size={15} /></button></div><p className="tm-form-note"><HardDrive size={14} />10 MB per PDF · 200 MB workspace allowance.</p></form>
    <section className="tm-records-panel"><div className="tm-list-toolbar"><h3>Your teaching shelf</h3><StudioSearch value={search} onChange={setSearch} label="Search resources" placeholder="Find a resource…" /></div>{loading ? <div role="status" className="tm-card">Opening your teaching shelf…</div> : !filtered.length ? <StudioEmpty icon={FileText} title={items.length ? 'Nothing by that name yet.' : 'Room for your next great lesson.'}>{items.length ? 'Try a different resource title.' : 'Upload your first PDF. Your resources stay private to this workspace.'}</StudioEmpty> : filtered.map(item => <article className="tm-card tm-resource-record" key={item._id}><span><FileText size={23} strokeWidth={1.4} /></span><div><h3>{item.title}</h3><p>PDF · {(item.bytes / 1024 / 1024).toFixed(1)} MB{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</p></div><div className="tm-actions"><button onClick={() => download(item)}><Download size={14} />Download</button><button className="tm-icon-action" aria-label={`Delete ${item.title}`} onClick={async () => { try { await api.delete(`/resources/${item._id}`); await load(); } catch { setError('Could not delete this resource.'); } }}><Trash2 size={14} /></button></div></article>)}<p className="tm-storage-note"><HardDrive size={13} />{(items.reduce((n, i) => n + i.bytes, 0) / 1024 / 1024).toFixed(1)} MB shown in this view.</p></section></div>
  </>;
}
