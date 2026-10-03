// src/pages/teacher/tabs/ClassSummariesTab.jsx
// After each completed class the teacher writes a short summary of what happened.
// Students see it in "Class reports", parents in their portal, and admins can
// copy it for the parent from the Class Report. Server: routes/classSummaryRoutes.js
import { useEffect, useRef, useState } from "react";
import { NotebookPen, Search, X, Check, Clock, Users } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import ManagedBadge from "../../../components/ManagedBadge";
import Pagination from "../../../components/Pagination";

const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;
const MAX = 3000;
const fmtWhen = (d) => new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const PROMPTS = [
  "What we covered today: ",
  "How the student did: ",
  "Words / skills to practise at home: ",
  "Next class we will: ",
];

export default function ClassSummariesTab({ isDarkMode }) {
  const [view, setView]       = useState("missing");
  const [source, setSource]   = useState("single"); // "single" (1-to-1 bookings) | "group" (group classes)
  const [q, setQ]             = useState("");
  const [dq, setDq]           = useState("");
  const [page, setPage]       = useState(1);
  const [classes, setClasses] = useState([]);
  const [counts, setCounts]   = useState({ missing: 0, written: 0, all: 0 });
  const [pager, setPager]     = useState({ total: 0, totalPages: 1, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);  // class being written
  const [text, setText]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const quietRef = useRef(false);

  const c = isDarkMode
    ? { card: "#1a1d2e", border: "#2a2d40", heading: "#f0f4ff", body: "#c8cce0", muted: "#8b91b8", input: "#0f1117", soft: "#141620" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#475569", muted: "#94a3b8", input: "#f8faff", soft: "#f8fafc" };
  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [view, dq, source]);

  const load = async () => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      const { data } = await api.get("/class-summaries/teacher", { params: { view, q: dq || undefined, page, source: source === "group" ? "group" : undefined } });
      setClasses(data.classes || []);
      setCounts(data.counts || { missing: 0, written: 0, all: 0 });
      if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== page) setPage(data.pagination.page); }
    } catch { notify("Could not load your classes", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [view, dq, page, source]); // eslint-disable-line react-hooks/exhaustive-deps
  // Live: a class finishes → it appears here without reloading
  useOnDataChanged(["classes", "bookings", "group-classes"], () => { quietRef.current = true; load(); });

  const open = (cls) => { setEditing(cls); setText(cls.summary || ""); };
  const save = async (value = text) => {
    setSaving(true);
    try {
      await api.put(editing.group ? `/class-summaries/group/${editing.id}` : `/class-summaries/${editing.id}`, { text: value });
      notify(value.trim() ? "Summary saved — the student, parent and admin can see it" : "Summary removed");
      setEditing(null);
      quietRef.current = true;
      load();
    } catch (err) {
      notify(err?.response?.data?.message || "Could not save", "error");
    } finally { setSaving(false); }
  };

  const pill = (active) => ({ padding: "6px 14px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    background: active ? BRAND : c.card, color: active ? "#fff" : c.body, boxShadow: active ? `0 2px 8px ${brandA(0.25)}` : `inset 0 0 0 1px ${c.border}` });
  const btn = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${c.border}`, background: primary ? BRAND : "transparent", color: primary ? "#fff" : c.heading });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div role="status" style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, color: "#fff",
          background: toast.type === "error" ? "#dc2626" : "#059669", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>{toast.msg}</div>
      )}

      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}>
          <NotebookPen size={22} color={BRAND} /> Class summaries
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: c.body, lineHeight: 1.6 }}>
          After each class, write what happened — what you covered, how the student did, what to practise next.
          The student sees it in their Class reports, the parent in their portal, and your admin can send it to the parent.
        </p>
      </div>

      <div role="tablist" aria-label="Class type" style={{ display: "flex", gap: 6 }}>
        {[["single", "1-to-1 classes"], ["group", "Group classes"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={source === k} onClick={() => setSource(k)}
            style={{ padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${source === k ? BRAND : c.border}`, background: source === k ? brandA(0.08) : "transparent", color: source === k ? BRAND : c.body }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setView("missing")} style={pill(view === "missing")}>Needs a summary · {counts.missing}</button>
        <button type="button" onClick={() => setView("written")} style={pill(view === "written")}>Written · {counts.written}</button>
        <button type="button" onClick={() => setView("all")} style={pill(view === "all")}>All · {counts.all}</button>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 320, marginLeft: "auto" }}>
          <Search size={14} color={c.muted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search class, topic or student"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 30px", borderRadius: 10, border: `1px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 13, fontFamily: "inherit" }} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: c.muted, textAlign: "center", padding: 40 }}>Loading…</p>
      ) : classes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.muted }}>
          <NotebookPen size={32} style={{ opacity: .4 }} />
          <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
            {view === "missing" ? "All caught up — every completed class has a summary." : "No classes here yet."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {classes.map(cls => (
            <div key={cls.id} style={{ background: c.card, border: `1px solid ${cls.summary ? c.border : brandA(0.35)}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: c.heading }}>{cls.title}</div>
                  <div style={{ fontSize: 12.5, color: c.body, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} /> {fmtWhen(cls.scheduledTime)} · {cls.duration} min</span>
                    {cls.topic && <span>Topic: {cls.topic}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: c.body, marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Users size={12} />
                    {cls.students.map((s, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <strong style={{ color: c.heading }}>{s.name}</strong>{s.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}{i < cls.students.length - 1 ? "," : ""}
                      </span>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={() => open(cls)} style={btn(!cls.summary)}>
                  <NotebookPen size={14} /> {cls.summary ? "Edit summary" : "Write summary"}
                </button>
              </div>
              {cls.summary && (
                <p style={{ margin: "10px 0 0", padding: "10px 12px", borderRadius: 10, background: c.soft, color: c.body, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {cls.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode={isDarkMode} />}

      {editing && (
        <div onClick={() => !saving && setEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Class summary"
            style={{ background: c.card, borderRadius: 18, width: "100%", maxWidth: 560, padding: 20, display: "flex", flexDirection: "column", gap: 12, border: `1px solid ${c.border}`, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: c.heading }}>{editing.title}</div>
                <div style={{ fontSize: 12.5, color: c.body }}>{fmtWhen(editing.scheduledTime)} · {editing.students.map(s => s.name).join(", ")}</div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setEditing(null)} style={{ ...btn(false), padding: 6 }}><X size={15} /></button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PROMPTS.map(p => (
                <button key={p} type="button" onClick={() => setText(t => (t && !t.endsWith("\n") ? t + "\n" : t) + p)}
                  style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${c.border}`, background: c.soft, color: c.body, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  + {p.replace(": ", "")}
                </button>
              ))}
            </div>
            <textarea autoFocus value={text} onChange={e => setText(e.target.value.slice(0, MAX))} rows={9}
              placeholder="e.g. We practised the past tense with a story about her weekend. She used 'went' and 'saw' correctly and asked great questions. Please practise irregular verbs (eat/ate, go/went) before next class."
              style={{ width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 12, border: `1.5px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 14, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: text.length > MAX - 200 ? "#d97706" : c.muted }}>{text.length}/{MAX}</span>
              <div style={{ display: "flex", gap: 8 }}>
                {editing.summary && <button type="button" disabled={saving} onClick={() => save("")} style={{ ...btn(false), color: "#dc2626" }}>Remove</button>}
                <button type="button" disabled={saving} onClick={() => setEditing(null)} style={btn(false)}>Cancel</button>
                <button type="button" disabled={saving || !text.trim()} onClick={() => save()} style={{ ...btn(true), opacity: saving || !text.trim() ? 0.6 : 1 }}>
                  <Check size={14} /> {saving ? "Saving…" : "Save summary"}
                </button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: c.muted }}>Visible to the student, their parent and your admin.{editing.group || editing.students.length > 1 ? " Every student in this class gets the same summary." : ""}</p>
          </div>
        </div>
      )}
    </div>
  );
}
