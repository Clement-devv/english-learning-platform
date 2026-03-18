// src/pages/student/tabs/ReviewsTab.jsx
// Student: see completed classes that haven't been reviewed yet + submit reviews.
// Also shows past submitted reviews.

import { useState, useEffect } from "react";
import { Star, CheckCircle, Send, RefreshCw } from "lucide-react";
import api from "../../../api";

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

// ── Star picker ───────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: 2,
            color: n <= (hover || value) ? "#f59e0b" : "#d1d5db", fontSize: 28, lineHeight: 1,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Static stars (display only) ───────────────────────────────────────────────
function Stars({ rating, size = 14 }) {
  return (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

// ── Review form for one booking ───────────────────────────────────────────────
function ReviewForm({ booking, isDarkMode, onSubmitted }) {
  const [rating,  setRating]  = useState(0);
  const [comment, setComment] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState("");

  const card   = isDarkMode ? "#1e293b" : "#ffffff";
  const border = isDarkMode ? "#334155" : "#e2e8f0";
  const text   = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted  = isDarkMode ? "#94a3b8" : "#64748b";
  const inputBg= isDarkMode ? "#0f172a" : "#f8fafc";

  async function submit() {
    if (!rating) { setErr("Please pick a star rating."); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/api/reviews", { bookingId: booking._id, rating, comment });
      onSubmitted(booking._id);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 12,
      padding: 18, marginBottom: 12,
    }}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: text }}>
          {booking.classTitle}
        </span>
        <span style={{ fontSize: 12, color: muted, marginLeft: 10 }}>
          {fmt(booking.scheduledTime)}
          {booking.teacherId && ` · ${booking.teacherId.firstName} ${booking.teacherId.lastName}`}
        </span>
      </div>

      <StarPicker value={rating} onChange={setRating} />
      {rating > 0 && (
        <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
          {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
        </p>
      )}

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Share what you learned or how the class went… (optional)"
        rows={3}
        maxLength={1000}
        style={{
          width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 8,
          border: `1px solid ${border}`, background: inputBg, color: text,
          fontSize: 13, fontFamily: "inherit", resize: "vertical",
          boxSizing: "border-box", outline: "none",
        }}
      />
      {err && <p style={{ color: "#ef4444", fontSize: 12, margin: "4px 0 0" }}>{err}</p>}

      <button
        onClick={submit}
        disabled={busy}
        style={{
          marginTop: 10, display: "flex", alignItems: "center", gap: 6,
          padding: "8px 18px", borderRadius: 8, border: "none",
          background: "#16a34a", color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
          fontFamily: "inherit",
        }}
      >
        <Send size={13} /> {busy ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function ReviewsTab({ isDarkMode }) {
  const [pending,   setPending]   = useState([]);   // completed bookings not yet reviewed
  const [myReviews, setMyReviews] = useState([]);   // already submitted
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState("pending"); // "pending" | "submitted"

  const bg    = isDarkMode ? "#0f172a" : "#f8fafc";
  const card  = isDarkMode ? "#1e293b" : "#ffffff";
  const border= isDarkMode ? "#334155" : "#e2e8f0";
  const text  = isDarkMode ? "#e2e8f0" : "#1e293b";
  const muted = isDarkMode ? "#94a3b8" : "#64748b";

  async function load() {
    setLoading(true);
    try {
      const [bookingsRes, reviewsRes] = await Promise.all([
        api.get("/api/bookings/student"),
        api.get("/api/reviews/my"),
      ]);

      const reviewedIds = new Set(
        (reviewsRes.data || []).map(r => r.bookingId?._id || r.bookingId)
      );
      const completed = (bookingsRes.data || []).filter(
        b => b.status === "completed" && !reviewedIds.has(b._id)
      );
      // Populate teacher name from booking data (already populated server-side)
      setPending(completed);
      setMyReviews(reviewsRes.data || []);
    } catch (e) {
      console.error("Reviews load error:", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmitted(bookingId) {
    setPending(p => p.filter(b => b._id !== bookingId));
    load(); // refresh submitted list
  }

  const tabBtn = (key, label, count) => (
    <button
      onClick={() => setView(key)}
      style={{
        padding: "8px 18px", borderRadius: 20, fontSize: 13, fontWeight: 700,
        border: `1px solid ${view === key ? "#16a34a" : border}`,
        background: view === key ? "#16a34a" : "transparent",
        color: view === key ? "#fff" : text,
        cursor: "pointer", fontFamily: "inherit", position: "relative",
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          position: "absolute", top: -6, right: -6,
          background: "#ef4444", color: "#fff",
          borderRadius: "50%", width: 18, height: 18,
          fontSize: 10, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{count}</span>
      )}
    </button>
  );

  return (
    <div style={{ padding: 24, background: bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: text, display: "flex", alignItems: "center", gap: 8 }}>
          ⭐ Class Reviews
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>
          Rate your classes to help us improve your learning experience.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabBtn("pending",   "Awaiting review", pending.length)}
        {tabBtn("submitted", "My reviews",       myReviews.length)}
        <button
          onClick={load}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: muted }}
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : view === "pending" ? (
        pending.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: muted }}>
            <CheckCircle size={36} style={{ marginBottom: 10, color: "#16a34a" }} />
            <p style={{ margin: 0, fontWeight: 600 }}>All caught up!</p>
            <p style={{ margin: "4px 0 0", fontSize: 13 }}>No classes waiting for a review.</p>
          </div>
        ) : (
          pending.map(booking => (
            <ReviewForm
              key={booking._id}
              booking={booking}
              isDarkMode={isDarkMode}
              onSubmitted={handleSubmitted}
            />
          ))
        )
      ) : (
        // Submitted reviews
        myReviews.length === 0 ? (
          <p style={{ color: muted, fontSize: 13 }}>No reviews submitted yet.</p>
        ) : (
          myReviews.map(r => (
            <div key={r._id} style={{
              background: card, border: `1px solid ${border}`,
              borderRadius: 12, padding: 16, marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: text }}>
                    {r.bookingId?.classTitle ?? "Class"}
                  </span>
                  <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>
                    {fmt(r.bookingId?.scheduledTime)}
                  </span>
                  {r.teacherId && (
                    <span style={{ fontSize: 12, color: muted, marginLeft: 8 }}>
                      · {r.teacherId.firstName} {r.teacherId.lastName}
                    </span>
                  )}
                </div>
                <Stars rating={r.rating} />
              </div>
              {r.comment && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: text, lineHeight: 1.5 }}>
                  "{r.comment}"
                </p>
              )}
              <p style={{ margin: "6px 0 0", fontSize: 11, color: muted }}>
                Submitted {fmt(r.createdAt)}
              </p>
            </div>
          ))
        )
      )}
    </div>
  );
}
