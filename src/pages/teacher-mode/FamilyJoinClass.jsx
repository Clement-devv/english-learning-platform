import { studioText } from './studioLanguage';
import { useState } from 'react';
import { Video } from 'lucide-react';

export default function FamilyJoinClass({ lesson, request }) {
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="tm-family-join"><button type="button" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { const r = await request('get', `/schedule/${lesson.id}/join?group=${lesson.group}`); setResult(r.data.data); }
    catch (e) { setResult(null); setError(e.response?.data?.message || 'Could not open the class. Please try again.'); }
    finally { setBusy(false); }
  }}><Video size={15} />{busy ? studioText('Checking classroom…') : studioText('Join class')}</button>{error && <p role="alert">{error}</p>}{result && <div role="status">{result.ready ? <a href={result.url} target="_blank" rel="noreferrer">Open {result.provider === 'zoom' ? 'Zoom' : 'Google Meet'} classroom ↗</a> : <p>{result.message}</p>}</div>}</div>;
}
