import { useState } from 'react';
import api from '../../api';
export default function StudentContactEditor({ student, onSaved }) {
  const [name, setName] = useState(student.firstName), [email, setEmail] = useState(student.notifyEmail || ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <details><summary>Edit student and family contact</summary><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api.patch(`/managed-students/${student._id}`, { name, notifyEmail: email }); await onSaved(); } catch (err) { setError(err.response?.data?.message || 'Unable to save.'); } finally { setBusy(false); } }}><label>Name for this student<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label><label>Family email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>Save student details</button></form></details>;
}
