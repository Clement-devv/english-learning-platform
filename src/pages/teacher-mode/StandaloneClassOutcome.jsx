import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';

export default function StandaloneClassOutcome({ bookingId }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="mb-4 text-sm"><p className="mb-3">You manage this lesson’s outcome. If it was taught despite the attendance result, record it as taught. Your booked center rate and prepaid policy apply.</p>{error && <p role="alert" className="mb-3 text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-full px-6 py-3 bg-emerald-700 text-white disabled:opacity-50" onClick={async () => {
    setBusy(true); setError('');
    try { await api.patch(`/work/${bookingId}`, { complete: true }); sessionStorage.removeItem('classroomState'); navigate('/teacher-mode/dashboard', { state: { classCompleted: true } }); }
    catch (e) { setError(e.response?.data?.message || 'Unable to save this outcome. Please retry.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Saving…' : 'Record lesson as taught'}</button></div>;
}
