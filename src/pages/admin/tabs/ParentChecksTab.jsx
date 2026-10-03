// src/pages/admin/tabs/ParentChecksTab.jsx
// Parent attendance checks for managed students. A managed student's attendance
// is confirmed only by the teacher; the admin sends the parent a link to confirm
// too. Links last 4 days — no reply means the class stands. "No" does NOT
// reverse the class: it opens a dispute and a 3-day countdown (red heartbeat);
// unsettled by then, it's returned to the student automatically.
// Server: server/routes/parentCheckRoutes.js, server/utils/parentCheck.js
import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Copy, Send, RefreshCw, CheckCircle2, XCircle, Clock, Link2, AlertTriangle } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { getCachedCenter } from "../../../utils/branding";
import ManagedBadge from "../../../components/ManagedBadge";
import DisputePulse, { DISPUTE_GLOW_CLASS } from "../../../components/DisputePulse";
import Pagination from "../../../components/Pagination";

// Center brand colour (set by utils/branding.js)
const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;

const fmtWhen = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const nameOf  = (p) => `${p?.firstName || ""} ${p?.lastName || ""}`.trim();
const teacherName = (t) => t?.displayName?.trim() || nameOf(t) || "—";
const ANSWER = { confirmed: "Yes", denied: "No", waiting: "—" };

function stateOf(c) {
  const status = c.parentCheck?.status;
  if (status === "confirmed") return "confirmed";
  if (status === "denied") return c.disputeStatus === "pending" ? "disputed" : "settled";
  if (status === "no_reply") return "noreply";
  // Past the 4 days but the sweep hasn't run yet — same outcome: attendance stands
  if (c.shareLink?.expiresAt && new Date(c.shareLink.expiresAt) < new Date()) return "noreply";
  if (!c.shareToken) return "nolink";
  return "waiting";
}

const STATE = {
  waiting:   { label: "Waiting for parent",             icon: Clock,         color: "#b45309", bg: "#fef3c7" },
  confirmed: { label: "Parent confirmed",               icon: CheckCircle2,  color: "#047857", bg: "#d1fae5" },
  noreply:   { label: "No reply · counted as attended", icon: CheckCircle2,  color: "#4b5563", bg: "#e5e7eb" },
  disputed:  { label: "Parent said No",                 icon: XCircle,       color: "#b91c1c", bg: "#fee2e2" },
  settled:   { label: "Dispute settled",                icon: AlertTriangle, color: "#6b7280", bg: "#f3f4f6" },
  nolink:    { label: "No link",                        icon: Link2,         color: "#6b7280", bg: "#f3f4f6" },
};

export default function ParentChecksTab({ isDarkMode }) {
  const [checks, setChecks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("waiting");
  const [busy, setBusy]       = useState(null);
  const [toast, setToast]     = useState(null);
  const [page, setPage]       = useState(1);
  const [pager, setPager]     = useState({ total: 0, totalPages: 1, limit: 20 });
  const [counts, setCounts]   = useState({ waiting: 0, confirmed: 0, disputed: 0 });

  const c = isDarkMode
    ? { card: "#1e293b", border: "#334155", heading: "#f1f5f9", body: "#94a3b8" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#64748b" };

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); };

  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["parent-checks","bookings"], () => { quietRef.current = true; load(); });

  const load = async (p = page, f = filter) => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      const { data } = await api.get(`/parent-checks?view=${f}&page=${p}`);
      setChecks(data.checks || []);
      if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== p) setPage(data.pagination.page); }
      if (data.counts) setCounts({ waiting: data.counts.waiting, confirmed: data.counts.attended, disputed: data.counts.disputed });
    }
    catch { notify("Could not load parent checks", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(page, filter); }, [page, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeFilter = (f) => { setFilter(f); setPage(1); };
  const goPage = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const urlFor = (ch) => `${window.location.origin}/ac/${ch.shareToken}`;
  const messageFor = (ch) => {
    const center = getCachedCenter()?.centerName || "the school";
    return `Hello! This is ${center}. Could you confirm that ${ch.studentId?.firstName || "your child"} attended "${ch.classTitle}" on ${fmtWhen(ch.scheduledTime)} with teacher ${teacherName(ch.teacherId)}?\n\nTap here (takes 10 seconds): ${urlFor(ch)}\n\nYou'll be asked for your child's name and the teacher's name.`;
  };

  const copy = async (ch) => {
    try { await navigator.clipboard.writeText(messageFor(ch)); notify("Message with link copied — paste it into WhatsApp, Zalo or Facebook"); }
    catch { notify("Could not copy", "error"); }
  };
  const whatsapp = (ch) => {
    const phone = (ch.studentId?.phone || "").replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messageFor(ch))}`, "_blank", "noopener");
  };
  const newLink = async (ch) => {
    setBusy(ch._id);
    try {
      const { data } = await api.post(`/parent-checks/${ch._id}/link`);
      setChecks(prev => prev.map(x => (x._id === ch._id ? { ...x, ...data.check, studentId: x.studentId, teacherId: x.teacherId } : x)));
      notify("New link ready — valid for 7 days");
    } catch (err) { notify(err?.response?.data?.message || "Could not create link", "error"); }
    finally { setBusy(null); }
  };

  // Filtering, "disputes first" ordering and paging are done by the server
  const shown = checks;

  const btn = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
    border: primary ? "none" : `1px solid ${c.border}`, background: primary ? BRAND : c.card, color: primary ? "#fff" : c.heading,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {toast && (
        <div role="status" style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#b91c1c" : "#15803d", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={22} color={BRAND} /> Parent checks
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: c.body, lineHeight: 1.6 }}>
            Managed students can't log in, so only their teacher confirms they joined a class. Send the parent this quick check:
            links last <strong>4 days</strong> and no reply means the class stands. If they answer <strong>No</strong>, nothing is taken back
            yet: a dispute opens in <strong>Disputes</strong> and you have <strong>3 days</strong> to settle it, or the class is returned to the student automatically.
          </p>
        </div>
        <button type="button" onClick={() => load()} style={btn(false)}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[["waiting", "To send / waiting", counts.waiting, STATE.waiting.color],
          ["confirmed", "Attended (confirmed or no reply)", counts.confirmed, STATE.confirmed.color],
          ["disputed", "Disputes to settle", counts.disputed, STATE.disputed.color]].map(([k, label, n, color]) => (
          <div key={k} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: c.body }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{n}</div>
          </div>
        ))}
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["waiting", "Needs attention"], ["answered", "Answered"], ["all", "All"]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} type="button" onClick={() => changeFilter(k)}
            style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: filter === k ? BRAND : c.card, color: filter === k ? "#fff" : c.body, boxShadow: filter === k ? `0 2px 8px ${brandA(0.25)}` : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: c.body, textAlign: "center", padding: 40 }}>Loading…</p>
      ) : shown.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.body }}>
          <ShieldCheck size={36} style={{ opacity: .4 }} />
          <p style={{ margin: "10px 0 0", fontWeight: 600 }}>
            {filter === "all" ? "No teacher-confirmed classes yet. They appear here when a managed student's class is completed." : "Nothing here."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map(ch => {
            const s = stateOf(ch), st = STATE[s], Icon = st.icon;
            return (
              <div key={ch._id} className={s === "disputed" ? DISPUTE_GLOW_CLASS : undefined}
                style={{ background: s === "disputed" ? (isDarkMode ? "rgba(220,38,38,.08)" : "#fff5f5") : c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.heading, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {nameOf(ch.studentId) || "Student"} <ManagedBadge isDarkMode={isDarkMode} />
                  </div>
                  <div style={{ fontSize: 12, color: c.body, marginTop: 3 }}>
                    {ch.classTitle} · {fmtWhen(ch.scheduledTime)} · Teacher {teacherName(ch.teacherId)}
                  </div>
                  {(s === "disputed" || s === "settled") && ch.parentCheck?.comment && (
                    <div style={{ fontSize: 12, color: STATE.disputed.color, marginTop: 4 }}>Parent's note: “{ch.parentCheck.comment}”</div>
                  )}
                  {s === "disputed" && (
                    <div style={{ fontSize: 12, color: c.body, marginTop: 4 }}>
                      Class still counts as completed. <strong>Settle it in Disputes</strong> — or it's returned to the student automatically.
                    </div>
                  )}
                  {/* Parent changed their answer — a withdrawn report is shown faded + struck through */}
                  {ch.parentCheck?.history?.length > 0 && (
                    <div style={{ fontSize: 12, color: c.body, marginTop: 4 }}>
                      {ch.parentCheck.history.map((h, i) => (
                        <span key={i} style={{ marginRight: 10 }}>
                          Parent changed <strong>{ANSWER[h.from] || h.from} → {ANSWER[h.to] || h.to}</strong> on {fmtWhen(h.at)}
                        </span>
                      ))}
                    </div>
                  )}
                  {ch.disputeStatus === "withdrawn" && (
                    <div style={{ fontSize: 12, marginTop: 4, color: STATE.disputed.color, opacity: 0.55, textDecoration: "line-through", filter: "blur(0.3px)" }}
                      title="The parent withdrew their report — nothing to review">
                      Parent's dispute · cancelled by the parent
                    </div>
                  )}
                  {s === "settled" && (
                    <div style={{ fontSize: 12, color: c.body, marginTop: 4 }}>
                      Outcome: <strong>{ch.disputeStatus === "resolved_teacher" ? "teacher upheld — class stands"
                        : ch.disputeResolution === "auto_parent" ? "not settled in 3 days — class returned to student"
                        : "parent upheld — class returned to student"}</strong>
                    </div>
                  )}
                </div>

                {s === "disputed"
                  ? <DisputePulse deadline={ch.parentCheck?.disputeDeadline} />
                  : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: st.color, background: st.bg }}>
                      <Icon size={13} /> {st.label}
                    </span>
                  )}

                {s === "waiting" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={btn(true)} onClick={() => whatsapp(ch)}
                      title={ch.studentId?.phone ? `Opens WhatsApp for ${ch.studentId.phone}` : "No phone saved — pick the contact in WhatsApp"}>
                      <Send size={13} /> WhatsApp
                    </button>
                    <button type="button" style={btn(false)} onClick={() => copy(ch)}><Copy size={13} /> Copy message</button>
                  </div>
                )}
                {s === "nolink" && (
                  <button type="button" style={btn(true)} disabled={busy === ch._id} onClick={() => newLink(ch)}>
                    <Link2 size={13} /> {busy === ch._id ? "Creating…" : "New link"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <Pagination page={page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={goPage} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}
