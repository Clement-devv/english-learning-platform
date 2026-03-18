// src/pages/teacher/tabs/ReviewsTab.jsx
// Teacher sees all reviews for their own classes + aggregate stats.

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import api from "../../../api";

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function Stars({ rating, size = 15 }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function StatBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <span style={{ width: 36, fontSize: 12, color: "#64748b", textAlign: "right" }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <span style={{ width: 24, fontSize: 12, color: "#64748b" }}>{count}</span>
    </div>
  );
}

export default function ReviewsTab({ teacherInfo, isDarkMode }) {
  const [data,    setData]    = useState(null);  // { reviews, stats }
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState(0);    // 0 = all stars

  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const card  = isDarkMode ? "#1e293b" : "#ffffff";
  const border= isDarkMode ? "#334155" : "#e2e8f0";
  const text  = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";

  async function load() {
    if (!teacherInfo?._id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/reviews/teacher/${teacherInfo._id}`);
      setData(res.data);
    } catch (e) {
      console.error("Reviews load error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [teacherInfo?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviews = data?.reviews ?? [];
  const stats   = data?.stats   ?? { total: 0, avgRating: null, dist: [0,0,0,0,0] };

  const displayed = filter === 0 ? reviews : reviews.filter(r => r.rating === filter);

  const distColors = ["#ef4444","#f97316","#eab308","#84cc16","#16a34a"];

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text }}>⭐ My Reviews</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            Feedback from students after their classes.
          </p>
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: muted }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          {/* Stats card */}
          {stats.total > 0 && (
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20, marginBottom: 20, display: "flex", gap: 32, flexWrap: "wrap" }}>
              {/* Average */}
              <div style={{ textAlign: "center", minWidth: 100 }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>
                  {stats.avgRating?.toFixed(1) ?? "—"}
                </div>
                <Stars rating={Math.round(stats.avgRating ?? 0)} size={18} />
                <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{stats.total} review{stats.total !== 1 ? "s" : ""}</div>
              </div>

              {/* Distribution */}
              <div style={{ flex: 1, minWidth: 180 }}>
                {[5,4,3,2,1].map(star => (
                  <StatBar
                    key={star}
                    label={`${star}★`}
                    count={stats.dist[star - 1]}
                    total={stats.total}
                    color={distColors[star - 1]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          {stats.total > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {[0,5,4,3,2,1].map(s => (
                <button key={s} onClick={() => setFilter(s)} style={{
                  padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${filter === s ? "#16a34a" : border}`,
                  background: filter === s ? "#16a34a" : "transparent",
                  color: filter === s ? "#fff" : text,
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  {s === 0 ? "All" : `${s}★`}
                </button>
              ))}
            </div>
          )}

          {/* Review list */}
          {displayed.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: muted }}>
              <p style={{ margin: 0, fontSize: 22 }}>⭐</p>
              <p style={{ margin: "8px 0 0", fontWeight: 600, color: text }}>No reviews yet</p>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                Reviews appear here after students rate their completed classes.
              </p>
            </div>
          ) : (
            displayed.map(r => (
              <div key={r._id} style={{
                background: card, border: `1px solid ${border}`,
                borderRadius: 12, padding: 16, marginBottom: 10,
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
                  <Stars rating={r.rating} />
                </div>

                {r.comment && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: text, lineHeight: 1.6, fontStyle: "italic" }}>
                    "{r.comment}"
                  </p>
                )}

                <p style={{ margin: "8px 0 0", fontSize: 12, color: muted }}>
                  — {r.studentId?.firstName ?? "Student"} {r.studentId?.surname ?? ""}
                  {" · "}{fmt(r.createdAt)}
                </p>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
