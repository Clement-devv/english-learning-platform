// src/pages/admin/tabs/LoggedClassesTab.jsx
// Approval queue for classes teachers logged outside the app (site down, held on
// Meet/Zoom directly…). Nothing is charged or paid until approved here.
// Server: server/routes/offlineClassRoutes.js
import { useState, useEffect, useRef } from "react";
import { ClipboardCheck, ExternalLink, Check, X, RefreshCw, AlertTriangle } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import ManagedBadge from "../../../components/ManagedBadge";
import DisputePulse, { DISPUTE_GLOW_CLASS, AWAITING_GLOW_CLASS } from "../../../components/DisputePulse";
import Pagination from "../../../components/Pagination";

const BRAND  = "var(--brand-primary, #2563eb)";
const brandA = (a) => `rgba(var(--brand-primary-rgb, 37, 99, 235), ${a})`;
const PLATFORM = { googlemeet: "Google Meet", zoom: "Zoom", other: "Other" };
const fmtWhen = (d) => new Date(d).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const nameOf = (p) => `${p?.firstName || ""} ${p?.lastName || ""}`.trim();
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; } };

function familyAnswer(b) {
  const who = b.studentId?.isManaged ? "Parent" : "Student";
  switch (b.parentCheck?.status) {
    case "confirmed": return { text: `${who} confirmed it happened`, color: "#047857" };
    case "denied":    return { text: `${who} says it didn't happen${b.parentCheck?.comment ? `: “${b.parentCheck.comment}”` : ""}`, color: "#b91c1c" };
    case "no_reply":  return { text: `${who} didn't reply — counted as attended`, color: "#4b5563" };
    case "waiting":   return { text: `Waiting for the ${who.toLowerCase()} to confirm`, color: "#b45309" };
    default:          return null;
  }
}

export default function LoggedClassesTab({ isDarkMode }) {
  const [filter, setFilter]   = useState("pending");
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(null);   // { id, kind: "approve" | "reject" }
  const [note, setNote]       = useState("");
  const [busy, setBusy]       = useState(false);
  const [toast, setToast]     = useState(null);
  const [page, setPage]       = useState(1);
  const [pager, setPager]     = useState({ total: 0, totalPages: 1, limit: 20 });
  const [counts, setCounts]   = useState({});

  const c = isDarkMode
    ? { card: "#1e293b", border: "#334155", heading: "#f1f5f9", body: "#94a3b8", soft: "#0f172a" }
    : { card: "#ffffff", border: "#e2e8f0", heading: "#1e293b", body: "#64748b", soft: "#f8fafc" };
  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["offline-classes","bookings"], () => { quietRef.current = true; load(); });

  const load = async (p = page, f = filter) => {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      const { data } = await api.get(`/offline-classes?status=${f}&page=${p}`);
      setList(data.classes || []);
      // The server clamps the page (e.g. the last item on a page was just approved)
      if (data.pagination) { setPager(data.pagination); if (data.pagination.page !== p) setPage(data.pagination.page); }
      if (data.counts) setCounts(data.counts);
    }
    catch { notify("Could not load logged classes", "error"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(page, filter); }, [page, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const changeFilter = (f) => { setFilter(f); setPage(1); setActing(null); };
  const goPage = (p) => { setPage(p); setActing(null); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const decide = async () => {
    if (!acting) return;
    if (acting.kind === "reject" && !note.trim()) { notify("Please give a reason for rejecting", "error"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/offline-classes/${acting.id}/${acting.kind}`, acting.kind === "reject" ? { reason: note.trim() } : { note: note.trim() });
      notify(data.message || "Done");
      setActing(null); setNote("");
      load();
    } catch (err) {
      notify(err?.response?.data?.message || "Could not save", "error");
    } finally { setBusy(false); }
  };

  const btn = (bg, color, border) => ({
    display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: busy ? "not-allowed" : "pointer", border: border || "none", background: bg, color, fontFamily: "inherit", opacity: busy ? .7 : 1,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {toast && (
        <div role="status" style={{ position: "fixed", top: 24, right: 24, zIndex: 9999, padding: "12px 18px", borderRadius: 12, fontWeight: 600, fontSize: 14, maxWidth: 380,
          background: toast.type === "error" ? "#fee2e2" : "#dcfce7", color: toast.type === "error" ? "#b91c1c" : "#15803d", boxShadow: "0 4px 20px rgba(0,0,0,.12)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 680 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: c.heading, display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={22} color={BRAND} /> Logged classes
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: c.body, lineHeight: 1.6 }}>
            Classes teachers logged because they happened outside the app (site down, held on Meet/Zoom…).
            <strong> Nothing is charged or paid until you approve.</strong> Check the recording link and the family's answer first.
          </p>
        </div>
        <button type="button" onClick={() => load()} style={btn(c.card, c.heading, `1px solid ${c.border}`)}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["pending", "Awaiting approval"], ["approved", "Approved"], ["rejected", "Rejected"]].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} type="button" onClick={() => changeFilter(k)}
            style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: filter === k ? BRAND : c.card, color: filter === k ? "#fff" : c.body, boxShadow: filter === k ? `0 2px 8px ${brandA(.25)}` : "none" }}>
            {label}{counts[k] != null && <span style={{ marginLeft: 6, opacity: .8 }}>· {counts[k]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: c.body, textAlign: "center", padding: 40 }}>Loading…</p>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.body }}>
          <ClipboardCheck size={36} style={{ opacity: .4 }} />
          <p style={{ margin: "10px 0 0", fontWeight: 600 }}>{filter === "pending" ? "Nothing waiting for approval." : "Nothing here."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map(b => {
            const pending  = ["pending", "processing"].includes(b.offline?.approval?.status);
            const disputed = b.parentCheck?.status === "denied" && b.disputeStatus === "pending";
            const ans = familyAnswer(b);
            const credits = b.studentId?.classCredits ?? 0;
            const rate = parseFloat(b.teacherId?.ratePerClass) || 0;
            const isActing = acting?.id === b._id;
            return (
              <div key={b._id} className={pending ? (disputed ? DISPUTE_GLOW_CLASS : AWAITING_GLOW_CLASS) : undefined}
                style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: c.heading }}>{b.classTitle}</div>
                  {pending && (disputed
                    ? <DisputePulse deadline={b.parentCheck?.disputeDeadline} label={b.studentId?.isManaged ? "Parent disputed" : "Student disputed"} />
                    : <DisputePulse tone="amber" compact label="Awaiting approval" />)}
                  {!pending && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
                      background: b.offline?.approval?.status === "approved" ? "#d1fae5" : "#fee2e2",
                      color: b.offline?.approval?.status === "approved" ? "#047857" : "#b91c1c" }}>
                      {b.offline?.approval?.status === "approved" ? "Approved · paid" : "Rejected"}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 12 }}>
                  {[
                    ["Teacher", b.teacherId?.displayName?.trim() || nameOf(b.teacherId)],
                    ["Student", <span key="s" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{nameOf(b.studentId)} {b.studentId?.isManaged && <ManagedBadge isDarkMode={isDarkMode} />}</span>],
                    ["When", `${fmtWhen(b.scheduledTime)} · ${b.duration} min`],
                    ["Where", PLATFORM[b.offline?.platform] || "—"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: c.soft, borderRadius: 10, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: c.body, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.heading, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                <p style={{ margin: "10px 0 0", fontSize: 13, color: c.body }}><strong style={{ color: c.heading }}>Why not in the app:</strong> {b.offline?.reason || "—"}</p>
                {ans && <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: ans.color }}>{ans.text}</p>}

                {/* Proof: recording links */}
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {b.recordings?.length ? b.recordings.map(r => (
                    <a key={r._id} href={r.externalUrl} target="_blank" rel="noopener noreferrer"
                      style={{ ...btn(brandA(.08), BRAND, `1px solid ${brandA(.3)}`), textDecoration: "none" }}
                      title={r.note || "Opens the teacher's recording in a new tab"}>
                      <ExternalLink size={13} /> Watch recording · {host(r.externalUrl)}
                    </a>
                  )) : (
                    <span style={{ fontSize: 12, color: "#b45309", display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <AlertTriangle size={13} /> No recording link
                    </span>
                  )}
                </div>

                {b.offline?.approval?.note && !pending && (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: c.body }}>Admin note: {b.offline.approval.note}</p>
                )}

                {pending && !isActing && (
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" style={btn("#16a34a", "#fff")} onClick={() => { setActing({ id: b._id, kind: "approve" }); setNote(""); }}><Check size={14} /> Approve & pay</button>
                    <button type="button" style={btn(c.card, "#b91c1c", `1px solid ${c.border}`)} onClick={() => { setActing({ id: b._id, kind: "reject" }); setNote(""); }}><X size={14} /> Reject</button>
                    <span style={{ fontSize: 12, color: credits > 0 ? c.body : "#b91c1c" }}>
                      {credits > 0
                        ? `Approving pays the teacher ${rate} and uses 1 of ${nameOf(b.studentId).split(" ")[0]}'s ${credits} classes.`
                        : `${nameOf(b.studentId).split(" ")[0]} has no classes left — record a payment first.`}
                    </span>
                  </div>
                )}

                {pending && isActing && (
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `2px solid ${acting.kind === "approve" ? "#16a34a" : "#dc2626"}` }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: c.heading, marginBottom: 6 }} htmlFor={`note-${b._id}`}>
                      {acting.kind === "approve" ? "Note (optional)" : "Why are you rejecting it? (the teacher will see this)"}
                    </label>
                    <textarea id={`note-${b._id}`} rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={500}
                      style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.card, color: c.heading, fontFamily: "inherit", fontSize: 13 }} />
                    {acting.kind === "approve" && disputed && (
                      <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c" }}>The family disputes this class — approving settles that dispute in the teacher's favour.</p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button type="button" disabled={busy} onClick={decide} style={btn(acting.kind === "approve" ? "#16a34a" : "#dc2626", "#fff")}>
                        {busy ? "Saving…" : acting.kind === "approve" ? "Confirm approval" : "Confirm rejection"}
                      </button>
                      <button type="button" disabled={busy} onClick={() => setActing(null)} style={btn(c.card, c.heading, `1px solid ${c.border}`)}>Cancel</button>
                    </div>
                  </div>
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
