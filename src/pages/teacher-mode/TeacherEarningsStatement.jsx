import { useEffect, useRef, useState } from 'react';
import api from '../../api';
import { studioMoney } from './studioFormatting';

const localDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export default function TeacherEarningsStatement({ centerId, centers = [], onCenterChange }) {
  const [from, setFrom] = useState(() =>
    localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  );
  const [to, setTo] = useState(() => localDate(new Date()));
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const [report, setReport] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    requestId.current++;
    setReport(null);
    setBusy(false);
    setPage(1);
    setError('');
  }, [from, to, centerId]);
  useEffect(
    () => () => {
      requestId.current++;
    },
    []
  );
  const load = async (pdf = false) => {
    const current = ++requestId.current;
    setBusy(true);
    setError('');
    try {
      const response = await api.get(`/earnings/statement${pdf ? '.pdf' : ''}`, {
        params: { from, to, centerId: centerId || undefined },
        ...(pdf ? { responseType: 'blob' } : {}),
      });
      if (current !== requestId.current) return;
      if (pdf) {
        const url = URL.createObjectURL(response.data),
          a = document.createElement('a');
        a.href = url;
        a.download = `clemify-earnings-${centerId || 'all-centers'}-${from}-${to}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      } else setReport(response.data.data);
    } catch (e) {
      if (current !== requestId.current) return;
      let message = e.response?.data?.message;
      if (e.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await e.response.data.text()).message;
        } catch {
          /* generic error */
        }
      }
      setError(message || 'Could not create the statement. Please try again.');
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  };
  return (
    <section className="tm-card">
      <h3>Date-filtered salary statement</h3>
      <p className="tm-muted">
        All completed classes, charges and payments received. Dates use your saved profile timezone.
        Each center has its own rates, charges and payment balance. All-centers statements keep each
        center's totals separate.
      </p>
      <label>
        Center for earnings
        <select
          value={centerId || ''}
          disabled={busy}
          onChange={(e) => onCenterChange(e.target.value)}
        >
          <option value="">All centers (separate totals)</option>
          {centers.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
              {c.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </label>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <div className="tm-actions">
          <label>
            From
            <input
              type="date"
              required
              value={from}
              max={to}
              disabled={busy}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              required
              value={to}
              min={from}
              disabled={busy}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? 'Preparing…' : 'View statement'}</button>
          <button
            type="button"
            disabled={busy || !from || !to || from > to}
            onClick={() => load(true)}
          >
            Download PDF
          </button>
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p>
            {report.from} to {report.to} · {report.timezone} · {report.entries.length} completed
            classes
          </p>
          {report.totals.map((t) => (
            <article className="tm-card" key={`${t.centerId}-${t.currency}`}>
              <h4>
                {t.centerName} · {t.currency} salary totals
              </h4>
              <p>
                Gross: {studioMoney(t.gross, t.currency)} · Charges:{' '}
                {studioMoney(t.charges, t.currency)}
              </p>
              <strong>Final salary: {studioMoney(t.net, t.currency)}</strong>
              <p>
                Received: {studioMoney(t.received, t.currency)} ·{' '}
                {t.outstanding < 0 ? 'Receipts above period net' : 'Outstanding for period'}:{' '}
                {studioMoney(Math.abs(t.outstanding), t.currency)}
              </p>
            </article>
          ))}
          <p className="tm-muted">
            Monthly charges are allocated across completed classes. Receipts are center payments,
            not individual-class payment confirmations. The period balance does not include earlier
            balances.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th>Completed</th>
                  <th>Class / student</th>
                  <th>Gross</th>
                  <th>Charges</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {report.entries.slice((page - 1) * 25, page * 25).map((r) => (
                  <tr key={`${r.type}-${r.id}`}>
                    <td>
                      {new Date(r.date).toLocaleDateString(undefined, {
                        timeZone: report.timezone,
                      })}
                    </td>
                    <td>
                      {r.title}
                      <br />
                      {r.student}
                    </td>
                    <td>{studioMoney(r.amountMinor, r.currency)}</td>
                    <td>{studioMoney(r.chargesMinor, r.currency)}</td>
                    <td>{studioMoney(r.netMinor, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tm-actions">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(report.entries.length / 25))}
            </span>
            <button
              disabled={page * 25 >= report.entries.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
