// src/pages/admin/tabs/ReferralsTab.jsx
// Admin: review pending referral applications, approve (send invite + credit referrer) or reject.

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, RefreshCw, Users } from "lucide-react";
import api from "../../../api";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/i18n.js";
import { dateLocale } from "../../../i18n/dateLocale.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`admin:${key}`, opts);


const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(dateLocale("en-US"), { month: "short", day: "numeric", year: "numeric" }) : "—";

const STATUS_META = {
  pending:  { get label() { return ta("referralsTab.status.pending"); },  color: "#f59e0b", bg: "#fef3c7" },
  invited:  { get label() { return ta("referralsTab.status.invited"); },  color: "#3b82f6", bg: "#eff6ff" },
  active:   { get label() { return ta("referralsTab.status.active"); },   color: "#16a34a", bg: "#f0fdf4" },
  rejected: { get label() { return ta("referralsTab.status.rejected"); }, color: "var(--a-muted)", bg: "var(--a-raised)" },
};

export default function ReferralsTab() {
  const { t: tr } = useTranslation("admin");
  const [referrals, setReferrals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("pending");
  const [busy,      setBusy]      = useState({});
  const [toast,     setToast]     = useState(null);

  const bg    = 'var(--a-raised)';
  const card  = 'var(--a-surface)';
  const border= 'var(--a-line)';
  const text  = 'var(--a-ink)';
  const muted = 'var(--a-ink-2)';

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const url = filter ? `/referrals?status=${filter}` : `/referrals`;
      const res  = await api.get(url);
      const json = res.data;
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
      await api.post(`/referrals/${id}/approve`);
      showToast(tr("referralsTab.studentInvitedReferrerCredited1"));
      load();
    } catch (e) {
      showToast(e.response?.data?.error || tr("referralsTab.approvalFailed"), false);
    } finally {
      setBusy(b => ({ ...b, [id]: false }));
    }
  }

  async function reject(id) {
    if (!window.confirm(tr("referralsTab.rejectThisReferralApplication"))) return;
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await api.post(`/referrals/${id}/reject`);
      showToast(tr("referralsTab.applicationRejected"));
      load();
    } catch (e) {
      showToast(e.response?.data?.error || tr("referralsTab.rejectionFailed"), false);
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
        <div className="ui-toast-in" role="status" style={{
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
            <Users size={20} /> {tr("referralsTab.referralApplications")}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            {tr("referralsTab.approveToSendAnInvite")}
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
        <p style={{ color: muted, fontSize: 13 }}>{tr("referralsTab.loading")}</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: muted }}>
          <p style={{ fontSize: 30, margin: 0 }}>🎁</p>
          <p style={{ margin: "8px 0 0", fontWeight: 600, color: text }}>{tr("referralsTab.noReferrals", { value: filter || "" })}</p>
        </div>
      ) : (
        referrals.map(r => {
          const meta = STATUS_META[r.status] ?? STATUS_META.pending;
          const referrerName = r.referrerId
            ? `${r.referrerId.firstName} ${r.referrerId.lastName}`
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
                    {tr("referralsTab.referredBy")} <strong style={{ color: text }}>{referrerName}</strong>
                    <span style={{ marginLeft: 6, fontFamily: "monospace", fontSize: 11, color: "#3b82f6" }}>
                      [{r.referrerCode}]
                    </span>
                    <span style={{ marginLeft: 8 }}>{tr("referralsTab.applied", { fmt: fmt(r.createdAt) })}</span>
                  </div>
                  {r.referredStudentId && (
                    <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                      {tr("referralsTab.studentStatus")} <strong>{r.referredStudentId.status}</strong>
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
                    {busy[r._id] ? tr("referralsTab.processing") : tr("referralsTab.approveInvite")}
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
                    <XCircle size={14} /> {tr("referralsTab.reject")}
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
