import { studioText } from './studioLanguage';
import { useEffect, useState } from 'react';
import api from '../../api';

export default function StudentClassBalance({ student, onSaved }) {
  const tracked = student.standaloneClassTracking || student.prepaidCredits;
  const count = Math.max(0, student.classCredits || 0);
  const [value, setValue] = useState(tracked ? String(count) : ''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { setValue(tracked ? String(count) : ''); }, [tracked, count]);
  return <section className="tm-class-balance"><div><strong>{tracked ? `${count} ${count === 1 ? 'class' : 'classes'} remaining` : 'Class balance not set'}</strong>{tracked && count <= 3 && <span className="tm-class-low" role="status">{count === 0 ? studioText('No classes left') : studioText('Classes low')}</span>}</div><details><summary>{tracked ? studioText('Update class balance') : studioText('Set class balance')}</summary><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api.patch(`/managed-students/${student._id}`, { classCount: Number(value) }); await onSaved(); } catch (err) { setError(err.response?.data?.message || 'Could not save class balance.'); } finally { setBusy(false); } }}><label>{studioText("Classes remaining")}<input type="number" min="0" max="1000000000" step="1" required value={value} onChange={e => setValue(e.target.value)} /></label><p className="tm-muted">Set the number remaining, including any new classes purchased.</p>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Saving…' : 'Save balance'}</button></form></details></section>;
}
