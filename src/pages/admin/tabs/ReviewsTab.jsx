// src/pages/admin/tabs/ReviewsTab.jsx
// Admin: all reviews across all teachers, per-teacher averages, flag/delete controls.

import { useState, useEffect, useMemo } from "react";
import { Flag, Trash2, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import api from "../../../api";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
function authHeader() {
  const t = localStorage.getItem("adminToken") || localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Stars({ rating, size = 13 }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function avgColor(avg) {
  if (!avg) return "#94a3b8";
  if (avg >= 4.5) return "#16a34a";
  if (avg >= 3.5) return "#84cc16";
  if (avg >= 2.5) return "#f59e0b";
  return "#ef4444";
}

export default function ReviewsTab({ isDarkMode }) {
  const [data,    setData]    = useState({ reviews: [], teacherStats: [] });
  const [loading, setLoading] = useState(true);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterFlag,    setFilterFlag]    = useState(false);
  const [filterRating,  setFilterRating]  = useState(0);
  const [expanded,      setExpanded]      = useState(null); // teacher _id
  const [toast,         setToast]         = useState(null);
  const [busy,          setBusy]          = useState({});

  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const card  = isDarkMode ? "#1e293b" : "#ffffff";
  const border= isDarkMode ? "#334155" : "#e2e8f0";
  const text  = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";
  const inputBg= isDarkMode ? "#0f172a" : "#f8fafc";

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTeacher) params.set("teacherId", filterTeacher);
      if (filterFlag)    params.set("flagged", "true");
      if (filterRating)  params.set("rating", filterRating);
      const res = await fetch(`${API}/api/reviews?${params}`, { headers: authHeader() });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFlag(reviewId, currentFlag) {
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      const res = await fetch(`${API}/api/reviews/${reviewId}/flag`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ flagged: !currentFlag }),
      });
      if (res.ok) { showToast(currentFlag ? "Flag removed" : "Review flagged"); load(); }
      else        { const e = await res.json(); showToast(e.error, false); }
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  async function handleDelete(reviewId) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      const res = await fetch(`${API}/api/reviews/${reviewId}`, {
        method: "DELETE", headers: authHeader(),
      });
      if (res.ok) { showToast("Review deleted"); load(); }
      else        { const e = await res.json(); showToast(e.error, false); }
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  const displayed = useMemo(() => {
    let list = data.reviews || [];
    if (filterTeacher) list = list.filter(r => r.teacherId?._id === filterTeacher || r.teacherId === filterTeacher);
    if (filterFlag)    list = list.filter(r => r.flagged);
    if (filterRating)  list = list.filter(r => r.rating === filterRating);
    return list;
  }, [data.reviews, filterTeacher, filterFlag, filterRating]);

  const inputStyle = {
    padding: "7px 10px", borderRadius: 8, fontSize: 13,
    border: `1px solid ${border}`, background: inputBg, color: text,
    fontFamily: "inherit", outline: "none",
  };

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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text }}>⭐ Teacher Reviews</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            Monitor student feedback to spot quality issues early.
          </p>
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: muted }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Teacher summary cards */}
      {data.teacherStats?.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {data.teacherStats.map(t => (
            <div
              key={t._id}
              onClick={() => setFilterTeacher(f => f === t._id ? "" : t._id)}
              style={{
                background: card, border: `1px solid ${filterTeacher === t._id ? "#16a34a" : border}`,
                borderRadius: 10, padding: "10px 14px", cursor: "pointer", minWidth: 140,
                boxShadow: filterTeacher === t._id ? "0 0 0 2px #16a34a33" : "none",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: text }}>{t.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: avgColor(t.avgRating) }}>
                  {t.avgRating?.toFixed(1) ?? "—"}
                </span>
                <Stars rating={Math.round(t.avgRating ?? 0)} />
              </div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
                {t.total} review{t.total !== 1 ? "s" : ""}
                {t.flagged > 0 && (
                  <span style={{ marginLeft: 6, color: "#ef4444", fontWeight: 700 }}>
                    ⚑ {t.flagged} flagged
                  </span>
                )}
              </div>
              {t.avgRating !== null && t.avgRating < 3 && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> Quality concern
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))} style={inputStyle}>
          <option value={0}>All ratings</option>
          {[5,4,3,2,1].map(s => <option key={s} value={s}>{s}★</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: text, cursor: "pointer" }}>
          <input type="checkbox" checked={filterFlag} onChange={e => setFilterFlag(e.target.checked)} />
          Flagged only
        </label>
        {(filterTeacher || filterFlag || filterRating > 0) && (
          <button onClick={() => { setFilterTeacher(""); setFilterFlag(false); setFilterRating(0); }}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            Clear filters
          </button>
        )}
        <button onClick={load} style={{ marginLeft: "auto", padding: "5px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>
          Apply
        </button>
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: muted }}>
          <p style={{ margin: 0, fontSize: 22 }}>⭐</p>
          <p style={{ margin: "8px 0 0", fontWeight: 600, color: text }}>No reviews found</p>
        </div>
      ) : (
        displayed.map(r => (
          <div key={r._id} style={{
            background: card,
            border: `1px solid ${r.flagged ? "#ef4444" : border}`,
            borderRadius: 12, padding: 16, marginBottom: 10,
            borderLeft: r.flagged ? "4px solid #ef4444" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: text }}>
                  {r.bookingId?.classTitle ?? "Class"}
                </span>
                <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>
                  {fmt(r.bookingId?.scheduledTime)}
                </span>
              </div>
              <Stars rating={r.rating} size={15} />
            </div>

            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
              Student: <strong style={{ color: text }}>{r.studentId?.firstName ?? "?"} {r.studentId?.surname ?? ""}</strong>
              {" · "}
              Teacher: <strong style={{ color: text }}>{r.teacherId?.firstName ?? "?"} {r.teacherId?.lastName ?? ""}</strong>
              {" · "}
              {fmt(r.createdAt)}
            </div>

            {r.comment && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: text, lineHeight: 1.6, fontStyle: "italic" }}>
                "{r.comment}"
              </p>
            )}

            {r.flagged && r.flagReason && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>
                ⚑ Flagged: {r.flagReason}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => handleFlag(r._id, r.flagged)}
                disabled={busy[r._id]}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 7, border: "none",
                  background: r.flagged ? "#fef2f2" : "#fff7ed",
                  color: r.flagged ? "#ef4444" : "#f97316",
                  cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                }}
              >
                <Flag size={12} /> {r.flagged ? "Unflag" : "Flag"}
              </button>
              <button
                onClick={() => handleDelete(r._id)}
                disabled={busy[r._id]}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 7, border: "none",
                  background: "#fef2f2", color: "#ef4444",
                  cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                }}
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
