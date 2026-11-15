import { useState } from 'react';

export function useClassRecurrence() {
  const [weekly, setWeekly] = useState(false);
  const [weeks, setWeeks] = useState(2);
  function dates(start) {
    const first = new Date(start);
    if (!Number.isFinite(+first)) throw new Error('Choose a class date and time.');
    return Array.from({ length: weekly ? weeks : 1 }, (_, i) => {
      const date = new Date(first);
      date.setDate(first.getDate() + 7 * i);
      if (date.getHours() !== first.getHours() || date.getMinutes() !== first.getMinutes()) {
        throw new Error('That time does not exist on one of the selected dates. Choose another time or a shorter series.');
      }
      return date.toISOString();
    });
  }
  return { weekly, setWeekly, weeks, setWeeks, dates };
}

export default function ClassRecurrence({ recurrence: r, start }) {
  const first = new Date(start);
  const when = Number.isFinite(+first) ? first.toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' }) : '';
  return <div>
    <label><input type="checkbox" checked={r.weekly} onChange={e => r.setWeekly(e.target.checked)} /> Repeat weekly{when && ' · ' + when}</label>
    {r.weekly && <label>Weeks including the first class <select value={r.weeks} onChange={e => r.setWeeks(Number(e.target.value))}>
      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} weeks · {n} classes</option>)}
    </select></label>}
  </div>;
}
