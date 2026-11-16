import { useClassConfirmation } from './ClassConfirmation';
import { studioText } from './studioLanguage';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api';
import { StudioEmpty, StudioIntro } from './StudioUI';
import { BookOpen } from 'lucide-react';

export default function TeacherClassHistory({
  teacherInfo,
  centerId,
  centers = [],
  onCenterChange,
  onNavigate,
  refreshKey,
  onChanged,
}) {
  const { ask, dialog } = useClassConfirmation();
  const [view, setView] = useState('completed'),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const [data, setData] = useState({ classes: [], pagination: { totalPages: 1 } });
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  useEffect(
    () => () => {
      requestId.current++;
    },
    []
  );
  useEffect(() => {
    requestId.current++;
    setData({ classes: [], pagination: { totalPages: 1 } });
    setLoading(true);
  }, [centerId]);
  const id = teacherInfo._id || teacherInfo.id;
  const historyParams = useCallback(() => ({
    managedCenterId: centerId || undefined,
    view,
    q,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
  }), [centerId, view, q, from, to]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const download = async () => {
    setExporting(true);
    setExportMessage('');
    try {
      const { data: report } = await api.get(`/bookings/teacher/${id}/history`, {
        params: { ...historyParams(), export: '1' },
      });
      if (!report.classes.length) {
        setExportMessage('No classes match these filters.');
        return;
      }
      if (report.pagination.totalPages > 1) {
        setExportMessage('This report exceeds the export limit. Choose a shorter date range.');
        return;
      }
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'), import('jspdf-autotable'),
      ]);
      const pdf = new JsPDF({ orientation: 'landscape' });
      const centerName = key => centers.find(c => String(c._id) === String(key))?.name || 'Center unavailable';
      const outcome = { all: 'All outcomes', completed: 'Completed', not_completed: 'Not completed' }[view];
      autoTable(pdf, {
        head: [['Class history', centerId ? centerName(centerId) : 'All centers']],
        body: [[outcome, `${from || 'Earliest'} to ${to || 'latest'} | ${report.classes.length} classes`],
          ...(q.trim() ? [['Search', q.trim()]] : [])],
      });
      autoTable(pdf, {
        head: [['Date and time', 'Center', 'Class / topic', 'Type', 'Students', 'Minutes', 'Outcome / reason']],
        body: report.classes.map(c => [
          new Date(c.scheduledTime).toLocaleString(), centerName(c.managedCenterId),
          [c.title, c.topic].filter(Boolean).join('\n'), c.isGroupClass ? 'Group' : 'Individual',
          c.students?.filter(Boolean).join(', '), c.duration,
          c.officiallyCompleted && !c.adminRejected ? 'Completed' :
            ['Not completed', c.missedReason || c.adminRejectedReason].filter(Boolean).join('\n'),
        ]),
        styles: { fontSize: 9 },
      });
      pdf.save(`class-history-${view}-${from || 'start'}-${to || 'latest'}.pdf`);
    } catch {
      setExportMessage('Could not download the class report. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/bookings/teacher/${id}/history`, {
        params: { ...historyParams(), page },
      });
      if (current === requestId.current) setData(response.data);
    } catch {
      if (current === requestId.current) setError('Unable to load class history. Please retry.');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [id, historyParams, page]);
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);
  const changeOutcome = async (lesson, completed) => {
    let reason;
    if (completed) {
      reason = await ask({ title: 'Unmark class as taught?', message: lesson.title + ' · Its earnings and recorded credit deductions will be reversed, and its summary removed.', reason: true, action: 'Unmark as taught' });
      if (reason === null) return;
    } else if (!(await ask({ title: 'Mark class as taught?', message: lesson.title + ' · Its booked earnings and attendance credits will be applied.', action: 'Mark as taught' }))) return;
    setSaving(true); setError('');
    try { await api.patch(`/work/${lesson.id}`, completed ? { action: 'unmark', reason } : { complete: true }); await onChanged?.(); await load(); }
    catch (e) { setError(e.response?.data?.message || 'Could not update this class.'); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    setPage(1);
  }, [view, q, from, to, centerId]);
  return (
    <>
      {dialog}
      <StudioIntro eyebrow="YOUR TEACHING RECORD" title="Every lesson, accounted for.">
        Review completed and missed classes. You decide when a lesson is taught and when its summary
        is shared with families.
      </StudioIntro>
      <label className="tm-card">
        Center for class history
        <select value={centerId || ''} onChange={(e) => onCenterChange(e.target.value)}>
          <option value="">All centers</option>
          {centers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
              {c.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      <details className="tm-card tm-history-filters">
        <summary>Search and filter classes</summary>
        <label>
          Search classes or students
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={() => window.print()}>Print record</button>
      </details>
      <div className="tm-list-toolbar">
        <h3>Class history</h3>
        <button type="button" onClick={download} disabled={exporting || Boolean(from && to && from > to)}>
          {exporting ? 'Preparing PDF…' : 'Download filtered PDF'}
        </button>
        <div className="tm-segmented" role="group" aria-label="Filter class outcomes">
          {[
            ['all', 'All'],
            ['completed', 'Completed'],
            ['not_completed', 'Not completed'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                setPage(1);
                setView(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {exportMessage && <p role="status">{exportMessage}</p>}
      {error && (
        <p role="alert" className="tm-notice tm-error">
          {error}
          <button onClick={load}>Retry</button>
        </p>
      )}
      {loading && !data.classes?.length ? (
        <p role="status">Loading class history…</p>
      ) : (
        <div className="tm-lesson-records">
          {data.classes?.length ? (
            data.classes.map((c) => (
              <article className="tm-card tm-history-record" key={c.id}>
                <div className="tm-row">
                  <span className="tm-tag">
                    {c.isGroupClass ? 'Group lesson' : 'Individual lesson'}
                  </span>
                  <span
                    className={
                      c.officiallyCompleted && !c.adminRejected
                        ? 'tm-history-done'
                        : 'tm-history-incomplete'
                    }
                  >
                    {c.officiallyCompleted && !c.adminRejected ? 'Completed' : 'Not completed'}
                  </span>
                </div>
                <h3>{c.title}</h3>
                <p className="tm-muted">
                  <strong>
                    {centers.find((center) => String(center._id) === String(c.managedCenterId))
                      ?.name || 'Center unavailable'}
                  </strong>
                </p>
                <p className="tm-muted">
                  {new Date(c.scheduledTime).toLocaleString()} · {c.duration} min
                </p>
                {(!c.officiallyCompleted || c.adminRejected) && (
                  <p className="tm-history-note">
                    <strong>What happened:</strong>{' '}
                    {c.missedReason ||
                      c.adminRejectedReason ||
                      (c.isMissed
                        ? 'No reason was recorded for this missed class.'
                        : 'This class has not been marked complete. Open the lesson to record its outcome.')}
                  </p>
                )}
                <details className="tm-history-details">
                  <summary>Class details and actions</summary>
                  <button disabled={saving} onClick={() => changeOutcome(c, c.officiallyCompleted && !c.adminRejected)}>{c.officiallyCompleted && !c.adminRejected ? 'Unmark as taught' : 'Mark as taught'}</button>
                  <p>
                    <strong>Students:</strong>{' '}
                    {c.students?.filter(Boolean).join(', ') || 'No student details available'}
                  </p>
                  {c.topic && (
                    <p>
                      <strong>Topic:</strong> {c.topic}
                    </p>
                  )}
                  <button
                    onClick={() =>
                      onNavigate(
                        c.officiallyCompleted && !c.adminRejected ? 'class-summaries' : 'classes'
                      )
                    }
                  >
                    {c.officiallyCompleted && !c.adminRejected
                      ? 'Write or review summary'
                      : 'Manage lesson'}
                  </button>
                </details>
              </article>
            ))
          ) : (
            <StudioEmpty icon={BookOpen} title="Your teaching story starts here.">
              Completed and missed lessons will appear here.
            </StudioEmpty>
          )}
        </div>
      )}
      <div className="tm-actions" aria-label="Class history pagination">
        <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          {studioText('Previous')}
        </button>
        <span>
          Page {page} of {data.pagination?.totalPages || 1}
        </span>
        <button
          disabled={page >= (data.pagination?.totalPages || 1) || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          {studioText('Next')}
        </button>
      </div>
    </>
  );
}
