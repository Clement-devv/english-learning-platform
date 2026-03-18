// src/pages/student/tabs/FlashcardsTab.jsx
import { useState, useEffect, useCallback } from "react";
import api from "../../../api";

export default function FlashcardsTab({ isDarkMode }) {
  const [stats,    setStats]    = useState([]);
  const [cards,    setCards]    = useState([]);
  const [mode,     setMode]     = useState("home");    // "home" | "review" | "done"
  const [idx,      setIdx]      = useState(0);
  const [flipped,  setFlipped]  = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [reviewed, setReviewed] = useState(0);

  const col = {
    bg:      isDarkMode ? "#0f1117" : "#fff8f0",
    card:    isDarkMode ? "#1a1d2e" : "#ffffff",
    border:  isDarkMode ? "#2a2d40" : "#ffe8cc",
    text:    isDarkMode ? "#e8eaf6" : "#1a1d2e",
    muted:   isDarkMode ? "#8b91b8" : "#6b7280",
    accent:  "#6366f1",
    cardAlt: isDarkMode ? "#1e2235" : "#fffbf5",
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, dueRes] = await Promise.allSettled([
        api.get("/api/vocab/stats"),
        api.get("/api/vocab/due"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data.stats || []);
      if (dueRes.status === "fulfilled")   setCards(dueRes.value.data.cards || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalDue = cards.length;

  const startReview = () => {
    setIdx(0);
    setFlipped(false);
    setReviewed(0);
    setMode("review");
  };

  const submitRating = async (quality) => {
    const card = cards[idx];
    try {
      await api.post("/api/vocab/review", { listId: card.listId, wordId: card.wordId, quality });
    } catch { /* silent */ }

    const next = idx + 1;
    setReviewed(r => r + 1);
    if (next >= cards.length) {
      setMode("done");
      fetchData();
    } else {
      setIdx(next);
      setFlipped(false);
    }
  };

  // ── Home ──────────────────────────────────────────────────────────────────
  if (mode === "home") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "24px", fontWeight: 900, color: col.text }}>📖 Flashcards</h2>
        <p style={{ margin: 0, fontSize: "14px", color: col.muted, fontWeight: 600 }}>
          {loading ? "Loading…" : totalDue > 0 ? `${totalDue} card${totalDue !== 1 ? "s" : ""} due for review today!` : "You're all caught up! 🎉"}
        </p>
        {totalDue > 0 && !loading && (
          <button onClick={startReview} style={{ marginTop: "16px", padding: "12px 28px", borderRadius: "14px", background: "linear-gradient(135deg,#f97316,#ec4899)", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: 900, boxShadow: "0 4px 14px rgba(249,115,22,0.4)", fontFamily: "inherit" }}>
            Start Review →
          </button>
        )}
      </div>

      {/* Per-list stats */}
      {!loading && stats.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: col.text }}>Your Word Lists</h3>
          {stats.map(s => {
            const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
            return (
              <div key={s.listId} style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "16px", padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 800, fontSize: "15px", color: col.text }}>{s.title}</span>
                  {s.due > 0 && (
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#f97316", background: "rgba(249,115,22,0.12)", padding: "3px 10px", borderRadius: "20px" }}>
                      {s.due} due
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
                  {[
                    { label: "Total",    val: s.total,    color: col.muted   },
                    { label: "Seen",     val: s.seen,     color: col.accent  },
                    { label: "Mastered", val: s.mastered, color: "#10b981"   },
                    { label: "New",      val: s.newCards, color: "#f59e0b"   },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "18px", fontWeight: 900, color: item.color }}>{item.val}</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: col.muted, textTransform: "uppercase" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                {/* Progress bar */}
                <div style={{ background: col.border, borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: "linear-gradient(90deg,#10b981,#34d399)", transition: "width 0.6s ease" }} />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: col.muted, fontWeight: 700 }}>{pct}% mastered</p>
              </div>
            );
          })}
        </div>
      )}

      {!loading && stats.length === 0 && (
        <div style={{ background: col.card, border: `2px dashed ${col.border}`, borderRadius: "16px", padding: "40px", textAlign: "center" }}>
          <p style={{ fontSize: "40px", margin: "0 0 12px" }}>📬</p>
          <p style={{ color: col.muted, fontWeight: 700, margin: 0 }}>No word lists assigned yet. Your teacher will add them soon!</p>
        </div>
      )}
    </div>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
  if (mode === "done") return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", gap: "16px", textAlign: "center" }}>
      <div style={{ fontSize: "72px" }}>🎉</div>
      <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 900, color: col.text }}>Session Complete!</h2>
      <p style={{ margin: 0, fontSize: "16px", color: col.muted, fontWeight: 600 }}>You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}. Great work!</p>
      <button onClick={() => setMode("home")} style={{ marginTop: "8px", padding: "12px 28px", borderRadius: "14px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: 900, fontFamily: "inherit" }}>
        Back to Home
      </button>
    </div>
  );

  // ── Review ────────────────────────────────────────────────────────────────
  const card = cards[idx];
  const progress = Math.round(((idx) / cards.length) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px", margin: "0 auto" }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, color: col.muted, marginBottom: "6px" }}>
          <span>{card?.listTitle}</span>
          <span>{idx + 1} / {cards.length}</span>
        </div>
        <div style={{ background: col.border, borderRadius: "999px", height: "8px", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: "999px", background: "linear-gradient(90deg,#6366f1,#8b5cf6)", transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Flash card */}
      <style>{`
        .fc-card { perspective: 1000px; cursor: pointer; }
        .fc-inner { position: relative; width: 100%; transition: transform 0.5s; transform-style: preserve-3d; }
        .fc-inner.flipped { transform: rotateY(180deg); }
        .fc-front, .fc-back { backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 24px; }
        .fc-back { transform: rotateY(180deg); position: absolute; top: 0; left: 0; width: 100%; }
      `}</style>

      <div className="fc-card" onClick={() => setFlipped(f => !f)} style={{ userSelect: "none" }}>
        <div className={`fc-inner${flipped ? " flipped" : ""}`} style={{ minHeight: "220px" }}>
          {/* Front */}
          <div className="fc-front" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", padding: "40px 32px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Word</p>
            <h2 style={{ margin: 0, fontSize: "36px", fontWeight: 900, color: "#fff" }}>{card?.word}</h2>
            <p style={{ margin: "20px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>Tap to reveal →</p>
          </div>
          {/* Back */}
          <div className="fc-back" style={{ background: col.card, border: `2px solid ${col.border}`, padding: "32px", minHeight: "220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "12px" }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Definition</p>
            <p style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: col.text, lineHeight: 1.4 }}>{card?.definition}</p>
            {card?.example && (
              <p style={{ margin: 0, fontSize: "14px", color: col.muted, fontStyle: "italic" }}>"{card.example}"</p>
            )}
          </div>
        </div>
      </div>

      {/* Rating buttons — only show after flip */}
      {flipped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <p style={{ margin: 0, textAlign: "center", fontSize: "13px", fontWeight: 700, color: col.muted }}>How well did you know it?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
            {[
              { q: 0, label: "😰 Forgot",   bg: "#ef4444", shadow: "rgba(239,68,68,0.35)"   },
              { q: 1, label: "😐 Hard",     bg: "#f97316", shadow: "rgba(249,115,22,0.35)"  },
              { q: 2, label: "🙂 Good",     bg: "#3b82f6", shadow: "rgba(59,130,246,0.35)"  },
              { q: 3, label: "😄 Easy",     bg: "#10b981", shadow: "rgba(16,185,129,0.35)"  },
            ].map(btn => (
              <button key={btn.q} onClick={() => submitRating(btn.q)} style={{ padding: "12px 6px", borderRadius: "14px", background: btn.bg, color: "#fff", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 800, boxShadow: `0 4px 14px ${btn.shadow}`, fontFamily: "inherit", lineHeight: 1.3 }}>
                {btn.label}
              </button>
            ))}
          </div>
          <p style={{ margin: 0, textAlign: "center", fontSize: "11px", color: col.muted }}>
            Forgot → see tomorrow · Easy → see in weeks
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, textAlign: "center", fontSize: "13px", color: col.muted, fontWeight: 600 }}>
          Tap the card to flip it, then rate how well you knew it.
        </p>
      )}
    </div>
  );
}
