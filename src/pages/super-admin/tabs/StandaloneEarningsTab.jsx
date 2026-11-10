import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import './standaloneTeachers.css';

const money = (amount, currency) => {
  try { const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency }); return fmt.format(amount / 10 ** fmt.resolvedOptions().maximumFractionDigits); }
  catch { return `${currency} ${(amount / 100).toFixed(2)}`; }
};

export default function StandaloneEarningsTab({ apiBase, authHeaders }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [search, setSearch] = useState(''), [currency, setCurrency] = useState('all');
  const authorization = authHeaders.Authorization;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await fetch(`${apiBase}/teacher-mode/admin/earnings`, { headers: { Authorization: authorization } }); const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to load earnings.'); setData(body.data); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [apiBase, authorization]);
  useEffect(() => { load(); }, [load]);
  const rows = (data?.teachers || []).flatMap(teacher => teacher.centers.flatMap(center => center.totals.map(total => ({ teacher, center, total })))).filter(({ teacher, center, total }) => (currency === 'all' || total.currency === currency) && `${teacher.name} ${teacher.email} ${center.name}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="sa-standalone"><header className="sa-st-hero"><div><span className="sa-st-eyebrow">TEACHER MODE · SALARY OVERSIGHT</span><h2>Teacher earnings</h2><p>Track completed-class earnings and platform charges across independent teachers and their centers.</p></div><button className="sa-st-primary" onClick={load} disabled={loading}><RefreshCw size={16} /> Refresh</button></header>
    {error && <p className="sa-st-alert" role="alert">{error} <button onClick={load}>Retry</button></p>}{loading && <p role="status">Loading earnings…</p>}
    {data && <><section className="sa-st-report-summary"><div><span className="sa-st-eyebrow">ALL-TIME TOTALS</span><h3>Across all teachers</h3><p>Amounts are kept in their original currencies. Charges are calculated from completed classes, not recorded payments.</p></div>{data.totals.length ? <div className="sa-st-currency-totals">{data.totals.map(t => <article key={t.currency}><span>{t.currency}</span><div><small>Teacher earnings</small><strong>{money(t.earned, t.currency)}</strong></div><div><small>Charges</small><strong>{money(t.chargesTotal, t.currency)}</strong></div><div><small>After charges</small><strong>{money(t.net, t.currency)}</strong></div></article>)}</div> : <p>No earnings recorded yet.</p>}</section>
      <section className="sa-st-directory"><div className="sa-st-directory-head"><div><span className="sa-st-eyebrow">TEACHERS & CENTERS</span><h3>Earnings breakdown <span>{rows.length}</span></h3><p>Open a center to see its monthly charges.</p></div><div className="sa-st-filters"><label className="sa-st-search"><Search size={16} /><span className="sa-st-sr">Search earnings</span><input placeholder="Search teacher or center" value={search} onChange={e => setSearch(e.target.value)} /></label><label><span className="sa-st-sr">Filter by currency</span><select value={currency} onChange={e => setCurrency(e.target.value)}><option value="all">All currencies</option>{data.totals.map(t => <option key={t.currency} value={t.currency}>{t.currency}</option>)}</select></label></div></div>
        {rows.length ? <div className="sa-st-earnings-list">{rows.map(({ teacher, center, total }) => <details className="sa-st-earnings-row" key={`${teacher.id}-${center._id}-${total.currency}`}><summary><div><strong>{teacher.name}</strong><span>{center.name}{center.archived ? ' · archived' : ''} · {total.lessons} completed {total.lessons === 1 ? 'class' : 'classes'}</span></div><div><small>Earned</small><strong>{money(total.earned, total.currency)}</strong></div><div><small>Charges</small><strong>{money(total.chargesTotal, total.currency)}</strong></div><div><small>After charges</small><strong>{money(total.net, total.currency)}</strong></div></summary><div className="sa-st-earnings-detail"><p>Received from center: <strong>{money(total.received, total.currency)}</strong> · {total.outstanding < 0 ? 'Advance received' : 'Outstanding'}: <strong>{money(Math.abs(total.outstanding), total.currency)}</strong></p>{total.charges.length ? total.charges.map((charge, i) => <div key={`${charge.month}-${i}`}><span>{charge.month} · {charge.name}{charge.kind === 'percent' ? ` (${charge.value / 100}%)` : ''}</span><strong>{money(charge.amountMinor, total.currency)}</strong></div>) : <p>No charges calculated for this center yet.</p>}</div></details>)}</div> : <p className="sa-st-empty">No earnings match these filters.</p>}
      </section></>}
  </div>;
}
