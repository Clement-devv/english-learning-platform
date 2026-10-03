// src/components/ClassReportsList.jsx
// The teacher's summary of each completed class — used by the student's
// "Class reports" tab and the parent portal. `fetchPage(page)` returns
// { reports, pagination, counts } (server/routes/classSummaryRoutes.js).
import { useEffect, useRef, useState } from "react";
import { NotebookText, Clock, Copy } from "lucide-react";
import Pagination from "./Pagination";
import { useOnDataChanged } from "../hooks/useLiveData";

const BRAND = "var(--brand-primary, #2563eb)";
const fmtWhen = (d) => new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function ClassReportsList({ fetchPage, isDarkMode, heading = "Class reports", intro, emptyText, reloadKey, live = true, allowCopy = false }) {
  const [page, setPage]       = useState(1);
  const [reports, setReports] = useState([]);
  const [pager, setPager]     = useState({ total: 0, totalPages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(null);
  const quietRef = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const c = isDarkMode
    ? { card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#8b91b8", soft: "#141620" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", soft: "#f8fafc" };

  const load = async () => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    setError("");
    try {
      const data = await fetchRef.current(page);
      setReports(data.reports || []);
      if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== page) setPage(data.pagination.page); }
    } catch { setError("Could not load class reports."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Live: the teacher saves a summary → it appears here without reloading
  useOnDataChanged(live ? ["classes", "bookings", "group-classes"] : ["__none__"], () => { quietRef.current = true; load(); });

  const copy = async (r) => {
    try { await navigator.clipboard.writeText(`${r.title} — ${fmtWhen(r.scheduledTime)}\nTeacher: ${r.teacher?.name || ""}\n\n${r.summary}`); setCopied(r.id); setTimeout(() => setCopied(null), 2000); }
    catch { /* clipboard unavailable */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}>
          <NotebookText size={20} color={BRAND} /> {heading}
        </h2>
        {intro && <p style={{ margin: "4px 0 0", fontSize: 13, color: c.body, lineHeight: 1.6 }}>{intro}</p>}
      </div>

      {loading ? (
        <p style={{ color: c.muted, textAlign: "center", padding: 40 }}>Loading…</p>
      ) : error ? (
        <p style={{ color: "#dc2626", textAlign: "center", padding: 20 }}>{error}</p>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.muted }}>
          <NotebookText size={32} style={{ opacity: .4 }} />
          <p style={{ margin: "10px 0 0", fontWeight: 600 }}>{emptyText || "No class reports yet. Your teacher writes one after each class."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map(r => (
            <article key={r.id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15.5, color: c.heading }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: c.body, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {fmtWhen(r.scheduledTime)}</span>
                    {r.teacher?.name && <span>Teacher: <strong style={{ color: c.heading }}>{r.teacher.name}</strong></span>}
                    {r.topic && <span>Topic: {r.topic}</span>}
                  </div>
                </div>
                {allowCopy && r.summary && (
                  <button type="button" onClick={() => copy(r)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: `1px solid ${c.border}`, background: "transparent", color: c.heading, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    <Copy size={12} /> {copied === r.id ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
              {r.summary ? (
                <p style={{ margin: "12px 0 0", padding: "12px 14px", borderRadius: 12, background: c.soft, borderLeft: `3px solid ${BRAND}`, color: c.body, fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {r.summary}
                </p>
              ) : (
                <p style={{ margin: "10px 0 0", fontSize: 13, color: c.muted, fontStyle: "italic" }}>The teacher hasn't written a summary for this class yet.</p>
              )}
            </article>
          ))}
        </div>
      )}

      {!loading && <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />}
    </div>
  );
}
