// src/pages/admin/tabs/ReviewsTab.jsx
// Admin: all reviews across all teachers, per-teacher averages, flag/delete controls.

import { useState, useEffect, useMemo } from "react";
import { Flag, Trash2, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../../api";

const PAGE_SIZE = 8;

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
  const [data,          setData]          = useState({ reviews: [], teacherStats: [] });
  const [loading,       setLoading]       = useState(true);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterFlag,    setFilterFlag]    = useState(false);
  const [filterRating,  setFilterRating]  = useState(0);
  const [sortBy,        setSortBy]        = useState("newest");
  const [page,          setPage]          = useState(1);
  const [toast,         setToast]         = useState(null);
  const [busy,          setBusy]          = useState({});

  const bg      = isDarkMode ? "#0f172a" : "#f8fafc";
  const card    = isDarkMode ? "#1e293b" : "#ffffff";
  const border  = isDarkMode ? "#334155" : "#e2e8f0";
  const text    = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted   = isDarkMode ? "#94a3b8" : "#64748b";
  const inputBg = isDarkMode ? "#0f172a" : "#f8fafc";

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/reviews");
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever filters or sort changes
  useEffect(() => { setPage(1); }, [filterTeacher, filterFlag, filterRating, sortBy]);

  async function handleFlag(reviewId, currentFlag) {
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      await api.patch(`/reviews/${reviewId}/flag`, { flagged: !currentFlag });
      showToast(currentFlag ? "Flag removed" : "Review flagged");
      load();
    } catch (e) {
      showToast(e.response?.data?.error || "Action failed", false);
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  async function handleDelete(reviewId) {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      await api.delete(`/reviews/${reviewId}`);
      showToast("Review deleted");
      load();
    } catch (e) {
      showToast(e.response?.data?.error || "Delete failed", false);
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = data.reviews || [];
    if (filterTeacher) list = list.filter(r => r.teacherId?._id === filterTeacher || r.teacherId === filterTeacher);
    if (filterFlag)    list = list.filter(r => r.flagged);
    if (filterRating)  list = list.filter(r => r.rating === filterRating);

    switch (sortBy) {
      case "oldest":   return [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      case "highest":  return [...list].sort((a, b) => b.rating - a.rating);
      case "lowest":   return [...list].sort((a, b) => a.rating - b.rating);
      case "flagged":  return [...list].sort((a, b) => (b.flagged ? 1 : 0) - (a.flagged ? 1 : 0));
      default:         return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }, [data.reviews, filterTeacher, filterFlag, filterRating, sortBy]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Summary stats across ALL reviews (not filtered)
  const allReviews  = data.reviews || [];
  const totalCount  = allReviews.length;
  const flaggedCount = allReviews.filter(r => r.flagged).length;
  const overallAvg  = totalCount
    ? (allReviews.reduce((s, r) => s + r.rating, 0) / totalCount).toFixed(1)
    : null;

  const inputStyle = {
    padding: "7px 10px", borderRadius: 8, fontSize: 13,
    border: `1px solid ${border}`, background: inputBg, color: text,
    fontFamily: "inherit", outline: "none",
  };

  // Page number buttons — show at most 5 around current page
  function pageNums() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const nums = new Set([1, totalPages, safePage, safePage - 1, safePage + 1].filter(n => n >= 1 && n <= totalPages));
    return [...nums].sort((a, b) => a - b);
  }

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
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

      {/* Summary stat bar */}
      {!loading && totalCount > 0 && (
        <div style={{
          display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
        }}>
          {[
            { label: "Total reviews", value: totalCount,   color: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.1)" : "#eff6ff" },
            { label: "Overall avg",   value: overallAvg ? `${overallAvg} ★` : "—", color: avgColor(Number(overallAvg)), bg: isDarkMode ? "rgba(245,158,11,0.1)" : "#fffbeb" },
            { label: "Flagged",       value: flaggedCount, color: flaggedCount > 0 ? "#ef4444" : muted, bg: isDarkMode ? "rgba(239,68,68,0.08)" : "#fef2f2" },
            { label: "Showing",       value: `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`, color: muted, bg: card },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${border}`,
              borderRadius: 10, padding: "10px 16px",
              display: "flex", flexDirection: "column", gap: 2, minWidth: 110,
            }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: muted }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Filters + Sort row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))} style={inputStyle}>
          <option value={0}>All ratings</option>
          {[5,4,3,2,1].map(s => <option key={s} value={s}>{s}★</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inputStyle}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="highest">Highest rated</option>
          <option value="lowest">Lowest rated</option>
          <option value="flagged">Flagged first</option>
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
      </div>

      {/* Review list */}
      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: isDarkMode ? "#1e1730" : "#f5f0ff",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Flag size={28} color="#7c3aed" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 8px" }}>No reviews found</p>
          <p style={{ fontSize: 13.5, color: muted, margin: 0 }}>Reviews will appear here once students rate their classes</p>
        </div>
      ) : (
        <>
          {/* Page info */}
          <div style={{ fontSize: 12, color: muted, marginBottom: 10, fontWeight: 600 }}>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} review{filtered.length !== 1 ? "s" : ""}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pageItems.map(r => (
              <div key={r._id} style={{
                background: card,
                border: `1px solid ${r.flagged ? "#ef4444" : border}`,
                borderRadius: 12, padding: 16,
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
                  Student: <strong style={{ color: text }}>{r.studentId?.firstName ?? "?"} {r.studentId?.lastName ?? ""}</strong>
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
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, marginTop: 24, flexWrap: "wrap",
            }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "7px 14px", borderRadius: 8,
                  border: `1px solid ${border}`, background: card,
                  color: safePage === 1 ? muted : text,
                  cursor: safePage === 1 ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 700, opacity: safePage === 1 ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                <ChevronLeft size={14} /> Prev
              </button>

              {pageNums().reduce((acc, n, i, arr) => {
                if (i > 0 && n - arr[i - 1] > 1) {
                  acc.push(
                    <span key={`gap-${n}`} style={{ color: muted, fontSize: 13, padding: "0 4px" }}>…</span>
                  );
                }
                acc.push(
                  <button key={n} onClick={() => setPage(n)}
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: n === safePage ? "#7c3aed" : card,
                      color: n === safePage ? "#fff" : text,
                      fontWeight: n === safePage ? 900 : 600,
                      cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                      border: `1px solid ${n === safePage ? "#7c3aed" : border}`,
                      boxShadow: n === safePage ? "0 2px 8px rgba(124,58,237,0.3)" : "none",
                    }}>
                    {n}
                  </button>
                );
                return acc;
              }, [])}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "7px 14px", borderRadius: 8,
                  border: `1px solid ${border}`, background: card,
                  color: safePage === totalPages ? muted : text,
                  cursor: safePage === totalPages ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 700, opacity: safePage === totalPages ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
