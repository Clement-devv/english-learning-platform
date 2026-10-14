// src/pages/admin/tabs/ReviewsTab.jsx
// Admin: all reviews across all teachers, per-teacher averages, flag/delete controls.

import { useState, useEffect, useMemo, useRef } from "react";
import { Flag, Trash2, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import api from "../../../api";
import { useOnDataChanged } from "../../../hooks/useLiveData";
import { useTranslation } from "react-i18next";
import { dateLocale } from "../../../i18n/dateLocale.js";

const PAGE_SIZE = 8;

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString(dateLocale("en-US"), { month: "short", day: "numeric", year: "numeric" }) : "—";

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
  const { t: tr } = useTranslation("admin");
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

  // One page from the server — filters and sort are applied there
  // Live: refresh quietly (no spinner) when the server says this data changed
  const quietRef = useRef(false);
  useOnDataChanged(["reviews"], () => { quietRef.current = true; load(); });

  async function load() {
    if (!quietRef.current) setLoading(true);
    quietRef.current = false;
    try {
      const res = await api.get("/reviews", { params: {
        page, limit: PAGE_SIZE, sort: sortBy,
        teacherId: filterTeacher || undefined,
        flagged:   filterFlag ? "true" : undefined,
        rating:    filterRating || undefined,
      } });
      setData(res.data);
      if (res.data.pagination && res.data.pagination.page !== page) setPage(res.data.pagination.page);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, filterTeacher, filterFlag, filterRating, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever filters or sort changes
  useEffect(() => { setPage(1); }, [filterTeacher, filterFlag, filterRating, sortBy]);

  async function handleFlag(reviewId, currentFlag) {
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      await api.patch(`/reviews/${reviewId}/flag`, { flagged: !currentFlag });
      showToast(currentFlag ? tr("reviewsTab.flagRemoved") : tr("reviewsTab.reviewFlagged"));
      load();
    } catch (e) {
      showToast(e.response?.data?.error || tr("reviewsTab.actionFailed"), false);
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  async function handleDelete(reviewId) {
    if (!window.confirm(tr("reviewsTab.deleteThisReviewPermanently"))) return;
    setBusy(b => ({ ...b, [reviewId]: true }));
    try {
      await api.delete(`/reviews/${reviewId}`);
      showToast(tr("reviewsTab.reviewDeleted"));
      load();
    } catch (e) {
      showToast(e.response?.data?.error || tr("reviewsTab.deleteFailed"), false);
    } finally {
      setBusy(b => ({ ...b, [reviewId]: false }));
    }
  }

  // Server already filtered, sorted and paged
  const pageItems   = data.reviews || [];
  const filtered    = { length: data.pagination?.total ?? pageItems.length }; // count for "Showing"
  const totalPages  = data.pagination?.totalPages || 1;
  const safePage    = Math.min(page, totalPages);

  // Summary stats across ALL reviews (not filtered) — computed by the server
  const totalCount   = data.totals?.total ?? 0;
  const flaggedCount = data.totals?.flagged ?? 0;
  const overallAvg   = data.totals?.avgRating != null ? data.totals.avgRating.toFixed(1) : null;

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text }}>{tr("reviewsTab.teacherReviews")}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
            {tr("reviewsTab.monitorStudentFeedbackToSpot")}
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
            { label: tr("reviewsTab.totalReviews"), value: totalCount,   color: "#3b82f6", bg: isDarkMode ? "rgba(59,130,246,0.1)" : "#eff6ff" },
            { label: tr("reviewsTab.overallAvg"),   value: overallAvg ? `${overallAvg} ★` : "—", color: avgColor(Number(overallAvg)), bg: isDarkMode ? "rgba(245,158,11,0.1)" : "#fffbeb" },
            { label: tr("reviewsTab.flagged"),       value: flaggedCount, color: flaggedCount > 0 ? "#ef4444" : muted, bg: isDarkMode ? "rgba(239,68,68,0.08)" : "#fef2f2" },
            { label: tr("reviewsTab.showing"),       value: `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`, color: muted, bg: card },
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
                {t.total} {tr("reviewsTab.review")}{t.total !== 1 ? "s" : ""}
                {t.flagged > 0 && (
                  <span style={{ marginLeft: 6, color: "#ef4444", fontWeight: 700 }}>{tr("reviewsTab.flagged2", { flagged: t.flagged })}</span>
                )}
              </div>
              {t.avgRating !== null && t.avgRating < 3 && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#ef4444", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={11} /> {tr("reviewsTab.qualityConcern")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Filters + Sort row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))} style={inputStyle}>
          <option value={0}>{tr("reviewsTab.allRatings")}</option>
          {[5,4,3,2,1].map(s => <option key={s} value={s}>{s}★</option>)}
        </select>

        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={inputStyle}>
          <option value="newest">{tr("reviewsTab.newestFirst")}</option>
          <option value="oldest">{tr("reviewsTab.oldestFirst")}</option>
          <option value="highest">{tr("reviewsTab.highestRated")}</option>
          <option value="lowest">{tr("reviewsTab.lowestRated")}</option>
          <option value="flagged">{tr("reviewsTab.flaggedFirst")}</option>
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: text, cursor: "pointer" }}>
          <input type="checkbox" checked={filterFlag} onChange={e => setFilterFlag(e.target.checked)} />
          {tr("reviewsTab.flaggedOnly")}
        </label>

        {(filterTeacher || filterFlag || filterRating > 0) && (
          <button onClick={() => { setFilterTeacher(""); setFilterFlag(false); setFilterRating(0); }}
            style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            {tr("reviewsTab.clearFilters")}
          </button>
        )}
      </div>

      {/* Review list */}
      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>{tr("reviewsTab.loading")}</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: isDarkMode ? "#1e1730" : "#f5f0ff",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Flag size={28} color="#7c3aed" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: text, margin: "0 0 8px" }}>{tr("reviewsTab.noReviewsFound")}</p>
          <p style={{ fontSize: 13.5, color: muted, margin: 0 }}>{tr("reviewsTab.reviewsWillAppearHereOnce")}</p>
        </div>
      ) : (
        <>
          {/* Page info */}
          <div style={{ fontSize: 12, color: muted, marginBottom: 10, fontWeight: 600 }}>{tr("reviewsTab.showingOfReview", { value: (safePage - 1) * PAGE_SIZE + 1, value2: Math.min(safePage * PAGE_SIZE, filtered.length), filteredCount: filtered.length, value3: filtered.length !== 1 ? "s" : "" })}
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
                      {r.bookingId?.classTitle ?? tr("reviewsTab.class")}
                    </span>
                    <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>
                      {fmt(r.bookingId?.scheduledTime)}
                    </span>
                  </div>
                  <Stars rating={r.rating} size={15} />
                </div>

                <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                  {tr("reviewsTab.student")} <strong style={{ color: text }}>{r.studentId?.firstName ?? "?"} {r.studentId?.lastName ?? ""}</strong>
                  {" · "}
                  {tr("reviewsTab.teacher")} <strong style={{ color: text }}>{r.teacherId?.firstName ?? "?"} {r.teacherId?.lastName ?? ""}</strong>
                  {" · "}
                  {fmt(r.createdAt)}
                </div>

                {r.comment && (
                  <p style={{ margin: "8px 0 0", fontSize: 13, color: text, lineHeight: 1.6, fontStyle: "italic" }}>
                    "{r.comment}"
                  </p>
                )}

                {r.flagged && r.flagReason && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{tr("reviewsTab.flagged3", { flagReason: r.flagReason })}
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
                    <Flag size={12} /> {r.flagged ? tr("reviewsTab.unflag") : tr("reviewsTab.flag")}
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
                    <Trash2 size={12} /> {tr("reviewsTab.delete")}
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
                <ChevronLeft size={14} /> {tr("reviewsTab.prev")}
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
                {tr("reviewsTab.next")} <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
