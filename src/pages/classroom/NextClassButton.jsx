import React, { useContext } from 'react';
import { ClassHandoffContext } from './ClassHandoffContext';
export default function NextClassButton() {
  const handoff = useContext(ClassHandoffContext);
  if (!handoff) return null;
  const { next, busy, error, keepCapture, setKeepCapture, goNext } = handoff;
  return <div className="relative shrink-0 text-xs">
    <button type="button" disabled={busy} onClick={goNext}
      title={next ? (next.classTitle || next.title) + ' · ' + new Date(next.scheduledTime).toLocaleString() : 'Check your next booking'}
      className="rounded-lg border border-emerald-700 bg-emerald-700 px-3 py-2 font-semibold text-white disabled:opacity-50">
      {busy ? 'Saving and switching…' : 'Next class'}{!busy && next?.studentId?.firstName && <span className="ml-1">· {next.studentId.firstName}</span>}
    </button>
    <label title="Reuse only if the selected shared tab will contain the next lesson. Otherwise choose a new recording tab." className="mt-1 flex items-center gap-1 text-current">
      <input type="checkbox" checked={keepCapture} disabled={busy} onChange={event => setKeepCapture(event.target.checked)} />
      Keep shared tab
    </label>
    {error && <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-red-200 bg-white p-3 text-red-800 shadow-lg">{error}</p>}
  </div>;
}
