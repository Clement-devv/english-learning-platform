// src/pages/admin/tabs/ReferralsTab.jsx
// Admin: review pending referral applications, approve (send invite + credit referrer) or reject.

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, RefreshCw, Users } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
function authHeader() {
  const t = localStorage.getItem("adminToken") || localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_META = {
  pending:  { label: "Pending",  color: "#f59e0b", bg: "#fef3c7" },
  invited:  { label: "Invited",  color: "#3b82f6", bg: "#eff6ff" },
  active:   { label: "Active",   color: "#16a34a", bg: "#f0fdf4" },
  rejected: { label: "Rejected", color: "#94a3b8", bg: "#f1f5f9" },
};

export default function ReferralsTab({ isDarkMode }) {
  const [referrals, setReferrals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("pending");
  const [busy,      setBusy]      = useState({});
  const [toast,     setToast]     = useState(null);

  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const card  = isDarkMode ? "#1e293b" : "#ffffff";
  const border= isDarkMode ? "#334155" : "#e2e8f0";
  const text  = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const url = filter ? `${API}/api/referrals?status=${filter}` : `${API}/api/referrals`;
      const res  = await fetch(url, { headers: authHeader() });
      const json = await res.json();
      setReferrals(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function approve(id) {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`${API}/api/referrals/${id}/approve`, {
        method: "POST", headers: authHeader(),
      });
      const json = await res.json();
      if (res.ok) {
        showToast("Student invited! Referrer credited +1 class.");
        load();
      } else {
        showToast(json.error || "Approval failed", false);
      }
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  }

  async function reject(id) {
    if (!window.confirm("Reject this referral application?")) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`${API}/api/referrals/${id}/reject`, {
        method: "POST", headers: authHeader(),
      });
      if (res.ok) { showToast("Application rejected."); load(); }
      else { const e = await res.json(); showToast(e.error, false); }
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  }

  const filterBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setFilter(key)}
      style={{
        padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        border: `1px solid ${filter === key ? "#3b82f6" : border}`,
        background: filter === key ? "#3b82f6" : "transparent",
        color: filter === key ? "#fff" : text,
        cursor: "pointer", fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          background: toast.ok ? "#16a34a" : "#dc2626",
          color: "#fff", padding: "10px 18px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text, display: "flex", alignItems: "center", gap: 8 }}>
            <Users size={20} /> Referral Applications
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            Approve to send an invite and automatically credit the referrer +1 class.
          </p>
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: muted }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {filterBtn("pending",  "Pending")}
        {filterBtn("invited",  "Invited")}
        {filterBtn("active",   "Active")}
        {filterBtn("rejected", "Rejected")}
        {filterBtn("",         "All")}
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: muted }}>
          <p style={{ fontSize: 30, margin: 0 }}>🎁</p>
          <p style={{ margin: "8px 0 0", fontWeight: 600, color: text }}>No {filter || ""} referrals</p>
        </div>
      ) : (
        referrals.map(r => {
          const meta = STATUS_META[r.status] ?? STATUS_META.pending;
          const referrerName = r.referrerId
            ? `${r.referrerId.firstName} ${r.referrerId.surname}`
            : "Unknown";
          return (
            <div key={r._id} style={{
              background: card, border: `1px solid ${border}`,
              borderRadius: 12, padding: 18, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                {/* Applicant info */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: text }}>
                    {r.referredFirstName} {r.referredLastName}
                  </div>
                  <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{r.referredEmail}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 6 }}>
                    Referred by: <strong style={{ color: text }}>{referrerName}</strong>
                    <span style={{ marginLeft: 6, fontFamily: "monospace", fontSize: 11, color: "#3b82f6" }}>
                      [{r.referrerCode}]
                    </span>
                    <span style={{ marginLeft: 8 }}>· Applied {fmt(r.createdAt)}</span>
                  </div>
                  {r.referredStudentId && (
                    <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                      Student status: <strong>{r.referredStudentId.status}</strong>
                    </div>
                  )}
                </div>

                {/* Status badge */}
                <span style={{
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: meta.bg, color: meta.color,
                }}>
                  {meta.label}
                </span>
              </div>

              {/* Actions — only for pending */}
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    onClick={() => approve(r._id)}
                    disabled={busy[r._id]}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 18px", borderRadius: 8, border: "none",
                      background: "#16a34a", color: "#fff",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", opacity: busy[r._id] ? 0.6 : 1,
                    }}
                  >
                    <CheckCircle size={14} />
                    {busy[r._id] ? "Processing…" : "Approve & Invite"}
                  </button>
                  <button
                    onClick={() => reject(r._id)}
                    disabled={busy[r._id]}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8, border: `1px solid ${border}`,
                      background: "transparent", color: muted,
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", opacity: busy[r._id] ? 0.6 : 1,
                    }}
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
