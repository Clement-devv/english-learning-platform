// src/pages/admin/tabs/ShareLinksTab.jsx
// Parent links: the homework / quiz links teachers created for managed students,
// so an admin can copy one (with a ready-made message) and send it to the parent.
// Server: server/routes/shareLinkAdminRoutes.js. Links are created by teachers
// (components/ShareLinkPanel.jsx) — this screen only reads them.
import { useEffect, useRef, useState } from "react";
import { Link2, Copy, Send, ExternalLink, Search, RefreshCw, BookOpen, ClipboardList } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { getCachedCenter } from "../../../utils/branding";
import ManagedBadge from "../../../components/ManagedBadge";
import Pagination from "../../../components/Pagination";

const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;
const KINDS = {
  homework: { path: "hw", noun: "Homework", icon: BookOpen,      resource: "homework" },
  quiz:     { path: "q",  noun: "Quiz",     icon: ClipboardList, resource: "quizzes" },
};
const STATUS = {
  assigned:  { label: "Not done yet", color: "#b45309", bg: "#fef3c7" },
  submitted: { label: "Submitted",    color: "#1d4ed8", bg: "#dbeafe" },
  graded:    { label: "Graded",       color: "#047857", bg: "#d1fae5" },
  attempted: { label: "Completed",    color: "#047857", bg: "#d1fae5" },
};
const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default function ShareLinksTab({ isDarkMode }) {
  const [kind, setKind]       = useState("homework");
  const [view, setView]       = useState("active");
  const [q, setQ]             = useState("");
  const [debouncedQ, setDQ]   = useState("");
  const [page, setPage]       = useState(1);
  const [items, setItems]     = useState([]);
  const [pager, setPager]     = useState({ total: 0, totalPages: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);
  const quietRef = useRef(false);

  const c = isDarkMode
    ? { card: "#1e293b", border: "#334155", heading: "#f1f5f9", body: "#94a3b8", soft: "#0f172a", input: "#0f172a" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#64748b", soft: "#f8fafc", input: "#ffffff" };
  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  useEffect(() => { const t = setTimeout(() => setDQ(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [kind, view, debouncedQ]);

  const load = async () => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      const { data } = await api.get("/share-links", { params: { kind, view, q: debouncedQ || undefined, page } });
      setItems(data.items || []);
      if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== page) setPage(data.pagination.page); }
    } catch { notify("Could not load links", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [kind, view, debouncedQ, page]); // eslint-disable-line react-hooks/exhaustive-deps
  // Live: a teacher creates / deletes a link, a student submits → refresh quietly
  useOnDataChanged([KINDS[kind].resource], () => { quietRef.current = true; load(); });

  const urlOf = (it) => `${window.location.origin}/${KINDS[it.kind].path}/${it.shareToken}`;
  const messageOf = (it) => {
    const center = getCachedCenter()?.centerName || "the school";
    const k = KINDS[it.kind];
    return `Hello! This is ${center}. Here is ${it.student?.firstName || "your child"}'s ${k.noun.toLowerCase()}: "${it.title}"\n`
      + `Due ${fmtDay(it.dueDate)}\n\nOpen it here: ${urlOf(it)}\n\n`
      + `Type the student's name and the teacher's name to open it.`;
  };
  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); notify(`${what} copied — paste it into WhatsApp, Zalo or Facebook`); }
    catch { notify("Could not copy — open the link and copy it from the address bar", "error"); }
  };
  const whatsapp = (it) => {
    const phone = (it.student?.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageOf(it))}`, "_blank", "noopener");
  };

  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${c.border}`, background: primary ? BRAND : c.card, color: primary ? "#fff" : c.heading, textDecoration: "none",
  });
  const pill = (active) => ({ padding: "6px 14px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    background: active ? BRAND : c.card, color: active ? "#fff" : c.body, boxShadow: active ? `0 2px 8px ${brandA(0.25)}` : "none" });
  const code = { fontSize: 10.5, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace", padding: "1px 6px", borderRadius: 6, background: c.soft, border: `1px solid ${c.border}`, color: c.body };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {toast && (
        <div role="status" style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, maxWidth: 380,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#b91c1c" : "#15803d", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>{toast.msg}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}>
            <Link2 size={22} color={BRAND} /> Parent links
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: c.body, lineHeight: 1.6 }}>
            Homework and quiz links teachers created for students' parents. Copy the ready-made message and send it on WhatsApp, Zalo or Facebook.
            Parents type the student's and teacher's names to open it; links stop working at the end of the due day.
          </p>
        </div>
        <button type="button" onClick={() => load()} style={btn(false)}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div role="tablist" aria-label="Link type" style={{ display: "flex", gap: 6 }}>
          {Object.entries(KINDS).map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} style={pill(kind === k)}>{v.noun === "Quiz" ? "Quizzes" : v.noun}</button>
          ))}
        </div>
        <select value={view} onChange={e => setView(e.target.value)} aria-label="Show"
          style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 13, fontFamily: "inherit" }}>
          <option value="active">Still open</option>
          <option value="expired">Expired</option>
          <option value="all">All</option>
        </select>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 380 }}>
          <Search size={14} color={c.body} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, student, teacher or ID (STU-… / TCH-…)"
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px 8px 30px", borderRadius: 9, border: `1px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 13, fontFamily: "inherit" }} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: c.body, textAlign: "center", padding: 40 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.body }}>
          <Link2 size={32} style={{ opacity: .4 }} />
          <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
            {debouncedQ ? "No links match your search." : view === "active" ? `No open ${KINDS[kind].noun.toLowerCase()} links right now.` : "Nothing here."}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12.5 }}>Teachers create these from Homework / Quizzes when assigning work to a managed student.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(it => {
            const Icon = KINDS[it.kind].icon;
            const st = STATUS[it.status] || STATUS.assigned;
            return (
              <div key={it._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: 14, opacity: it.expired ? 0.7 : 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 280px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Icon size={16} color={BRAND} />
                      <span style={{ fontWeight: 800, fontSize: 15, color: c.heading }}>{it.title}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: st.color, background: st.bg }}>{st.label}</span>
                      {it.expired && <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#b91c1c", background: "#fee2e2" }}>Link expired</span>}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, color: c.body, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span>Student: <strong style={{ color: c.heading }}>{it.student?.name || "—"}</strong></span>
                      {it.student?.code && <span style={code}>{it.student.code}</span>}
                      {it.student?.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}
                      <span style={{ margin: "0 4px" }}>·</span>
                      <span>Teacher: <strong style={{ color: c.heading }}>{it.teacher?.name || "—"}</strong></span>
                      {it.teacher?.code && <span style={code}>{it.teacher.code}</span>}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12.5, color: c.body }}>
                      Due {fmtDay(it.dueDate)}{it.student?.phone ? ` · Parent phone ${it.student.phone}` : ""}
                    </div>
                  </div>
                  {!it.expired && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => copy(messageOf(it), "Message with link")} style={btn(true)}><Copy size={13} /> Copy message</button>
                      <button type="button" onClick={() => copy(urlOf(it), "Link")} style={btn(false)}><Link2 size={13} /> Copy link</button>
                      <button type="button" onClick={() => whatsapp(it)} style={btn(false)} title={it.student?.phone ? "Opens WhatsApp to the parent's number" : "Opens WhatsApp — choose the parent"}>
                        <Send size={13} /> WhatsApp
                      </button>
                      <a href={urlOf(it)} target="_blank" rel="noopener noreferrer" style={btn(false)} title="See what the parent sees"><ExternalLink size={13} /> Open</a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit}
          onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}
