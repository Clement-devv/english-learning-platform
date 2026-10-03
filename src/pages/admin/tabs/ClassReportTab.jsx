// src/pages/admin/tabs/ClassReportTab.jsx
// Daily class report: every class of one day (school time zone), completed
// first, then not completed — grouped by teacher A→Z, each teacher's classes
// together. Earlier classes whose outcome changed on this day are marked
// (red = completed → not completed, green = not completed → completed).
// The same report is emailed to admins every day after midnight.
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Mail, Loader2, Search, CalendarDays, CheckCircle2, XCircle, RefreshCw, Copy, NotebookText } from "lucide-react";
import api from "../../../api";
import { getCachedCenter } from "../../../utils/branding";
import { useOnDataChanged } from "../../../hooks/useLiveData";

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function ClassReportTab({ isDarkMode }) {
  const [date,    setDate]    = useState(null);   // null → server picks "today" (school time)
  const [today,   setToday]   = useState(null);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [busy,    setBusy]    = useState("");      // "pdf" | "email"
  const [toast,   setToast]   = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  // Live: a class completes or a teacher saves a summary → refresh this report
  useOnDataChanged(["bookings", "classes"], () => setReloadKey(k => k + 1));
  const [openSummary, setOpenSummary] = useState({}); // row id → expanded

  // Ready-to-send message for the parent: class details + the teacher's summary
  const parentMessage = (r) => {
    const center = getCachedCenter()?.centerName || "the school";
    return `Hello! This is ${center}. Here is the class report for ${r.studentFirst || r.studentName}.

`
      + `Class: ${r.classTitle}
Date: ${r.classDate} ${r.timeLabel}
Teacher: ${r.teacherName}

${r.summary}`;
  };
  const copySummary = async (r) => {
    try { await navigator.clipboard.writeText(parentMessage(r)); setToast("Report copied — paste it into WhatsApp, Zalo or Facebook"); setTimeout(() => setToast(""), 3500); }
    catch { setToast("Could not copy"); setTimeout(() => setToast(""), 3500); }
  };

  const col = {
    card:   isDarkMode ? "#1a1d2e" : "#ffffff",
    border: isDarkMode ? "#2a2d40" : "#e8edf5",
    text:   isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:  isDarkMode ? "#8b91b8" : "#6b7280",
    input:  isDarkMode ? "#1e2235" : "#f3f4f6",
    head:   isDarkMode ? "#20243a" : "#eef2ff",
    accent: "#6366f1",
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  useEffect(() => {
    let cancelled = false;
    if (!reloadKey) setLoading(true); // live refreshes stay quiet
    setError("");
    api.get("/admin/class-report", { params: date ? { date } : {} })
      .then(r => {
        if (cancelled) return;
        setReport(r.data.data);
        setToday(r.data.data.today);
        if (!date) setDate(r.data.data.date);
      })
      .catch(e => !cancelled && setError(e?.response?.data?.message || "Could not load the report"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [date, reloadKey]);

  // Search filters rows by teacher, student or class name
  const filterGroups = (groups) => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => g.teacherName.toLowerCase().includes(q)
        ? g
        : { ...g, rows: g.rows.filter(r => `${r.studentName} ${r.classTitle}`.toLowerCase().includes(q)) })
      .filter(g => g.rows.length);
  };
  const completed    = useMemo(() => filterGroups(report?.completed || []), [report, search]);    // eslint-disable-line react-hooks/exhaustive-deps
  const notCompleted = useMemo(() => filterGroups(report?.notCompleted || []), [report, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const { data } = await api.get("/admin/class-report/pdf", { params: { date: report.date }, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = `Class_Report_${report.date}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast("Could not download the PDF"); }
    finally { setBusy(""); }
  };

  const emailMe = async () => {
    setBusy("email");
    try {
      const { data } = await api.post("/admin/class-report/email", { date: report.date });
      showToast(data.message || "Report sent");
    } catch (e) { showToast(e?.response?.data?.message || "Could not send the report"); }
    finally { setBusy(""); }
  };

  const c = report?.counts;
  const changed = c ? c.changedToCompleted + c.changedToNotCompleted : 0;

  const Section = ({ title, icon, color, groups, empty }) => (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color, display: "flex", alignItems: "center", gap: 8 }}>
        {icon} {title}
      </h3>
      {groups.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: col.muted, fontStyle: "italic" }}>{empty}</p>
      ) : groups.map(g => (
        <div key={g.teacherId} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", fontSize: 14, fontWeight: 800, color: col.text, borderBottom: `1px solid ${col.border}` }}>
            {g.teacherName} <span style={{ color: col.muted, fontWeight: 600 }}>· {g.rows.length} class{g.rows.length !== 1 ? "es" : ""}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
              <thead>
                <tr style={{ background: col.head, color: col.accent, textAlign: "left" }}>
                  {["Time", "Teacher", "Student(s)", "Class", "Min", "Notes"].map(h => (
                    <th key={h} style={{ padding: "7px 12px", fontSize: 11.5, fontWeight: 800 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {g.rows.map(r => {
                  const mark = r.change ? (r.change.to === "not_completed" ? "#dc2626" : "#059669") : null;
                  const notes = [r.reason, r.note, r.platform].filter(Boolean).join(" · ") || (r.outcome === "completed" ? "Completed" : "");
                  return [
                    <tr key={r.id} style={{ borderTop: `1px solid ${col.border}`, boxShadow: mark ? `inset 3px 0 0 ${mark}` : "none" }}>
                      <td style={{ padding: "8px 12px", color: col.text, whiteSpace: "nowrap" }}>{r.change?.pastClass ? r.classDate : r.timeLabel}</td>
                      <td style={{ padding: "8px 12px", color: col.text }}>{r.teacherName}</td>
                      <td style={{ padding: "8px 12px", color: col.text, fontWeight: 600 }}>{r.studentName}</td>
                      <td style={{ padding: "8px 12px", color: col.text }}>{r.classTitle}</td>
                      <td style={{ padding: "8px 12px", color: col.muted }}>{r.duration}</td>
                      <td style={{ padding: "8px 12px", color: col.muted }}>{notes}</td>
                    </tr>,
                    r.outcome === "completed" && (
                      <tr key={`${r.id}-sum`}>
                        <td colSpan={6} style={{ padding: "0 12px 10px 15px" }}>
                          {r.summary ? (
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: isDarkMode ? "rgba(99,102,241,0.08)" : "#f5f7ff", border: `1px solid ${col.border}`, borderRadius: 10, padding: "8px 10px" }}>
                              <NotebookText size={14} color={col.accent} style={{ flexShrink: 0, marginTop: 2 }} />
                              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: col.text, lineHeight: 1.55, whiteSpace: "pre-wrap",
                                ...(openSummary[r.id] ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
                                {r.summary}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                {r.summary.length > 140 && (
                                  <button type="button" onClick={() => setOpenSummary(o => ({ ...o, [r.id]: !o[r.id] }))}
                                    style={{ padding: "4px 8px", borderRadius: 8, border: `1px solid ${col.border}`, background: "transparent", color: col.muted, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                    {openSummary[r.id] ? "Less" : "More"}
                                  </button>
                                )}
                                <button type="button" onClick={() => copySummary(r)} title="Copy a ready-to-send message with this summary"
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 8, border: "none", background: col.accent, color: "#fff", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                                  <Copy size={11} /> Copy for parent
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: col.muted, fontStyle: "italic" }}>No class summary from the teacher yet</span>
                          )}
                        </td>
                      </tr>
                    ),
                    r.change && (
                      <tr key={`${r.id}-chg`} style={{ boxShadow: `inset 3px 0 0 ${mark}` }}>
                        <td colSpan={6} style={{ padding: "0 12px 9px 15px", fontSize: 12, fontWeight: 700, color: mark }}>
                          {r.change.to === "not_completed" ? "⚠ Was completed — turned NOT completed" : "✓ Was not completed — turned COMPLETED"}
                          {" on "}{r.change.atLabel}
                          {r.change.pastClass ? ` · class held ${r.classDate}` : ""}
                          {" · "}{r.change.source}{r.change.reason ? `: ${r.change.reason}` : ""}
                          {r.change.pastClass && r.change.to === "completed" ? " (dispute of a past date)" : ""}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 900, color: col.text }}>📋 Class Report</h2>
          <p style={{ margin: 0, fontSize: 13, color: col.muted }}>
            Every class of the day, grouped by teacher. Emailed to admins every day after midnight{report?.tz ? ` (${report.tz})` : ""}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={downloadPdf} disabled={!report || !!busy}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: "inherit" }}>
            {busy === "pdf" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
          </button>
          <button onClick={emailMe} disabled={!report || !!busy}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "inherit" }}>
            {busy === "email" ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} Email me
          </button>
        </div>
      </div>

      {/* Day picker + search */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => date && setDate(addDays(date, -1))} aria-label="Previous day"
            style={{ padding: 8, borderRadius: 10, border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer", display: "flex" }}>
            <ChevronLeft size={16} />
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: `1px solid ${col.border}`, background: col.card }}>
            <CalendarDays size={15} color={col.muted} />
            <input type="date" value={date || ""} max={today || undefined} onChange={e => e.target.value && setDate(e.target.value)}
              style={{ border: "none", background: "transparent", color: col.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </label>
          <button onClick={() => date && setDate(addDays(date, 1))} disabled={!!today && date >= today} aria-label="Next day"
            style={{ padding: 8, borderRadius: 10, border: `1px solid ${col.border}`, background: col.card, color: col.text, cursor: "pointer", display: "flex", opacity: today && date >= today ? 0.4 : 1 }}>
            <ChevronRight size={16} />
          </button>
          {today && date !== today && (
            <button onClick={() => setDate(today)}
              style={{ padding: "7px 12px", borderRadius: 10, border: `1px solid ${col.border}`, background: col.card, color: col.accent, cursor: "pointer", fontSize: 12.5, fontWeight: 800, fontFamily: "inherit" }}>
              Today
            </button>
          )}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} color={col.muted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher, student or class…"
            style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px 9px 34px", borderRadius: 10, border: `1px solid ${col.border}`, background: col.input, color: col.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={26} color={col.accent} className="animate-spin" /></div>
      ) : error ? (
        <p style={{ margin: 0, padding: 14, borderRadius: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>{error}</p>
      ) : report && (
        <>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: col.text }}>{report.dateLabel}</p>

          {/* Summary */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
            {[
              ["Completed", c.completed, "#059669"],
              ["Not completed", c.notCompleted, "#dc2626"],
              ["Earlier classes changed", changed, "#b45309"],
              ["Teachers", c.teachers, col.accent],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
                <div style={{ fontSize: 12, color: col.muted, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          {changed > 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: col.muted, display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={13} /> Classes from earlier days whose result changed on this day are listed with a
              <span style={{ color: "#dc2626", fontWeight: 800 }}>red</span> or <span style={{ color: "#059669", fontWeight: 800 }}>green</span> marker.
            </p>
          )}

          <Section title="Completed classes" icon={<CheckCircle2 size={18} />} color="#059669" groups={completed}
            empty={search ? "No completed classes match your search." : "No completed classes on this day."} />
          <Section title="Not completed" icon={<XCircle size={18} />} color="#dc2626" groups={notCompleted}
            empty={search ? "No unsuccessful classes match your search." : "No unsuccessful classes on this day."} />
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, padding: "12px 20px", background: "#1a1d2e", color: "#fff", borderRadius: 12, fontWeight: 700, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
